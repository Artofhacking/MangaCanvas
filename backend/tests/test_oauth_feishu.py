from types import SimpleNamespace
from unittest.mock import patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base
from app import models
from app.errors import ApiError
from app.oauth import (
    FeishuProfile,
    allowed_frontend_origin,
    build_feishu_authorize_url,
    complete_feishu_login,
    feishu_callback_uri,
    login_redirect,
    make_state,
    make_ticket,
    parse_feishu_profile,
    parse_state,
    parse_ticket,
    pkce_pair,
    resolve_frontend_origin,
    upsert_feishu_user,
)


def test_allowed_origin_accepts_localhost_and_rejects_unknown():
    assert allowed_frontend_origin("http://localhost:5174") == "http://localhost:5174"
    assert allowed_frontend_origin("http://localhost:5174/api/v1/auth/oauth/feishu/callback") == "http://localhost:5174"
    assert allowed_frontend_origin("http://47.104.138.144:18999") == "http://47.104.138.144:18999"
    assert allowed_frontend_origin("https://evil.example") is None


def test_resolve_frontend_origin_prefers_redirect_uri():
    origin = resolve_frontend_origin(
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5174/login",
    )
    assert origin == "http://localhost:5174"


def test_state_and_ticket_roundtrip():
    verifier, _challenge = pkce_pair()
    state = make_state(
        provider="feishu",
        frontend_origin="http://localhost:5174",
        redirect_uri="http://localhost:5174/api/v1/auth/oauth/feishu/callback",
        code_verifier=verifier,
    )
    payload = parse_state(state, "feishu")
    assert payload["code_verifier"] == verifier
    ticket = make_ticket(42)
    assert parse_ticket(ticket) == 42


def test_parse_state_rejects_wrong_provider():
    verifier, _challenge = pkce_pair()
    state = make_state(
        provider="feishu",
        frontend_origin="http://localhost:5174",
        redirect_uri="http://localhost:5174/api/v1/auth/oauth/feishu/callback",
        code_verifier=verifier,
    )
    with pytest.raises(ApiError):
        parse_state(state, "github")


def test_authorize_url_contains_pkce_and_callback():
    with patch("app.oauth.settings", SimpleNamespace(feishu_app_id="cli_test", jwt_secret="secret")):
        url = build_feishu_authorize_url(
            redirect_uri="http://localhost:5174/api/v1/auth/oauth/feishu/callback",
            state="abc",
            code_challenge="challenge",
        )
    assert "client_id=cli_test" in url
    assert "code_challenge=challenge" in url
    assert "code_challenge_method=S256" in url
    assert "redirect_uri=http" in url


def test_login_redirect_and_callback_path():
    assert feishu_callback_uri("http://localhost:5174") == "http://localhost:5174/api/v1/auth/oauth/feishu/callback"
    assert login_redirect("http://localhost:5174", ticket="tok") == "http://localhost:5174/#/login?ticket=tok"


def test_parse_feishu_profile_prefers_enterprise_email():
    profile = parse_feishu_profile(
        {
            "union_id": "on_123",
            "open_id": "ou_abc",
            "name": "高上",
            "email": "personal@example.com",
            "enterprise_email": "phosa@corp.com",
            "avatar_url": "https://img.example/a.png",
        }
    )
    assert profile.email == "phosa@corp.com"
    assert profile.union_id == "on_123"
    assert profile.name == "高上"


def _session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    db = Session()
    db.add(
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
    db.commit()
    return db


def test_upsert_creates_user_then_reuses_identity(monkeypatch):
    monkeypatch.setattr("app.oauth.settings.allow_registration", True)
    db = _session()
    profile = FeishuProfile(
        union_id="on_reuse",
        open_id="ou_reuse",
        name="飞书甲",
        email="a@example.com",
        avatar="https://img.example/a.png",
    )
    created = upsert_feishu_user(db, profile)
    again = upsert_feishu_user(db, profile)
    assert created.id == again.id
    assert db.query(models.User).count() == 1
    assert db.query(models.OauthIdentity).count() == 1
    db.close()


def test_upsert_binds_existing_email_account():
    db = _session()
    existing = models.User(
        role_id=3,
        username="local_user",
        email="same@example.com",
        password_hash="x",
        credits=0,
    )
    db.add(existing)
    db.commit()
    profile = FeishuProfile(
        union_id="on_bind",
        open_id="ou_bind",
        name="飞书乙",
        email="same@example.com",
        avatar=None,
    )
    user = upsert_feishu_user(db, profile)
    assert user.id == existing.id
    assert user.username == "local_user"
    assert db.query(models.OauthIdentity).filter_by(provider="feishu", provider_user_id="on_bind").first()
    db.close()


def test_complete_feishu_login_exchanges_code(monkeypatch):
    monkeypatch.setattr("app.oauth.settings.allow_registration", True)
    db = _session()
    monkeypatch.setattr("app.oauth.feishu_enabled", lambda: True)
    monkeypatch.setattr(
        "app.oauth.exchange_feishu_code",
        lambda **_kwargs: "user-access-token",
    )
    monkeypatch.setattr(
        "app.oauth.fetch_feishu_user",
        lambda _token: FeishuProfile(
            union_id="on_login",
            open_id="ou_login",
            name="登录用户",
            email="login@example.com",
            avatar=None,
        ),
    )
    verifier, _challenge = pkce_pair()
    state = make_state(
        provider="feishu",
        frontend_origin="http://localhost:5174",
        redirect_uri="http://localhost:5174/api/v1/auth/oauth/feishu/callback",
        code_verifier=verifier,
    )
    user = complete_feishu_login(db, code="auth-code", state=state)
    assert user.email == "login@example.com"
    assert user.password_hash is None
    db.close()


def test_upsert_rejects_new_user_when_registration_closed(monkeypatch):
    monkeypatch.setattr("app.oauth.settings.allow_registration", False)
    db = _session()
    profile = FeishuProfile(
        union_id="on_closed",
        open_id="ou_closed",
        name="新用户",
        email="new@example.com",
        avatar=None,
    )
    with pytest.raises(ApiError) as exc:
        upsert_feishu_user(db, profile)
    assert exc.value.code == 2003
    assert exc.value.http_status == 403
    assert db.query(models.User).count() == 0
    db.close()
