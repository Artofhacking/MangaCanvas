from __future__ import annotations

import hashlib
import json
import secrets
from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from . import models
from .config import settings
from .db import SessionLocal
from .errors import ApiError, fail
from .pricing import Quote
from .util import now

RETRY_AFTER = {"Retry-After": "5"}
TTL = {
    "image": timedelta(minutes=12),
    "video": timedelta(minutes=20),
    "text": timedelta(minutes=3),
    "script_parse": timedelta(minutes=5),
}


@dataclass(frozen=True)
class CaptureResult:
    uncollected: bool
    charged: int
    attempt_matched: bool
    replayed: bool
    payload: dict | None = None


def canonical_request_hash(body: dict) -> str:
    obj = dict(body or {})
    obj.pop("clientRequestId", None)
    if "n" not in obj:
        obj["n"] = 1
    if obj.get("modality") == "video" and "duration" not in obj:
        obj["duration"] = 5
    payload = json.dumps(obj, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _ttl_for(modality: str, unit: str) -> timedelta:
    if unit == "script_parse":
        return TTL["script_parse"]
    return TTL.get(modality, TTL["text"])


def _quote_dict(quote: Quote) -> dict:
    return {
        "model_id": quote.model_id,
        "modality": quote.modality,
        "unit": quote.unit,
        "unit_count": quote.unit_count,
        "unit_price": quote.unit_price,
        "credits": quote.credits,
        "quality": quote.quality,
        "resolution": quote.resolution,
        "rule_id": quote.rule_id,
    }


def _lock_user(db: Session, user_id: int) -> models.User:
    user = db.execute(select(models.User).where(models.User.id == user_id).with_for_update()).scalar_one_or_none()
    if user is None:
        fail(1004, "用户不存在", 404)
    return user


def _deduct(db: Session, user_id: int, amount: int) -> None:
    result = db.execute(
        update(models.User)
        .where(models.User.id == user_id, models.User.credits >= amount)
        .values(credits=models.User.credits - amount)
    )
    if result.rowcount != 1:
        fail(2003, "积分不足", 402)


def _credit(db: Session, user_id: int, amount: int) -> None:
    db.execute(update(models.User).where(models.User.id == user_id).values(credits=models.User.credits + amount))


def _consume_layer(db: Session, model, pk_clause, cost: int, layer_name: str) -> None:
    row = db.execute(select(model).where(pk_clause).with_for_update()).scalar_one_or_none()
    if row is None or row.quota_limit <= 0:
        return
    result = db.execute(
        update(model)
        .where(pk_clause, model.quota_limit > 0, model.quota_consumed + cost <= model.quota_limit)
        .values(quota_consumed=model.quota_consumed + cost)
    )
    if result.rowcount != 1:
        fail(2004, f"{layer_name}额度不足", 402)


def _restore_layer(db: Session, model, pk_clause, cost: int) -> None:
    row = db.execute(select(model).where(pk_clause).with_for_update()).scalar_one_or_none()
    if row is None or row.quota_limit <= 0:
        return
    restored = row.quota_consumed - cost
    if restored < 0:
        restored = 0
    db.execute(update(model).where(pk_clause, model.quota_limit > 0).values(quota_consumed=restored))


def consume_quotas(db: Session, organization_id: int | None, project_id: int | None, cost: int) -> None:
    if not settings.billing_enforce_quotas or cost <= 0:
        return
    _consume_layer(db, models.BillingEnterpriseQuota, models.BillingEnterpriseQuota.id == 1, cost, "企业")
    if organization_id:
        _consume_layer(
            db,
            models.BillingOrganizationQuota,
            models.BillingOrganizationQuota.organization_id == organization_id,
            cost,
            "组织",
        )
    if project_id:
        _consume_layer(
            db,
            models.BillingProjectQuota,
            models.BillingProjectQuota.project_id == project_id,
            cost,
            "项目",
        )


def restore_quotas(db: Session, organization_id: int | None, project_id: int | None, cost: int) -> None:
    if not settings.billing_enforce_quotas or cost <= 0:
        return
    _restore_layer(db, models.BillingEnterpriseQuota, models.BillingEnterpriseQuota.id == 1, cost)
    if organization_id:
        _restore_layer(
            db,
            models.BillingOrganizationQuota,
            models.BillingOrganizationQuota.organization_id == organization_id,
            cost,
        )
    if project_id:
        _restore_layer(
            db,
            models.BillingProjectQuota,
            models.BillingProjectQuota.project_id == project_id,
            cost,
        )


def quotas_sufficient(
    db: Session, organization_id: int | None, project_id: int | None, cost: int
) -> tuple[bool, str | None]:
    if not settings.billing_enforce_quotas or cost <= 0:
        return True, None
    layers = [
        (db.get(models.BillingEnterpriseQuota, 1), "企业"),
        (
            db.get(models.BillingOrganizationQuota, organization_id) if organization_id else None,
            "组织",
        ),
        (db.get(models.BillingProjectQuota, project_id) if project_id else None, "项目"),
    ]
    for row, name in layers:
        if row is None or row.quota_limit <= 0:
            continue
        if row.quota_consumed + cost > row.quota_limit:
            return False, f"{name}额度不足"
    return True, None


def read_wallet(user_id: int) -> tuple[int, int]:
    db = SessionLocal()
    try:
        user = db.get(models.User, user_id)
        return (int(user.credits) if user else 0, frozen_credits(db, user_id))
    finally:
        db.close()


def frozen_credits(db: Session, user_id: int) -> int:
    from sqlalchemy import func

    total = (
        db.query(func.coalesce(func.sum(models.BillingReservation.amount), 0))
        .filter_by(user_id=user_id, status="held")
        .scalar()
    )
    return int(total or 0)


def _in_progress() -> None:
    fail(1005, "生成进行中", 409, headers=RETRY_AFTER)


def _resume_existing(db: Session, row: models.BillingReservation, request_hash: str) -> models.BillingReservation:
    if row.request_hash != request_hash:
        fail(1006, "幂等键与请求体不一致", 409)
    if row.status == "held":
        _in_progress()
    if row.status == "captured":
        db.expunge(row)
        return row
    if row.status in {"refunded", "expired"}:
        return _retry_held(db, row, request_hash)
    _in_progress()
    raise RuntimeError("unreachable")  # pragma: no cover


def _retry_held(db: Session, row: models.BillingReservation, request_hash: str) -> models.BillingReservation:
    _lock_user(db, row.user_id)
    _deduct(db, row.user_id, row.amount)
    consume_quotas(db, row.organization_id, row.project_id, row.amount)
    result = db.execute(
        update(models.BillingReservation)
        .where(
            models.BillingReservation.user_id == row.user_id,
            models.BillingReservation.idempotency_key == row.idempotency_key,
            models.BillingReservation.request_hash == request_hash,
            models.BillingReservation.status.in_(("refunded", "expired")),
        )
        .values(
            attempt=models.BillingReservation.attempt + 1,
            status="held",
            expires_at=now() + _ttl_for(row.modality, (row.quote or {}).get("unit") or ""),
            updated_at=now(),
            response_payload=None,
            ledger_id=None,
        )
    )
    if result.rowcount != 1:
        db.rollback()
        again = (
            db.query(models.BillingReservation)
            .filter_by(user_id=row.user_id, idempotency_key=row.idempotency_key)
            .first()
        )
        if again and again.status == "captured":
            db.expunge(again)
            return again
        _in_progress()
    db.commit()
    fresh = db.get(models.BillingReservation, row.id)
    db.expunge(fresh)
    return fresh


def _insert_held(
    db: Session,
    *,
    user_id: int,
    organization_id: int | None,
    project_id: int | None,
    key: str,
    request_hash: str,
    quote: Quote,
    reference_type: str,
) -> models.BillingReservation:
    _lock_user(db, user_id)
    _deduct(db, user_id, quote.credits)
    consume_quotas(db, organization_id, project_id, quote.credits)
    row = models.BillingReservation(
        user_id=user_id,
        organization_id=organization_id,
        project_id=project_id,
        idempotency_key=key,
        request_hash=request_hash,
        status="held",
        attempt=1,
        amount=quote.credits,
        model_id=quote.model_id,
        modality=quote.modality,
        quote=_quote_dict(quote),
        reference_type=reference_type,
        expires_at=now() + _ttl_for(quote.modality, quote.unit),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    db.expunge(row)
    return row


def reserve(
    *,
    user_id: int,
    quote: Quote,
    request_body: dict,
    reference_type: str,
    organization_id: int | None = None,
    project_id: int | None = None,
    idempotency_key: str | None = None,
) -> models.BillingReservation:
    key = (idempotency_key or f"req_{secrets.token_hex(12)}").strip()
    if not key or len(key) > 64:
        fail(1001, "Idempotency-Key 无效", 400)
    request_hash = canonical_request_hash(request_body)
    db = SessionLocal()
    try:
        existing = (
            db.query(models.BillingReservation).filter_by(user_id=user_id, idempotency_key=key).first()
        )
        if existing:
            return _resume_existing(db, existing, request_hash)
        return _insert_held(
            db,
            user_id=user_id,
            organization_id=organization_id,
            project_id=project_id,
            key=key,
            request_hash=request_hash,
            quote=quote,
            reference_type=reference_type,
        )
    except IntegrityError:
        db.rollback()
        existing = (
            db.query(models.BillingReservation).filter_by(user_id=user_id, idempotency_key=key).first()
        )
        if not existing:
            fail(1005, "生成进行中", 409, headers=RETRY_AFTER)
        return _resume_existing(db, existing, request_hash)
    except ApiError:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def heartbeat(reservation_id: int, attempt: int) -> bool:
    db = SessionLocal()
    try:
        result = db.execute(
            update(models.BillingReservation)
            .where(
                models.BillingReservation.id == reservation_id,
                models.BillingReservation.attempt == attempt,
                models.BillingReservation.status == "held",
            )
            .values(updated_at=now())
        )
        db.commit()
        return result.rowcount == 1
    finally:
        db.close()


def capture(reservation_id: int, attempt: int, response_payload: dict | None = None) -> CaptureResult:
    db = SessionLocal()
    try:
        peek = db.get(models.BillingReservation, reservation_id)
        if peek is None:
            return CaptureResult(True, 0, False, False)
        if peek.attempt != attempt:
            return CaptureResult(True, 0, False, False, None)
        _lock_user(db, peek.user_id)
        row = db.execute(
            select(models.BillingReservation)
            .where(models.BillingReservation.id == reservation_id, models.BillingReservation.attempt == attempt)
            .with_for_update()
        ).scalar_one_or_none()
        if row is None:
            return CaptureResult(True, 0, False, False)
        if row.attempt != attempt:
            return CaptureResult(True, 0, False, False)
        if row.status == "captured":
            return CaptureResult(False, 0, True, True, row.response_payload)
        if row.status == "held":
            user = db.get(models.User, row.user_id)
            ledger = models.BillingLedger(
                organization_id=row.organization_id,
                project_id=row.project_id,
                user_id=row.user_id,
                entry_type="consume",
                amount=-row.amount,
                balance_after=user.credits if user else None,
                description=(row.model_id or "")[:200],
                reference_type=row.reference_type,
                reference_id=str(row.id),
            )
            db.add(ledger)
            db.flush()
            row.status = "captured"
            row.ledger_id = ledger.id
            row.response_payload = response_payload
            row.updated_at = now()
            db.commit()
            return CaptureResult(False, row.amount, True, False, response_payload)
        if row.status in {"expired", "refunded"}:
            try:
                _deduct(db, row.user_id, row.amount)
                consume_quotas(db, row.organization_id, row.project_id, row.amount)
            except ApiError:
                db.rollback()
                return CaptureResult(True, 0, True, False)
            user = db.get(models.User, row.user_id)
            ledger = models.BillingLedger(
                organization_id=row.organization_id,
                project_id=row.project_id,
                user_id=row.user_id,
                entry_type="consume",
                amount=-row.amount,
                balance_after=user.credits if user else None,
                description=(row.model_id or "")[:200],
                reference_type=row.reference_type,
                reference_id=str(row.id),
            )
            db.add(ledger)
            db.flush()
            row.status = "captured"
            row.ledger_id = ledger.id
            row.response_payload = response_payload
            row.updated_at = now()
            db.commit()
            return CaptureResult(False, row.amount, True, False, response_payload)
        return CaptureResult(True, 0, True, False)
    finally:
        db.close()


def release(reservation_id: int, attempt: int, reason: str = "") -> bool:
    db = SessionLocal()
    try:
        peek = db.get(models.BillingReservation, reservation_id)
        if peek is None:
            return False
        _lock_user(db, peek.user_id)
        row = db.execute(
            select(models.BillingReservation)
            .where(
                models.BillingReservation.id == reservation_id,
                models.BillingReservation.attempt == attempt,
            )
            .with_for_update()
        ).scalar_one_or_none()
        if row is None or row.status != "held":
            db.commit()
            return False
        _credit(db, row.user_id, row.amount)
        restore_quotas(db, row.organization_id, row.project_id, row.amount)
        row.status = "refunded"
        row.updated_at = now()
        if reason:
            meta = dict(row.extra_metadata or {})
            meta["releaseReason"] = reason[:64]
            row.extra_metadata = meta
        db.commit()
        return True
    finally:
        db.close()


def _expire_one(reservation_id: int, attempt: int) -> None:
    db = SessionLocal()
    try:
        peek = db.get(models.BillingReservation, reservation_id)
        if peek is None:
            return
        _lock_user(db, peek.user_id)
        row = db.execute(
            select(models.BillingReservation)
            .where(
                models.BillingReservation.id == reservation_id,
                models.BillingReservation.attempt == attempt,
                models.BillingReservation.status == "held",
            )
            .with_for_update()
        ).scalar_one_or_none()
        if row is None:
            db.rollback()
            return
        _credit(db, row.user_id, row.amount)
        restore_quotas(db, row.organization_id, row.project_id, row.amount)
        row.status = "expired"
        row.updated_at = now()
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


def sweep_once() -> int:
    db = SessionLocal()
    stale_after = now() - timedelta(seconds=120)
    try:
        rows = (
            db.query(models.BillingReservation.id, models.BillingReservation.attempt)
            .filter(
                models.BillingReservation.status == "held",
                models.BillingReservation.expires_at < now(),
                models.BillingReservation.updated_at < stale_after,
            )
            .all()
        )
    finally:
        db.close()
    for reservation_id, attempt in rows:
        _expire_one(reservation_id, attempt)
    return len(rows)


def grant(*, target_user_id: int, amount: int, description: str, admin_id: int) -> dict:
    if amount <= 0:
        fail(1001, "发放金额必须大于 0", 400)
    db = SessionLocal()
    try:
        user = _lock_user(db, target_user_id)
        user.credits = user.credits + amount
        ledger = models.BillingLedger(
            user_id=user.id,
            entry_type="allocate",
            amount=amount,
            balance_after=user.credits,
            description=(description or "管理员发放")[:200],
            reference_type="admin",
            reference_id=str(admin_id),
        )
        db.add(ledger)
        db.commit()
        return {"userId": user.id, "amount": amount, "balance": user.credits}
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def adjust(*, target_user_id: int, amount: int, description: str, admin_id: int) -> dict:
    if amount == 0:
        fail(1001, "调整金额不能为 0", 400)
    db = SessionLocal()
    try:
        user = _lock_user(db, target_user_id)
        if amount < 0 and user.credits < abs(amount):
            fail(2003, "积分不足", 402)
        user.credits = user.credits + amount
        ledger = models.BillingLedger(
            user_id=user.id,
            entry_type="adjust",
            amount=amount,
            balance_after=user.credits,
            description=(description or "管理员调整")[:200],
            reference_type="admin",
            reference_id=str(admin_id),
        )
        db.add(ledger)
        db.commit()
        return {"userId": user.id, "amount": amount, "balance": user.credits}
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
