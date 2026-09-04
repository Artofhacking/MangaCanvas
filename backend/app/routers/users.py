from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from .. import models, serialize
from ..db import get_db
from ..deps import current_user, org_ids_of
from ..errors import fail, ok
from ..util import paginate

router = APIRouter()


@router.get("/users")
def lookup_user(
    email: str | None = Query(default=None),
    user: models.User = Depends(current_user),
    db: Session = Depends(get_db),
):
    if not email:
        fail(1001, "参数错误：email 不能为空", 400)
    found = db.query(models.User).filter_by(email=email).first()
    if not found:
        fail(1004, "用户不存在", 404)
    return ok(serialize.user_public(found))


@router.get("/users/me/organizations")
def my_organizations(user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    ids = org_ids_of(db, user.id)
    orgs = db.query(models.Organization).filter(models.Organization.id.in_(ids)).all() if ids else []
    sliced, pagination = paginate([serialize.organization(o) for o in orgs], 1, 100)
    return ok({"list": sliced, "pagination": pagination})
