import asyncio
import logging
import time

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import billing_service, models, serialize
from ..ai_media import llm_complete, resolve_chat_endpoint
from ..config import settings
from ..db import SessionLocal, get_db
from ..deps import current_user, current_user_detached, require_project_access, resolve_project_detached
from ..errors import ApiError, fail, ok
from ..pricing import quote_request
from ..script_agent import (
    MAX_EPISODE_SUMMARY,
    MAX_LLM_CHARS,
    MAX_SOURCE_CHARS,
    SYSTEM_PROMPT,
    extract_json_object,
    heuristic_parse,
    normalize_parse_result,
    restore_episode_summaries,
)
from ..util import now, paginate

router = APIRouter(prefix="/projects/{project_id}/scripts")
logger = logging.getLogger(__name__)


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


def _asset_text(*parts: object, limit: int = 4000) -> str | None:
    chunks: list[str] = []
    for part in parts:
        text = str(part or "").strip()
        if text and text not in chunks:
            chunks.append(text)
    if not chunks:
        return None
    return "\n".join(chunks)[:limit]


def _scene_text(item: dict) -> str | None:
    parts: list[str] = []
    for key in ("location", "time", "description", "prompt"):
        text = str(item.get(key) or "").strip()
        if text and text not in parts:
            parts.append(text)
    if not parts:
        return None
    return " / ".join(parts)[:4000]


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


def _idempotency_key(request: Request, body: dict) -> str | None:
    raw = request.headers.get("Idempotency-Key") or body.get("clientRequestId")
    if raw is None:
        return None
    key = str(raw).strip()
    return key or None


def _with_fresh_billing(media: dict, user_id: int, cap: billing_service.CaptureResult, reservation) -> dict:
    balance, _frozen = billing_service.read_wallet(user_id)
    out = dict(media)
    out.pop("billing", None)
    out["billing"] = {
        "charged": cap.charged,
        "balanceAfter": balance,
        "reservationId": None if not cap.attempt_matched else (reservation.id if reservation is not None else None),
        "model": reservation.model_id if reservation is not None else None,
        "uncollected": cap.uncollected,
        "replayed": cap.replayed,
    }
    return out


async def _heartbeat_loop(reservation, stop: asyncio.Event) -> None:
    while not stop.is_set():
        try:
            await asyncio.wait_for(stop.wait(), timeout=60)
            return
        except asyncio.TimeoutError:
            billing_service.heartbeat(reservation.id, reservation.attempt)


def persist_script_document_short(
    project: dict,
    user: models.User,
    parsed: dict,
    *,
    text: str,
    filename: str | None,
    title: str,
) -> dict:
    db = SessionLocal()
    try:
        plot = parsed.get("plot") or {}
        row = models.ScriptDocument(
            organization_id=project["organization_id"],
            project_id=project["id"],
            title=parsed.get("title") or title or "未命名剧本",
            source_filename=filename or None,
            source_text=text,
            plot_summary=(plot.get("summary") or "")[:2000],
            parsed_json=parsed,
            status="parsed",
            model=((parsed.get("agent") or {}).get("model") if isinstance(parsed.get("agent"), dict) else None),
            created_by=user.id,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return serialize.script_document(row, include_text=True)
    finally:
        db.close()


def replay_script_document(payload: dict) -> dict:
    sid = payload.get("scriptId")
    db = SessionLocal()
    try:
        row = db.get(models.ScriptDocument, sid) if sid else None
        if row:
            return serialize.script_document(row, include_text=True)
    finally:
        db.close()
    return dict(payload.get("document") or {})


@router.post("/parse")
async def parse_project_script(
    project_id: int,
    body: ScriptParseIn,
    request: Request,
    user: models.User = Depends(current_user_detached),
):
    project = resolve_project_detached(user, project_id, write=True)
    if not project:
        fail(1004, "项目不存在", 404)
    text = (body.text or "").strip()
    if not text:
        fail(1001, "请先上传或粘贴剧本", 400)
    filename = (body.filename or "").strip()
    if filename:
        lowered = filename.lower()
        if not (lowered.endswith(".txt") or lowered.endswith(".md")):
            fail(1001, "仅支持 txt、md 文件", 400)
    title = (body.title or "").strip() or (filename.rsplit(".", 1)[0] if filename else "")
    if len(text) > MAX_SOURCE_CHARS:
        text = text[:MAX_SOURCE_CHARS]
    raw_body = body.model_dump()

    if not resolve_chat_endpoint():
        parsed = heuristic_parse(text, title)
        parsed["agent"] = {"provider": "heuristic", "model": "rules"}
        snapshot = persist_script_document_short(project, user, parsed, text=text, filename=filename or None, title=title)
        return ok(snapshot)

    reservation = None
    captured = False
    stop = asyncio.Event()
    beat = None
    try:
        if settings.billing_enabled:
            quote_db = SessionLocal()
            try:
                quoted = quote_request(
                    quote_db,
                    model="",
                    modality="text",
                    unit="script_parse",
                )
            finally:
                quote_db.close()
            reservation = billing_service.reserve(
                user_id=user.id,
                quote=quoted,
                request_body=raw_body,
                reference_type="script_parse",
                organization_id=project["organization_id"],
                project_id=project["id"],
                idempotency_key=_idempotency_key(request, raw_body),
            )
            if reservation.status == "captured" and reservation.response_payload:
                captured = True
                payload = replay_script_document(reservation.response_payload)
                payload.pop("billing", None)
                replay = billing_service.CaptureResult(False, 0, True, True, payload)
                return ok(_with_fresh_billing(payload, user.id, replay, reservation))
            beat = asyncio.create_task(_heartbeat_loop(reservation, stop))

        llm_input = text if len(text) <= MAX_LLM_CHARS else text[:MAX_LLM_CHARS] + "\n\n[原文过长，以上为截取部分]"
        user_prompt = f"作品参考标题：{title or ''}\n\n剧本原文：\n{llm_input}"
        content, model = await llm_complete(
            [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            timeout=180,
            fail_on_error=False,
        )
        parsed_llm = extract_json_object(content or "")
        if not parsed_llm:
            parsed = heuristic_parse(text, title)
            parsed["agent"] = {
                "provider": "heuristic",
                "model": model or "rules",
                "note": "模型未返回合法 JSON，已使用规则拆解",
            }
            snapshot = persist_script_document_short(
                project, user, parsed, text=text, filename=filename or None, title=title
            )
            return ok(snapshot)

        parsed = normalize_parse_result(parsed_llm, title, text)
        if model and str(model).startswith("grok"):
            provider = "xai"
        elif model and "qwen" in str(model):
            provider = "openai-compatible"
        else:
            provider = "llm"
        parsed["agent"] = {"provider": provider, "model": model or "unknown"}
        snapshot = persist_script_document_short(
            project, user, parsed, text=text, filename=filename or None, title=title
        )
        if reservation is not None:
            cap = billing_service.capture(
                reservation.id,
                reservation.attempt,
                response_payload={"scriptId": snapshot.get("id"), "document": snapshot},
            )
            captured = True
            return ok(_with_fresh_billing(snapshot, user.id, cap, reservation))
        return ok(snapshot)
    except ApiError:
        raise
    except Exception as exc:
        fail(3001, f"剧本解析失败: {exc}", 502)
    finally:
        stop.set()
        if beat is not None:
            beat.cancel()
        if reservation is not None and not captured:
            billing_service.release(reservation.id, reservation.attempt, reason="finally")


def _import_parsed_script(
    project: models.Project,
    row: models.ScriptDocument,
    body: ScriptImportIn,
    project_id: int,
    db: Session,
):
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
            description=_asset_text(item.get("description"), item.get("prompt"), item.get("personality")),
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
        scene = models.Scene(
            organization_id=project.organization_id,
            project_id=project_id,
            name=name[:128],
            description=_scene_text(item),
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
            description=_asset_text(item.get("description"), item.get("prompt")),
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
            description=_asset_text(
                item.get("summary"),
                item.get("description"),
                item.get("prompt"),
                limit=MAX_EPISODE_SUMMARY,
            ),
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
    try:
        return _import_parsed_script(project, row, body, project_id, db)
    except ApiError:
        raise
    except Exception as exc:
        logger.exception("script import failed project=%s script=%s", project_id, script_id)
        fail(5000, f"写入项目资产失败: {exc}", 500)
