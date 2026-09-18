from __future__ import annotations

import base64
import hashlib
import re
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from urllib.parse import quote as urlquote
from urllib.parse import urlencode, urlparse

import httpx
import jwt
from sqlalchemy.orm import Session

from . import models
from .config import settings
from .errors import fail
from .security import require_open_registration
from .util import now

FEISHU_AUTHORIZE_URL = "https://accounts.feishu.cn/open-apis/authen/v1/authorize"
FEISHU_TOKEN_URL = "https://open.feishu.cn/open-apis/authen/v2/oauth/token"
FEISHU_USER_INFO_URL = "https://open.feishu.cn/open-apis/authen/v1/user_info"
FEISHU_CALLBACK_PATH = "/api/v1/auth/oauth/feishu/callback"
SUPPORTED_PROVIDERS = {"feishu"}
PLACEHOLDER_EMAIL_DOMAIN = "users.noreply.mangacanvas.local"
STATE_TTL = timedelta(minutes=10)
TICKET_TTL = timedelta(minutes=2)


@dataclass(frozen=True)
class FeishuProfile:
    union_id: str
    open_id: str
    name: str
    email: str | None
    avatar: str | None


def feishu_enabled() -> bool:
    return bool(settings.feishu_app_id and settings.feishu_app_secret)


def redirect_origins() -> set[str]:
    raw = settings.feishu_redirect_origins or ""
    origins = {item.strip().rstrip("/") for item in raw.split(",") if item.strip()}
    origins.update(
        {
            "http://localhost:5174",
            "http://127.0.0.1:5174",
            "http://localhost:4173",
            "http://127.0.0.1:4173",
            "http://47.104.138.144:18999",
        }
    )
    return origins


def origin_from_url(value: str | None) -> str | None:
    if not value:
        return None
    parsed = urlparse(value.strip())
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        return None
    return f"{parsed.scheme}://{parsed.netloc}"


def allowed_frontend_origin(value: str | None) -> str | None:
    origin = origin_from_url(value) or (value.strip().rstrip("/") if value else None)
    if not origin:
        return None
    if origin_from_url(origin) not in redirect_origins() and origin not in redirect_origins():
        return None
    return origin_from_url(origin) or origin


def resolve_frontend_origin(
    redirect_uri: str | None = None,
    origin_header: str | None = None,
    referer: str | None = None,
) -> str:
    for candidate in (redirect_uri, origin_header, referer):
        origin = allowed_frontend_origin(candidate)
        if origin:
            return origin
    fail(1001, "回调地址未授权", 400)
    raise RuntimeError("unreachable")


def feishu_callback_uri(frontend_origin: str) -> str:
    return f"{frontend_origin.rstrip('/')}{FEISHU_CALLBACK_PATH}"


def pkce_pair() -> tuple[str, str]:
    verifier = secrets.token_urlsafe(64)
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
    return verifier, challenge


def make_state(*, provider: str, frontend_origin: str, redirect_uri: str, code_verifier: str) -> str:
    payload = {
        "typ": "oauth_state",
        "provider": provider,
        "frontend_origin": frontend_origin,
        "redirect_uri": redirect_uri,
        "code_verifier": code_verifier,
        "nonce": secrets.token_urlsafe(12),
        "exp": datetime.now(timezone.utc) + STATE_TTL,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def parse_state(state: str | None, provider: str) -> dict:
    if not state:
        fail(1001, "缺少 state", 400)
    try:
        payload = jwt.decode(state, settings.jwt_secret, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        fail(1001, "授权已过期，请重新登录", 400)
    except jwt.InvalidTokenError:
        fail(1001, "无效的 state，请重新授权", 400)
    if payload.get("typ") != "oauth_state" or payload.get("provider") != provider:
        fail(1001, "无效的 state，请重新授权", 400)
    if not payload.get("redirect_uri") or not payload.get("code_verifier"):
        fail(1001, "无效的 state，请重新授权", 400)
    return payload


def make_ticket(user_id: int) -> str:
    payload = {
        "typ": "oauth_ticket",
        "sub": str(user_id),
        "jti": secrets.token_urlsafe(12),
        "exp": datetime.now(timezone.utc) + TICKET_TTL,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def parse_ticket(ticket: str) -> int:
    if not ticket:
        fail(1001, "缺少 ticket", 400)
    try:
        payload = jwt.decode(ticket, settings.jwt_secret, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        fail(1001, "登录凭证已过期，请重新授权", 401)
    except jwt.InvalidTokenError:
        fail(1001, "无效的登录凭证", 401)
    if payload.get("typ") != "oauth_ticket":
        fail(1001, "无效的登录凭证", 401)
    try:
        return int(payload["sub"])
    except (KeyError, TypeError, ValueError):
        fail(1001, "无效的登录凭证", 401)
        raise RuntimeError("unreachable")


def build_feishu_authorize_url(*, redirect_uri: str, state: str, code_challenge: str) -> str:
    query = urlencode(
        {
            "client_id": settings.feishu_app_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "state": state,
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
            "scope": "auth:user.id:read",
        }
    )
    return f"{FEISHU_AUTHORIZE_URL}?{query}"


def login_redirect(frontend_origin: str, **params: str) -> str:
    query = urlencode({key: value for key, value in params.items() if value}, quote_via=urlquote)
    suffix = f"?{query}" if query else ""
    return f"{frontend_origin.rstrip('/')}/#/login{suffix}"


def _unique_username(db: Session, base: str) -> str:
    cleaned = re.sub(r"\s+", "", (base or "").strip())
    cleaned = cleaned[:48] or "feishu_user"
    candidate = cleaned
    n = 1
    while db.query(models.User).filter_by(username=candidate).first():
        n += 1
        suffix = f"_{n}"
        candidate = f"{cleaned[: 64 - len(suffix)]}{suffix}"
    return candidate


def _placeholder_email(union_id: str) -> str:
    token = re.sub(r"[^a-zA-Z0-9_-]", "", union_id)[:48] or secrets.token_hex(8)
    return f"feishu_{token}@{PLACEHOLDER_EMAIL_DOMAIN}"


def _clip_avatar(url: str | None) -> str | None:
    if not url:
        return None
    return url[:512]


def _profile_email(data: dict) -> str | None:
    for key in ("enterprise_email", "email"):
        value = (data.get(key) or "").strip()
        if value and "@" in value:
            return value
    return None


def parse_feishu_profile(data: dict) -> FeishuProfile:
    union_id = (data.get("union_id") or "").strip()
    open_id = (data.get("open_id") or "").strip()
    if not union_id:
        fail(2002, "未获取到飞书用户标识", 400)
    name = (data.get("name") or data.get("en_name") or "").strip() or "飞书用户"
    avatar = _clip_avatar(
        data.get("avatar_url") or data.get("avatar_middle") or data.get("avatar_big") or data.get("avatar_thumb")
    )
    return FeishuProfile(
        union_id=union_id,
        open_id=open_id or union_id,
        name=name,
        email=_profile_email(data),
        avatar=avatar,
    )


def _bind_identity(db: Session, user: models.User, profile: FeishuProfile) -> None:
    identity = (
        db.query(models.OauthIdentity)
        .filter_by(provider="feishu", provider_user_id=profile.union_id)
        .first()
    )
    if identity is None:
        identity = models.OauthIdentity(
            user_id=user.id,
            provider="feishu",
            provider_user_id=profile.union_id,
        )
        db.add(identity)
    identity.user_id = user.id
    identity.open_id = profile.open_id
    identity.union_id = profile.union_id
    identity.email = profile.email
    identity.updated_at = now()
    if profile.avatar and (not user.avatar or "dicebear.com" in user.avatar):
        user.avatar = profile.avatar
    db.flush()


def upsert_feishu_user(db: Session, profile: FeishuProfile) -> models.User:
    identity = (
        db.query(models.OauthIdentity)
        .filter_by(provider="feishu", provider_user_id=profile.union_id)
        .first()
    )
    if identity:
        user = db.get(models.User, identity.user_id)
        if user:
            _bind_identity(db, user, profile)
            return user

    if profile.email:
        existing = db.query(models.User).filter_by(email=profile.email).first()
        if existing:
            other = (
                db.query(models.OauthIdentity)
                .filter_by(user_id=existing.id, provider="feishu")
                .first()
            )
            if other is None or other.provider_user_id == profile.union_id:
                _bind_identity(db, existing, profile)
                return existing

    require_open_registration()
    user = models.User(
        role_id=3,
        username=_unique_username(db, profile.name),
        email=profile.email or _placeholder_email(profile.union_id),
        password_hash=None,
        avatar=profile.avatar,
        credits=0,
    )
    db.add(user)
    db.flush()
    _bind_identity(db, user, profile)
    return user


def _feishu_json_error(payload: dict | None, fallback: str) -> str:
    if not payload:
        return fallback
    for key in ("error_description", "msg", "message", "error"):
        value = payload.get(key)
        if value:
            return str(value)
    return fallback


def exchange_feishu_code(*, code: str, redirect_uri: str, code_verifier: str) -> str:
    body = {
        "grant_type": "authorization_code",
        "client_id": settings.feishu_app_id,
        "client_secret": settings.feishu_app_secret,
        "code": code,
        "redirect_uri": redirect_uri,
        "code_verifier": code_verifier,
    }
    try:
        response = httpx.post(FEISHU_TOKEN_URL, json=body, timeout=15)
        payload = response.json()
    except Exception as exc:
        fail(2002, f"飞书登录失败：{exc}", 502)
        raise RuntimeError("unreachable")
    access_token = payload.get("access_token")
    if not access_token and isinstance(payload.get("data"), dict):
        access_token = payload["data"].get("access_token")
    if not access_token or payload.get("code") not in (0, None):
        fail(2002, f"获取飞书令牌失败：{_feishu_json_error(payload, response.text)}", 400)
    return str(access_token)


def fetch_feishu_user(access_token: str) -> FeishuProfile:
    try:
        response = httpx.get(
            FEISHU_USER_INFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=15,
        )
        payload = response.json()
    except Exception as exc:
        fail(2002, f"获取飞书用户信息失败：{exc}", 502)
        raise RuntimeError("unreachable")
    data = payload.get("data") if isinstance(payload, dict) else None
    if not isinstance(data, dict) or payload.get("code") != 0:
        fail(2002, f"获取飞书用户信息失败：{_feishu_json_error(payload, response.text)}", 400)
    return parse_feishu_profile(data)


def complete_feishu_login(db: Session, *, code: str, state: str) -> models.User:
    if not feishu_enabled():
        fail(1001, "飞书登录未配置", 400)
    if not code:
        fail(1001, "授权码不能为空", 400)
    payload = parse_state(state, "feishu")
    access_token = exchange_feishu_code(
        code=code,
        redirect_uri=payload["redirect_uri"],
        code_verifier=payload["code_verifier"],
    )
    profile = fetch_feishu_user(access_token)
    return upsert_feishu_user(db, profile)
