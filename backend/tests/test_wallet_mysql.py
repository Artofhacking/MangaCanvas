import os
import threading

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import models
from app.billing_service import reserve
from app.db import Base
from app.errors import ApiError
from app.pricing import quote_request
from app.seed import seed_price_rules

URL = os.environ.get("TEST_DATABASE_URL", "")

pytestmark = pytest.mark.skipif(not URL.startswith("mysql"), reason="TEST_DATABASE_URL mysql required")


@pytest.fixture
def mysql_session(monkeypatch):
    engine = create_engine(URL, future=True, pool_pre_ping=True)
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    monkeypatch.setattr("app.billing_service.SessionLocal", Session)
    session = Session()
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
    session.add(models.User(role_id=3, username="emp", email="emp@x.com", credits=1000))
    seed_price_rules(session)
    session.commit()
    yield session
    session.close()


def test_concurrent_retry_after_expire(mysql_session, monkeypatch):
    from datetime import timedelta

    from app.billing_service import sweep_once
    from app.util import now

    db = mysql_session
    emp = db.query(models.User).filter_by(email="emp@x.com").one()
    quoted = quote_request(db, model="gpt-image-2", modality="image")
    # quote_request starts a MySQL REPEATABLE READ snapshot; close it so we can
    # see the reservation that reserve() commits on a separate SessionLocal.
    user_id = emp.id
    db.commit()
    row = reserve(
        user_id=user_id,
        quote=quoted,
        request_body={"model": "gpt-image-2", "modality": "image"},
        reference_type="ai_image",
        idempotency_key="k-race",
    )
    held = db.get(models.BillingReservation, row.id)
    assert held is not None
    held.expires_at = now() - timedelta(minutes=1)
    held.updated_at = now() - timedelta(seconds=130)
    db.commit()
    sweep_once()
    results: list[str] = []

    def _run():
        try:
            again = reserve(
                user_id=user_id,
                quote=quoted,
                request_body={"model": "gpt-image-2", "modality": "image"},
                reference_type="ai_image",
                idempotency_key="k-race",
            )
            results.append(f"held:{again.attempt}")
        except ApiError as exc:
            results.append(f"err:{exc.code}")

    t1 = threading.Thread(target=_run)
    t2 = threading.Thread(target=_run)
    t1.start()
    t2.start()
    t1.join()
    t2.join()
    assert any(item.startswith("held:") for item in results)
    assert "err:1005" in results
    db.expire_all()
    emp = db.query(models.User).filter_by(email="emp@x.com").one()
    assert emp.credits == 1000 - 39
    held_rows = db.query(models.BillingReservation).filter_by(idempotency_key="k-race", status="held").all()
    assert len(held_rows) == 1
