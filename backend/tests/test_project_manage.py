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
from app.routers import projects
from app.routers.projects import duplicate_project_name


def test_duplicate_project_name_suffixes_and_avoids_collisions():
    assert duplicate_project_name("雾城", set()) == "雾城 副本"
    assert duplicate_project_name("雾城", {"雾城 副本"}) == "雾城 副本 2"
    assert duplicate_project_name("  ", set()) == "未命名项目 副本"


@pytest.fixture
def engine(tmp_path):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'projects.db'}",
        future=True,
        connect_args={"check_same_thread": False},
    )

    @event.listens_for(engine, "connect")
    def _enable_foreign_keys(dbapi_conn, _connection_record):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    return engine


@pytest.fixture
def Session(engine):
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def _role(role_id: int, code: str, *, manage: bool, list_org: bool) -> models.Role:
    return models.Role(
        id=role_id,
        code=code,
        name=code,
        can_create_organization=False,
        can_create_project=True,
        can_manage_project_members=manage,
        list_all_projects=False,
        list_organization_projects=list_org,
    )


@pytest.fixture
def actors(Session):
    session = Session()
    session.add(_role(2, "admin", manage=True, list_org=True))
    session.add(_role(3, "employee", manage=False, list_org=False))
    session.flush()

    def add_user(role_id: int, username: str) -> models.User:
        user = models.User(role_id=role_id, username=username, email=f"{username}@x.com", credits=0)
        session.add(user)
        session.flush()
        return user

    owner = add_user(3, "owner")
    editor = add_user(3, "editor")
    viewer = add_user(3, "viewer")
    admin = add_user(2, "admin")
    org = models.Organization(name="Studio", created_by=owner.id)
    session.add(org)
    session.flush()
    for user in (owner, editor, viewer, admin):
        session.add(models.OrganizationMember(organization_id=org.id, user_id=user.id, assigned_by=owner.id))
    project = models.Project(organization_id=org.id, name="雾城", description="夜戏", owner_id=owner.id)
    session.add(project)
    session.flush()
    session.add(models.ProjectMember(project_id=project.id, user_id=owner.id, organization_id=org.id, role="owner"))
    session.add(models.ProjectMember(project_id=project.id, user_id=editor.id, organization_id=org.id, role="editor"))
    session.add(models.ProjectMember(project_id=project.id, user_id=viewer.id, organization_id=org.id, role="viewer"))
    session.add(models.Episode(organization_id=org.id, project_id=project.id, name="第一集", code="E01"))
    session.commit()

    def detach(user_id: int) -> models.User:
        row = session.query(models.User).options(joinedload(models.User.role)).filter_by(id=user_id).one()
        session.expunge(row)
        return row

    payload = {
        "owner": detach(owner.id),
        "editor": detach(editor.id),
        "viewer": detach(viewer.id),
        "admin": detach(admin.id),
        "project_id": project.id,
    }
    session.close()
    return payload


@pytest.fixture
def client(Session, actors):
    holder = {"user": actors["owner"]}
    application = FastAPI()
    application.add_exception_handler(ApiError, api_error_handler)
    application.add_exception_handler(RequestValidationError, validation_error_handler)
    application.add_exception_handler(Exception, unhandled_exception_handler)
    application.include_router(projects.router, prefix="/api/v1")

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
    application.dependency_overrides[current_user] = lambda: holder["user"]
    with TestClient(application, raise_server_exceptions=False) as test_client:
        test_client.act = holder  # type: ignore[attr-defined]
        yield test_client


def _body(response):
    return response.json()


def test_owner_can_duplicate_with_copy_suffix_and_editor_cannot_delete(client, actors):
    project_id = actors["project_id"]
    copied = _body(client.post(f"/api/v1/projects/{project_id}/duplicate"))
    assert copied["code"] == 0
    assert copied["data"]["name"] == "雾城 副本"
    assert copied["data"]["ownerId"] == actors["owner"].id

    again = _body(client.post(f"/api/v1/projects/{project_id}/duplicate"))
    assert again["data"]["name"] == "雾城 副本 2"

    client.act["user"] = actors["editor"]
    denied = _body(client.delete(f"/api/v1/projects/{project_id}"))
    assert denied["code"] == 1003
    assert client.delete(f"/api/v1/projects/{project_id}").status_code == 403

    client.act["user"] = actors["viewer"]
    viewer_update = client.put(f"/api/v1/projects/{project_id}", json={"name": "不该改成这样"})
    assert viewer_update.status_code == 403


def test_owner_and_org_admin_can_delete_but_members_cannot(client, actors):
    project_id = actors["project_id"]
    copied = _body(client.post(f"/api/v1/projects/{project_id}/duplicate"))["data"]

    client.act["user"] = actors["admin"]
    removed = client.delete(f"/api/v1/projects/{copied['id']}")
    assert removed.status_code == 200
    assert _body(removed)["data"] is True

    client.act["user"] = actors["editor"]
    assert client.delete(f"/api/v1/projects/{project_id}").status_code == 403

    client.act["user"] = actors["owner"]
    renamed = _body(client.put(f"/api/v1/projects/{project_id}", json={"name": "雾城改", "description": "新说明"}))
    assert renamed["data"]["name"] == "雾城改"
    assert renamed["data"]["description"] == "新说明"

    deleted = client.delete(f"/api/v1/projects/{project_id}")
    assert deleted.status_code == 200
    missing = client.get(f"/api/v1/projects/{project_id}")
    assert missing.status_code == 404


def test_owner_delete_removes_episode_links_before_parents(client, actors, Session):
    project_id = actors["project_id"]
    session = Session()
    project = session.get(models.Project, project_id)
    org_id = project.organization_id
    owner_id = actors["owner"].id
    character = models.Character(organization_id=org_id, project_id=project_id, name="青鱼")
    scene = models.Scene(organization_id=org_id, project_id=project_id, name="雨巷")
    prop = models.ProjectObject(organization_id=org_id, project_id=project_id, name="油纸伞")
    session.add_all([character, scene, prop])
    session.flush()
    episode = session.query(models.Episode).filter_by(project_id=project_id).one()
    session.add_all(
        [
            models.EpisodeCharacter(episode_id=episode.id, character_id=character.id),
            models.EpisodeScene(episode_id=episode.id, scene_id=scene.id),
            models.EpisodeObject(episode_id=episode.id, object_id=prop.id),
            models.CanvasWorkflow(
                id="wf-delete",
                organization_id=org_id,
                project_id=project_id,
                name="分镜",
                canvas_data={"nodes": []},
                created_by=owner_id,
            ),
            models.ScriptDocument(
                organization_id=org_id,
                project_id=project_id,
                title="大纲",
                source_text="雨夜",
                parsed_json={},
            ),
            models.ProjectAsset(
                organization_id=org_id,
                project_id=project_id,
                name="收藏画面",
                source_type="canvas",
                source_id="node-1",
                url="/static/fav.png",
                extra_metadata={"source": "favorite"},
            ),
        ]
    )
    session.flush()
    session.add(
        models.CanvasWorkflowMember(
            workflow_id="wf-delete",
            user_id=owner_id,
            project_id=project_id,
            role="owner",
        )
    )
    other = models.Project(organization_id=org_id, name="别的项目", owner_id=owner_id)
    session.add(other)
    session.flush()
    other_character = models.Character(organization_id=org_id, project_id=other.id, name="路人")
    session.add(other_character)
    session.flush()
    other_episode = models.Episode(organization_id=org_id, project_id=other.id, name="外集", code="E01")
    session.add(other_episode)
    session.flush()
    session.add(models.EpisodeCharacter(episode_id=other_episode.id, character_id=other_character.id))
    session.commit()
    episode_id = episode.id
    other_id = other.id
    session.close()

    client.act["user"] = actors["editor"]
    denied = client.delete(f"/api/v1/projects/{project_id}")
    assert denied.status_code == 403

    client.act["user"] = actors["owner"]
    deleted = client.delete(f"/api/v1/projects/{project_id}")
    assert deleted.status_code == 200, deleted.text
    assert _body(deleted)["code"] == 0
    assert _body(deleted)["data"] is True

    check = Session()
    try:
        assert check.get(models.Project, project_id) is None
        assert check.query(models.Character).filter_by(project_id=project_id).count() == 0
        assert check.query(models.Scene).filter_by(project_id=project_id).count() == 0
        assert check.query(models.ProjectObject).filter_by(project_id=project_id).count() == 0
        assert check.query(models.Episode).filter_by(project_id=project_id).count() == 0
        assert check.query(models.EpisodeCharacter).filter_by(episode_id=episode_id).count() == 0
        assert check.query(models.EpisodeScene).count() == 0
        assert check.query(models.EpisodeObject).count() == 0
        assert check.query(models.CanvasWorkflow).filter_by(id="wf-delete").count() == 0
        assert check.query(models.CanvasWorkflowMember).filter_by(workflow_id="wf-delete").count() == 0
        assert check.query(models.ScriptDocument).filter_by(project_id=project_id).count() == 0
        assert check.query(models.ProjectAsset).filter_by(project_id=project_id).count() == 0
        assert check.query(models.ProjectMember).filter_by(project_id=project_id).count() == 0
        assert check.get(models.Project, other_id) is not None
        assert check.query(models.EpisodeCharacter).count() == 1
        assert check.query(models.Character).filter_by(project_id=other_id).one().name == "路人"
    finally:
        check.close()
