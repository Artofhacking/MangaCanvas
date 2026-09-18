import time

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import models, serialize
from ..db import get_db
from ..deps import current_user, require_project_access
from ..errors import fail, ok
from ..script_agent import MAX_EPISODE_SUMMARY, parse_script, restore_episode_summaries
from ..util import now, paginate

router = APIRouter(prefix="/projects/{project_id}/scripts")


class ScriptParseIn(BaseModel):
    text: str
    title: str | None = None
    filename: str | None = None


class ScriptImportIn(BaseModel):
    characters: list[dict] | None = None
    scenes: list[dict] | None = None
    props: list[dict] | None = None
    episodes: list[dict] | None = None
    skipExisting: bool = True


def _payload_of(row: models.ScriptDocument) -> dict:
    parsed = row.parsed_json if isinstance(row.parsed_json, dict) else {}
    return {
        "characters": parsed.get("characters") or [],
        "scenes": parsed.get("scenes") or [],
        "props": parsed.get("props") or [],
        "episodes": parsed.get("episodes") or [],
        "plot": parsed.get("plot") or {"summary": row.plot_summary or ""},
        "title": parsed.get("title") or row.title,
    }


def _existing_name_map(rows, attr: str = "name") -> dict[str, object]:
    mapping: dict[str, object] = {}
    for row in rows:
        key = (getattr(row, attr) or "").strip().casefold()
        if key:
            mapping[key] = row
    return mapping


def _match_ids(names: list, mapping: dict[str, object]) -> list[int]:
    ids: list[int] = []
    seen: set[int] = set()
    for name in names or []:
        key = str(name or "").strip().casefold()
        row = mapping.get(key)
        if row is None:
            for existing_name, candidate in mapping.items():
                if key and (key in existing_name or existing_name in key):
                    row = candidate
                    break
        if row is None:
            continue
        if row.id in seen:
            continue
        seen.add(row.id)
        ids.append(row.id)
    return ids


@router.get("")
def list_scripts(
    project_id: int,
    page: int = 1,
    size: int = 20,
    user: models.User = Depends(current_user),
    db: Session = Depends(get_db),
):
    require_project_access(db, user, project_id)
    rows = (
        db.query(models.ScriptDocument)
        .filter_by(project_id=project_id)
        .order_by(models.ScriptDocument.updated_at.desc())
        .all()
    )
    items = [serialize.script_document(row, include_text=False) for row in rows]
    sliced, pagination = paginate(items, page, size)
    return ok({"list": sliced, "pagination": pagination})


@router.get("/{script_id}")
def get_script(
    project_id: int,
    script_id: int,
    user: models.User = Depends(current_user),
    db: Session = Depends(get_db),
):
    require_project_access(db, user, project_id)
    row = db.query(models.ScriptDocument).filter_by(id=script_id, project_id=project_id).first()
    if not row:
        fail(1004, "剧本不存在", 404)
    return ok(serialize.script_document(row, include_text=True))


@router.post("/parse")
async def parse_project_script(
    project_id: int,
    body: ScriptParseIn,
    user: models.User = Depends(current_user),
    db: Session = Depends(get_db),
):
    project = require_project_access(db, user, project_id, write=True)
    text = (body.text or "").strip()
    if not text:
        fail(1001, "请先上传或粘贴剧本", 400)
    filename = (body.filename or "").strip()
    if filename:
        lowered = filename.lower()
        if not (lowered.endswith(".txt") or lowered.endswith(".md")):
            fail(1001, "仅支持 txt、md 文件", 400)
    title = (body.title or "").strip() or (filename.rsplit(".", 1)[0] if filename else "")
    try:
        parsed = await parse_script(text, title)
    except ValueError as exc:
        fail(1001, str(exc), 400)

    plot = parsed.get("plot") or {}
    row = models.ScriptDocument(
        organization_id=project.organization_id,
        project_id=project_id,
        title=parsed.get("title") or title,
        source_filename=filename or None,
        source_text=text,
        plot_summary=(plot.get("summary") or "")[:2000],
        parsed_json=parsed,
        status="parsed",
        model=((parsed.get("agent") or {}).get("model") if isinstance(parsed.get("agent"), dict) else None),
        created_by=user.id,
    )
    db.add(row)
    db.flush()
    db.add(
        models.BillingLedger(
            user_id=user.id,
            organization_id=project.organization_id,
            project_id=project_id,
            entry_type="consume",
            amount=0,
            balance_after=user.credits,
            description=f"剧本解析 {row.title}"[:200],
            reference_type="script_parse",
            reference_id=str(row.id),
        )
    )
    return ok(serialize.script_document(row, include_text=True))


@router.post("/{script_id}/import")
def import_script(
    project_id: int,
    script_id: int,
    body: ScriptImportIn,
    user: models.User = Depends(current_user),
    db: Session = Depends(get_db),
):
    project = require_project_access(db, user, project_id, write=True)
    row = db.query(models.ScriptDocument).filter_by(id=script_id, project_id=project_id).first()
    if not row:
        fail(1004, "剧本不存在", 404)

    stored = _payload_of(row)
    characters_in = body.characters if body.characters is not None else stored["characters"]
    scenes_in = body.scenes if body.scenes is not None else stored["scenes"]
    props_in = body.props if body.props is not None else stored["props"]
    episodes_in = restore_episode_summaries(
        body.episodes if body.episodes is not None else stored["episodes"],
        row.source_text or "",
    )

    existing_characters = _existing_name_map(db.query(models.Character).filter_by(project_id=project_id).all())
    existing_scenes = _existing_name_map(db.query(models.Scene).filter_by(project_id=project_id).all())
    existing_objects = _existing_name_map(db.query(models.ProjectObject).filter_by(project_id=project_id).all())
    existing_episodes = _existing_name_map(db.query(models.Episode).filter_by(project_id=project_id).all())

    created = {"characters": 0, "scenes": 0, "objects": 0, "episodes": 0}
    skipped = {"characters": 0, "scenes": 0, "objects": 0, "episodes": 0}

    for item in characters_in:
        name = str((item or {}).get("name") or "").strip()
        if not name:
            continue
        key = name.casefold()
        if body.skipExisting and key in existing_characters:
            skipped["characters"] += 1
            continue
        role = item.get("role") if item.get("role") in {"main", "support"} else None
        gender = item.get("gender") if item.get("gender") in {"male", "female", "other"} else None
        age_group = item.get("ageGroup") if item.get("ageGroup") in {"child", "teen", "young", "middle", "old"} else None
        character = models.Character(
            organization_id=project.organization_id,
            project_id=project_id,
            name=name[:128],
            role=role or "main",
            gender=gender,
            age_group=age_group,
            description=str(item.get("description") or item.get("personality") or "")[:4000] or None,
            creation_mode="quick",
        )
        db.add(character)
        db.flush()
        existing_characters[key] = character
        created["characters"] += 1

    for item in scenes_in:
        name = str((item or {}).get("name") or "").strip()
        if not name:
            continue
        key = name.casefold()
        if body.skipExisting and key in existing_scenes:
            skipped["scenes"] += 1
            continue
        description_parts = [str(item.get("location") or "").strip(), str(item.get("time") or "").strip(), str(item.get("description") or "").strip()]
        scene = models.Scene(
            organization_id=project.organization_id,
            project_id=project_id,
            name=name[:128],
            description=" / ".join(part for part in description_parts if part) or None,
            status="draft",
            creation_mode="quick",
        )
        db.add(scene)
        db.flush()
        existing_scenes[key] = scene
        created["scenes"] += 1

    for item in props_in:
        name = str((item or {}).get("name") or "").strip()
        if not name:
            continue
        key = name.casefold()
        if body.skipExisting and key in existing_objects:
            skipped["objects"] += 1
            continue
        prop_type = item.get("type") if item.get("type") in {"weapon", "prop", "clothing", "decoration"} else None
        obj = models.ProjectObject(
            organization_id=project.organization_id,
            project_id=project_id,
            name=name[:128],
            type=prop_type or "prop",
            description=str(item.get("description") or "")[:4000] or None,
            status="draft",
            creation_mode="quick",
        )
        db.add(obj)
        db.flush()
        existing_objects[key] = obj
        created["objects"] += 1

    stamp = int(time.time())
    for index, item in enumerate(episodes_in, start=1):
        name = str((item or {}).get("name") or "").strip()
        if not name:
            continue
        key = name.casefold()
        if body.skipExisting and key in existing_episodes:
            skipped["episodes"] += 1
            continue
        code = f"S{row.id}E{index:02d}T{stamp}"
        episode = models.Episode(
            organization_id=project.organization_id,
            project_id=project_id,
            name=name[:128],
            code=code[:64],
            description=str(item.get("summary") or item.get("description") or "")[:MAX_EPISODE_SUMMARY] or None,
            status="draft",
            creation_mode="quick",
        )
        db.add(episode)
        db.flush()
        character_ids = _match_ids(item.get("characterNames") or [], existing_characters)
        scene_ids = _match_ids(item.get("sceneNames") or [], existing_scenes)
        object_ids = _match_ids(item.get("propNames") or [], existing_objects)
        for cid in character_ids:
            db.add(models.EpisodeCharacter(episode_id=episode.id, character_id=cid))
        for sid in scene_ids:
            db.add(models.EpisodeScene(episode_id=episode.id, scene_id=sid))
        for oid in object_ids:
            db.add(models.EpisodeObject(episode_id=episode.id, object_id=oid))
        existing_episodes[key] = episode
        created["episodes"] += 1

    row.status = "imported"
    row.imported_at = now()
    row.updated_at = now()
    db.flush()
    return ok(
        {
            "script": serialize.script_document(row, include_text=False),
            "created": created,
            "skipped": skipped,
        }
    )
