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
    assert data["list"][0]["nodeCount"] == 1
    assert data["list"][0]["edgeCount"] == 0

    workflow_sql = [sql for sql in client.statements if "canvas_workflows" in sql]
    assert workflow_sql, client.statements
    ordered = [sql for sql in workflow_sql if "ORDER BY" in sql.upper()]
    assert ordered, workflow_sql
    # Filesort must not see the JSON document. Counts are a separate lookup.
    assert all("canvas_data" not in sql.lower() for sql in ordered), ordered
    assert all("LIMIT" in sql.upper() for sql in ordered), ordered
    length_sql = [
        sql
        for sql in workflow_sql
        if "json_array_length" in sql.lower() or "json_length" in sql.lower()
    ]
    assert length_sql, workflow_sql
    assert all("ORDER BY" not in sql.upper() for sql in length_sql), length_sql
    assert all("canvas_data" in sql.lower() for sql in length_sql), length_sql

    page2 = _data(client.get(f"/api/v1/projects/{project_id}/canvas-workflows", params={"page": 2, "size": 1}))
    assert [item["id"] for item in page2["list"]] == ["workflow_old"]
    assert "canvasData" not in page2["list"][0]
    assert page2["list"][0]["nodeCount"] == 1
    assert page2["list"][0]["edgeCount"] == 1


def test_detail_create_and_update_still_return_canvas(client, project_id):
    detail = _data(client.get(f"/api/v1/projects/{project_id}/canvas-workflows/workflow_old"))
    assert detail["canvasData"]["nodes"][0]["id"] == "n-heavy"
    assert detail["canvasData"]["edges"][0]["id"] == "e-heavy"
    assert detail["nodeCount"] == 1
    assert detail["edgeCount"] == 1

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
    assert created["nodeCount"] == 1
    assert created["edgeCount"] == 1

    updated = _data(
        client.put(
            f"/api/v1/projects/{project_id}/canvas-workflows/{created['id']}",
            json={"name": "已改", "canvasData": {"nodes": [{"id": "edited"}], "edges": []}},
        )
    )
    assert updated["name"] == "已改"
    assert updated["canvasData"]["nodes"][0]["id"] == "edited"
    assert updated["canvasData"]["edges"] == []
    assert updated["nodeCount"] == 1
    assert updated["edgeCount"] == 0


def test_list_node_count_counts_arrays_only(client, db, project_id):
    project = db.get(models.Project, project_id)
    db.add(
        models.CanvasWorkflow(
            id="workflow_empty",
            organization_id=project.organization_id,
            project_id=project.id,
            name="空白工作流",
            source_type="blank",
            canvas_data={"nodes": [], "edges": [], "viewport": {"x": 0, "y": 0, "zoom": 1}},
            updated_at=datetime(2026, 7, 1, tzinfo=timezone.utc),
        )
    )
    db.add(
        models.CanvasWorkflow(
            id="workflow_three",
            organization_id=project.organization_id,
            project_id=project.id,
            name="三节点",
            source_type="scene",
            canvas_data={
                "nodes": [{"id": "a"}, {"id": "b"}, {"id": "c"}],
                "edges": [{"id": "e1"}, {"id": "e2"}],
                "viewport": {"x": 0, "y": 0, "zoom": 1},
            },
            updated_at=datetime(2026, 8, 1, tzinfo=timezone.utc),
        )
    )
    broken = db.query(models.CanvasWorkflow).filter_by(id="workflow_old").one()
    broken.canvas_data = {"viewport": {"x": 0, "y": 0, "zoom": 1}, "nodes": {"not": "a list"}, "edges": None}
    db.commit()

    data = _data(client.get(f"/api/v1/projects/{project_id}/canvas-workflows", params={"page": 1, "size": 20}))
    by_id = {item["id"]: item for item in data["list"]}
    # A real empty array is deleted. A non-array still counts as 0 and stays
    # out of the list, but the broken document itself is not destroyed.
    assert "workflow_empty" not in by_id
    assert "workflow_old" not in by_id
    assert set(by_id) == {"workflow_three", "workflow_new"}
    assert data["pagination"]["total"] == 2
    assert all("canvasData" not in item for item in data["list"])
    assert by_id["workflow_three"]["nodeCount"] == 3
    assert by_id["workflow_three"]["edgeCount"] == 2
    assert by_id["workflow_new"]["nodeCount"] == 1
    db.expire_all()
    assert db.get(models.CanvasWorkflow, "workflow_empty") is None
    broken = db.get(models.CanvasWorkflow, "workflow_old")
    assert broken is not None
    assert broken.canvas_data["nodes"] == {"not": "a list"}


def test_empty_canvas_is_not_stored_and_clearing_nodes_deletes_the_row(client, db, project_id):
    rejected = client.post(
        f"/api/v1/projects/{project_id}/canvas-workflows",
        json={
            "name": "空白工作流",
            "sourceType": "blank",
            "canvasData": {"nodes": [], "edges": [], "viewport": {"x": 0, "y": 0, "zoom": 1}},
        },
    )
    assert rejected.status_code == 400
    body = rejected.json()
    assert body["code"] == 1001
    assert "空工作流" in body["message"]
    db.expire_all()
    assert db.query(models.CanvasWorkflow).filter_by(name="空白工作流").count() == 0

    project = db.get(models.Project, project_id)
    user = db.query(models.User).filter_by(email="emp@x.com").one()
    db.add(
        models.CanvasWorkflowMember(
            workflow_id="workflow_new",
            user_id=user.id,
            project_id=project.id,
            role="editor",
        )
    )
    db.commit()

    cleared = client.put(
        f"/api/v1/projects/{project_id}/canvas-workflows/workflow_new",
        json={"canvasData": {"nodes": [], "edges": [], "viewport": {"x": 0, "y": 0, "zoom": 1}}},
    )
    assert cleared.status_code == 200
    payload = cleared.json()
    assert payload["code"] == 0
    assert payload["data"]["deleted"] is True
    assert payload["data"]["id"] == "workflow_new"
    db.expire_all()
    assert db.get(models.CanvasWorkflow, "workflow_new") is None
    assert db.query(models.CanvasWorkflowMember).filter_by(workflow_id="workflow_new").count() == 0

    renamed = _data(
        client.put(
            f"/api/v1/projects/{project_id}/canvas-workflows/workflow_old",
            json={"name": "只改名字"},
        )
    )
    assert renamed["name"] == "只改名字"
    assert renamed["canvasData"]["nodes"][0]["id"] == "n-heavy"


def test_mysql_count_expression_uses_json_length_without_order_by():
    from sqlalchemy.dialects import mysql

    from app.canvas_counts import canvas_collection_count

    expression = canvas_collection_count(models.CanvasWorkflow.canvas_data, "$.nodes", "mysql")
    sql = str(expression.compile(dialect=mysql.dialect(), compile_kwargs={"literal_binds": True}))
    lowered = sql.lower()
    assert "json_length" in lowered
    assert "json_extract" in lowered
    assert "array" in lowered
    assert "order by" not in lowered


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


def test_put_live_canvas_shape_externalizes_data_urls_in_url(client, project_id, tmp_path, monkeypatch):
    """Live workflow_cb2ae3386ac7: 3 nodes, 0 edges, two data URLs in data.url, one static path."""
    import json

    upload_dir = tmp_path / "uploads"
    monkeypatch.setattr("app.config.settings.upload_dir", upload_dir)
    wide = base64.b64encode(b"wide-png" * 400).decode()
    narrow = base64.b64encode(b"narrow-png" * 120).decode()
    static = "/static/uploads/generated/already.png"
    body = {
        "canvasData": {
            "nodes": [
                {"id": "a", "type": "image", "data": {"url": f"data:image/png;base64,{wide}"}},
                {"id": "b", "type": "image", "data": {"url": f"data:image/png;base64,{narrow}"}},
                {"id": "c", "type": "image", "data": {"url": static}},
            ],
            "edges": [],
            "viewport": {"x": 0, "y": 0, "zoom": 1},
        }
    }
    request_text = json.dumps(body)
    updated = _data(
        client.put(
            f"/api/v1/projects/{project_id}/canvas-workflows/workflow_old",
            json=body,
        )
    )
    response_body = response_text(updated)
    urls = [node["data"]["url"] for node in updated["canvasData"]["nodes"]]
    assert urls[0].startswith("/static/uploads/")
    assert urls[1].startswith("/static/uploads/")
    assert urls[0] != urls[1]
    assert urls[2] == static
    assert updated["canvasData"]["edges"] == []
    assert "data:image" not in response_body
    assert "base64" not in updated["canvasData"]["nodes"][0]["data"]
    assert len(response_body) < len(request_text) / 2
    files = [path for path in upload_dir.rglob("*") if path.is_file()]
    assert len(files) == 2
    detail = _data(client.get(f"/api/v1/projects/{project_id}/canvas-workflows/workflow_old"))
    assert "data:image" not in response_text(detail)
    assert [node["data"]["url"] for node in detail["canvasData"]["nodes"]] == urls


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
