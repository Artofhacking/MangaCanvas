from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import models, serialize
from ..db import get_db
from ..deps import current_user, require_project_access
from ..errors import fail, ok
from ..util import now, paginate

router = APIRouter(prefix="/projects/{project_id}")


class CharacterIn(BaseModel):
    name: str | None = None
    role: str | None = None
    gender: str | None = None
    ageGroup: str | None = None
    style: str | None = None
    description: str | None = None
    avatar: str | None = None
    referenceImages: list[str] | None = None
    modelId: str | None = None
    seed: str | None = None
    creationMode: str | None = None
    sourceWorkflowId: str | None = None
    sourceNodeId: str | None = None


class SceneIn(BaseModel):
    name: str | None = None
    description: str | None = None
    image: str | None = None
    status: str | None = None
    genMethod: str | None = None
    modelId: str | None = None
    style: str | None = None
    camera: dict | None = None
    referenceImages: list[str] | None = None
    seed: str | None = None
    creationMode: str | None = None
    sourceWorkflowId: str | None = None
    sourceNodeId: str | None = None


class ObjectIn(BaseModel):
    name: str | None = None
    type: str | None = None
    description: str | None = None
    image: str | None = None
    sceneId: int | None = None
    status: str | None = None
    genMethod: str | None = None
    referenceImages: list[str] | None = None
    creationMode: str | None = None
    sourceWorkflowId: str | None = None
    sourceNodeId: str | None = None


class EpisodeIn(BaseModel):
    name: str | None = None
    code: str | None = None
    description: str | None = None
    status: str | None = None
    progress: int | None = None
    duration: int | None = None
    characterIds: list[int] | None = None
    sceneIds: list[int] | None = None
    objectIds: list[int] | None = None
    creationMode: str | None = None
    sourceWorkflowId: str | None = None
    sourceNodeId: str | None = None


class RelationsIn(BaseModel):
    characterIds: list[int] | None = None
    sceneIds: list[int] | None = None
    objectIds: list[int] | None = None


def _check_creation(mode: str | None, workflow_id: str | None, node_id: str | None) -> tuple[str, str | None, str | None]:
    mode = mode or "quick"
    if mode not in ("quick", "workflow"):
        fail(1001, "参数错误：creationMode", 400)
    if mode == "quick":
        return mode, None, None
    if not workflow_id:
        fail(1001, "参数错误：workflow 模式必须提供 sourceWorkflowId", 400)
    return mode, workflow_id, node_id


def _set_relations(db: Session, episode_id: int, character_ids, scene_ids, object_ids) -> None:
    if character_ids is not None:
        db.query(models.EpisodeCharacter).filter_by(episode_id=episode_id).delete()
        for cid in character_ids:
            db.add(models.EpisodeCharacter(episode_id=episode_id, character_id=cid))
    if scene_ids is not None:
        db.query(models.EpisodeScene).filter_by(episode_id=episode_id).delete()
        for sid in scene_ids:
            db.add(models.EpisodeScene(episode_id=episode_id, scene_id=sid))
    if object_ids is not None:
        db.query(models.EpisodeObject).filter_by(episode_id=episode_id).delete()
        for oid in object_ids:
            db.add(models.EpisodeObject(episode_id=episode_id, object_id=oid))


@router.get("/characters")
def list_characters(
    project_id: int,
    role: str | None = None,
    page: int = 1,
    size: int = 20,
    user: models.User = Depends(current_user),
    db: Session = Depends(get_db),
):
    require_project_access(db, user, project_id)
    q = db.query(models.Character).filter_by(project_id=project_id)
    if role:
        q = q.filter_by(role=role)
    items = [serialize.character(r) for r in q.order_by(models.Character.id.desc()).all()]
    sliced, pagination = paginate(items, page, size)
    return ok({"list": sliced, "pagination": pagination})


@router.post("/characters")
def create_character(
    project_id: int,
    body: CharacterIn,
    user: models.User = Depends(current_user),
    db: Session = Depends(get_db),
):
    project = require_project_access(db, user, project_id, write=True)
    if not body.name:
        fail(1001, "参数错误：name 不能为空", 400)
    mode, wf, node = _check_creation(body.creationMode, body.sourceWorkflowId, body.sourceNodeId)
    row = models.Character(
        organization_id=project.organization_id,
        project_id=project_id,
        name=body.name,
        role=body.role or "main",
        gender=body.gender,
        age_group=body.ageGroup,
        style=body.style,
        description=body.description,
        avatar=body.avatar,
        reference_images=body.referenceImages or [],
        model_id=body.modelId,
        seed=body.seed,
        creation_mode=mode,
        source_workflow_id=wf,
        source_node_id=node,
    )
    db.add(row)
    db.flush()
    return ok(serialize.character(row))


@router.get("/characters/{character_id}")
def get_character(
    project_id: int, character_id: int, user: models.User = Depends(current_user), db: Session = Depends(get_db)
):
    require_project_access(db, user, project_id)
    row = db.query(models.Character).filter_by(id=character_id, project_id=project_id).first()
    if not row:
        fail(1004, "角色不存在", 404)
    return ok(serialize.character(row))


@router.put("/characters/{character_id}")
def update_character(
    project_id: int,
    character_id: int,
    body: CharacterIn,
    user: models.User = Depends(current_user),
    db: Session = Depends(get_db),
):
    require_project_access(db, user, project_id, write=True)
    row = db.query(models.Character).filter_by(id=character_id, project_id=project_id).first()
    if not row:
        fail(1004, "角色不存在", 404)
    mapping = {
        "name": "name",
        "role": "role",
        "gender": "gender",
        "ageGroup": "age_group",
        "style": "style",
        "description": "description",
        "avatar": "avatar",
        "referenceImages": "reference_images",
        "modelId": "model_id",
        "seed": "seed",
    }
    for field, attr in mapping.items():
        value = getattr(body, field)
        if value is not None:
            setattr(row, attr, value)
    row.updated_at = now()
    return ok(serialize.character(row))


@router.delete("/characters/{character_id}")
def delete_character(
    project_id: int, character_id: int, user: models.User = Depends(current_user), db: Session = Depends(get_db)
):
    require_project_access(db, user, project_id, write=True)
    row = db.query(models.Character).filter_by(id=character_id, project_id=project_id).first()
    if not row:
        fail(1004, "角色不存在", 404)
    db.query(models.EpisodeCharacter).filter_by(character_id=character_id).delete()
    db.delete(row)
    return ok(True)


@router.get("/scenes")
def list_scenes(
    project_id: int,
    status: str | None = None,
    page: int = 1,
    size: int = 20,
    user: models.User = Depends(current_user),
    db: Session = Depends(get_db),
):
    require_project_access(db, user, project_id)
    q = db.query(models.Scene).filter_by(project_id=project_id)
    if status:
        q = q.filter_by(status=status)
    items = [serialize.scene(r) for r in q.order_by(models.Scene.id.desc()).all()]
    sliced, pagination = paginate(items, page, size)
    return ok({"list": sliced, "pagination": pagination})


@router.post("/scenes")
def create_scene(
    project_id: int, body: SceneIn, user: models.User = Depends(current_user), db: Session = Depends(get_db)
):
    project = require_project_access(db, user, project_id, write=True)
    if not body.name:
        fail(1001, "参数错误：name 不能为空", 400)
    mode, wf, node = _check_creation(body.creationMode, body.sourceWorkflowId, body.sourceNodeId)
    row = models.Scene(
        organization_id=project.organization_id,
        project_id=project_id,
        name=body.name,
        description=body.description,
        image=body.image,
        status=body.status or "draft",
        gen_method=body.genMethod,
        model_id=body.modelId,
        style=body.style,
        camera=body.camera,
        reference_images=body.referenceImages or [],
        seed=body.seed,
        creation_mode=mode,
        source_workflow_id=wf,
        source_node_id=node,
    )
    db.add(row)
    db.flush()
    return ok(serialize.scene(row))


@router.get("/scenes/{scene_id}")
def get_scene(project_id: int, scene_id: int, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    require_project_access(db, user, project_id)
    row = db.query(models.Scene).filter_by(id=scene_id, project_id=project_id).first()
    if not row:
        fail(1004, "场景不存在", 404)
    return ok(serialize.scene(row))


@router.put("/scenes/{scene_id}")
def update_scene(
    project_id: int,
    scene_id: int,
    body: SceneIn,
    user: models.User = Depends(current_user),
    db: Session = Depends(get_db),
):
    require_project_access(db, user, project_id, write=True)
    row = db.query(models.Scene).filter_by(id=scene_id, project_id=project_id).first()
    if not row:
        fail(1004, "场景不存在", 404)
    mapping = {
        "name": "name",
        "description": "description",
        "image": "image",
        "status": "status",
        "genMethod": "gen_method",
        "modelId": "model_id",
        "style": "style",
        "camera": "camera",
        "referenceImages": "reference_images",
        "seed": "seed",
    }
    for field, attr in mapping.items():
        value = getattr(body, field)
        if value is not None:
            setattr(row, attr, value)
    row.updated_at = now()
    return ok(serialize.scene(row))


@router.delete("/scenes/{scene_id}")
def delete_scene(project_id: int, scene_id: int, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    require_project_access(db, user, project_id, write=True)
    row = db.query(models.Scene).filter_by(id=scene_id, project_id=project_id).first()
    if not row:
        fail(1004, "场景不存在", 404)
    db.query(models.EpisodeScene).filter_by(scene_id=scene_id).delete()
    db.delete(row)
    return ok(True)


@router.get("/objects")
def list_objects(
    project_id: int,
    type: str | None = None,
    page: int = 1,
    size: int = 20,
    user: models.User = Depends(current_user),
    db: Session = Depends(get_db),
):
    require_project_access(db, user, project_id)
    q = db.query(models.ProjectObject).filter_by(project_id=project_id)
    if type:
        q = q.filter_by(type=type)
    items = [serialize.obj(r) for r in q.order_by(models.ProjectObject.id.desc()).all()]
    sliced, pagination = paginate(items, page, size)
    return ok({"list": sliced, "pagination": pagination})


@router.post("/objects")
def create_object(
    project_id: int, body: ObjectIn, user: models.User = Depends(current_user), db: Session = Depends(get_db)
):
    project = require_project_access(db, user, project_id, write=True)
    if not body.name:
        fail(1001, "参数错误：name 不能为空", 400)
    mode, wf, node = _check_creation(body.creationMode, body.sourceWorkflowId, body.sourceNodeId)
    row = models.ProjectObject(
        organization_id=project.organization_id,
        project_id=project_id,
        scene_id=body.sceneId,
        name=body.name,
        type=body.type or "prop",
        description=body.description,
        image=body.image,
        status=body.status or "draft",
        gen_method=body.genMethod,
        reference_images=body.referenceImages or [],
        creation_mode=mode,
        source_workflow_id=wf,
        source_node_id=node,
    )
    db.add(row)
    db.flush()
    return ok(serialize.obj(row))


@router.get("/objects/{object_id}")
def get_object(project_id: int, object_id: int, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    require_project_access(db, user, project_id)
    row = db.query(models.ProjectObject).filter_by(id=object_id, project_id=project_id).first()
    if not row:
        fail(1004, "物品不存在", 404)
    return ok(serialize.obj(row))


@router.put("/objects/{object_id}")
def update_object(
    project_id: int,
    object_id: int,
    body: ObjectIn,
    user: models.User = Depends(current_user),
    db: Session = Depends(get_db),
):
    require_project_access(db, user, project_id, write=True)
    row = db.query(models.ProjectObject).filter_by(id=object_id, project_id=project_id).first()
    if not row:
        fail(1004, "物品不存在", 404)
    mapping = {
        "name": "name",
        "type": "type",
        "description": "description",
        "image": "image",
        "sceneId": "scene_id",
        "status": "status",
        "genMethod": "gen_method",
        "referenceImages": "reference_images",
    }
    for field, attr in mapping.items():
        value = getattr(body, field)
        if value is not None:
            setattr(row, attr, value)
    row.updated_at = now()
    return ok(serialize.obj(row))


@router.delete("/objects/{object_id}")
def delete_object(
    project_id: int, object_id: int, user: models.User = Depends(current_user), db: Session = Depends(get_db)
):
    require_project_access(db, user, project_id, write=True)
    row = db.query(models.ProjectObject).filter_by(id=object_id, project_id=project_id).first()
    if not row:
        fail(1004, "物品不存在", 404)
    db.query(models.EpisodeObject).filter_by(object_id=object_id).delete()
    db.delete(row)
    return ok(True)


@router.get("/episodes")
def list_episodes(
    project_id: int,
    status: str | None = None,
    page: int = 1,
    size: int = 20,
    user: models.User = Depends(current_user),
    db: Session = Depends(get_db),
):
    require_project_access(db, user, project_id)
    q = db.query(models.Episode).filter_by(project_id=project_id)
    if status:
        q = q.filter_by(status=status)
    items = [serialize.episode(db, r) for r in q.order_by(models.Episode.id.desc()).all()]
    sliced, pagination = paginate(items, page, size)
    return ok({"list": sliced, "pagination": pagination})


@router.post("/episodes")
def create_episode(
    project_id: int, body: EpisodeIn, user: models.User = Depends(current_user), db: Session = Depends(get_db)
):
    project = require_project_access(db, user, project_id, write=True)
    if not body.name:
        fail(1001, "参数错误：name 不能为空", 400)
    mode, wf, node = _check_creation(body.creationMode, body.sourceWorkflowId, body.sourceNodeId)
    row = models.Episode(
        organization_id=project.organization_id,
        project_id=project_id,
        name=body.name,
        code=body.code or f"EP_{int(now().timestamp() * 1000)}",
        description=body.description,
        duration=body.duration or 0,
        creation_mode=mode,
        source_workflow_id=wf,
        source_node_id=node,
    )
    db.add(row)
    try:
        db.flush()
    except IntegrityError:
        fail(1005, "片段编号冲突", 409)
    _set_relations(db, row.id, body.characterIds, body.sceneIds, body.objectIds)
    db.flush()
    return ok(serialize.episode(db, row))


@router.get("/episodes/{episode_id}")
def get_episode(
    project_id: int, episode_id: int, user: models.User = Depends(current_user), db: Session = Depends(get_db)
):
    require_project_access(db, user, project_id)
    row = db.query(models.Episode).filter_by(id=episode_id, project_id=project_id).first()
    if not row:
        fail(1004, "片段不存在", 404)
    return ok(serialize.episode(db, row))


@router.put("/episodes/{episode_id}")
def update_episode(
    project_id: int,
    episode_id: int,
    body: EpisodeIn,
    user: models.User = Depends(current_user),
    db: Session = Depends(get_db),
):
    require_project_access(db, user, project_id, write=True)
    row = db.query(models.Episode).filter_by(id=episode_id, project_id=project_id).first()
    if not row:
        fail(1004, "片段不存在", 404)
    mapping = {
        "name": "name",
        "code": "code",
        "description": "description",
        "status": "status",
        "progress": "progress",
        "duration": "duration",
    }
    for field, attr in mapping.items():
        value = getattr(body, field)
        if value is not None:
            setattr(row, attr, value)
    if any(v is not None for v in (body.characterIds, body.sceneIds, body.objectIds)):
        _set_relations(db, row.id, body.characterIds, body.sceneIds, body.objectIds)
    row.updated_at = now()
    try:
        db.flush()
    except IntegrityError:
        fail(1005, "片段编号冲突", 409)
    return ok(serialize.episode(db, row))


@router.patch("/episodes/{episode_id}/relations")
def update_relations(
    project_id: int,
    episode_id: int,
    body: RelationsIn,
    user: models.User = Depends(current_user),
    db: Session = Depends(get_db),
):
    require_project_access(db, user, project_id, write=True)
    row = db.query(models.Episode).filter_by(id=episode_id, project_id=project_id).first()
    if not row:
        fail(1004, "片段不存在", 404)
    _set_relations(db, row.id, body.characterIds, body.sceneIds, body.objectIds)
    row.updated_at = now()
    db.flush()
    return ok(serialize.episode(db, row))


@router.delete("/episodes/{episode_id}")
def delete_episode(
    project_id: int, episode_id: int, user: models.User = Depends(current_user), db: Session = Depends(get_db)
):
    require_project_access(db, user, project_id, write=True)
    row = db.query(models.Episode).filter_by(id=episode_id, project_id=project_id).first()
    if not row:
        fail(1004, "片段不存在", 404)
    db.query(models.EpisodeCharacter).filter_by(episode_id=episode_id).delete()
    db.query(models.EpisodeScene).filter_by(episode_id=episode_id).delete()
    db.query(models.EpisodeObject).filter_by(episode_id=episode_id).delete()
    db.delete(row)
    return ok(True)
