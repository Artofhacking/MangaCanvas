import secrets
from pathlib import Path

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import models, serialize
from ..config import settings
from ..db import get_db
from ..deps import current_user
from ..errors import fail, ok
from ..util import paginate

router = APIRouter(prefix="/upload")


class PresignIn(BaseModel):
    filename: str
    contentType: str
    directory: str


class ConfirmIn(BaseModel):
    accessUrl: str
    directory: str
    relatedId: int | str | None = None


@router.post("/presigned")
def presign(body: PresignIn, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    file_key = secrets.token_hex(16)
    put_token = secrets.token_urlsafe(24)
    suffix = Path(body.filename).suffix or ""
    stored_name = f"{file_key}{suffix}"
    access_url = f"{settings.public_base_url}/static/uploads/{body.directory}/{stored_name}"
    upload_url = f"{settings.public_base_url}/api/v1/upload/raw/{file_key}?token={put_token}"
    row = models.UploadedFile(
        file_key=file_key,
        url=access_url,
        directory=body.directory,
        filename=stored_name,
        content_type=body.contentType,
        created_by=user.id,
        put_token=put_token,
    )
    db.add(row)
    db.flush()
    return ok({"uploadUrl": upload_url, "accessUrl": access_url, "expiresIn": 1800})


@router.put("/raw/{file_key}")
async def put_raw(file_key: str, request: Request, token: str = Query(...), db: Session = Depends(get_db)):
    row = db.query(models.UploadedFile).filter_by(file_key=file_key, put_token=token).first()
    if not row:
        fail(1002, "未授权", 401)
    data = await request.body()
    dest_dir = settings.upload_dir / row.directory
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / row.filename
    dest.write_bytes(data)
    row.size = len(data)
    return Response(status_code=200)


@router.post("/confirm")
def confirm(body: ConfirmIn, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    row = db.query(models.UploadedFile).filter_by(url=body.accessUrl, created_by=user.id).first()
    if not row:
        fail(1004, "文件不存在", 404)
    row.confirmed = True
    if body.relatedId is not None:
        row.related_id = str(body.relatedId)
    return ok({"accessUrl": row.url, "confirmed": True})


@router.get("/files")
def list_files(
    page: int = 1,
    size: int = 20,
    directory: str | None = None,
    relatedId: str | None = None,
    user: models.User = Depends(current_user),
    db: Session = Depends(get_db),
):
    q = db.query(models.UploadedFile).filter_by(created_by=user.id, confirmed=True)
    if directory:
        q = q.filter_by(directory=directory)
    if relatedId:
        q = q.filter_by(related_id=str(relatedId))
    items = [serialize.uploaded(r) for r in q.order_by(models.UploadedFile.id.desc()).all()]
    sliced, pagination = paginate(items, page, size)
    return ok({"list": sliced, "pagination": pagination})
