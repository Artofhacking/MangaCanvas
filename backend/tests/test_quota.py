import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import joinedload, sessionmaker

from app import models
from app.billing_service import release, reserve
from app.db import Base
from app.errors import ApiError
from app.pricing import quote_request
from app.routers.billing import get_org_quota, get_project_quota
from app.schema_migrate import migrate_schema
from app.seed import seed_price_rules


@pytest.fixture
def engine(tmp_path):
    return create_engine(f"sqlite:///{tmp_path / 'quota.db'}", future=True, connect_args={"check_same_thread": False})


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
            name="超管",
            can_create_organization=True,
            can_create_project=True,
            can_manage_project_members=True,
            list_all_projects=True,
            list_organization_projects=True,
        )
    )
    session.flush()
    user = models.User(role_id=1, username="admin", email="admin@x.com", credits=5000)
    session.add(user)
    session.flush()
    org = models.Organization(name="Studio", created_by=user.id)
    session.add(org)
    session.flush()
    project = models.Project(organization_id=org.id, name="P", owner_id=user.id)
    session.add(project)
    session.add(models.BillingEnterpriseQuota(id=1, quota_limit=1_000_000, quota_consumed=0))
    seed_price_rules(session)
    session.commit()
    yield session
    session.close()


@pytest.fixture
def admin(db):
    row = db.query(models.User).options(joinedload(models.User.role)).filter_by(email="admin@x.com").one()
    db.expunge(row)
    return row


@pytest.fixture(autouse=True)
def patch_sessions(monkeypatch, Session):
    monkeypatch.setattr("app.billing_service.SessionLocal", Session)


def test_lazy_create_does_not_enable_cap(db, admin):
    project = db.query(models.Project).filter_by(name="P").one()
    org = db.query(models.Organization).filter_by(name="Studio").one()
    payload = get_project_quota(project.id, user=admin, db=db).body
    import json

    data = json.loads(payload)
    assert data["data"]["quotaLimit"] == 0
    assert data["data"]["remaining"] is None
    org_payload = json.loads(get_org_quota(org.id, user=admin, db=db).body)
    assert org_payload["data"]["quotaLimit"] == 0


def test_limit_zero_allows_reserve(db, monkeypatch):
    monkeypatch.setattr("app.billing_service.settings.billing_enforce_quotas", True)
    user = db.query(models.User).filter_by(email="admin@x.com").one()
    project = db.query(models.Project).filter_by(name="P").one()
    db.add(models.BillingProjectQuota(project_id=project.id, quota_limit=0, quota_consumed=0))
    db.commit()
    quoted = quote_request(db, model="gpt-image-2", modality="image")
    row = reserve(
        user_id=user.id,
        quote=quoted,
        request_body={"model": "gpt-image-2", "modality": "image"},
        reference_type="ai_image",
        organization_id=project.organization_id,
        project_id=project.id,
        idempotency_key="q-zero",
    )
    assert row.status == "held"


def test_enterprise_cap_blocks(db, monkeypatch):
    monkeypatch.setattr("app.billing_service.settings.billing_enforce_quotas", True)
    ent = db.get(models.BillingEnterpriseQuota, 1)
    ent.quota_limit = 10
    ent.quota_consumed = 0
    db.commit()
    user = db.query(models.User).filter_by(email="admin@x.com").one()
    quoted = quote_request(db, model="gpt-image-2", modality="image")
    with pytest.raises(ApiError) as exc:
        reserve(
            user_id=user.id,
            quote=quoted,
            request_body={"model": "gpt-image-2", "modality": "image"},
            reference_type="ai_image",
            idempotency_key="q-ent",
        )
    assert exc.value.code == 2004
    db.expire_all()
    assert db.query(models.User).filter_by(email="admin@x.com").one().credits == 5000
    assert db.get(models.BillingEnterpriseQuota, 1).quota_consumed == 0


def test_project_cap_consume_and_release(db, monkeypatch):
    monkeypatch.setattr("app.billing_service.settings.billing_enforce_quotas", True)
    user = db.query(models.User).filter_by(email="admin@x.com").one()
    project = db.query(models.Project).filter_by(name="P").one()
    db.add(models.BillingProjectQuota(project_id=project.id, quota_limit=100, quota_consumed=0))
    db.commit()
    quoted = quote_request(db, model="gpt-image-2", modality="image")
    row = reserve(
        user_id=user.id,
        quote=quoted,
        request_body={"model": "gpt-image-2", "modality": "image"},
        reference_type="ai_image",
        organization_id=project.organization_id,
        project_id=project.id,
        idempotency_key="q-proj",
    )
    db.expire_all()
    assert db.get(models.BillingProjectQuota, project.id).quota_consumed == 39
    release(row.id, row.attempt, reason="fail")
    db.expire_all()
    assert db.get(models.BillingProjectQuota, project.id).quota_consumed == 0
    assert db.query(models.User).filter_by(email="admin@x.com").one().credits == 5000


def test_migrate_zeros_default_project_caps(engine, Session):
    session = Session()
    session.add(
        models.Role(
            id=1,
            code="super_admin",
            name="超管",
            can_create_organization=True,
            can_create_project=True,
            can_manage_project_members=True,
            list_all_projects=True,
            list_organization_projects=True,
        )
    )
    session.flush()
    user = models.User(role_id=1, username="u2", email="u2@x.com", credits=1)
    session.add(user)
    session.flush()
    org = models.Organization(name="O2", created_by=user.id)
    session.add(org)
    session.flush()
    p1 = models.Project(organization_id=org.id, name="idle", owner_id=user.id)
    p2 = models.Project(organization_id=org.id, name="demo", owner_id=user.id)
    session.add_all([p1, p2])
    session.flush()
    session.add(models.BillingProjectQuota(project_id=p1.id, quota_limit=100000, quota_consumed=0))
    session.add(models.BillingProjectQuota(project_id=p2.id, quota_limit=300000, quota_consumed=12000))
    session.commit()
    session.close()
    migrate_schema(engine)
    session = Session()
    idle = (
        session.query(models.BillingProjectQuota)
        .join(models.Project, models.Project.id == models.BillingProjectQuota.project_id)
        .filter(models.Project.name == "idle")
        .one()
    )
    demo = (
        session.query(models.BillingProjectQuota)
        .join(models.Project, models.Project.id == models.BillingProjectQuota.project_id)
        .filter(models.Project.name == "demo")
        .one()
    )
    assert idle.quota_limit == 0
    assert demo.quota_limit == 300000
    session.close()
