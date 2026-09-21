from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import billing_service, models
from ..db import get_db
from ..deps import current_user
from ..errors import fail, ok
from ..pricing import quote_request
from ..util import iso

router = APIRouter(prefix="/credits")


def _require_super_admin(user: models.User) -> None:
    if not user.role or user.role.code != "super_admin":
        fail(1003, "禁止访问", 403)


class QuoteIn(BaseModel):
    model: str
    modality: str
    n: int | None = 1
    quality: str | None = None
    size: str | None = None
    resolution: str | None = None
    duration: int | None = None
    unit: str | None = None
    imageCount: int | None = 0
    template: str | None = None
    projectId: int | None = None


class GrantIn(BaseModel):
    userId: int
    amount: int
    description: str | None = None


class AdjustIn(BaseModel):
    userId: int
    amount: int
    description: str | None = None


class PriceUpdateIn(BaseModel):
    creditsPerUnit: int | None = None
    isActive: bool | None = None


@router.get("")
def balance(user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    earned = (
        db.query(func.coalesce(func.sum(models.BillingLedger.amount), 0))
        .filter(models.BillingLedger.user_id == user.id, models.BillingLedger.amount > 0)
        .scalar()
    )
    used = (
        db.query(func.coalesce(func.sum(models.BillingLedger.amount), 0))
        .filter(
            models.BillingLedger.user_id == user.id,
            models.BillingLedger.entry_type == "consume",
            models.BillingLedger.amount < 0,
        )
        .scalar()
    )
    return ok(
        {
            "balance": user.credits,
            "frozenCredits": billing_service.frozen_credits(db, user.id),
            "totalEarned": int(earned),
            "totalUsed": abs(int(used)),
        }
    )


@router.get("/history")
def history(
    page: int = 1,
    size: int = 20,
    entryType: str | None = None,
    user: models.User = Depends(current_user),
    db: Session = Depends(get_db),
):
    q = db.query(models.BillingLedger).filter_by(user_id=user.id)
    if entryType:
        q = q.filter_by(entry_type=entryType)
    page = max(page or 1, 1)
    size = min(max(size or 20, 1), 100)
    total = q.count()
    rows = q.order_by(models.BillingLedger.id.desc()).offset((page - 1) * size).limit(size).all()
    items = [
        {
            "id": r.id,
            "organizationId": r.organization_id,
            "projectId": r.project_id,
            "userId": r.user_id,
            "entryType": r.entry_type,
            "amount": r.amount,
            "balanceAfter": r.balance_after,
            "description": r.description,
            "referenceType": r.reference_type,
            "referenceId": r.reference_id,
            "metadata": r.extra_metadata,
            "createdAt": iso(r.created_at),
        }
        for r in rows
    ]
    return ok({"list": items, "pagination": {"page": page, "size": size, "total": total}})


@router.get("/prices")
def list_prices(user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    rows = (
        db.query(models.BillingPriceRule)
        .filter_by(is_active=True)
        .order_by(models.BillingPriceRule.model_id, models.BillingPriceRule.unit, models.BillingPriceRule.id)
        .all()
    )
    return ok(
        {
            "list": [
                {
                    "id": row.id,
                    "modelId": row.model_id,
                    "modality": row.modality,
                    "unit": row.unit,
                    "quality": row.quality,
                    "resolution": row.resolution,
                    "creditsPerUnit": row.credits_per_unit,
                    "isActive": row.is_active,
                }
                for row in rows
            ]
        }
    )


@router.post("/quote")
def quote(body: QuoteIn, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    quoted = quote_request(
        db,
        model=body.model,
        modality=body.modality,
        n=body.n,
        quality=body.quality,
        size=body.size,
        resolution=body.resolution,
        duration=body.duration,
        unit=body.unit,
        image_count=body.imageCount or 0,
        template=body.template,
    )
    org_id = None
    if body.projectId:
        project = db.get(models.Project, body.projectId)
        if project:
            org_id = project.organization_id
    quota_ok, quota_msg = billing_service.quotas_sufficient(db, org_id, body.projectId, quoted.credits)
    return ok(
        {
            "credits": quoted.credits,
            "unit": quoted.unit,
            "unitCount": quoted.unit_count,
            "unitPrice": quoted.unit_price,
            "modelId": quoted.model_id,
            "quality": quoted.quality,
            "resolution": quoted.resolution,
            "balance": user.credits,
            "frozenCredits": billing_service.frozen_credits(db, user.id),
            "sufficient": user.credits >= quoted.credits,
            "quotaOk": quota_ok,
            "message": quota_msg,
        }
    )


@router.get("/users")
def lookup_user_for_grant(
    email: str | None = Query(default=None),
    user: models.User = Depends(current_user),
    db: Session = Depends(get_db),
):
    _require_super_admin(user)
    if not email:
        fail(1001, "参数错误：email 不能为空", 400)
    found = db.query(models.User).filter_by(email=email).first()
    if not found:
        fail(1004, "用户不存在", 404)
    return ok({"id": found.id, "username": found.username, "email": found.email})


@router.post("/grant")
def grant_credits(body: GrantIn, user: models.User = Depends(current_user)):
    _require_super_admin(user)
    return ok(
        billing_service.grant(
            target_user_id=body.userId,
            amount=body.amount,
            description=body.description or "管理员发放",
            admin_id=user.id,
        )
    )


@router.post("/adjust")
def adjust_credits(body: AdjustIn, user: models.User = Depends(current_user)):
    _require_super_admin(user)
    return ok(
        billing_service.adjust(
            target_user_id=body.userId,
            amount=body.amount,
            description=body.description or "管理员调整",
            admin_id=user.id,
        )
    )


@router.put("/prices/{price_id}")
def update_price(
    price_id: int,
    body: PriceUpdateIn,
    user: models.User = Depends(current_user),
    db: Session = Depends(get_db),
):
    _require_super_admin(user)
    row = db.get(models.BillingPriceRule, price_id)
    if not row:
        fail(1004, "价目不存在", 404)
    if body.creditsPerUnit is not None:
        if body.creditsPerUnit < 1:
            fail(1001, "单价必须大于 0", 400)
        row.credits_per_unit = body.creditsPerUnit
    if body.isActive is not None:
        row.is_active = body.isActive
    db.flush()
    return ok(
        {
            "id": row.id,
            "modelId": row.model_id,
            "creditsPerUnit": row.credits_per_unit,
            "isActive": row.is_active,
        }
    )
