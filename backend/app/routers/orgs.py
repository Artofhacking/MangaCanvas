from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import models, serialize
from ..db import get_db
from ..deps import current_user, org_ids_of, require_org_member
from ..errors import fail, ok
from ..util import iso, paginate

router = APIRouter(prefix="/organizations")


class OrgIn(BaseModel):
    name: str


class OrgMemberIn(BaseModel):
    userId: int


@router.post("")
def create_org(body: OrgIn, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    if not user.role or not user.role.can_create_organization:
        fail(1003, "禁止访问", 403)
    org = models.Organization(name=body.name, created_by=user.id)
    db.add(org)
    db.flush()
    db.add(models.OrganizationMember(organization_id=org.id, user_id=user.id, assigned_by=user.id))
    db.add(
        models.BillingOrganizationQuota(
            organization_id=org.id, quota_percent=0, quota_limit=0, quota_consumed=0
        )
    )
    return ok(serialize.organization(org))


@router.get("")
def list_orgs(
    page: int = 1,
    size: int = 20,
    user: models.User = Depends(current_user),
    db: Session = Depends(get_db),
):
    if user.role and user.role.list_all_projects:
        orgs = db.query(models.Organization).all()
    else:
        ids = org_ids_of(db, user.id)
        orgs = db.query(models.Organization).filter(models.Organization.id.in_(ids)).all() if ids else []
    sliced, pagination = paginate([serialize.organization(o) for o in orgs], page, size)
    return ok({"list": sliced, "pagination": pagination})


@router.get("/{organization_id}")
def get_org(organization_id: int, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    require_org_member(db, user, organization_id)
    org = db.get(models.Organization, organization_id)
    if not org:
        fail(1004, "组织不存在", 404)
    return ok(serialize.organization(org))


@router.get("/{organization_id}/members")
def list_members(organization_id: int, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    require_org_member(db, user, organization_id)
    rows = db.query(models.OrganizationMember).filter_by(organization_id=organization_id).all()
    items = []
    for row in rows:
        member_user = db.get(models.User, row.user_id)
        items.append(
            {
                "userId": row.user_id,
                "organizationId": row.organization_id,
                "assignedBy": row.assigned_by,
                "joinedAt": iso(row.joined_at),
                "user": {
                    "id": member_user.id,
                    "username": member_user.username,
                    "email": member_user.email,
                    "avatar": member_user.avatar,
                }
                if member_user
                else None,
            }
        )
    return ok({"list": items, "pagination": {"page": 1, "size": len(items), "total": len(items)}})


@router.post("/{organization_id}/members")
def add_member(
    organization_id: int,
    body: OrgMemberIn,
    user: models.User = Depends(current_user),
    db: Session = Depends(get_db),
):
    require_org_member(db, user, organization_id)
    target = db.get(models.User, body.userId)
    if not target:
        fail(1004, "用户不存在", 404)
    exists = (
        db.query(models.OrganizationMember)
        .filter_by(organization_id=organization_id, user_id=body.userId)
        .first()
    )
    if exists:
        fail(1005, "资源冲突", 409)
    row = models.OrganizationMember(
        organization_id=organization_id, user_id=body.userId, assigned_by=user.id
    )
    db.add(row)
    db.flush()
    return ok(
        {
            "userId": row.user_id,
            "organizationId": row.organization_id,
            "assignedBy": row.assigned_by,
            "joinedAt": iso(row.joined_at),
            "user": {
                "id": target.id,
                "username": target.username,
                "email": target.email,
                "avatar": target.avatar,
            },
        }
    )


@router.delete("/{organization_id}/members/{user_id}")
def remove_member(
    organization_id: int,
    user_id: int,
    user: models.User = Depends(current_user),
    db: Session = Depends(get_db),
):
    require_org_member(db, user, organization_id)
    row = (
        db.query(models.OrganizationMember)
        .filter_by(organization_id=organization_id, user_id=user_id)
        .first()
    )
    if not row:
        fail(1004, "资源不存在", 404)
    db.delete(row)
    return ok(True)
