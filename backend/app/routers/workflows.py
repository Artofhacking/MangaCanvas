import secrets

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session, defer

from .. import models, serialize
from ..canvas_counts import canvas_collection_count, canvas_nodes_are_empty
from ..canvas_media import persist_inline_canvas_logged
from ..serialize import normalize_canvas
from ..db import get_db
from ..deps import current_user, require_project_access
from ..errors import fail, ok
from ..util import iso, now

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


def _canvas_node_count(canvas: dict | None) -> int:
    if not isinstance(canvas, dict):
        return 0
    nodes = canvas.get("nodes")
    return len(nodes) if isinstance(nodes, list) else 0


def _delete_workflow(db: Session, row: models.CanvasWorkflow) -> None:
    db.query(models.CanvasWorkflowMember).filter_by(workflow_id=row.id).delete(synchronize_session=False)
    db.delete(row)


def _purge_empty_workflows(db: Session, project_id: int) -> None:
    """Drop saved canvases that really have zero nodes so lists do not keep them."""
    dialect = db.get_bind().dialect.name
    empty_nodes = canvas_nodes_are_empty(models.CanvasWorkflow.canvas_data, dialect)
    ids = [
        workflow_id
        for (workflow_id,) in db.query(models.CanvasWorkflow.id)
        .filter(models.CanvasWorkflow.project_id == project_id)
        .filter(empty_nodes)
        .all()
    ]
    if not ids:
        return
    db.query(models.CanvasWorkflowMember).filter(models.CanvasWorkflowMember.workflow_id.in_(ids)).delete(
        synchronize_session=False
    )
    db.query(models.CanvasWorkflow).filter(models.CanvasWorkflow.id.in_(ids)).delete(synchronize_session=False)
    db.flush()


def _collection_counts(db: Session, workflow_ids: list[str]) -> dict[str, tuple[int, int]]:
    """Return ``(node_count, edge_count)`` without sorting the JSON column."""
    if not workflow_ids:
        return {}
    dialect = db.get_bind().dialect.name
    node_count = canvas_collection_count(models.CanvasWorkflow.canvas_data, "$.nodes", dialect)
    edge_count = canvas_collection_count(models.CanvasWorkflow.canvas_data, "$.edges", dialect)
    rows = (
        db.query(models.CanvasWorkflow.id, node_count, edge_count)
        .filter(models.CanvasWorkflow.id.in_(workflow_ids))
        .all()
    )
    return {workflow_id: (int(nodes or 0), int(edges or 0)) for workflow_id, nodes, edges in rows}


@router.get("")
def list_workflows(
    project_id: int,
    page: int = 1,
    size: int = 20,
    user: models.User = Depends(current_user),
    db: Session = Depends(get_db),
):
    require_project_access(db, user, project_id)
    page = max(page or 1, 1)
    size = min(max(size or 20, 1), 100)
    # Empty canvases are not user workflows. Remove them before paging so the
    # workflow space and recent list cannot keep showing 0-node cards.
    _purge_empty_workflows(db, project_id)
    # MySQL filesort copies selected columns into the sort buffer. Including
    # the JSON canvas_data column raises 1038 once a workflow payload is large.
    # Count nodes in an unordered id lookup, then sort only those ids.
    dialect = db.get_bind().dialect.name
    node_count = canvas_collection_count(models.CanvasWorkflow.canvas_data, "$.nodes", dialect)
    workflow_ids = [
        workflow_id
        for (workflow_id,) in db.query(models.CanvasWorkflow.id)
        .filter(models.CanvasWorkflow.project_id == project_id)
        .filter(node_count > 0)
        .all()
    ]
    total = len(workflow_ids)
    if not workflow_ids:
        return ok({"list": [], "pagination": {"page": page, "size": size, "total": 0}})
    rows = (
        db.query(models.CanvasWorkflow)
        .options(defer(models.CanvasWorkflow.canvas_data))
        .filter(models.CanvasWorkflow.id.in_(workflow_ids))
        .order_by(models.CanvasWorkflow.updated_at.desc(), models.CanvasWorkflow.id.desc())
        .offset((page - 1) * size)
        .limit(size)
        .all()
    )
    counts = _collection_counts(db, [row.id for row in rows])
    items = []
    for row in rows:
        counted = counts.get(row.id)
        if counted is None:
            items.append(serialize.workflow(row, include_canvas=False))
            continue
        nodes, edges = counted
        items.append(serialize.workflow(row, include_canvas=False, node_count=nodes, edge_count=edges))
    return ok({"list": items, "pagination": {"page": page, "size": size, "total": int(total or 0)}})


@router.post("")
def create_workflow(
    project_id: int, body: WorkflowIn, user: models.User = Depends(current_user), db: Session = Depends(get_db)
):
    project = require_project_access(db, user, project_id, write=True)
    canvas = normalize_canvas(persist_inline_canvas_logged(body.canvasData) or _default_canvas())
    if _canvas_node_count(canvas) == 0:
        fail(1001, "空工作流不会保存", 400)
    row = models.CanvasWorkflow(
        id=f"workflow_{secrets.token_hex(6)}",
        organization_id=project.organization_id,
        project_id=project_id,
        name=body.name or "未命名工作流",
        thumbnail=body.thumbnail,
        source_type=body.sourceType or "blank",
        source_asset_id=body.sourceAssetId,
        canvas_data=canvas,
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
        canvas = normalize_canvas(persist_inline_canvas_logged(body.canvasData))
        if _canvas_node_count(canvas) == 0:
            _delete_workflow(db, row)
            return ok({"id": workflow_id, "deleted": True})
        row.canvas_data = canvas
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
    _delete_workflow(db, row)
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
