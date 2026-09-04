from sqlalchemy.orm import Session

from . import models
from .config import settings
from .security import hash_password


def seed_if_empty(db: Session) -> None:
    if db.query(models.Role).count() == 0:
        db.add_all(
            [
                models.Role(
                    id=1,
                    code="super_admin",
                    name="超级管理员",
                    can_create_organization=True,
                    can_create_project=True,
                    can_manage_project_members=True,
                    list_all_projects=True,
                    list_organization_projects=True,
                ),
                models.Role(
                    id=2,
                    code="admin",
                    name="管理员",
                    can_create_organization=False,
                    can_create_project=True,
                    can_manage_project_members=True,
                    list_all_projects=False,
                    list_organization_projects=True,
                ),
                models.Role(
                    id=3,
                    code="employee",
                    name="员工",
                    can_create_organization=False,
                    can_create_project=True,
                    can_manage_project_members=False,
                    list_all_projects=False,
                    list_organization_projects=False,
                ),
            ]
        )
        db.flush()

    if db.query(models.User).filter_by(email=settings.seed_email).first():
        if db.query(models.BillingEnterpriseQuota).count() == 0:
            db.add(models.BillingEnterpriseQuota(id=1))
        return

    user = models.User(
        role_id=1,
        username=settings.seed_username,
        email=settings.seed_email,
        password_hash=hash_password(settings.seed_password),
        avatar=f"https://api.dicebear.com/7.x/avataaars/svg?seed={settings.seed_username}",
        credits=10000,
    )
    db.add(user)
    db.flush()

    org = models.Organization(name="MangaCanvas Studio", created_by=user.id)
    db.add(org)
    db.flush()
    db.add(models.OrganizationMember(organization_id=org.id, user_id=user.id, assigned_by=user.id))
    db.add(models.BillingEnterpriseQuota(id=1, quota_limit=1_000_000, quota_consumed=0))
    db.add(
        models.BillingOrganizationQuota(
            organization_id=org.id, quota_percent=100, quota_limit=1_000_000, quota_consumed=0
        )
    )
    db.add(
        models.BillingLedger(
            organization_id=org.id,
            user_id=user.id,
            entry_type="earn",
            amount=10000,
            balance_after=10000,
            description="初始积分",
        )
    )
