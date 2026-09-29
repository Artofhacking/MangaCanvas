import base64
from datetime import datetime, timezone

import pytest
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import joinedload, sessionmaker

from app import models
from app.db import Base, get_db
from app.deps import current_user
from app.errors import ApiError, api_error_handler, unhandled_exception_handler, validation_error_handler
from app.routers import workflows


@pytest.fixture
def engine(tmp_path):
    return create_engine(
        f"sqlite:///{tmp_path / 'workflows.db'}",
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
    heavy = {
        "nodes": [{"id": "n-heavy", "type": "text", "data": {"content": "x" * 4000}}],
        "edges": [{"id": "e-heavy", "source": "n-heavy", "target": "n-heavy"}],
        "viewport": {"x": 1, "y": 2, "zoom": 1},
    }
    light = {"nodes": [{"id": "n-light", "type": "text", "data": {}}], "edges": [], "viewport": {"x": 0, "y": 0, "zoom": 1}}
    session.add(
        models.CanvasWorkflow(
            id="workflow_old",
            organization_id=org.id,
            project_id=project.id,
            name="旧工作流",
            source_type="blank",
            canvas_data=heavy,
            created_by=user.id,
            created_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
            updated_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
        )
    )
    session.add(
        models.CanvasWorkflow(
            id="workflow_new",
            organization_id=org.id,
            project_id=project.id,
            name="新工作流",
            source_type="episode",
            source_asset_id=9,
            canvas_data=light,
            created_by=user.id,
            created_at=datetime(2026, 6, 1, tzinfo=timezone.utc),
            updated_at=datetime(2026, 6, 1, tzinfo=timezone.utc),
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
def project_id(db):
    return db.query(models.Project).filter_by(name="P").one().id


@pytest.fixture
def client(engine, Session, user):
    application = FastAPI()
    application.add_exception_handler(ApiError, api_error_handler)
    application.add_exception_handler(RequestValidationError, validation_error_handler)
    application.add_exception_handler(Exception, unhandled_exception_handler)
    application.include_router(workflows.router, prefix="/api/v1")

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
    statements: list[str] = []

    def capture(_conn, _cursor, statement, _parameters, _context, _executemany):
        statements.append(statement)

    event.listen(engine, "before_cursor_execute", capture)
    with TestClient(application, raise_server_exceptions=False) as test_client:
        test_client.statements = statements  # type: ignore[attr-defined]
        yield test_client
    event.remove(engine, "before_cursor_execute", capture)


def _data(response):
    body = response.json()
    assert response.status_code == 200, body
    assert body["code"] == 0
    return body["data"]


def test_list_omits_canvas_and_does_not_sort_canvas_data(client, project_id):
    client.statements.clear()
    data = _data(client.get(f"/api/v1/projects/{project_id}/canvas-workflows", params={"page": 1, "size": 1}))

    assert data["pagination"] == {"page": 1, "size": 1, "total": 2}
    assert [item["id"] for item in data["list"]] == ["workflow_new"]
    assert "canvasData" not in data["list"][0]
    assert data["list"][0]["name"] == "新工作流"

    workflow_sql = [sql for sql in client.statements if "canvas_workflows" in sql]
    assert workflow_sql, client.statements
    ordered = [sql for sql in workflow_sql if "ORDER BY" in sql]
    assert ordered, workflow_sql
    assert all("canvas_data" not in sql for sql in ordered), ordered
    assert all("LIMIT" in sql for sql in ordered), ordered
    assert all("canvas_data" not in sql for sql in workflow_sql), workflow_sql

    page2 = _data(client.get(f"/api/v1/projects/{project_id}/canvas-workflows", params={"page": 2, "size": 1}))
    assert [item["id"] for item in page2["list"]] == ["workflow_old"]
    assert "canvasData" not in page2["list"][0]


def test_detail_create_and_update_still_return_canvas(client, project_id):
    detail = _data(client.get(f"/api/v1/projects/{project_id}/canvas-workflows/workflow_old"))
    assert detail["canvasData"]["nodes"][0]["id"] == "n-heavy"
    assert detail["canvasData"]["edges"][0]["id"] == "e-heavy"

    created = _data(
        client.post(
            f"/api/v1/projects/{project_id}/canvas-workflows",
            json={
                "name": "新建",
                "sourceType": "blank",
                "canvasData": {"nodes": [{"id": "created"}], "edges": [{"id": "e-created"}]},
            },
        )
    )
    assert created["canvasData"]["nodes"][0]["id"] == "created"
    assert created["canvasData"]["edges"][0]["id"] == "e-created"

    updated = _data(
        client.put(
            f"/api/v1/projects/{project_id}/canvas-workflows/{created['id']}",
            json={"name": "已改", "canvasData": {"nodes": [{"id": "edited"}], "edges": []}},
        )
    )
    assert updated["name"] == "已改"
    assert updated["canvasData"]["nodes"][0]["id"] == "edited"
    assert updated["canvasData"]["edges"] == []


def test_invalid_json_is_a_non_empty_json_400(client, project_id):
    """App validation never answers with an empty body. Access-log `400 0` is not this handler."""
    response = client.put(
        f"/api/v1/projects/{project_id}/canvas-workflows/workflow_old",
        content=b"{",
        headers={"content-type": "application/json"},
    )
    assert response.status_code == 400
    assert len(response.content) > 0
    body = response.json()
    assert body["code"] == 1001
    assert body["message"]
    assert "参数错误" in body["message"]


def test_put_externalizes_duplicate_data_urls(client, project_id, tmp_path, monkeypatch):
    upload_dir = tmp_path / "uploads"
    monkeypatch.setattr("app.config.settings.upload_dir", upload_dir)
    payload = base64.b64encode(b"same-bitmap").decode()
    data_url = f"data:image/png;base64,{payload}"
    updated = _data(
        client.put(
            f"/api/v1/projects/{project_id}/canvas-workflows/workflow_old",
            json={
                "canvasData": {
                    "nodes": [
                        {"id": "a", "type": "image", "data": {"url": data_url, "base64": data_url, "label": "贴图"}},
                        {"id": "b", "type": "image", "data": {"url": data_url}},
                    ],
                    "edges": [],
                    "viewport": {"x": 0, "y": 0, "zoom": 1},
                }
            },
        )
    )
    urls = [node["data"]["url"] for node in updated["canvasData"]["nodes"]]
    assert urls[0] == urls[1]
    assert urls[0].startswith("/static/uploads/")
    assert "base64" not in updated["canvasData"]["nodes"][0]["data"]
    assert "data:image" not in response_text(updated)
    stored = list(upload_dir.rglob("*"))
    files = [path for path in stored if path.is_file()]
    assert len(files) == 1
    assert files[0].read_bytes() == b"same-bitmap"


def test_put_rejects_oversized_inline_image_with_json(client, project_id, tmp_path, monkeypatch):
    upload_dir = tmp_path / "uploads"
    monkeypatch.setattr("app.config.settings.upload_dir", upload_dir)
    monkeypatch.setattr("app.canvas_media.MAX_INLINE_MEDIA_BYTES", 4)
    data_url = "data:image/png;base64," + base64.b64encode(b"0123456789abcdef").decode()
    response = client.put(
        f"/api/v1/projects/{project_id}/canvas-workflows/workflow_old",
        json={
            "canvasData": {
                "nodes": [{"id": "huge", "type": "image", "data": {"url": data_url, "base64": data_url}}],
                "edges": [],
                "viewport": {"x": 0, "y": 0, "zoom": 1},
            }
        },
    )
    assert response.status_code == 413
    assert len(response.content) > 0
    body = response.json()
    assert body["code"] == 1001
    assert "过大" in body["message"]
    assert list(upload_dir.rglob("*")) == []
    detail = _data(client.get(f"/api/v1/projects/{project_id}/canvas-workflows/workflow_old"))
    assert detail["canvasData"]["nodes"][0]["id"] == "n-heavy"


def test_get_does_not_externalize_stored_data_urls(client, db, project_id, tmp_path, monkeypatch):
    upload_dir = tmp_path / "uploads"
    monkeypatch.setattr("app.config.settings.upload_dir", upload_dir)
    row = db.query(models.CanvasWorkflow).filter_by(id="workflow_old").one()
    row.canvas_data = {
        "nodes": [{"id": "kept", "type": "image", "data": {"url": "data:image/png;base64,AAAA"}}],
        "edges": [],
        "viewport": {"x": 0, "y": 0, "zoom": 1},
    }
    db.commit()
    detail = _data(client.get(f"/api/v1/projects/{project_id}/canvas-workflows/workflow_old"))
    assert detail["canvasData"]["nodes"][0]["data"]["url"].startswith("data:image/png;base64,")
    assert list(upload_dir.rglob("*")) == []


def response_text(payload) -> str:
    import json

    return json.dumps(payload, ensure_ascii=False)
