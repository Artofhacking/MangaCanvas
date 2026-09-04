from fastapi import Depends, Header
from sqlalchemy.orm import Session, joinedload

from . import models
from .db import get_db
from .errors import fail
from .security import decode_access_token


def current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> models.User:
    if not authorization or not authorization.lower().startswith("bearer "):
        fail(1002, "未授权", 401)
    token = authorization.split(" ", 1)[1].strip()
    try:
        user_id = decode_access_token(token)
    except Exception:
        fail(1002, "未授权", 401)
    user = (
        db.query(models.User)
        .options(joinedload(models.User.role))
        .filter(models.User.id == user_id)
        .first()
    )
    if not user:
        fail(1002, "未授权", 401)
    return user


def org_ids_of(db: Session, user_id: int) -> list[int]:
    rows = db.query(models.OrganizationMember).filter_by(user_id=user_id).all()
    return [r.organization_id for r in rows]


def require_org_member(db: Session, user: models.User, organization_id: int) -> None:
    if user.role and user.role.list_all_projects:
        return
    exists = (
        db.query(models.OrganizationMember)
        .filter_by(organization_id=organization_id, user_id=user.id)
        .first()
    )
    if not exists:
        fail(1003, "禁止访问", 403)


def get_project(db: Session, project_id: int) -> models.Project:
    project = db.get(models.Project, project_id)
    if not project:
        fail(1004, "项目不存在", 404)
    return project


def require_project_access(
    db: Session, user: models.User, project_id: int, write: bool = False
) -> models.Project:
    project = get_project(db, project_id)
    if user.role and user.role.list_all_projects:
        return project
    member = (
        db.query(models.ProjectMember).filter_by(project_id=project_id, user_id=user.id).first()
    )
    if member:
        if write and member.role == "viewer":
            fail(1003, "禁止访问", 403)
        return project
    if user.role and user.role.list_organization_projects:
        require_org_member(db, user, project.organization_id)
        return project
    fail(1003, "禁止访问", 403)
    raise RuntimeError("unreachable")
