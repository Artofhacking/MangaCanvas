from datetime import timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import models
from app.billing_service import (
    canonical_request_hash,
    capture,
    frozen_credits,
    grant,
    heartbeat,
    release,
    reserve,
    sweep_once,
)
from app.db import Base
from app.errors import ApiError
from app.pricing import quote_request
from app.seed import seed_price_rules
from app.util import now


@pytest.fixture
def engine(tmp_path):
    return create_engine(f"sqlite:///{tmp_path / 'wallet.db'}", future=True, connect_args={"check_same_thread": False})


@pytest.fixture
def Session(engine):
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


@pytest.fixture
def db(Session):
    session = Session()
    session.add(
        models.Role(
            id=1,
            code="super_admin",
            name="超级管理员",
            can_create_organization=True,
            can_create_project=True,
            can_manage_project_members=True,
            list_all_projects=True,
            list_organization_projects=True,
        )
    )
    session.add(
        models.Role(
            id=3,
            code="employee",
            name="员工",
            can_create_organization=False,
            can_create_project=True,
            can_manage_project_members=False,
            list_all_projects=False,
            list_organization_projects=False,
        )
    )
    session.flush()
    session.add(models.User(role_id=1, username="admin", email="admin@x.com", credits=10000))
    session.add(models.User(role_id=3, username="emp", email="emp@x.com", credits=1000))
    seed_price_rules(session)
    session.commit()
    yield session
    session.close()


@pytest.fixture(autouse=True)
def patch_sessions(monkeypatch, Session):
    monkeypatch.setattr("app.billing_service.SessionLocal", Session)


def _emp(db):
    return db.query(models.User).filter_by(email="emp@x.com").one()


def test_request_hash_golden_and_defaults():
    expected = canonical_request_hash({"model": "gpt-image-2", "modality": "image", "n": 1})
    assert canonical_request_hash({"model": "gpt-image-2", "modality": "image"}) == expected
    payload = '{"modality":"image","model":"gpt-image-2","n":1}'
    import hashlib

    assert expected == hashlib.sha256(payload.encode("utf-8")).hexdigest()
    assert canonical_request_hash({"model": "happyhorse-1.1-t2v", "modality": "video"}) == canonical_request_hash(
        {"model": "happyhorse-1.1-t2v", "modality": "video", "duration": 5, "n": 1}
    )
    left = canonical_request_hash({"model": "x", "modality": "image", "images": ["b", "a"]})
    right = canonical_request_hash({"model": "x", "modality": "image", "images": ["a", "b"]})
    assert left != right


def test_grant_and_adjust(db):
    emp = _emp(db)
    out = grant(target_user_id=emp.id, amount=50, description="活动", admin_id=1)
    db.expire_all()
    emp = _emp(db)
    assert out["balance"] == 1050
    assert emp.credits == 1050
    from app.billing_service import adjust

    adjust(target_user_id=emp.id, amount=-20, description="扣回", admin_id=1)
    db.expire_all()
    assert _emp(db).credits == 1030


def test_reserve_capture_does_not_double_charge(db):
    emp = _emp(db)
    quoted = quote_request(db, model="gpt-image-2", modality="image", n=1)
    assert quoted.credits == 39
    row = reserve(
        user_id=emp.id,
        quote=quoted,
        request_body={"model": "gpt-image-2", "modality": "image"},
        reference_type="ai_image",
        idempotency_key="k1",
    )
    db.expire_all()
    assert _emp(db).credits == 1000 - 39
    assert frozen_credits(db, emp.id) == 39
    result = capture(row.id, row.attempt, {"urls": ["/static/a.png"]})
    assert result.uncollected is False
    assert result.charged == 39
    assert result.replayed is False
    db.expire_all()
    emp = _emp(db)
    assert emp.credits == 961
    consume = db.query(models.BillingLedger).filter_by(user_id=emp.id, entry_type="consume").one()
    assert consume.amount == -39
    replay = capture(row.id, row.attempt, {"urls": ["/static/a.png"]})
    assert replay.replayed is True
    assert replay.charged == 0
    db.expire_all()
    assert _emp(db).credits == 961


def test_release_refunds(db):
    emp = _emp(db)
    quoted = quote_request(db, model="wan2.7-image", modality="image")
    row = reserve(
        user_id=emp.id,
        quote=quoted,
        request_body={"model": "wan2.7-image", "modality": "image"},
        reference_type="ai_image",
        idempotency_key="k-rel",
    )
    assert release(row.id, row.attempt, reason="fail")
    db.expire_all()
    assert _emp(db).credits == 1000
    reservation = db.query(models.BillingReservation).filter_by(idempotency_key="k-rel").one()
    assert reservation.status == "refunded"
    refunds = db.query(models.BillingLedger).filter_by(user_id=emp.id, entry_type="refund").all()
    assert len(refunds) == 1
    refund = refunds[0]
    assert refund.amount == quoted.credits
    assert refund.amount > 0
    assert refund.balance_after == 1000
    assert refund.reference_type == "ai_image"
    assert refund.reference_id == str(row.id)
    assert refund.project_id == row.project_id
    assert "退回" in (refund.description or "")
    assert (refund.extra_metadata or {}).get("reason") == "fail"
    assert release(row.id, row.attempt, reason="fail") is False
    db.expire_all()
    assert db.query(models.BillingLedger).filter_by(user_id=emp.id, entry_type="refund").count() == 1
    assert db.query(models.BillingLedger).filter_by(user_id=emp.id, entry_type="consume").count() == 0


def test_insufficient_credits(db):
    emp = _emp(db)
    emp.credits = 1
    db.commit()
    quoted = quote_request(db, model="gpt-image-2", modality="image")
    with pytest.raises(ApiError) as exc:
        reserve(
            user_id=emp.id,
            quote=quoted,
            request_body={"model": "gpt-image-2", "modality": "image"},
            reference_type="ai_image",
            idempotency_key="k-poor",
        )
    assert exc.value.code == 2003
    db.expire_all()
    assert _emp(db).credits == 1


def test_held_conflict_and_hash_mismatch(db):
    emp = _emp(db)
    quoted = quote_request(db, model="gpt-image-2", modality="image")
    reserve(
        user_id=emp.id,
        quote=quoted,
        request_body={"model": "gpt-image-2", "modality": "image"},
        reference_type="ai_image",
        idempotency_key="k-hold",
    )
    with pytest.raises(ApiError) as exc:
        reserve(
            user_id=emp.id,
            quote=quoted,
            request_body={"model": "gpt-image-2", "modality": "image"},
            reference_type="ai_image",
            idempotency_key="k-hold",
        )
    assert exc.value.code == 1005
    with pytest.raises(ApiError) as exc:
        reserve(
            user_id=emp.id,
            quote=quoted,
            request_body={"model": "gpt-image-2", "modality": "image", "quality": "high"},
            reference_type="ai_image",
            idempotency_key="k-hold",
        )
    assert exc.value.code == 1006


def test_heartbeat_and_sweep_then_retry(db, Session):
    emp = _emp(db)
    quoted = quote_request(db, model="gpt-image-2", modality="image")
    row = reserve(
        user_id=emp.id,
        quote=quoted,
        request_body={"model": "gpt-image-2", "modality": "image"},
        reference_type="ai_image",
        idempotency_key="k-exp",
    )
    assert heartbeat(row.id, row.attempt)
    s = Session()
    held = s.get(models.BillingReservation, row.id)
    held.expires_at = now() - timedelta(minutes=1)
    held.updated_at = now() - timedelta(seconds=130)
    s.commit()
    s.close()
    assert sweep_once() == 1
    db.expire_all()
    assert _emp(db).credits == 1000
    expired = db.query(models.BillingReservation).filter_by(idempotency_key="k-exp").one()
    assert expired.status == "expired"
    releases = db.query(models.BillingLedger).filter_by(user_id=emp.id, entry_type="release").all()
    assert len(releases) == 1
    returned = releases[0]
    assert returned.amount == quoted.credits
    assert returned.amount > 0
    assert returned.balance_after == 1000
    assert returned.reference_id == str(row.id)
    assert "释放" in (returned.description or "")
    assert (returned.extra_metadata or {}).get("reason") == "expired"
    again = reserve(
        user_id=emp.id,
        quote=quoted,
        request_body={"model": "gpt-image-2", "modality": "image"},
        reference_type="ai_image",
        idempotency_key="k-exp",
    )
    assert again.attempt == 2
    assert again.status == "held"
    db.expire_all()
    assert _emp(db).credits == 961
    assert db.query(models.BillingLedger).filter_by(user_id=emp.id, entry_type="release").count() == 1


def test_refund_visible_in_history_and_not_earned(db, monkeypatch):
    import json

    from app.routers.credits import balance, history

    emp = _emp(db)
    quoted = quote_request(db, model="gpt-image-2", modality="image", n=1)
    row = reserve(
        user_id=emp.id,
        quote=quoted,
        request_body={"model": "gpt-image-2", "modality": "image"},
        reference_type="ai_image",
        idempotency_key="k-hist",
    )
    assert release(row.id, row.attempt, reason="finally")
    db.expire_all()
    emp = _emp(db)
    monkeypatch.setattr("app.routers.credits.settings.billing_enabled", False)
    summary = json.loads(balance(user=emp, db=db).body)
    assert summary["data"]["billingEnabled"] is False
    assert summary["data"]["balance"] == 1000
    assert summary["data"]["totalEarned"] == 0
    assert summary["data"]["totalUsed"] == 0
    monkeypatch.setattr("app.routers.credits.settings.billing_enabled", True)
    enabled = json.loads(balance(user=emp, db=db).body)
    assert enabled["data"]["billingEnabled"] is True
    page = json.loads(history(page=1, size=20, entryType=None, user=emp, db=db).body)
    items = page["data"]["list"]
    assert len(items) == 1
    assert items[0]["entryType"] == "refund"
    assert items[0]["amount"] == quoted.credits
    assert items[0]["referenceId"] == str(row.id)
    filtered = json.loads(history(page=1, size=20, entryType="refund", user=emp, db=db).body)
    assert filtered["data"]["pagination"]["total"] == 1
