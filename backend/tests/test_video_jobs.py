import asyncio
import json

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import models, video_jobs
from app.db import Base
from app.errors import ApiError
from app.routers.ai import video_generation_status, videos
from app.seed import seed_price_rules


class FakeRequest:
    def __init__(self, body, headers=None):
        self._body = body
        self.headers = headers or {}

    async def json(self):
        return self._body


@pytest.fixture
def engine(tmp_path):
    return create_engine(f"sqlite:///{tmp_path / 'jobs.db'}", future=True, connect_args={"check_same_thread": False})


@pytest.fixture
def Session(engine):
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


@pytest.fixture
def db(Session):
    session = Session()
    session.add(
        models.Role(
            id=3,
            code="employee",
            name="员工",
            can_create_organization=False,
            can_create_project=True,
            can_manage_project_members=False,
            list_all_projects=False,
            list_organization_projects=False,
        )
    )
    session.flush()
    session.add(models.User(role_id=3, username="emp", email="emp@x.com", credits=2000))
    seed_price_rules(session)
    session.commit()
    yield session
    session.close()


@pytest.fixture
def user(db):
    row = db.query(models.User).filter_by(email="emp@x.com").one()
    db.expunge(row)
    return row


@pytest.fixture(autouse=True)
def patch_sessions(monkeypatch, Session):
    monkeypatch.setattr("app.billing_service.SessionLocal", Session)
    monkeypatch.setattr("app.routers.ai.SessionLocal", Session)
    monkeypatch.setattr("app.video_jobs.SessionLocal", Session)
    monkeypatch.setattr("app.routers.ai.settings.openai_api_key", "sk-test")
    monkeypatch.setattr("app.routers.ai.settings.billing_enabled", True)


def _run(coro):
    return asyncio.run(coro)


def _data(resp):
    return json.loads(resp.body)["data"]


def _body(node_id, key, prompt="run", batch=None):
    payload = {
        "model": "happyhorse-1.1-t2v",
        "prompt": prompt,
        "duration": 5,
        "resolution": "720P",
        "size": "1280*720",
        "nodeId": node_id,
    }
    if batch:
        payload["batchId"] = batch
    return FakeRequest(payload, headers={"Idempotency-Key": key})


def test_upstream_failure_marks_job_failed(user, db, monkeypatch):
    async def boom(**kwargs):
        raise ApiError(3001, "上游拒绝", 502)

    monkeypatch.setattr("app.routers.ai.openai_video_generate", boom)
    submitted = _data(_run(videos(_body("node-a", "fail-1"), user=user)))
    assert submitted["status"] == "queued"
    _run(video_jobs.drain())
    done = _data(_run(video_generation_status(submitted["job_id"], user=user)))
    assert done["status"] == "failed"
    assert done["message"] == "上游拒绝"
    assert "url" not in done
    db.expire_all()
    assert db.query(models.User).filter_by(email="emp@x.com").one().credits == 2000


def test_job_is_private(user, monkeypatch):
    async def fake_gen(**kwargs):
        return "https://cdn.example/v.mp4"

    async def fake_persist(url):
        return "/static/uploads/v.mp4"

    monkeypatch.setattr("app.routers.ai.openai_video_generate", fake_gen)
    monkeypatch.setattr("app.routers.ai.persist_remote_url", fake_persist)
    submitted = _data(_run(videos(_body("node-a", "priv-1"), user=user)))

    class Other:
        id = user.id + 99

    with pytest.raises(ApiError) as exc:
        _run(video_generation_status(submitted["job_id"], user=Other()))
    assert exc.value.http_status == 404


def test_same_node_supersedes_previous_job(user, db, monkeypatch):
    release = asyncio.Event()
    started = asyncio.Event()

    async def fake_gen(**kwargs):
        started.set()
        await release.wait()
        return "https://cdn.example/v.mp4"

    async def fake_persist(url):
        return "/static/uploads/v.mp4"

    monkeypatch.setattr("app.routers.ai.openai_video_generate", fake_gen)
    monkeypatch.setattr("app.routers.ai.persist_remote_url", fake_persist)

    async def scenario():
        first = _data(await videos(_body("node-a", "same-1"), user=user))
        runner = asyncio.create_task(video_jobs.drain())
        await asyncio.wait_for(started.wait(), timeout=2)
        second = _data(await videos(_body("node-a", "same-2", prompt="again"), user=user))
        assert second["job_id"] != first["job_id"]
        assert second["status"] == "queued"
        cancelled = None
        for _ in range(40):
            cancelled = _data(await video_generation_status(first["job_id"], user=user))
            if cancelled["status"] == "cancelled":
                break
            await asyncio.sleep(0.05)
        assert cancelled["status"] == "cancelled"
        release.set()
        await runner
        done = _data(await video_generation_status(second["job_id"], user=user))
        assert done["status"] == "succeeded"
        assert done["url"] == "/static/uploads/v.mp4"

    _run(scenario())
    db.expire_all()
    assert db.query(models.User).filter_by(email="emp@x.com").one().credits == 1400
    assert db.query(models.BillingLedger).filter_by(entry_type="consume").count() == 1


def test_same_batch_keeps_sibling_jobs(user, db, monkeypatch):
    async def fake_gen(**kwargs):
        return "https://cdn.example/v.mp4"

    async def fake_persist(url):
        return "/static/uploads/v.mp4"

    monkeypatch.setattr("app.routers.ai.openai_video_generate", fake_gen)
    monkeypatch.setattr("app.routers.ai.persist_remote_url", fake_persist)

    async def scenario():
        first = _data(await videos(_body("node-a", "batch-1", prompt="one", batch="stack-a"), user=user))
        second = _data(await videos(_body("node-a", "batch-2", prompt="two", batch="stack-a"), user=user))
        assert _data(await video_generation_status(first["job_id"], user=user))["status"] == "queued"
        assert _data(await video_generation_status(second["job_id"], user=user))["status"] == "queued"
        third = _data(await videos(_body("node-a", "batch-3", prompt="three", batch="stack-b"), user=user))
        assert _data(await video_generation_status(first["job_id"], user=user))["status"] == "cancelled"
        assert _data(await video_generation_status(second["job_id"], user=user))["status"] == "cancelled"
        assert third["status"] == "queued"
        await video_jobs.drain()
        done = _data(await video_generation_status(third["job_id"], user=user))
        assert done["status"] == "succeeded"
        assert done["url"] == "/static/uploads/v.mp4"

    _run(scenario())
    db.expire_all()
    # Two superseded holds are released. Only the new batch is captured.
    assert db.query(models.User).filter_by(email="emp@x.com").one().credits == 1400
    assert db.query(models.BillingLedger).filter_by(entry_type="consume").count() == 1


def test_different_nodes_run_together(user, monkeypatch):
    release = asyncio.Event()
    started = []

    async def fake_gen(**kwargs):
        started.append(kwargs["prompt"])
        await release.wait()
        return "https://cdn.example/v.mp4"

    async def fake_persist(url):
        return "/static/uploads/v.mp4"

    monkeypatch.setattr("app.video_jobs.settings.video_job_max_running_per_user", 2)
    monkeypatch.setattr("app.routers.ai.openai_video_generate", fake_gen)
    monkeypatch.setattr("app.routers.ai.persist_remote_url", fake_persist)

    async def scenario():
        first = _data(await videos(_body("node-a", "ov-1", prompt="one"), user=user))
        second = _data(await videos(_body("node-b", "ov-2", prompt="two"), user=user))
        runner = asyncio.create_task(video_jobs.drain())
        for _ in range(50):
            if len(started) >= 2:
                break
            await asyncio.sleep(0.02)
        assert sorted(started) == ["one", "two"]
        assert _data(await video_generation_status(first["job_id"], user=user))["status"] == "running"
        assert _data(await video_generation_status(second["job_id"], user=user))["status"] == "running"
        release.set()
        await runner

    _run(scenario())


def test_different_nodes_overlap_and_cap_queues(user, monkeypatch):
    release = asyncio.Event()
    started = []

    async def fake_gen(**kwargs):
        started.append(kwargs["prompt"])
        await release.wait()
        return "https://cdn.example/v.mp4"

    async def fake_persist(url):
        return "/static/uploads/v.mp4"

    monkeypatch.setattr("app.video_jobs.settings.video_job_max_running_per_user", 1)
    monkeypatch.setattr("app.routers.ai.openai_video_generate", fake_gen)
    monkeypatch.setattr("app.routers.ai.persist_remote_url", fake_persist)

    async def scenario():
        first = _data(await videos(_body("node-a", "cap-1", prompt="one"), user=user))
        second = _data(await videos(_body("node-b", "cap-2", prompt="two"), user=user))
        runner = asyncio.create_task(video_jobs.drain())
        for _ in range(50):
            if started:
                break
            await asyncio.sleep(0.02)
        assert started == ["one"]
        running = _data(await video_generation_status(first["job_id"], user=user))
        queued = _data(await video_generation_status(second["job_id"], user=user))
        assert running["status"] == "running"
        assert queued["status"] == "queued"
        assert "排队" in (queued["message"] or "")
        release.set()
        await runner
        assert _data(await video_generation_status(first["job_id"], user=user))["status"] == "succeeded"
        assert _data(await video_generation_status(second["job_id"], user=user))["status"] == "succeeded"
        assert started == ["one", "two"]

    _run(scenario())
