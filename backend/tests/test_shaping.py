import pytest
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import joinedload, sessionmaker

from app import models
from app.db import Base, get_db
from app.deps import current_user
from app.errors import ApiError, api_error_handler, unhandled_exception_handler, validation_error_handler
from app.routers import catalog
from app.schema_migrate import ensure_prompt_lock_columns


@pytest.fixture
def engine(tmp_path):
    return create_engine(
        f"sqlite:///{tmp_path / 'shaping.db'}",
        future=True,
        connect_args={"check_same_thread": False},
    )


@pytest.fixture
def Session(engine):
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


@pytest.fixture
def db(Session):
    session = Session()
    session.add(
        models.Role(
            id=3,
            code="employee",
            name="员工",
            can_create_organization=False,
            can_create_project=True,
            can_manage_project_members=False,
            list_all_projects=True,
            list_organization_projects=True,
        )
    )
    session.flush()
    user = models.User(role_id=3, username="emp", email="emp@x.com", credits=0)
    session.add(user)
    session.flush()
    org = models.Organization(name="Studio", created_by=user.id)
    session.add(org)
    session.flush()
    session.add(models.Project(organization_id=org.id, name="P", owner_id=user.id))
    session.commit()
    yield session
    session.close()


@pytest.fixture
def user(db):
    row = db.query(models.User).options(joinedload(models.User.role)).filter_by(email="emp@x.com").one()
    db.expunge(row)
    return row


@pytest.fixture
def project_id(db):
    return db.query(models.Project).filter_by(name="P").one().id


@pytest.fixture
def client(Session, user):
    application = FastAPI()
    application.add_exception_handler(ApiError, api_error_handler)
    application.add_exception_handler(RequestValidationError, validation_error_handler)
    application.add_exception_handler(Exception, unhandled_exception_handler)
    application.include_router(catalog.router, prefix="/api/v1")

    def override_db():
        session = Session()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    application.dependency_overrides[get_db] = override_db
    application.dependency_overrides[current_user] = lambda: user
    with TestClient(application, raise_server_exceptions=False) as test_client:
        yield test_client


def _data(response):
    body = response.json()
    assert response.status_code == 200, body
    assert body["code"] == 0
    return body["data"]


@pytest.mark.parametrize(
    ("kind", "payload", "cover_field"),
    [
        ("characters", {"name": "林深", "description": "黑大衣医生"}, "avatar"),
        ("scenes", {"name": "夜诊所", "description": "冷白灯"}, "image"),
        ("objects", {"name": "铁钥匙", "description": "黄铜旧钥匙"}, "image"),
    ],
)
def test_lock_cover_and_unlock(client, project_id, kind, payload, cover_field):
    base = f"/api/v1/projects/{project_id}/{kind}"
    created = _data(client.post(base, json=payload))
    assert created["shapingStatus"] == "unset"
    assert created["promptLocked"] is False
    assert created["hasCover"] is False
    assert created["promptLockedAt"] is None

    asset_id = created["id"]
    empty = client.post(base, json={"name": "没词"})
    empty_id = _data(empty)["id"]
    rejected = client.post(f"{base}/{empty_id}/prompt-lock", json={"locked": True})
    assert rejected.status_code == 400
    assert "提示词" in rejected.json()["message"]

    semi = _data(client.post(f"{base}/{asset_id}/prompt-lock", json={"locked": True}))
    assert semi["shapingStatus"] == "semi"
    assert semi["promptLocked"] is True
    assert semi["promptLockedAt"]

    same = _data(client.put(f"{base}/{asset_id}", json={"description": payload["description"]}))
    assert same["shapingStatus"] == "semi"

    changed = client.put(f"{base}/{asset_id}", json={"description": "改掉的提示词"})
    assert changed.status_code == 400
    assert "解锁" in changed.json()["message"]

    final = _data(client.put(f"{base}/{asset_id}", json={cover_field: "/static/uploads/cover.png"}))
    assert final["shapingStatus"] == "final"
    assert final["hasCover"] is True

    replaced = client.put(f"{base}/{asset_id}", json={cover_field: "/static/uploads/other.png"})
    assert replaced.status_code == 400
    assert "定妆" in replaced.json()["message"]

    unlocked = _data(client.post(f"{base}/{asset_id}/prompt-lock", json={"locked": False}))
    assert unlocked["shapingStatus"] == "unset"
    assert unlocked["promptLocked"] is False
    assert unlocked["promptLockedAt"] is None
    assert unlocked["hasCover"] is True
    assert unlocked[cover_field] == "/static/uploads/cover.png"

    relocked = _data(client.post(f"{base}/{asset_id}/prompt-lock", json={"locked": True}))
    assert relocked["shapingStatus"] == "final"


def test_cover_without_lock_stays_unset(client, project_id):
    created = _data(
        client.post(
            f"/api/v1/projects/{project_id}/characters",
            json={"name": "苏晚", "description": "短发", "avatar": "/static/uploads/su.png"},
        )
    )
    assert created["hasCover"] is True
    assert created["shapingStatus"] == "unset"


def test_prompt_lock_columns_migrate_onto_existing_tables(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'legacy.db'}", future=True)
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE characters (id INTEGER PRIMARY KEY, name VARCHAR(128))"))
        connection.execute(text("CREATE TABLE scenes (id INTEGER PRIMARY KEY, name VARCHAR(128))"))
        connection.execute(text("CREATE TABLE project_objects (id INTEGER PRIMARY KEY, name VARCHAR(128))"))
        connection.execute(text("INSERT INTO characters (name) VALUES ('旧角色')"))
    ensure_prompt_lock_columns(engine)
    ensure_prompt_lock_columns(engine)
    columns = {column["name"] for column in inspect(engine).get_columns("characters")}
    assert "prompt_locked" in columns
    assert "prompt_locked_at" in columns
    with engine.connect() as connection:
        locked = connection.execute(text("SELECT prompt_locked FROM characters")).scalar()
    assert locked in (0, False)
