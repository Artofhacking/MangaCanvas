import asyncio

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import models
from app.db import Base
from app.errors import ApiError
from app.routers.ai import images
from app.seed import seed_price_rules


class FakeRequest:
    def __init__(self, body, headers=None):
        self._body = body
        self.headers = headers or {}

    async def json(self):
        return self._body


@pytest.fixture
def engine(tmp_path):
    return create_engine(f"sqlite:///{tmp_path / 'img.db'}", future=True, connect_args={"check_same_thread": False})


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
    session.add(models.User(role_id=3, username="emp", email="emp@x.com", credits=1000))
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
    monkeypatch.setattr("app.deps.SessionLocal", Session)


def _run(coro):
    return asyncio.run(coro)


def test_n_out_of_range(user):
    with pytest.raises(ApiError) as exc:
        _run(images(FakeRequest({"n": 5, "prompt": "x"}), user=user))
    assert exc.value.code == 1001


def test_wan_n_gt_one(user):
    with pytest.raises(ApiError) as exc:
        _run(images(FakeRequest({"model": "wan2.7-image", "n": 2, "prompt": "x"}), user=user))
    assert exc.value.code == 1001


def test_no_key_returns_503(user, monkeypatch):
    monkeypatch.setattr("app.routers.ai.settings.openai_api_key", "")
    monkeypatch.setattr("app.routers.ai.settings.dashscope_api_key", "")
    monkeypatch.setattr("app.routers.ai.settings.allow_placeholder", False)
    monkeypatch.setattr("app.routers.ai.settings.billing_enabled", False)
    with pytest.raises(ApiError) as exc:
        _run(images(FakeRequest({"prompt": "x"}), user=user))
    assert exc.value.code == 3001
    assert exc.value.http_status == 503


def test_placeholder_when_allowed(user, monkeypatch):
    monkeypatch.setattr("app.routers.ai.settings.openai_api_key", "")
    monkeypatch.setattr("app.routers.ai.settings.dashscope_api_key", "")
    monkeypatch.setattr("app.routers.ai.settings.allow_placeholder", True)
    monkeypatch.setattr("app.routers.ai.settings.billing_enabled", False)
    resp = _run(images(FakeRequest({"prompt": "x"}), user=user))
    payload = resp.body
    import json

    data = json.loads(payload)
    assert data["code"] == 0
    assert "placeholder" in data["data"]["data"][0]["url"]


def test_billing_capture_on_success(user, db, monkeypatch):
    monkeypatch.setattr("app.routers.ai.settings.openai_api_key", "sk-test")
    monkeypatch.setattr("app.routers.ai.settings.dashscope_api_key", "")
    monkeypatch.setattr("app.routers.ai.settings.billing_enabled", True)
    monkeypatch.setattr("app.routers.ai.settings.allow_placeholder", False)

    async def fake_gen(**kwargs):
        return {"data": [{"url": "/static/uploads/generated/ok.png"}]}

    monkeypatch.setattr("app.routers.ai.openai_image_generate", fake_gen)
    resp = _run(
        images(
            FakeRequest({"model": "gpt-image-2", "prompt": "cat"}, headers={"Idempotency-Key": "img-1"}),
            user=user,
        )
    )
    import json

    data = json.loads(resp.body)
    assert data["code"] == 0
    billing = data["data"]["billing"]
    assert billing["charged"] == 39
    assert billing["replayed"] is False
    db.expire_all()
    assert db.query(models.User).filter_by(email="emp@x.com").one().credits == 961


def test_persist_failure_releases(user, db, monkeypatch):
    monkeypatch.setattr("app.routers.ai.settings.openai_api_key", "sk-test")
    monkeypatch.setattr("app.routers.ai.settings.billing_enabled", True)

    async def fake_gen(**kwargs):
        return {"data": [{"url": "https://cdn.example/a.png"}]}

    async def boom(url):
        raise ApiError(3001, "persist fail", 502)

    monkeypatch.setattr("app.routers.ai.openai_image_generate", fake_gen)
    monkeypatch.setattr("app.routers.ai.persist_remote_url", boom)
    with pytest.raises(ApiError) as exc:
        _run(
            images(
                FakeRequest({"model": "gpt-image-2", "prompt": "cat"}, headers={"Idempotency-Key": "img-fail"}),
                user=user,
            )
        )
    assert exc.value.code == 3001
    db.expire_all()
    assert db.query(models.User).filter_by(email="emp@x.com").one().credits == 1000
    row = db.query(models.BillingReservation).filter_by(idempotency_key="img-fail").one()
    assert row.status == "refunded"


def test_detached_user_releases_pool(engine, Session, db, monkeypatch):
    from app.deps import current_user_detached
    from app.security import create_access_token

    emp = db.query(models.User).filter_by(email="emp@x.com").one()
    token = create_access_token(emp.id)
    monkeypatch.setattr("app.deps.SessionLocal", Session)
    held = engine.pool.checkedout()
    user = current_user_detached(authorization=f"Bearer {token}")
    assert user.id == emp.id
    assert engine.pool.checkedout() == held
