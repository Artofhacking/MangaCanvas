from datetime import timedelta

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import models, serialize
from ..config import settings
from ..db import get_db
from ..deps import current_user, org_ids_of
from ..errors import fail, ok
from ..security import (
    create_access_token,
    hash_password,
    hash_token,
    new_refresh_token,
    verify_password,
)
from ..util import now

router = APIRouter(prefix="/auth")


class RegisterIn(BaseModel):
    username: str
    email: str
    password: str
    avatar: str | None = None


class LoginIn(BaseModel):
    email: str
    password: str


class RefreshIn(BaseModel):
    refreshToken: str


class OauthIn(BaseModel):
    code: str
    redirectUri: str


def _issue_tokens(db: Session, user: models.User) -> dict:
    refresh = new_refresh_token()
    db.add(
        models.RefreshToken(
            user_id=user.id,
            token_hash=hash_token(refresh),
            expires_at=now() + timedelta(seconds=settings.refresh_expire_seconds),
        )
    )
    return {
        "user": serialize.user_public(user, org_ids_of(db, user.id), with_role=True),
        "token": create_access_token(user.id),
        "refreshToken": refresh,
    }


def _join_default_org(db: Session, user: models.User) -> None:
    org = db.query(models.Organization).order_by(models.Organization.id.asc()).first()
    if org:
        exists = (
            db.query(models.OrganizationMember)
            .filter_by(organization_id=org.id, user_id=user.id)
            .first()
        )
        if not exists:
            db.add(models.OrganizationMember(organization_id=org.id, user_id=user.id, assigned_by=user.id))


@router.post("/register")
def register(body: RegisterIn, db: Session = Depends(get_db)):
    if db.query(models.User).filter_by(email=body.email).first():
        fail(2001, "用户已存在", 409)
    if db.query(models.User).filter_by(username=body.username).first():
        fail(2001, "用户已存在", 409)
    user = models.User(
        role_id=3,
        username=body.username,
        email=body.email,
        password_hash=hash_password(body.password),
        avatar=body.avatar,
        credits=0,
    )
    db.add(user)
    db.flush()
    _join_default_org(db, user)
    return ok(_issue_tokens(db, user))


@router.post("/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    user = db.query(models.User).filter_by(email=body.email).first()
    if not user or not verify_password(body.password, user.password_hash):
        fail(2002, "邮箱或密码错误", 401)
    return ok(_issue_tokens(db, user))


@router.post("/refresh")
def refresh(body: RefreshIn, db: Session = Depends(get_db)):
    hashed = hash_token(body.refreshToken)
    row = db.query(models.RefreshToken).filter_by(token_hash=hashed, revoked=False).first()
    if not row or row.expires_at < now():
        fail(1002, "未授权", 401)
    row.revoked = True
    user = db.get(models.User, row.user_id)
    if not user:
        fail(1002, "未授权", 401)
    tokens = _issue_tokens(db, user)
    return ok({"token": tokens["token"], "refreshToken": tokens["refreshToken"]})


@router.get("/me")
def me(user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    return ok(serialize.user_public(user, org_ids_of(db, user.id), with_role=True))


@router.post("/oauth/{provider}")
def oauth(provider: str, body: OauthIn):
    fail(1001, f"OAuth provider {provider} 未配置", 400)
