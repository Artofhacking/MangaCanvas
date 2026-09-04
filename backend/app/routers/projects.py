from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import models, serialize
from ..db import get_db
from ..deps import current_user, org_ids_of, require_org_member, require_project_access
from ..errors import fail, ok
from ..util import now, paginate

router = APIRouter(prefix="/projects")


class ProjectCreate(BaseModel):
    organizationId: int
    name: str
    description: str | None = None
    coverImage: str | None = None
    isPublic: bool = False


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    coverImage: str | None = None
    status: str | None = None
    isPublic: bool | None = None


class MemberAdd(BaseModel):
    userId: int
    role: str


class MemberRole(BaseModel):
    role: str


def _stats(db: Session, project_id: int) -> dict:
    return {
        "episodeCount": db.query(models.Episode).filter_by(project_id=project_id).count(),
        "sceneCount": db.query(models.Scene).filter_by(project_id=project_id).count(),
        "characterCount": db.query(models.Character).filter_by(project_id=project_id).count(),
        "objectCount": db.query(models.ProjectObject).filter_by(project_id=project_id).count(),
        "totalDuration": sum(
            (e.duration or 0) for e in db.query(models.Episode).filter_by(project_id=project_id)
        ),
    }


@router.get("")
def list_projects(
    page: int = 1,
    size: int = 20,
    status: str | None = None,
    organizationId: int | None = None,
    user: models.User = Depends(current_user),
    db: Session = Depends(get_db),
):
    q = db.query(models.Project)
    if organizationId:
        require_org_member(db, user, organizationId)
        q = q.filter_by(organization_id=organizationId)
    elif not (user.role and user.role.list_all_projects):
        member_ids = [
            m.project_id for m in db.query(models.ProjectMember).filter_by(user_id=user.id)
        ]
        org_ids = org_ids_of(db, user.id)
        if user.role and user.role.list_organization_projects and org_ids:
            q = q.filter(
                (models.Project.id.in_(member_ids or [0]))
                | (models.Project.organization_id.in_(org_ids))
            )
        else:
            q = q.filter(models.Project.id.in_(member_ids or [0]))
    if status:
        q = q.filter_by(status=status)
    rows = q.order_by(models.Project.updated_at.desc()).all()
    items = []
    for row in rows:
        extra = _stats(db, row.id)
        extra["episodeCount"] = extra["episodeCount"]
        extra["progress"] = 0
        items.append(serialize.project(row, extra))
    sliced, pagination = paginate(items, page, size)
    return ok({"list": sliced, "pagination": pagination})


@router.post("")
def create_project(body: ProjectCreate, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    if not user.role or not user.role.can_create_project:
        fail(1003, "禁止访问", 403)
    require_org_member(db, user, body.organizationId)
    row = models.Project(
        organization_id=body.organizationId,
        name=body.name,
        description=body.description or "",
        cover_image=body.coverImage,
        is_public=body.isPublic,
        owner_id=user.id,
        status="draft",
    )
    db.add(row)
    db.flush()
    db.add(
        models.ProjectMember(
            project_id=row.id,
            user_id=user.id,
            organization_id=body.organizationId,
            role="owner",
            assigned_by=user.id,
        )
    )
    db.add(
        models.BillingProjectQuota(
            project_id=row.id, quota_percent=100, quota_limit=100000, quota_consumed=0
        )
    )
    return ok(serialize.project(row, _stats(db, row.id)))


@router.get("/{project_id}")
def get_project(project_id: int, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    row = require_project_access(db, user, project_id)
    owner = db.get(models.User, row.owner_id)
    members = db.query(models.ProjectMember).filter_by(project_id=project_id).all()
    extra = {
        "owner": {
            "id": owner.id,
            "username": owner.username,
            "avatar": owner.avatar,
        }
        if owner
        else None,
        "members": [serialize.member(m) for m in members],
        "stats": _stats(db, project_id),
        "progress": 0,
        "episodeCount": _stats(db, project_id)["episodeCount"],
    }
    return ok(serialize.project(row, extra))


@router.put("/{project_id}")
def update_project(
    project_id: int,
    body: ProjectUpdate,
    user: models.User = Depends(current_user),
    db: Session = Depends(get_db),
):
    row = require_project_access(db, user, project_id, write=True)
    for field, attr in [
        ("name", "name"),
        ("description", "description"),
        ("coverImage", "cover_image"),
        ("status", "status"),
        ("isPublic", "is_public"),
    ]:
        value = getattr(body, field)
        if value is not None:
            setattr(row, attr, value)
    row.updated_at = now()
    return ok(serialize.project(row, _stats(db, row.id)))


@router.delete("/{project_id}")
def delete_project(project_id: int, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    row = require_project_access(db, user, project_id, write=True)
    member = db.query(models.ProjectMember).filter_by(project_id=project_id, user_id=user.id).first()
    if not (user.role and user.role.list_all_projects) and (not member or member.role != "owner"):
        fail(1003, "禁止访问", 403)
    db.query(models.ProjectMember).filter_by(project_id=project_id).delete()
    db.query(models.Character).filter_by(project_id=project_id).delete()
    db.query(models.Scene).filter_by(project_id=project_id).delete()
    db.query(models.ProjectObject).filter_by(project_id=project_id).delete()
    db.query(models.Episode).filter_by(project_id=project_id).delete()
    db.query(models.CanvasWorkflow).filter_by(project_id=project_id).delete()
    db.query(models.ProjectAsset).filter_by(project_id=project_id).delete()
    db.delete(row)
    return ok(True)


@router.post("/{project_id}/duplicate")
def duplicate_project(project_id: int, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    src = require_project_access(db, user, project_id)
    copy = models.Project(
        organization_id=src.organization_id,
        name=f"{src.name} (复制)",
        description=src.description,
        cover_image=src.cover_image,
        status="draft",
        is_public=False,
        owner_id=user.id,
    )
    db.add(copy)
    db.flush()
    db.add(
        models.ProjectMember(
            project_id=copy.id,
            user_id=user.id,
            organization_id=copy.organization_id,
            role="owner",
            assigned_by=user.id,
        )
    )
    char_map: dict[int, int] = {}
    scene_map: dict[int, int] = {}
    object_map: dict[int, int] = {}
    for c in db.query(models.Character).filter_by(project_id=src.id):
        n = models.Character(
            organization_id=copy.organization_id,
            project_id=copy.id,
            name=c.name,
            role=c.role,
            gender=c.gender,
            age_group=c.age_group,
            style=c.style,
            description=c.description,
            avatar=c.avatar,
            reference_images=c.reference_images,
            model_id=c.model_id,
            seed=c.seed,
            creation_mode=c.creation_mode,
        )
        db.add(n)
        db.flush()
        char_map[c.id] = n.id
    for s in db.query(models.Scene).filter_by(project_id=src.id):
        n = models.Scene(
            organization_id=copy.organization_id,
            project_id=copy.id,
            name=s.name,
            description=s.description,
            image=s.image,
            status=s.status,
            gen_method=s.gen_method,
            model_id=s.model_id,
            style=s.style,
            camera=s.camera,
            reference_images=s.reference_images,
            seed=s.seed,
            creation_mode=s.creation_mode,
        )
        db.add(n)
        db.flush()
        scene_map[s.id] = n.id
    for o in db.query(models.ProjectObject).filter_by(project_id=src.id):
        n = models.ProjectObject(
            organization_id=copy.organization_id,
            project_id=copy.id,
            scene_id=scene_map.get(o.scene_id) if o.scene_id else None,
            name=o.name,
            type=o.type,
            description=o.description,
            image=o.image,
            status=o.status,
            gen_method=o.gen_method,
            reference_images=o.reference_images,
            creation_mode=o.creation_mode,
        )
        db.add(n)
        db.flush()
        object_map[o.id] = n.id
    return ok(serialize.project(copy, _stats(db, copy.id)))


@router.get("/{project_id}/members")
def list_members(project_id: int, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    require_project_access(db, user, project_id)
    rows = db.query(models.ProjectMember).filter_by(project_id=project_id).all()
    items = [serialize.member(r, db.get(models.User, r.user_id)) for r in rows]
    return ok({"list": items, "pagination": {"page": 1, "size": len(items), "total": len(items)}})


@router.post("/{project_id}/members")
def add_member(
    project_id: int,
    body: MemberAdd,
    user: models.User = Depends(current_user),
    db: Session = Depends(get_db),
):
    project = require_project_access(db, user, project_id, write=True)
    if body.role not in ("editor", "viewer"):
        fail(1001, "参数错误：role", 400)
    target = db.get(models.User, body.userId)
    if not target:
        fail(1004, "用户不存在", 404)
    org_member = (
        db.query(models.OrganizationMember)
        .filter_by(organization_id=project.organization_id, user_id=body.userId)
        .first()
    )
    if not org_member:
        fail(1003, "用户不在组织内", 403)
    exists = db.query(models.ProjectMember).filter_by(project_id=project_id, user_id=body.userId).first()
    if exists:
        fail(1005, "资源冲突", 409)
    row = models.ProjectMember(
        project_id=project_id,
        user_id=body.userId,
        organization_id=project.organization_id,
        role=body.role,
        assigned_by=user.id,
    )
    db.add(row)
    db.flush()
    return ok(serialize.member(row, target))


@router.patch("/{project_id}/members/{user_id}")
def update_member(
    project_id: int,
    user_id: int,
    body: MemberRole,
    user: models.User = Depends(current_user),
    db: Session = Depends(get_db),
):
    require_project_access(db, user, project_id, write=True)
    if body.role not in ("owner", "editor", "viewer"):
        fail(1001, "参数错误：role", 400)
    row = db.query(models.ProjectMember).filter_by(project_id=project_id, user_id=user_id).first()
    if not row:
        fail(1004, "资源不存在", 404)
    row.role = body.role
    return ok(serialize.member(row, db.get(models.User, user_id)))


@router.delete("/{project_id}/members/{user_id}")
def remove_member(
    project_id: int,
    user_id: int,
    user: models.User = Depends(current_user),
    db: Session = Depends(get_db),
):
    require_project_access(db, user, project_id, write=True)
    row = db.query(models.ProjectMember).filter_by(project_id=project_id, user_id=user_id).first()
    if not row:
        fail(1004, "资源不存在", 404)
    if row.role == "owner":
        fail(1003, "不能移除项目所有者", 403)
    db.delete(row)
    return ok(True)
