import pytest
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import joinedload, sessionmaker

from app import models
from app.db import Base, get_db
from app.deps import current_user
from app.errors import ApiError, api_error_handler, unhandled_exception_handler, validation_error_handler
from app.routers import catalog, scripts

PARSED = {
    "title": "透风的窗",
    "plot": {"summary": "雨夜来客"},
    "characters": [
        {
            "name": "林深",
            "role": "main",
            "gender": "male",
            "ageGroup": "young",
            "description": "黑大衣，诊所医生",
            "personality": "谨慎，不轻易开门",
        },
        {
            "name": "苏晚",
            "role": "support",
            "gender": "female",
            "ageGroup": "young",
            "prompt": "短发年轻女性，眼神警觉",
        },
    ],
    "scenes": [
        {"name": "夜诊所", "location": "城南诊所", "time": "夜", "description": "铁门，冷白灯"},
        {
            "name": "废弃钟楼",
            "location": "旧钟楼",
            "time": "夜",
            "description": "积灰楼梯",
            "prompt": "废弃钟楼内部，月光从破窗进来",
        },
    ],
    "props": [
        {"name": "铁钥匙", "type": "prop", "description": "黄铜旧钥匙"},
        {"name": "旧照片", "type": "prop", "description": "泛黄合影"},
        {"name": "黑伞", "type": "prop", "prompt": "湿透的黑伞"},
        {"name": "白大褂", "type": "clothing", "description": "洗得发白的白大褂"},
    ],
    "episodes": [
        {
            "index": 1,
            "name": "第01集 别开门",
            "summary": "林深把铁门闩死，钥匙在我这儿。",
            "characterNames": ["林深", "苏晚"],
            "sceneNames": ["夜诊所"],
            "propNames": ["铁钥匙", "白大褂"],
        },
        {
            "index": 2,
            "name": "第02集 钟声",
            "summary": "两人走进废弃钟楼，她长得像我妈。",
            "characterNames": ["苏晚"],
            "sceneNames": ["废弃钟楼"],
            "propNames": ["旧照片", "黑伞"],
        },
    ],
}


@pytest.fixture
def engine(tmp_path):
    return create_engine(
        f"sqlite:///{tmp_path / 'import.db'}",
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
    project = models.Project(organization_id=org.id, name="P", owner_id=user.id)
    session.add(project)
    session.flush()
    session.add(
        models.ScriptDocument(
            organization_id=org.id,
            project_id=project.id,
            title="透风的窗",
            source_text="",
            plot_summary="雨夜来客",
            parsed_json=PARSED,
            status="parsed",
            created_by=user.id,
        )
    )
    session.commit()
    yield session
    session.close()


@pytest.fixture
def user(db):
    row = db.query(models.User).options(joinedload(models.User.role)).filter_by(email="emp@x.com").one()
    db.expunge(row)
    return row


@pytest.fixture
def ids(db):
    project = db.query(models.Project).filter_by(name="P").one()
    script = db.query(models.ScriptDocument).filter_by(project_id=project.id).one()
    return {"project_id": project.id, "script_id": script.id}


@pytest.fixture
def client(Session, user):
    application = FastAPI()
    application.add_exception_handler(ApiError, api_error_handler)
    application.add_exception_handler(RequestValidationError, validation_error_handler)
    application.add_exception_handler(Exception, unhandled_exception_handler)

    @application.get("/boom")
    def boom():
        raise RuntimeError("plain boom")

    application.include_router(scripts.router, prefix="/api/v1")
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


def _names(response):
    body = response.json()
    assert body["code"] == 0
    return {item["name"]: item for item in body["data"]["list"]}


def test_import_empty_body_persists_text_assets_without_media(client, ids, Session):
    url = f"/api/v1/projects/{ids['project_id']}/scripts/{ids['script_id']}/import"
    response = client.post(url, json={})
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    payload = response.json()
    assert payload["code"] == 0
    assert payload["data"]["created"] == {"characters": 2, "scenes": 2, "objects": 4, "episodes": 2}
    assert payload["data"]["skipped"] == {"characters": 0, "scenes": 0, "objects": 0, "episodes": 0}
    assert payload["data"]["script"]["status"] == "imported"

    base = f"/api/v1/projects/{ids['project_id']}"
    characters = _names(client.get(f"{base}/characters"))
    scenes = _names(client.get(f"{base}/scenes"))
    objects = _names(client.get(f"{base}/objects"))
    episodes = _names(client.get(f"{base}/episodes"))

    assert set(characters) == {"林深", "苏晚"}
    assert "黑大衣，诊所医生" in characters["林深"]["description"]
    assert "谨慎，不轻易开门" in characters["林深"]["description"]
    assert characters["林深"]["role"] == "main"
    assert characters["林深"]["gender"] == "male"
    assert characters["苏晚"]["description"] == "短发年轻女性，眼神警觉"
    assert characters["苏晚"]["role"] == "support"
    assert all(not item["avatar"] for item in characters.values())
    assert all(item["shapingStatus"] == "unset" and item["promptLocked"] is False for item in characters.values())

    assert "城南诊所" in scenes["夜诊所"]["description"]
    assert "铁门，冷白灯" in scenes["夜诊所"]["description"]
    assert "废弃钟楼内部，月光从破窗进来" in scenes["废弃钟楼"]["description"]
    assert all(not item["image"] for item in scenes.values())
    assert all(item["status"] == "draft" for item in scenes.values())
    assert all(item["shapingStatus"] == "unset" for item in scenes.values())

    assert objects["铁钥匙"]["description"] == "黄铜旧钥匙"
    assert objects["黑伞"]["description"] == "湿透的黑伞"
    assert objects["白大褂"]["type"] == "clothing"
    assert all(not item["image"] for item in objects.values())
    assert all(item["shapingStatus"] == "unset" for item in objects.values())

    assert "钥匙在我这儿" in episodes["第01集 别开门"]["description"]
    assert {item["name"] for item in episodes["第01集 别开门"]["characters"]} == {"林深", "苏晚"}
    assert all(item["shapingStatus"] == "unset" for item in episodes["第01集 别开门"]["characters"])
    assert {item["name"] for item in episodes["第01集 别开门"]["scenes"]} == {"夜诊所"}
    assert {item["name"] for item in episodes["第01集 别开门"]["objects"]} == {"铁钥匙", "白大褂"}
    assert "她长得像我妈" in episodes["第02集 钟声"]["description"]
    assert {item["name"] for item in episodes["第02集 钟声"]["scenes"]} == {"废弃钟楼"}
    assert {item["name"] for item in episodes["第02集 钟声"]["objects"]} == {"旧照片", "黑伞"}
    assert all(not item["coverImage"] for item in episodes.values())
    assert all(item["storyboard"] == [] for item in episodes.values())

    session = Session()
    try:
        assert session.query(models.ProjectAsset).count() == 0
    finally:
        session.close()

    again = client.post(url, json={})
    assert again.status_code == 200
    skipped = again.json()["data"]
    assert skipped["created"] == {"characters": 0, "scenes": 0, "objects": 0, "episodes": 0}
    assert skipped["skipped"] == {"characters": 2, "scenes": 2, "objects": 4, "episodes": 2}
    assert len(_names(client.get(f"{base}/episodes"))) == 2


def test_import_failure_returns_json_and_rolls_back(client, ids, monkeypatch):
    url = f"/api/v1/projects/{ids['project_id']}/scripts/{ids['script_id']}/import"

    class _FrozenTime:
        @staticmethod
        def time():
            raise RuntimeError("stamp failed")

    monkeypatch.setattr(scripts, "time", _FrozenTime)
    response = client.post(url, json={})

    assert response.status_code == 500
    assert response.headers["content-type"].startswith("application/json")
    assert response.text.strip() != "Internal Server Error"
    body = response.json()
    assert body["code"] == 5000
    assert body["data"] is None
    assert "stamp failed" in body["message"]

    listed = client.get(f"/api/v1/projects/{ids['project_id']}/characters")
    assert listed.status_code == 200
    assert listed.json()["data"]["pagination"]["total"] == 0


def test_import_validation_error_stays_json(client, ids):
    url = f"/api/v1/projects/{ids['project_id']}/scripts/{ids['script_id']}/import"
    response = client.post(url, json={"episodes": "nope"})
    assert response.status_code == 400
    assert response.headers["content-type"].startswith("application/json")
    body = response.json()
    assert body["code"] == 1001
    assert body["data"] is None


def test_unhandled_exception_is_json_not_plain_text(client):
    response = client.get("/boom")
    assert response.status_code == 500
    assert response.headers["content-type"].startswith("application/json")
    assert response.text.strip() != "Internal Server Error"
    body = response.json()
    assert body["code"] == 5000
    assert "plain boom" in body["message"]
