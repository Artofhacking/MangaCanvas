import time
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from .. import models
from ..config import settings
from ..db import get_db
from ..deps import current_user
from ..errors import fail, ok

router = APIRouter(prefix="/ai")


PLACEHOLDER_SVG = """<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
  <rect width="100%" height="100%" fill="#1a1a1a"/>
  <text x="50%" y="48%" text-anchor="middle" fill="#f5c16c" font-size="48" font-family="sans-serif">MangaCanvas</text>
  <text x="50%" y="56%" text-anchor="middle" fill="#888" font-size="24" font-family="sans-serif">placeholder image</text>
</svg>
"""


@router.post("/images/generations")
async def images(request: Request, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    body = await request.json()
    if settings.dashscope_api_key:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                f"{settings.dashscope_base_url.rstrip('/')}/images/generations",
                headers={"Authorization": f"Bearer {settings.dashscope_api_key}"},
                json=body,
            )
            if resp.status_code >= 400:
                fail(3001, f"生成任务失败: {resp.text}", 500)
            payload = resp.json()
            return ok(payload.get("data") and payload or payload)

    dest_dir = settings.upload_dir / "generated"
    dest_dir.mkdir(parents=True, exist_ok=True)
    filename = f"gen_{int(time.time() * 1000)}.svg"
    (dest_dir / filename).write_text(PLACEHOLDER_SVG, encoding="utf-8")
    url = f"{settings.public_base_url}/static/uploads/generated/{filename}"
    n = int(body.get("n") or 1)
    db.add(
        models.BillingLedger(
            user_id=user.id,
            entry_type="consume",
            amount=0,
            balance_after=user.credits,
            description=body.get("prompt", "")[:200],
            reference_type="ai_image",
        )
    )
    return ok({"created": int(time.time()), "data": [{"url": url} for _ in range(max(n, 1))]})


@router.get("/models")
def models_list(_user: models.User = Depends(current_user)):
    return ok(
        {
            "list": [
                {"id": "qwen-image-2.0", "owned_by": "local", "modality": "image"},
                {"id": "qwen-image-2.0-pro", "owned_by": "local", "modality": "image"},
            ]
        }
    )


@router.get("/balance")
def balance(user: models.User = Depends(current_user)):
    return ok({"balance": user.credits})


@router.get("/bills")
def bills(
    page: int = 1,
    page_size: int = 20,
    user: models.User = Depends(current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(models.BillingLedger)
        .filter_by(user_id=user.id)
        .order_by(models.BillingLedger.id.desc())
        .offset((max(page, 1) - 1) * page_size)
        .limit(page_size)
        .all()
    )
    total = db.query(models.BillingLedger).filter_by(user_id=user.id).count()
    return ok(
        {
            "list": [
                {
                    "order_id": f"bill_{r.id}",
                    "bill_type": r.entry_type,
                    "amount": r.amount,
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                }
                for r in rows
            ],
            "pagination": {"page": page, "page_size": page_size, "total": total},
        }
    )
