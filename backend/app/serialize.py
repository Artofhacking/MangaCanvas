from sqlalchemy.orm import Session

from . import models
from .shaping import shaping_payload
from .util import iso, rewrite_media_tree, rewrite_stored_media_url


def user_public(user: models.User, organization_ids: list[int] | None = None, with_role: bool = False) -> dict:
    data = {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "avatar": rewrite_stored_media_url(user.avatar),
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
        "coverImage": rewrite_stored_media_url(row.cover_image),
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
            "avatar": rewrite_stored_media_url(user.avatar),
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
        "avatar": rewrite_stored_media_url(row.avatar),
        "referenceImages": rewrite_media_tree(row.reference_images or []),
        "modelId": row.model_id,
        "seed": row.seed,
        "creationMode": row.creation_mode,
        "sourceWorkflowId": row.source_workflow_id,
        "sourceNodeId": row.source_node_id,
        "usageCount": row.usage_count,
        "createdAt": iso(row.created_at),
        "updatedAt": iso(row.updated_at),
        **shaping_payload(row),
    }


def scene(row: models.Scene) -> dict:
    return {
        "id": row.id,
        "organizationId": row.organization_id,
        "projectId": row.project_id,
        "name": row.name,
        "description": row.description,
        "image": rewrite_stored_media_url(row.image),
        "status": row.status,
        "genMethod": row.gen_method,
        "modelId": row.model_id,
        "style": row.style,
        "camera": row.camera,
        "referenceImages": rewrite_media_tree(row.reference_images or []),
        "seed": row.seed,
        "creationMode": row.creation_mode,
        "sourceWorkflowId": row.source_workflow_id,
        "sourceNodeId": row.source_node_id,
        "usageCount": row.usage_count,
        "createdAt": iso(row.created_at),
        "updatedAt": iso(row.updated_at),
        **shaping_payload(row),
    }


def obj(row: models.ProjectObject) -> dict:
    return {
        "id": row.id,
        "organizationId": row.organization_id,
        "projectId": row.project_id,
        "name": row.name,
        "type": row.type,
        "description": row.description,
        "image": rewrite_stored_media_url(row.image),
        "sceneId": row.scene_id,
        "status": row.status,
        "genMethod": row.gen_method,
        "referenceImages": rewrite_media_tree(row.reference_images or []),
        "creationMode": row.creation_mode,
        "sourceWorkflowId": row.source_workflow_id,
        "sourceNodeId": row.source_node_id,
        "createdAt": iso(row.created_at),
        "updatedAt": iso(row.updated_at),
        **shaping_payload(row),
    }


STORYBOARD_STATUSES = {"empty", "generating", "ready", "failed"}


def normalize_storyboard(value) -> list:
    if not isinstance(value, list):
        return []
    shots = []
    for index, item in enumerate(value[:80]):
        if not isinstance(item, dict):
            continue
        raw_status = str(item.get("status") or "")
        image_url = item.get("imageUrl") or item.get("image") or None
        if raw_status == "generating":
            status = "ready" if image_url else "empty"
        elif raw_status in STORYBOARD_STATUSES:
            status = raw_status
        else:
            status = "ready" if image_url else "empty"
        character_ids = []
        for cid in item.get("characterIds") or []:
            try:
                character_ids.append(int(cid))
            except (TypeError, ValueError):
                continue
        scene_id = item.get("sceneId")
        try:
            scene_id = int(scene_id) if scene_id not in (None, "", 0, "0") else None
        except (TypeError, ValueError):
            scene_id = None
        shots.append(
            {
                "id": str(item.get("id") or f"shot_{index + 1}"),
                "index": index + 1,
                "prompt": str(item.get("prompt") or "")[:4000],
                "characterIds": character_ids[:12],
                "sceneId": scene_id,
                "imageUrl": str(image_url)[:1024] if image_url else None,
                "status": status,
                "error": str(item.get("error") or "")[:400] or None,
            }
        )
    return shots


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
        "coverImage": rewrite_stored_media_url(row.cover_image),
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
                "image": rewrite_stored_media_url(c.avatar),
                "description": c.description,
                "role": "主角" if c.role == "main" else "配角",
                **shaping_payload(c),
            }
            for c in chars
        ],
        "scenes": [
            {
                "id": s.id,
                "name": s.name,
                "image": rewrite_stored_media_url(s.image),
                "description": s.description,
                **shaping_payload(s),
            }
            for s in scenes
        ],
        "objects": [
            {
                "id": o.id,
                "name": o.name,
                "image": rewrite_stored_media_url(o.image),
                "description": o.description,
                "type": o.type,
                **shaping_payload(o),
            }
            for o in objects
        ],
        "sceneCount": len(scenes),
        "storyboard": rewrite_media_tree(normalize_storyboard(getattr(row, "storyboard", None))),
        "createdAt": iso(row.created_at),
        "updatedAt": iso(row.updated_at),
    }


def script_document(row, include_text: bool = False) -> dict:
    parsed = row.parsed_json if isinstance(row.parsed_json, dict) else {}
    data = {
        "id": row.id,
        "organizationId": row.organization_id,
        "projectId": row.project_id,
        "title": row.title,
        "sourceFilename": row.source_filename,
        "plot": parsed.get("plot") or {"summary": row.plot_summary or ""},
        "characters": parsed.get("characters") or [],
        "scenes": parsed.get("scenes") or [],
        "props": parsed.get("props") or [],
        "episodes": parsed.get("episodes") or [],
        "agent": parsed.get("agent") or {"model": row.model},
        "status": row.status,
        "model": row.model,
        "createdBy": row.created_by,
        "importedAt": iso(row.imported_at),
        "createdAt": iso(row.created_at),
        "updatedAt": iso(row.updated_at),
    }
    if include_text:
        data["sourceText"] = row.source_text
    return data


def normalize_canvas(canvas: dict | None) -> dict:
    canvas = canvas or {}
    nodes = []
    for raw in canvas.get("nodes") or []:
        node = dict(raw)
        data = rewrite_media_tree(dict(node.get("data") or {}))
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
        "thumbnail": rewrite_stored_media_url(row.thumbnail),
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
        "url": rewrite_stored_media_url(row.url),
        "metadata": row.extra_metadata,
        "createdBy": row.created_by,
        "createdAt": iso(row.created_at),
        "updatedAt": iso(row.updated_at),
    }


def uploaded(row: models.UploadedFile) -> dict:
    return {
        "id": row.id,
        "url": rewrite_stored_media_url(row.url),
        "directory": row.directory,
        "filename": row.filename,
        "contentType": row.content_type,
        "size": row.size,
        "relatedId": row.related_id,
        "createdBy": row.created_by,
        "createdAt": iso(row.created_at),
    }
