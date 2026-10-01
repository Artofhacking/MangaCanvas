import asyncio
import json

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import models
from app.db import Base
from app.errors import ApiError
from app import video_jobs
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
    return create_engine(f"sqlite:///{tmp_path / 'vid.db'}", future=True, connect_args={"check_same_thread": False})


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
    monkeypatch.setattr("app.deps.SessionLocal", Session)


def _data(resp):
    return json.loads(resp.body)["data"]


def _finish(job_id, user):
    _run(video_jobs.drain())
    return _data(_run(video_generation_status(job_id, user=user)))


def _run(coro):
    return asyncio.run(coro)


def test_happyhorse_illegal_duration(user, monkeypatch):
    monkeypatch.setattr("app.routers.ai.settings.openai_api_key", "sk-test")
    with pytest.raises(ApiError) as exc:
        _run(videos(FakeRequest({"model": "happyhorse-1.1-t2v", "duration": 12, "prompt": "x"}), user=user))
    assert exc.value.code == 1001


def test_channel_disabled_before_reserve(user, db, monkeypatch):
    monkeypatch.setattr("app.routers.ai.settings.billing_enabled", True)
    monkeypatch.setattr("app.routers.ai.settings.baidu_enabled", False)
    monkeypatch.setattr("app.routers.ai.settings.openai_api_key", "")
    monkeypatch.setattr("app.routers.ai.settings.dashscope_api_key", "")
    with pytest.raises(ApiError) as exc:
        _run(
            videos(
                FakeRequest({"model": "doubao-seedance-2-0-260128", "duration": 5, "prompt": "x"}),
                user=user,
            )
        )
    assert exc.value.http_status == 503
    db.expire_all()
    assert db.query(models.User).filter_by(email="emp@x.com").one().credits == 2000


def test_video_capture_on_success(user, db, monkeypatch):
    monkeypatch.setattr("app.routers.ai.settings.openai_api_key", "sk-test")
    monkeypatch.setattr("app.routers.ai.settings.billing_enabled", True)

    calls = {"n": 0}

    async def fake_gen(**kwargs):
        calls["n"] += 1
        return "https://cdn.example/v.mp4"

    async def fake_persist(url):
        return "/static/uploads/generated/v.mp4"

    monkeypatch.setattr("app.routers.ai.openai_video_generate", fake_gen)
    monkeypatch.setattr("app.routers.ai.persist_remote_url", fake_persist)
    resp = _run(
        videos(
            FakeRequest(
                {
                    "model": "happyhorse-1.1-t2v",
                    "prompt": "run",
                    "duration": 5,
                    "resolution": "720P",
                    "size": "1280*720",
                },
                headers={"Idempotency-Key": "vid-1"},
            ),
            user=user,
        )
    )
    data = json.loads(resp.body)
    assert data["code"] == 0
    assert calls["n"] == 0
    assert data["data"]["status"] == "queued"
    assert data["data"]["job_id"]
    assert "url" not in data["data"]
    db.expire_all()
    assert db.query(models.User).filter_by(email="emp@x.com").one().credits == 1400
    assert db.query(models.BillingLedger).count() == 0

    done = _finish(data["data"]["job_id"], user)
    assert calls["n"] == 1
    assert done["status"] == "succeeded"
    assert done["url"] == "/static/uploads/generated/v.mp4"
    assert done["billing"]["charged"] == 600
    db.expire_all()
    assert db.query(models.User).filter_by(email="emp@x.com").one().credits == 1400
    assert db.query(models.BillingLedger).filter_by(entry_type="consume").count() == 1

    again = _data(
        _run(
            videos(
                FakeRequest(
                    {
                        "model": "happyhorse-1.1-t2v",
                        "prompt": "run",
                        "duration": 5,
                        "resolution": "720P",
                        "size": "1280*720",
                    },
                    headers={"Idempotency-Key": "vid-1"},
                ),
                user=user,
            )
        )
    )
    assert again["job_id"] == data["data"]["job_id"]
    assert again["status"] == "succeeded"
    db.expire_all()
    assert db.query(models.BillingLedger).filter_by(entry_type="consume").count() == 1


def test_r2v_and_persist_failure_releases(user, db, monkeypatch):
    monkeypatch.setattr("app.routers.ai.settings.openai_api_key", "sk-test")
    monkeypatch.setattr("app.routers.ai.settings.billing_enabled", True)

    async def fake_gen(**kwargs):
        return "https://cdn.example/v.mp4"

    async def boom(url):
        raise ApiError(3001, "persist fail", 502)

    monkeypatch.setattr("app.routers.ai.openai_video_generate", fake_gen)
    monkeypatch.setattr("app.routers.ai.persist_remote_url", boom)
    submitted = _data(
        _run(
            videos(
                FakeRequest(
                    {
                        "model": "happyhorse-1.1-r2v",
                        "prompt": "run",
                        "duration": 5,
                        "resolution": "720P",
                        "images": ["https://a", "https://b"],
                    },
                    headers={"Idempotency-Key": "vid-fail"},
                ),
                user=user,
            )
        )
    )
    assert submitted["status"] == "queued"
    done = _finish(submitted["job_id"], user)
    assert done["status"] == "failed"
    assert "persist fail" in (done["message"] or "")
    db.expire_all()
    assert db.query(models.User).filter_by(email="emp@x.com").one().credits == 2000
    row = db.query(models.BillingReservation).filter_by(idempotency_key="vid-fail").one()
    assert row.status == "refunded"
    assert row.model_id == "happyhorse-1.1-i2v"
    assert "r2v" not in row.model_id


def test_seedance_rejected_when_baidu_off_even_with_nexcor(user, db, monkeypatch):
    monkeypatch.setattr("app.routers.ai.settings.openai_api_key", "sk-test")
    monkeypatch.setattr("app.routers.ai.settings.baidu_enabled", False)
    monkeypatch.setattr("app.routers.ai.settings.baidu_api_key", "")
    monkeypatch.setattr("app.routers.ai.settings.billing_enabled", True)

    async def fake_openai(**kwargs):
        raise AssertionError("Seedance must not fall back to nexcor")

    monkeypatch.setattr("app.routers.ai.openai_video_generate", fake_openai)
    with pytest.raises(ApiError) as exc:
        _run(
            videos(
                FakeRequest({"model": "doubao-seedance-2-0-260128", "duration": 5, "prompt": "x"}),
                user=user,
            )
        )
    assert exc.value.http_status == 503
    db.expire_all()
    assert db.query(models.User).filter_by(email="emp@x.com").one().credits == 2000


def test_seedance_uses_baidu_when_enabled(user, monkeypatch):
    monkeypatch.setattr("app.routers.ai.settings.openai_api_key", "sk-test")
    monkeypatch.setattr("app.routers.ai.settings.baidu_enabled", True)
    monkeypatch.setattr("app.routers.ai.settings.baidu_api_key", "baidu-test")
    seen = {}

    async def fake_baidu(**kwargs):
        seen.update(kwargs)
        return "https://cdn.example/s.mp4"

    async def fake_openai(**kwargs):
        raise AssertionError("Seedance generate prefers Baidu over nexcor")

    async def fake_persist(url):
        return "/static/uploads/generated/s.mp4"

    monkeypatch.setattr("app.routers.ai.baidu_video_generate", fake_baidu)
    monkeypatch.setattr("app.routers.ai.openai_video_generate", fake_openai)
    monkeypatch.setattr("app.routers.ai.persist_remote_url", fake_persist)
    resp = _run(
        videos(
            FakeRequest(
                {
                    "model": "doubao-seedance-2-0-260128",
                    "prompt": "run",
                    "duration": 5,
                    "resolution": "720P",
                    "size": "1280*720",
                }
            ),
            user=user,
        )
    )
    data = json.loads(resp.body)
    assert data["code"] == 0
    assert data["data"]["status"] == "queued"
    assert seen == {}
    done = _finish(data["data"]["job_id"], user)
    assert done["status"] == "succeeded"
    assert done["url"].endswith("s.mp4")
    assert seen["model"] == "doubao-seedance-2-0-260128"


def test_template_requires_first_frame(user, monkeypatch):
    monkeypatch.setattr("app.routers.ai.settings.openai_api_key", "sk-test")
    with pytest.raises(ApiError) as exc:
        _run(videos(FakeRequest({"template": "hug", "prompt": "x"}), user=user))
    assert exc.value.code == 3001
