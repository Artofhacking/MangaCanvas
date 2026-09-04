from sqlalchemy.orm import Session

from . import models
from .util import iso


def user_public(user: models.User, organization_ids: list[int] | None = None, with_role: bool = False) -> dict:
    data = {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "avatar": user.avatar,
        "roleId": user.role_id,
        "credits": user.credits,
        "createdAt": iso(user.created_at),
        "updatedAt": iso(user.updated_at),
    }
    if organization_ids is not None:
        data["organizationIds"] = organization_ids
    if with_role and user.role:
        data["role"] = {"id": user.role.id, "code": user.role.code, "name": user.role.name}
    return data


def organization(row: models.Organization) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "createdBy": row.created_by,
        "createdAt": iso(row.created_at),
        "updatedAt": iso(row.updated_at),
    }


def project(row: models.Project, extra: dict | None = None) -> dict:
    data = {
        "id": row.id,
        "organizationId": row.organization_id,
        "name": row.name,
        "description": row.description,
        "coverImage": row.cover_image,
        "status": row.status,
        "isPublic": row.is_public,
        "ownerId": row.owner_id,
        "createdAt": iso(row.created_at),
        "updatedAt": iso(row.updated_at),
    }
    if extra:
        data.update(extra)
    return data


def member(row: models.ProjectMember, user: models.User | None = None) -> dict:
    data = {
        "userId": row.user_id,
        "organizationId": row.organization_id,
        "role": row.role,
        "assignedBy": row.assigned_by,
        "joinedAt": iso(row.joined_at),
    }
    if user:
        data["user"] = {
            "id": user.id,
            "username": user.username,
            "avatar": user.avatar,
            "email": user.email,
        }
    return data


def character(row: models.Character) -> dict:
    return {
        "id": row.id,
        "organizationId": row.organization_id,
        "projectId": row.project_id,
        "name": row.name,
        "role": row.role,
        "gender": row.gender,
        "ageGroup": row.age_group,
        "style": row.style,
        "description": row.description,
        "avatar": row.avatar,
        "referenceImages": row.reference_images or [],
        "modelId": row.model_id,
        "seed": row.seed,
        "creationMode": row.creation_mode,
        "sourceWorkflowId": row.source_workflow_id,
        "sourceNodeId": row.source_node_id,
        "usageCount": row.usage_count,
        "createdAt": iso(row.created_at),
        "updatedAt": iso(row.updated_at),
    }


def scene(row: models.Scene) -> dict:
    return {
        "id": row.id,
        "organizationId": row.organization_id,
        "projectId": row.project_id,
        "name": row.name,
        "description": row.description,
        "image": row.image,
        "status": row.status,
        "genMethod": row.gen_method,
        "modelId": row.model_id,
        "style": row.style,
        "camera": row.camera,
        "referenceImages": row.reference_images or [],
        "seed": row.seed,
        "creationMode": row.creation_mode,
        "sourceWorkflowId": row.source_workflow_id,
        "sourceNodeId": row.source_node_id,
        "usageCount": row.usage_count,
        "createdAt": iso(row.created_at),
        "updatedAt": iso(row.updated_at),
    }


def obj(row: models.ProjectObject) -> dict:
    return {
        "id": row.id,
        "organizationId": row.organization_id,
        "projectId": row.project_id,
        "name": row.name,
        "type": row.type,
        "description": row.description,
        "image": row.image,
        "sceneId": row.scene_id,
        "status": row.status,
        "genMethod": row.gen_method,
        "referenceImages": row.reference_images or [],
        "creationMode": row.creation_mode,
        "sourceWorkflowId": row.source_workflow_id,
        "sourceNodeId": row.source_node_id,
        "createdAt": iso(row.created_at),
        "updatedAt": iso(row.updated_at),
    }


def episode(db: Session, row: models.Episode) -> dict:
    char_ids = [r.character_id for r in db.query(models.EpisodeCharacter).filter_by(episode_id=row.id)]
    scene_ids = [r.scene_id for r in db.query(models.EpisodeScene).filter_by(episode_id=row.id)]
    object_ids = [r.object_id for r in db.query(models.EpisodeObject).filter_by(episode_id=row.id)]
    chars = db.query(models.Character).filter(models.Character.id.in_(char_ids)).all() if char_ids else []
    scenes = db.query(models.Scene).filter(models.Scene.id.in_(scene_ids)).all() if scene_ids else []
    objects = db.query(models.ProjectObject).filter(models.ProjectObject.id.in_(object_ids)).all() if object_ids else []
    return {
        "id": row.id,
        "organizationId": row.organization_id,
        "projectId": row.project_id,
        "name": row.name,
        "code": row.code,
        "description": row.description,
        "status": row.status,
        "progress": row.progress,
        "duration": row.duration,
        "creationMode": row.creation_mode,
        "sourceWorkflowId": row.source_workflow_id,
        "sourceNodeId": row.source_node_id,
        "characterIds": char_ids,
        "sceneIds": scene_ids,
        "objectIds": object_ids,
        "characters": [
            {
                "id": c.id,
                "name": c.name,
                "image": c.avatar,
                "role": "主角" if c.role == "main" else "配角",
            }
            for c in chars
        ],
        "scenes": [{"id": s.id, "name": s.name, "image": s.image} for s in scenes],
        "objects": [{"id": o.id, "name": o.name, "image": o.image, "type": o.type} for o in objects],
        "sceneCount": len(scenes),
        "createdAt": iso(row.created_at),
        "updatedAt": iso(row.updated_at),
    }


def normalize_canvas(canvas: dict | None) -> dict:
    canvas = canvas or {}
    nodes = []
    for raw in canvas.get("nodes") or []:
        node = dict(raw)
        data = dict(node.get("data") or {})
        if node.get("type") == "text" and not data.get("content"):
            data["content"] = data.get("value") or ""
        node["data"] = data
        nodes.append(node)
    return {
        "nodes": nodes,
        "edges": canvas.get("edges") or [],
        "viewport": canvas.get("viewport") or {"x": 0, "y": 0, "zoom": 1},
    }


def workflow(row: models.CanvasWorkflow, include_canvas: bool = True) -> dict:
    data = {
        "id": row.id,
        "organizationId": row.organization_id,
        "projectId": row.project_id,
        "name": row.name,
        "thumbnail": row.thumbnail,
        "sourceType": row.source_type,
        "sourceAssetId": row.source_asset_id,
        "status": row.status,
        "createdBy": row.created_by,
        "createdAt": iso(row.created_at),
        "updatedAt": iso(row.updated_at),
    }
    if include_canvas:
        data["canvasData"] = normalize_canvas(row.canvas_data)
    return data


def asset(row: models.ProjectAsset) -> dict:
    return {
        "id": row.id,
        "organizationId": row.organization_id,
        "projectId": row.project_id,
        "name": row.name,
        "sourceType": row.source_type,
        "sourceId": row.source_id,
        "prompt": row.prompt,
        "url": row.url,
        "metadata": row.extra_metadata,
        "createdBy": row.created_by,
        "createdAt": iso(row.created_at),
        "updatedAt": iso(row.updated_at),
    }


def uploaded(row: models.UploadedFile) -> dict:
    return {
        "id": row.id,
        "url": row.url,
        "directory": row.directory,
        "filename": row.filename,
        "contentType": row.content_type,
        "size": row.size,
        "relatedId": row.related_id,
        "createdBy": row.created_by,
        "createdAt": iso(row.created_at),
    }
