from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import models, serialize
from ..db import get_db
from ..deps import current_user, require_project_access
from ..errors import fail, ok
from ..util import now, paginate

router = APIRouter(prefix="/projects/{project_id}/assets")


class AssetCreate(BaseModel):
    name: str | None = None
    sourceType: str
    sourceId: str
    prompt: str | None = None
    url: str
    metadata: dict | None = None


class AssetUpdate(BaseModel):
    name: str | None = None
    prompt: str | None = None
    metadata: dict | None = None


@router.get("")
def list_assets(
    project_id: int,
    page: int = 1,
    size: int = 20,
    sourceType: str | None = None,
    user: models.User = Depends(current_user),
    db: Session = Depends(get_db),
):
    require_project_access(db, user, project_id)
    q = db.query(models.ProjectAsset).filter_by(project_id=project_id)
    if sourceType:
        q = q.filter_by(source_type=sourceType)
    items = [serialize.asset(r) for r in q.order_by(models.ProjectAsset.id.desc()).all()]
    sliced, pagination = paginate(items, page, size)
    return ok({"list": sliced, "pagination": pagination})


@router.post("")
def create_asset(
    project_id: int, body: AssetCreate, user: models.User = Depends(current_user), db: Session = Depends(get_db)
):
    project = require_project_access(db, user, project_id, write=True)
    row = models.ProjectAsset(
        organization_id=project.organization_id,
        project_id=project_id,
        name=body.name,
        source_type=body.sourceType,
        source_id=body.sourceId,
        prompt=body.prompt,
        url=body.url,
        extra_metadata=body.metadata,
        created_by=user.id,
    )
    db.add(row)
    db.flush()
    return ok(serialize.asset(row))


@router.get("/{asset_id}")
def get_asset(project_id: int, asset_id: int, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    require_project_access(db, user, project_id)
    row = db.query(models.ProjectAsset).filter_by(id=asset_id, project_id=project_id).first()
    if not row:
        fail(1004, "资产不存在", 404)
    return ok(serialize.asset(row))


@router.put("/{asset_id}")
def update_asset(
    project_id: int,
    asset_id: int,
    body: AssetUpdate,
    user: models.User = Depends(current_user),
    db: Session = Depends(get_db),
):
    require_project_access(db, user, project_id, write=True)
    row = db.query(models.ProjectAsset).filter_by(id=asset_id, project_id=project_id).first()
    if not row:
        fail(1004, "资产不存在", 404)
    if body.name is not None:
        row.name = body.name
    if body.prompt is not None:
        row.prompt = body.prompt
    if body.metadata is not None:
        row.extra_metadata = body.metadata
    row.updated_at = now()
    return ok(serialize.asset(row))


@router.delete("/{asset_id}")
def delete_asset(
    project_id: int, asset_id: int, user: models.User = Depends(current_user), db: Session = Depends(get_db)
):
    require_project_access(db, user, project_id, write=True)
    row = db.query(models.ProjectAsset).filter_by(id=asset_id, project_id=project_id).first()
    if not row:
        fail(1004, "资产不存在", 404)
    db.delete(row)
    return ok(True)
