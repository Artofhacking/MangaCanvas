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
from app.favorites import is_collected_metadata
from app.routers import assets


def test_is_collected_metadata_accepts_favorite_or_collect_source():
    assert is_collected_metadata({"source": "favorite", "category": "scene"}) is True
    assert is_collected_metadata({"source": "collect"}) is True


def test_is_collected_metadata_accepts_favorited_at():
    assert is_collected_metadata({"favoritedAt": "2026-09-20T05:00:00.000Z"}) is True


def test_is_collected_metadata_rejects_ordinary_assets():
    assert is_collected_metadata({"status": "approved", "category": "character"}) is False
    assert is_collected_metadata(None) is False
    assert is_collected_metadata("favorite") is False


def test_is_collected_metadata_parses_json_string():
    assert is_collected_metadata('{"source":"favorite","mediaType":"video"}') is True
    assert is_collected_metadata('{"status":"approved"}') is False


@pytest.fixture
def engine(tmp_path):
    return create_engine(
        f"sqlite:///{tmp_path / 'favorites.db'}",
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
    application.include_router(assets.router, prefix="/api/v1")

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
    assert body["code"] == 0, body
    return body["data"]


def _favorite_payload(url: str, *, node_id: str, media_type: str, name: str):
    return {
        "name": name,
        "sourceType": "workflow",
        "sourceId": f"workflow-shared-{node_id}",
        "url": url,
        "prompt": "雨夜长街",
        "metadata": {
            "category": "scene",
            "nodeId": node_id,
            "mediaType": media_type,
            "source": "favorite",
            "favoritedAt": "2026-09-20T05:00:00.000Z",
        },
    }


def test_star_image_and_video_show_up_in_collected_list(client, project_id):
    base = f"/api/v1/projects/{project_id}/assets"
    image = _data(
        client.post(
            base,
            json=_favorite_payload("/static/uploads/generated/still.png", node_id="node_img", media_type="image", name="画面"),
        )
    )
    video = _data(
        client.post(
            base,
            json=_favorite_payload("https://cdn.example/clip.mp4", node_id="node_vid", media_type="video", name="片段"),
        )
    )
    ordinary = _data(
        client.post(
            base,
            json={
                "name": "普通素材",
                "sourceType": "workflow",
                "sourceId": "workflow-shared",
                "url": "/static/uploads/generated/plain.png",
                "metadata": {"category": "object", "nodeId": "node_plain", "mediaType": "image"},
            },
        )
    )

    collected = _data(client.get(base, params={"collected": "true", "page": 1, "size": 200}))
    ids = [item["id"] for item in collected["list"]]
    assert image["id"] in ids
    assert video["id"] in ids
    assert ordinary["id"] not in ids
    by_id = {item["id"]: item for item in collected["list"]}
    assert by_id[image["id"]]["metadata"]["source"] == "favorite"
    assert by_id[image["id"]]["metadata"]["favoritedAt"]
    assert by_id[image["id"]]["metadata"]["mediaType"] == "image"
    assert by_id[video["id"]]["metadata"]["mediaType"] == "video"
    assert collected["pagination"]["total"] == 2


def test_restar_same_url_and_node_updates_instead_of_duplicating(client, project_id):
    base = f"/api/v1/projects/{project_id}/assets"
    url = "https://app.example/static/uploads/generated/still.png"
    first = _data(client.post(base, json=_favorite_payload(url, node_id="node_1", media_type="image", name="第一次")))
    again = _favorite_payload("/static/uploads/generated/still.png", node_id="node_1", media_type="image", name="第二次")
    again["metadata"]["favoritedAt"] = "2026-09-21T05:00:00.000Z"
    second = _data(client.post(base, json=again))

    assert second["id"] == first["id"]
    assert second["name"] == "第二次"
    assert second["metadata"]["favoritedAt"] == "2026-09-21T05:00:00.000Z"
    collected = _data(client.get(base, params={"collected": True}))
    assert collected["pagination"]["total"] == 1
    assert collected["list"][0]["id"] == first["id"]


def test_unfavorite_drops_the_mark_and_restar_reuses_the_row(client, project_id):
    base = f"/api/v1/projects/{project_id}/assets"
    created = _data(
        client.post(
            base,
            json=_favorite_payload("/static/uploads/generated/still.png", node_id="node_1", media_type="image", name="画面"),
        )
    )
    cleared = {
        "category": "scene",
        "nodeId": "node_1",
        "mediaType": "image",
    }
    updated = _data(client.put(f"{base}/{created['id']}", json={"metadata": cleared}))
    assert "source" not in (updated["metadata"] or {})
    assert "favoritedAt" not in (updated["metadata"] or {})
    hidden = _data(client.get(base, params={"collected": "true", "nodeId": "node_1"}))
    assert hidden["list"] == []

    restored = _data(
        client.post(
            base,
            json=_favorite_payload("/static/uploads/generated/still.png", node_id="node_1", media_type="image", name="画面"),
        )
    )
    assert restored["id"] == created["id"]
    visible = _data(client.get(base, params={"collected": "true", "nodeId": "node_1"}))
    assert [item["id"] for item in visible["list"]] == [created["id"]]


def test_repersist_keeps_one_favorite_when_source_url_matches(client, project_id):
    base = f"/api/v1/projects/{project_id}/assets"
    preview = "https://cdn.example/clip.mp4?sig=1"
    first_body = _favorite_payload("/static/uploads/generated/gen_a.mp4", node_id="node_vid", media_type="video", name="片段")
    first_body["metadata"]["sourceUrl"] = preview
    first = _data(client.post(base, json=first_body))
    second_body = _favorite_payload("/static/uploads/generated/gen_b.mp4", node_id="node_vid", media_type="video", name="片段")
    second_body["metadata"]["sourceUrl"] = "https://cdn.example/clip.mp4?sig=2"
    second = _data(client.post(base, json=second_body))
    assert second["id"] == first["id"]
    assert second["url"].endswith("gen_b.mp4")
    collected = _data(client.get(base, params={"collected": "true", "nodeId": "node_vid"}))
    assert collected["pagination"]["total"] == 1


def test_same_url_on_another_node_stays_a_separate_favorite(client, project_id):
    base = f"/api/v1/projects/{project_id}/assets"
    url = "/static/uploads/generated/shared.png"
    first = _data(client.post(base, json=_favorite_payload(url, node_id="node_a", media_type="image", name="甲")))
    second = _data(client.post(base, json=_favorite_payload(url, node_id="node_b", media_type="video", name="乙")))
    assert first["id"] != second["id"]
    listed = _data(client.get(base, params={"collected": "true", "nodeId": "node_b"}))
    assert [item["id"] for item in listed["list"]] == [second["id"]]
    assert listed["list"][0]["metadata"]["mediaType"] == "video"


def test_long_media_url_and_name_still_persist(client, project_id):
    base = f"/api/v1/projects/{project_id}/assets"
    long_url = "https://cdn.example/generated/" + ("a" * 600) + ".mp4"
    payload = _favorite_payload(long_url, node_id="node_long", media_type="video", name="名" * 200)
    payload["sourceId"] = "x" * 80
    created = _data(client.post(base, json=payload))
    assert created["url"] == long_url
    assert len(created["name"]) == 128
    assert len(created["sourceId"]) == 64
    listed = _data(client.get(base, params={"collected": "true", "nodeId": "node_long"}))
    assert listed["list"][0]["metadata"]["mediaType"] == "video"
