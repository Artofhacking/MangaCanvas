from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import models
from ..db import get_db
from ..deps import current_user, require_project_access
from ..errors import fail, ok
from ..util import iso, now

router = APIRouter(prefix="/billing")


class QuotaIn(BaseModel):
    quotaPercent: float | None = None
    quotaLimit: int | None = None


def _org_quota(row: models.BillingOrganizationQuota) -> dict:
    return {
        "organizationId": row.organization_id,
        "quotaPercent": row.quota_percent,
        "quotaLimit": row.quota_limit,
        "quotaConsumed": row.quota_consumed,
        "updatedAt": iso(row.updated_at),
    }


def _project_quota(row: models.BillingProjectQuota) -> dict:
    return {
        "projectId": row.project_id,
        "quotaPercent": row.quota_percent,
        "quotaLimit": row.quota_limit,
        "quotaConsumed": row.quota_consumed,
        "updatedAt": iso(row.updated_at),
    }


def _user_quota(row: models.BillingUserProjectQuota) -> dict:
    return {
        "projectId": row.project_id,
        "userId": row.user_id,
        "quotaPercent": row.quota_percent,
        "quotaLimit": row.quota_limit,
        "quotaConsumed": row.quota_consumed,
        "updatedAt": iso(row.updated_at),
    }


@router.get("/enterprise/quota")
def get_enterprise(user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    row = db.get(models.BillingEnterpriseQuota, 1)
    if not row:
        row = models.BillingEnterpriseQuota(id=1)
        db.add(row)
        db.flush()
    return ok(
        {
            "quotaLimit": row.quota_limit,
            "quotaConsumed": row.quota_consumed,
            "updatedAt": iso(row.updated_at),
        }
    )


@router.put("/enterprise/quota")
def put_enterprise(body: QuotaIn, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    if not user.role or user.role.code != "super_admin":
        fail(1003, "禁止访问", 403)
    row = db.get(models.BillingEnterpriseQuota, 1) or models.BillingEnterpriseQuota(id=1)
    db.add(row)
    if body.quotaLimit is not None:
        row.quota_limit = body.quotaLimit
    row.updated_at = now()
    db.flush()
    return ok(
        {
            "quotaLimit": row.quota_limit,
            "quotaConsumed": row.quota_consumed,
            "updatedAt": iso(row.updated_at),
        }
    )


@router.get("/organizations/{organization_id}/quota")
def get_org_quota(
    organization_id: int, user: models.User = Depends(current_user), db: Session = Depends(get_db)
):
    row = db.get(models.BillingOrganizationQuota, organization_id)
    if not row:
        row = models.BillingOrganizationQuota(organization_id=organization_id)
        db.add(row)
        db.flush()
    return ok(_org_quota(row))


@router.put("/organizations/{organization_id}/quota")
def put_org_quota(
    organization_id: int,
    body: QuotaIn,
    user: models.User = Depends(current_user),
    db: Session = Depends(get_db),
):
    if not user.role or user.role.code not in ("super_admin", "admin"):
        fail(1003, "禁止访问", 403)
    row = db.get(models.BillingOrganizationQuota, organization_id) or models.BillingOrganizationQuota(
        organization_id=organization_id
    )
    db.add(row)
    if body.quotaPercent is not None:
        row.quota_percent = body.quotaPercent
    if body.quotaLimit is not None:
        row.quota_limit = body.quotaLimit
    row.updated_at = now()
    db.flush()
    return ok(_org_quota(row))


@router.get("/projects/{project_id}/quota")
def get_project_quota(
    project_id: int, user: models.User = Depends(current_user), db: Session = Depends(get_db)
):
    require_project_access(db, user, project_id)
    row = db.get(models.BillingProjectQuota, project_id)
    if not row:
        row = models.BillingProjectQuota(project_id=project_id)
        db.add(row)
        db.flush()
    return ok(_project_quota(row))


@router.put("/projects/{project_id}/quota")
def put_project_quota(
    project_id: int,
    body: QuotaIn,
    user: models.User = Depends(current_user),
    db: Session = Depends(get_db),
):
    require_project_access(db, user, project_id, write=True)
    row = db.get(models.BillingProjectQuota, project_id) or models.BillingProjectQuota(project_id=project_id)
    db.add(row)
    if body.quotaPercent is not None:
        row.quota_percent = body.quotaPercent
    if body.quotaLimit is not None:
        row.quota_limit = body.quotaLimit
    row.updated_at = now()
    db.flush()
    return ok(_project_quota(row))


@router.get("/projects/{project_id}/users/{user_id}/quota")
def get_user_quota(
    project_id: int, user_id: int, user: models.User = Depends(current_user), db: Session = Depends(get_db)
):
    require_project_access(db, user, project_id)
    row = (
        db.query(models.BillingUserProjectQuota)
        .filter_by(project_id=project_id, user_id=user_id)
        .first()
    )
    if not row:
        row = models.BillingUserProjectQuota(project_id=project_id, user_id=user_id)
        db.add(row)
        db.flush()
    return ok(_user_quota(row))


@router.put("/projects/{project_id}/users/{user_id}/quota")
def put_user_quota(
    project_id: int,
    user_id: int,
    body: QuotaIn,
    user: models.User = Depends(current_user),
    db: Session = Depends(get_db),
):
    require_project_access(db, user, project_id, write=True)
    row = (
        db.query(models.BillingUserProjectQuota)
        .filter_by(project_id=project_id, user_id=user_id)
        .first()
    )
    if not row:
        row = models.BillingUserProjectQuota(project_id=project_id, user_id=user_id)
        db.add(row)
    if body.quotaPercent is not None:
        row.quota_percent = body.quotaPercent
    if body.quotaLimit is not None:
        row.quota_limit = body.quotaLimit
    row.updated_at = now()
    db.flush()
    return ok(_user_quota(row))
