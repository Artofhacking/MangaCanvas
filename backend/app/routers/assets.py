from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import models, serialize
from ..db import get_db
from ..deps import current_user, require_project_access
from ..errors import fail, ok
from ..favorites import (
    metadata_text,
    coerce_metadata,
    is_collected_metadata,
    media_identity,
    metadata_node_id,
    same_media_target,
)
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


def _clamp_name(name: str | None) -> str | None:
    if not name:
        return None
    trimmed = name.strip()
    return trimmed[:128] or None


def _clamp_source_id(source_id: str) -> str:
    clamped = (source_id or "").strip()[:64]
    if not clamped:
        fail(1001, "参数错误：sourceId", 400)
    return clamped


def _take_favorite_target(
    db: Session,
    project_id: int,
    url: str,
    node_id: str | None,
    source_url: str | None = None,
) -> models.ProjectAsset | None:
    rows = (
        db.query(models.ProjectAsset)
        .filter_by(project_id=project_id)
        .order_by(models.ProjectAsset.id.desc())
        .all()
    )
    matches = [
        row for row in rows if same_media_target(row.url, row.extra_metadata, url, node_id, source_url)
    ]
    if not matches:
        return None
    primary = matches[0]
    for extra in matches[1:]:
        if is_collected_metadata(extra.extra_metadata):
            db.delete(extra)
    return primary


def _row_matches_lookup(row: models.ProjectAsset, asset_url: str | None, node_id: str | None) -> bool:
    if asset_url and media_identity(row.url) != media_identity(asset_url):
        return False
    if node_id and metadata_node_id(row.extra_metadata) != node_id:
        return False
    return True


@router.get("")
def list_assets(
    project_id: int,
    page: int = 1,
    size: int = 20,
    sourceType: str | None = None,
    collected: bool | None = None,
    nodeId: str | None = None,
    assetUrl: str | None = None,
    user: models.User = Depends(current_user),
    db: Session = Depends(get_db),
):
    require_project_access(db, user, project_id)
    q = db.query(models.ProjectAsset).filter_by(project_id=project_id)
    if sourceType:
        q = q.filter_by(source_type=sourceType)
    rows = q.order_by(models.ProjectAsset.id.desc()).all()
    if nodeId or assetUrl:
        rows = [row for row in rows if _row_matches_lookup(row, assetUrl, nodeId)]
    items = [serialize.asset(row) for row in rows]
    if collected is True:
        items = [item for item in items if is_collected_metadata(item.get("metadata"))]
    elif collected is False:
        items = [item for item in items if not is_collected_metadata(item.get("metadata"))]
    sliced, pagination = paginate(items, page, size, max_size=200)
    return ok({"list": sliced, "pagination": pagination})


@router.post("")
def create_asset(
    project_id: int, body: AssetCreate, user: models.User = Depends(current_user), db: Session = Depends(get_db)
):
    project = require_project_access(db, user, project_id, write=True)
    metadata = coerce_metadata(body.metadata) if body.metadata is not None else None
    name = _clamp_name(body.name)
    source_id = _clamp_source_id(body.sourceId)
    if is_collected_metadata(metadata):
        existing = _take_favorite_target(
            db,
            project_id,
            body.url,
            metadata_node_id(metadata),
            metadata_text(metadata, "sourceUrl"),
        )
        if existing:
            if name:
                existing.name = name
            if body.prompt is not None:
                existing.prompt = body.prompt
            existing.url = body.url
            existing.extra_metadata = metadata
            existing.updated_at = now()
            db.flush()
            return ok(serialize.asset(existing))
    row = models.ProjectAsset(
        organization_id=project.organization_id,
        project_id=project_id,
        name=name,
        source_type=body.sourceType,
        source_id=source_id,
        prompt=body.prompt,
        url=body.url,
        extra_metadata=metadata,
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
        row.extra_metadata = coerce_metadata(body.metadata)
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
