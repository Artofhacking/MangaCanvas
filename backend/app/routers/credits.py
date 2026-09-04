from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import models
from ..db import get_db
from ..deps import current_user
from ..errors import ok
from ..util import iso, paginate

router = APIRouter(prefix="/credits")


@router.get("")
def balance(user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    earned = (
        db.query(func.coalesce(func.sum(models.BillingLedger.amount), 0))
        .filter(models.BillingLedger.user_id == user.id, models.BillingLedger.amount > 0)
        .scalar()
    )
    used = (
        db.query(func.coalesce(func.sum(models.BillingLedger.amount), 0))
        .filter(models.BillingLedger.user_id == user.id, models.BillingLedger.amount < 0)
        .scalar()
    )
    return ok({"balance": user.credits, "totalEarned": int(earned), "totalUsed": abs(int(used))})


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
    rows = q.order_by(models.BillingLedger.id.desc()).all()
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
    sliced, pagination = paginate(items, page, size)
    return ok({"list": sliced, "pagination": pagination})
