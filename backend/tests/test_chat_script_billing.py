import asyncio
import json

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import joinedload, sessionmaker

from app import models
from app.db import Base
from app.errors import ApiError
from app.routers.ai import chat
from app.routers.scripts import ScriptParseIn, parse_project_script
from app.seed import seed_price_rules


class FakeRequest:
    def __init__(self, body, headers=None):
        self._body = body
        self.headers = headers or {}

    async def json(self):
        return self._body


@pytest.fixture
def engine(tmp_path):
    return create_engine(f"sqlite:///{tmp_path / 'chat.db'}", future=True, connect_args={"check_same_thread": False})


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
            list_all_projects=True,
            list_organization_projects=True,
        )
    )
    session.flush()
    user = models.User(role_id=3, username="emp", email="emp@x.com", credits=500)
    session.add(user)
    session.flush()
    org = models.Organization(name="Studio", created_by=user.id)
    session.add(org)
    session.flush()
    project = models.Project(organization_id=org.id, name="P", owner_id=user.id)
    session.add(project)
    seed_price_rules(session)
    session.commit()
    yield session
    session.close()


@pytest.fixture
def user(db):
    row = db.query(models.User).options(joinedload(models.User.role)).filter_by(email="emp@x.com").one()
    db.expunge(row)
    return row


@pytest.fixture
def project_id(db):
    return db.query(models.Project).filter_by(name="P").one().id


@pytest.fixture(autouse=True)
def patch_sessions(monkeypatch, Session):
    monkeypatch.setattr("app.billing_service.SessionLocal", Session)
    monkeypatch.setattr("app.routers.ai.SessionLocal", Session)
    monkeypatch.setattr("app.routers.scripts.SessionLocal", Session)
    monkeypatch.setattr("app.deps.SessionLocal", Session)


def _run(coro):
    return asyncio.run(coro)


def test_chat_no_key_503_when_billing(user, monkeypatch):
    monkeypatch.setattr("app.routers.ai.settings.billing_enabled", True)
    monkeypatch.setattr("app.routers.ai.settings.xai_api_key", "")
    monkeypatch.setattr("app.routers.ai.settings.openai_api_key", "")
    monkeypatch.setattr("app.routers.ai.settings.dashscope_api_key", "")
    monkeypatch.setattr("app.ai_media.settings.xai_api_key", "")
    monkeypatch.setattr("app.ai_media.settings.openai_api_key", "")
    monkeypatch.setattr("app.ai_media.settings.dashscope_api_key", "")
    with pytest.raises(ApiError) as exc:
        _run(chat(FakeRequest({"messages": [{"role": "user", "content": "hi"}]}), user=user))
    assert exc.value.http_status == 503


def test_chat_placeholder_when_allowed(user, monkeypatch):
    monkeypatch.setattr("app.routers.ai.settings.billing_enabled", False)
    monkeypatch.setattr("app.ai_media.settings.allow_placeholder", True)
    monkeypatch.setattr("app.ai_media.settings.billing_enabled", False)
    monkeypatch.setattr("app.ai_media.settings.xai_api_key", "")
    monkeypatch.setattr("app.ai_media.settings.openai_api_key", "")
    monkeypatch.setattr("app.ai_media.settings.dashscope_api_key", "")
    resp = _run(chat(FakeRequest({"messages": [{"role": "user", "content": "雨夜"}]}), user=user))
    data = json.loads(resp.body)
    assert "电影感" in data["data"]["choices"][0]["message"]["content"]


def test_chat_capture_qwen(user, db, monkeypatch):
    monkeypatch.setattr("app.routers.ai.settings.billing_enabled", True)
    monkeypatch.setattr("app.pricing.settings.xai_api_key", "")
    monkeypatch.setattr("app.pricing.settings.openai_api_key", "sk")
    monkeypatch.setattr("app.ai_media.settings.xai_api_key", "")
    monkeypatch.setattr("app.ai_media.settings.openai_api_key", "sk")
    monkeypatch.setattr("app.ai_media.settings.dashscope_api_key", "")

    async def fake_chat(messages, model):
        return "润色后的提示词"

    monkeypatch.setattr("app.routers.ai.dashscope_chat", fake_chat)
    resp = _run(
        chat(
            FakeRequest(
                {"messages": [{"role": "user", "content": "雨夜"}], "model": "qwen-plus"},
                headers={"Idempotency-Key": "chat-1"},
            ),
            user=user,
        )
    )
    data = json.loads(resp.body)
    assert data["data"]["billing"]["charged"] == 1
    db.expire_all()
    assert db.query(models.User).filter_by(email="emp@x.com").one().credits == 499


def test_script_heuristic_does_not_charge(user, db, project_id, monkeypatch):
    monkeypatch.setattr("app.routers.scripts.settings.billing_enabled", True)
    monkeypatch.setattr("app.ai_media.settings.xai_api_key", "")
    monkeypatch.setattr("app.ai_media.settings.openai_api_key", "")
    monkeypatch.setattr("app.ai_media.settings.dashscope_api_key", "")
    body = ScriptParseIn(text="角色A：你好。\n角色B：再见。", title="试")
    req = FakeRequest({}, headers={"Idempotency-Key": "script-h"})
    resp = _run(parse_project_script(project_id, body, req, user=user))
    data = json.loads(resp.body)
    assert data["code"] == 0
    assert "billing" not in data["data"]
    db.expire_all()
    assert db.query(models.User).filter_by(email="emp@x.com").one().credits == 500


def test_script_llm_success_charges(user, db, project_id, monkeypatch):
    monkeypatch.setattr("app.routers.scripts.settings.billing_enabled", True)
    monkeypatch.setattr("app.pricing.settings.xai_api_key", "")
    monkeypatch.setattr("app.pricing.settings.openai_api_key", "sk")
    monkeypatch.setattr("app.ai_media.settings.xai_api_key", "")
    monkeypatch.setattr("app.ai_media.settings.openai_api_key", "sk")

    async def fake_llm(messages, model=None, timeout=180, fail_on_error=False):
        return (
            json.dumps(
                {
                    "title": "试",
                    "plot": {"summary": "故事", "logline": "", "themes": [], "tone": ""},
                    "characters": [{"name": "A"}],
                    "scenes": [],
                    "props": [],
                    "episodes": [{"index": 1, "name": "第01集", "summary": "角色A：你好。"}],
                }
            ),
            "qwen-plus",
        )

    monkeypatch.setattr("app.routers.scripts.llm_complete", fake_llm)
    body = ScriptParseIn(text="角色A：你好。", title="试")
    req = FakeRequest({}, headers={"Idempotency-Key": "script-ok"})
    resp = _run(parse_project_script(project_id, body, req, user=user))
    data = json.loads(resp.body)
    assert data["data"]["billing"]["charged"] == 4
    db.expire_all()
    assert db.query(models.User).filter_by(email="emp@x.com").one().credits == 496


def test_script_invalid_json_releases(user, db, project_id, monkeypatch):
    monkeypatch.setattr("app.routers.scripts.settings.billing_enabled", True)
    monkeypatch.setattr("app.pricing.settings.openai_api_key", "sk")
    monkeypatch.setattr("app.pricing.settings.xai_api_key", "")
    monkeypatch.setattr("app.ai_media.settings.openai_api_key", "sk")
    monkeypatch.setattr("app.ai_media.settings.xai_api_key", "")

    async def fake_llm(messages, model=None, timeout=180, fail_on_error=False):
        return ("not-json", "qwen-plus")

    monkeypatch.setattr("app.routers.scripts.llm_complete", fake_llm)
    body = ScriptParseIn(text="角色A：你好。", title="试")
    req = FakeRequest({}, headers={"Idempotency-Key": "script-bad"})
    resp = _run(parse_project_script(project_id, body, req, user=user))
    data = json.loads(resp.body)
    assert "billing" not in data["data"]
    db.expire_all()
    assert db.query(models.User).filter_by(email="emp@x.com").one().credits == 500
    row = db.query(models.BillingReservation).filter_by(idempotency_key="script-bad").one()
    assert row.status == "refunded"
