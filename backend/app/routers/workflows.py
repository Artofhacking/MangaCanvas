import secrets

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import models, serialize
from ..serialize import normalize_canvas
from ..db import get_db
from ..deps import current_user, require_project_access
from ..errors import fail, ok
from ..util import iso, now, paginate

router = APIRouter(prefix="/projects/{project_id}/canvas-workflows")


class WorkflowIn(BaseModel):
    name: str | None = None
    thumbnail: str | None = None
    sourceType: str | None = None
    sourceAssetId: int | None = None
    sourceEpisodeId: int | None = None
    status: str | None = None
    canvasData: dict | None = None


class MemberIn(BaseModel):
    userId: int
    role: str


class MemberRole(BaseModel):
    role: str


def _default_canvas() -> dict:
    return {"nodes": [], "edges": [], "viewport": {"x": 0, "y": 0, "zoom": 1}}


@router.get("")
def list_workflows(
    project_id: int,
    page: int = 1,
    size: int = 20,
    user: models.User = Depends(current_user),
    db: Session = Depends(get_db),
):
    require_project_access(db, user, project_id)
    rows = (
        db.query(models.CanvasWorkflow)
        .filter_by(project_id=project_id)
        .order_by(models.CanvasWorkflow.updated_at.desc())
        .all()
    )
    items = [serialize.workflow(r, include_canvas=True) for r in rows]
    sliced, pagination = paginate(items, page, size)
    return ok({"list": sliced, "pagination": pagination})


@router.post("")
def create_workflow(
    project_id: int, body: WorkflowIn, user: models.User = Depends(current_user), db: Session = Depends(get_db)
):
    project = require_project_access(db, user, project_id, write=True)
    row = models.CanvasWorkflow(
        id=f"workflow_{secrets.token_hex(6)}",
        organization_id=project.organization_id,
        project_id=project_id,
        name=body.name or "未命名工作流",
        thumbnail=body.thumbnail,
        source_type=body.sourceType or "blank",
        source_asset_id=body.sourceAssetId,
        canvas_data=normalize_canvas(body.canvasData or _default_canvas()),
        created_by=user.id,
    )
    db.add(row)
    db.flush()
    return ok(serialize.workflow(row))


@router.get("/{workflow_id}")
def get_workflow(
    project_id: int, workflow_id: str, user: models.User = Depends(current_user), db: Session = Depends(get_db)
):
    require_project_access(db, user, project_id)
    row = db.query(models.CanvasWorkflow).filter_by(id=workflow_id, project_id=project_id).first()
    if not row:
        fail(1004, "工作流不存在", 404)
    return ok(serialize.workflow(row))


@router.put("/{workflow_id}")
def update_workflow(
    project_id: int,
    workflow_id: str,
    body: WorkflowIn,
    user: models.User = Depends(current_user),
    db: Session = Depends(get_db),
):
    require_project_access(db, user, project_id, write=True)
    row = db.query(models.CanvasWorkflow).filter_by(id=workflow_id, project_id=project_id).first()
    if not row:
        fail(1004, "工作流不存在", 404)
    if body.name is not None:
        row.name = body.name
    if body.thumbnail is not None:
        row.thumbnail = body.thumbnail
    if body.sourceType is not None:
        row.source_type = body.sourceType
    if body.sourceAssetId is not None:
        row.source_asset_id = body.sourceAssetId
    if body.status is not None:
        row.status = body.status
    if body.canvasData is not None:
        row.canvas_data = normalize_canvas(body.canvasData)
    row.updated_at = now()
    return ok(serialize.workflow(row))


@router.delete("/{workflow_id}")
def delete_workflow(
    project_id: int, workflow_id: str, user: models.User = Depends(current_user), db: Session = Depends(get_db)
):
    require_project_access(db, user, project_id, write=True)
    row = db.query(models.CanvasWorkflow).filter_by(id=workflow_id, project_id=project_id).first()
    if not row:
        fail(1004, "工作流不存在", 404)
    db.query(models.CanvasWorkflowMember).filter_by(workflow_id=workflow_id).delete()
    db.delete(row)
    return ok(True)


@router.get("/{workflow_id}/members")
def list_members(
    project_id: int, workflow_id: str, user: models.User = Depends(current_user), db: Session = Depends(get_db)
):
    require_project_access(db, user, project_id)
    if not db.query(models.CanvasWorkflow).filter_by(id=workflow_id, project_id=project_id).first():
        fail(1004, "工作流不存在", 404)
    rows = db.query(models.CanvasWorkflowMember).filter_by(workflow_id=workflow_id).all()
    items = []
    for row in rows:
        member_user = db.get(models.User, row.user_id)
        items.append(
            {
                "userId": row.user_id,
                "workflowId": row.workflow_id,
                "projectId": row.project_id,
                "role": row.role,
                "joinedAt": iso(row.joined_at),
                "assignedBy": row.assigned_by,
                "user": {
                    "id": member_user.id,
                    "username": member_user.username,
                    "avatar": member_user.avatar,
                    "email": member_user.email,
                }
                if member_user
                else None,
            }
        )
    return ok({"list": items})


@router.post("/{workflow_id}/members")
def add_member(
    project_id: int,
    workflow_id: str,
    body: MemberIn,
    user: models.User = Depends(current_user),
    db: Session = Depends(get_db),
):
    require_project_access(db, user, project_id, write=True)
    if not db.query(models.CanvasWorkflow).filter_by(id=workflow_id, project_id=project_id).first():
        fail(1004, "工作流不存在", 404)
    if body.role not in ("editor", "viewer"):
        fail(1001, "参数错误：role", 400)
    target = db.get(models.User, body.userId)
    if not target:
        fail(1004, "用户不存在", 404)
    exists = (
        db.query(models.CanvasWorkflowMember).filter_by(workflow_id=workflow_id, user_id=body.userId).first()
    )
    if exists:
        fail(1005, "资源冲突", 409)
    row = models.CanvasWorkflowMember(
        workflow_id=workflow_id,
        user_id=body.userId,
        project_id=project_id,
        role=body.role,
        assigned_by=user.id,
    )
    db.add(row)
    db.flush()
    return ok(
        {
            "userId": row.user_id,
            "workflowId": row.workflow_id,
            "projectId": row.project_id,
            "role": row.role,
            "joinedAt": iso(row.joined_at),
            "assignedBy": row.assigned_by,
            "user": {
                "id": target.id,
                "username": target.username,
                "avatar": target.avatar,
                "email": target.email,
            },
        }
    )


@router.patch("/{workflow_id}/members/{user_id}")
def update_member(
    project_id: int,
    workflow_id: str,
    user_id: int,
    body: MemberRole,
    user: models.User = Depends(current_user),
    db: Session = Depends(get_db),
):
    require_project_access(db, user, project_id, write=True)
    row = db.query(models.CanvasWorkflowMember).filter_by(workflow_id=workflow_id, user_id=user_id).first()
    if not row:
        fail(1004, "资源不存在", 404)
    row.role = body.role
    target = db.get(models.User, user_id)
    return ok(
        {
            "userId": row.user_id,
            "workflowId": row.workflow_id,
            "projectId": row.project_id,
            "role": row.role,
            "joinedAt": iso(row.joined_at),
            "assignedBy": row.assigned_by,
            "user": {
                "id": target.id,
                "username": target.username,
                "avatar": target.avatar,
                "email": target.email,
            }
            if target
            else None,
        }
    )


@router.delete("/{workflow_id}/members/{user_id}")
def remove_member(
    project_id: int,
    workflow_id: str,
    user_id: int,
    user: models.User = Depends(current_user),
    db: Session = Depends(get_db),
):
    require_project_access(db, user, project_id, write=True)
    row = db.query(models.CanvasWorkflowMember).filter_by(workflow_id=workflow_id, user_id=user_id).first()
    if not row:
        fail(1004, "资源不存在", 404)
    db.delete(row)
    return ok(True)
