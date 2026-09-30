"""In-process async video jobs.

Submit returns as soon as the row is queued. A lifespan worker claims jobs and
runs the existing upstream poll off the request thread. Same-node submits
cancel the previous queued/running job for that user. Other nodes overlap,
up to a small concurrency cap; extras stay queued.
"""

from __future__ import annotations

import asyncio
import logging
import secrets
from contextlib import suppress
from datetime import timedelta

from sqlalchemy import update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from . import billing_service, models
from .config import settings
from .db import SessionLocal
from .errors import ApiError, fail
from .util import now

logger = logging.getLogger(__name__)

STALE_RUNNING = timedelta(seconds=90)
_CANCEL_EVENTS: dict[str, asyncio.Event] = {}
_BACKGROUND: set[asyncio.Task] = set()
_ACTIVE = ("queued", "running")
_TERMINAL = ("succeeded", "failed", "cancelled")


def _per_user_cap() -> int:
    return max(1, int(settings.video_job_max_running_per_user))


def _global_cap() -> int:
    return max(1, int(settings.video_job_max_running_global))


def _new_id() -> str:
    return "vjob_" + secrets.token_hex(16)


def _clean_node_id(raw) -> str | None:
    if raw is None:
        return None
    text = str(raw).strip()
    return text[:128] or None


def _client_key(raw: str | None) -> str | None:
    if raw is None:
        return None
    key = str(raw).strip()
    if not key:
        return None
    if len(key) > 64:
        fail(1001, "Idempotency-Key 无效", 400)
    return key


def _expunge(db: Session, row):
    if row is not None:
        db.expunge(row)
    return row


def _find_by_key(user_id: int, key: str) -> models.VideoGenerationJob | None:
    db = SessionLocal()
    try:
        row = (
            db.query(models.VideoGenerationJob)
            .filter_by(user_id=user_id, idempotency_key=key)
            .first()
        )
        return _expunge(db, row)
    finally:
        db.close()


def _find_by_reservation(reservation_id: int) -> models.VideoGenerationJob | None:
    db = SessionLocal()
    try:
        row = (
            db.query(models.VideoGenerationJob)
            .filter_by(reservation_id=reservation_id)
            .order_by(models.VideoGenerationJob.created_at.desc())
            .first()
        )
        return _expunge(db, row)
    finally:
        db.close()


def _load_reservation(user_id: int, key: str) -> models.BillingReservation | None:
    db = SessionLocal()
    try:
        row = (
            db.query(models.BillingReservation)
            .filter_by(user_id=user_id, idempotency_key=key)
            .first()
        )
        return _expunge(db, row)
    finally:
        db.close()


def _load_job(job_id: str) -> models.VideoGenerationJob | None:
    db = SessionLocal()
    try:
        return _expunge(db, db.get(models.VideoGenerationJob, job_id))
    finally:
        db.close()


def _require(user_id: int, job_id: str) -> models.VideoGenerationJob:
    job = _load_job(job_id)
    if job is None or job.user_id != user_id:
        fail(1004, "视频任务不存在", 404)
    return job


def public_status(status: str) -> str:
    if status == "finalizing":
        return "running"
    return status


def public_view(job: models.VideoGenerationJob) -> dict:
    status = public_status(job.status)
    data = {
        "job_id": job.id,
        "status": status,
        "progress": job.progress,
        "message": job.message,
    }
    if status == "succeeded" and job.result_url:
        data["url"] = job.result_url
    billing = _billing_public(job)
    if billing is not None:
        data["billing"] = billing
    return data


def _billing_public(job: models.VideoGenerationJob) -> dict | None:
    if job.reservation_id is None and not job.billing_snapshot:
        return None
    snap = dict(job.billing_snapshot or {})
    if "charged" not in snap:
        snap["charged"] = 0
    snap.setdefault("reservationId", job.reservation_id)
    snap.setdefault("model", job.model)
    snap.setdefault("uncollected", False)
    snap.setdefault("replayed", False)
    balance, _frozen = billing_service.read_wallet(job.user_id)
    snap["balanceAfter"] = balance
    return snap


def _billing_dict(runtime: dict, *, charged: int, uncollected: bool, replayed: bool) -> dict:
    balance, _frozen = billing_service.read_wallet(runtime["user_id"])
    return {
        "charged": charged,
        "balanceAfter": balance,
        "reservationId": runtime.get("reservation_id"),
        "model": runtime.get("model"),
        "uncollected": uncollected,
        "replayed": replayed,
    }


def _signal_cancelled(job_ids: list[str]) -> None:
    for job_id in job_ids:
        event = _CANCEL_EVENTS.get(job_id)
        if event is not None:
            event.set()


def clean_batch_id(raw) -> str | None:
    if raw is None:
        return None
    text = str(raw).strip()
    if not text:
        return None
    return text[:64]


def _payload_batch_id(payload) -> str:
    if not isinstance(payload, dict):
        return ""
    raw = payload.get("batch_id")
    if raw is None:
        return ""
    return str(raw).strip()


def _cancel_others(
    db: Session,
    user_id: int,
    node_id: str,
    keep_id: str,
    batch_id: str = "",
) -> list[tuple[str, int | None, int | None]]:
    rows = (
        db.query(models.VideoGenerationJob)
        .filter(
            models.VideoGenerationJob.user_id == user_id,
            models.VideoGenerationJob.node_id == node_id,
            models.VideoGenerationJob.id != keep_id,
            models.VideoGenerationJob.status.in_(_ACTIVE),
        )
        .all()
    )
    superseded: list[tuple[str, int | None, int | None]] = []
    for row in rows:
        # Clips from the same stacked generation share a batch and must all run.
        if batch_id and _payload_batch_id(row.payload) == batch_id:
            continue
        row.status = "cancelled"
        row.message = "已取消"
        row.finished_at = now()
        row.updated_at = now()
        superseded.append((row.id, row.reservation_id, row.reservation_attempt))
    return superseded


def _release_superseded(rows: list[tuple[str, int | None, int | None]]) -> None:
    for job_id, reservation_id, attempt in rows:
        if reservation_id is None or attempt is None:
            continue
        billing_service.release(reservation_id, attempt, reason="superseded")
        job = _load_job(job_id)
        if job is None:
            continue
        runtime = {
            "user_id": job.user_id,
            "reservation_id": reservation_id,
            "model": job.model,
        }
        _save_snapshot(job_id, _billing_dict(runtime, charged=0, uncollected=False, replayed=False))
    _signal_cancelled([job_id for job_id, _rid, _attempt in rows])


def _save_snapshot(job_id: str, snapshot: dict) -> None:
    db = SessionLocal()
    try:
        db.execute(
            update(models.VideoGenerationJob)
            .where(models.VideoGenerationJob.id == job_id)
            .values(billing_snapshot=snapshot, updated_at=now())
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def _insert_job(
    *,
    user_id: int,
    node_id: str | None,
    client_key: str | None,
    model: str,
    payload: dict,
    reservation,
    status: str,
    message: str | None,
    result_url: str | None = None,
) -> models.VideoGenerationJob:
    job = models.VideoGenerationJob(
        id=_new_id(),
        user_id=user_id,
        node_id=node_id,
        idempotency_key=client_key,
        status=status,
        progress=None,
        message=message,
        result_url=result_url,
        model=model[:128],
        payload=payload,
        reservation_id=None if reservation is None else reservation.id,
        reservation_attempt=None if reservation is None else reservation.attempt,
        finished_at=now() if status in _TERMINAL else None,
    )
    db = SessionLocal()
    superseded: list[tuple[str, int | None, int | None]] = []
    try:
        if node_id and status == "queued":
            superseded = _cancel_others(db, user_id, node_id, job.id, _payload_batch_id(payload))
        db.add(job)
        db.commit()
        db.refresh(job)
        db.expunge(job)
    except IntegrityError:
        db.rollback()
        if client_key:
            existing = _find_by_key(user_id, client_key)
            if existing is not None:
                return existing
        raise
    except Exception:
        db.rollback()
        if reservation is not None and status == "queued":
            billing_service.release(reservation.id, reservation.attempt, reason="enqueue")
        raise
    finally:
        db.close()
    if superseded:
        _release_superseded(superseded)
    return job


def submit_video_job(
    *,
    user_id: int,
    node_id: str | None,
    idempotency_key: str | None,
    model: str,
    prompt: str,
    size: str,
    resolution: str,
    duration: int,
    first_frame: str | None,
    last_frame: str | None,
    images: list,
    image_names: list,
    template: str | None,
    batch_id: str | None,
    quote,
    request_body: dict,
    organization_id: int | None,
    project_id: int | None,
) -> models.VideoGenerationJob:
    client_key = _client_key(idempotency_key)
    node = _clean_node_id(node_id)
    if client_key:
        existing = _find_by_key(user_id, client_key)
        if existing is not None:
            return existing

    payload = {
        "model": model,
        "prompt": prompt,
        "size": size,
        "resolution": resolution,
        "duration": duration,
        "first_frame": first_frame,
        "last_frame": last_frame,
        "images": list(images or []),
        "image_names": list(image_names or []),
        "template": template,
    }
    if batch_id:
        payload["batch_id"] = batch_id
    reservation = None
    if quote is not None:
        reserve_key = client_key or f"req_{secrets.token_hex(12)}"
        try:
            reservation = billing_service.reserve(
                user_id=user_id,
                quote=quote,
                request_body=request_body,
                reference_type="ai_video",
                organization_id=organization_id,
                project_id=project_id,
                idempotency_key=reserve_key,
            )
        except ApiError as exc:
            if exc.code != 1005 or not client_key:
                raise
            existing = _find_by_key(user_id, client_key)
            if existing is not None:
                return existing
            reservation = _load_reservation(user_id, client_key)
            if reservation is None:
                raise
        if client_key:
            existing = _find_by_key(user_id, client_key)
            if existing is not None:
                return existing
        if reservation is not None and reservation.status == "captured":
            linked = _find_by_reservation(reservation.id)
            if linked is not None:
                return linked
            url = (reservation.response_payload or {}).get("url")
            if not url:
                fail(1005, "生成进行中", 409)
            return _insert_job(
                user_id=user_id,
                node_id=node,
                client_key=client_key,
                model=model,
                payload=payload,
                reservation=reservation,
                status="succeeded",
                message=None,
                result_url=url,
            )

    return _insert_job(
        user_id=user_id,
        node_id=node,
        client_key=client_key,
        model=model,
        payload=payload,
        reservation=reservation,
        status="queued",
        message="排队中",
    )


def get_public(user_id: int, job_id: str) -> dict:
    return public_view(_require(user_id, job_id))


def cancel_for_user(user_id: int, job_id: str) -> dict:
    job = _require(user_id, job_id)
    if job.status in _TERMINAL or job.status == "finalizing":
        return public_view(job)
    reservation_id = None
    attempt = None
    db = SessionLocal()
    try:
        result = db.execute(
            update(models.VideoGenerationJob)
            .where(
                models.VideoGenerationJob.id == job_id,
                models.VideoGenerationJob.user_id == user_id,
                models.VideoGenerationJob.status.in_(_ACTIVE),
            )
            .values(status="cancelled", message="已取消", finished_at=now(), updated_at=now())
        )
        db.commit()
        changed = result.rowcount == 1
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
    if changed:
        fresh = _load_job(job_id)
        if fresh is not None:
            reservation_id = fresh.reservation_id
            attempt = fresh.reservation_attempt
        if reservation_id is not None and attempt is not None:
            billing_service.release(reservation_id, attempt, reason="cancelled")
            runtime = {
                "user_id": user_id,
                "reservation_id": reservation_id,
                "model": job.model,
            }
            _save_snapshot(job_id, _billing_dict(runtime, charged=0, uncollected=False, replayed=False))
        _signal_cancelled([job_id])
    return get_public(user_id, job_id)


def _load_runtime(job_id: str) -> dict | None:
    job = _load_job(job_id)
    if job is None or job.status != "running":
        return None
    return {
        "payload": dict(job.payload or {}),
        "reservation_id": job.reservation_id,
        "reservation_attempt": job.reservation_attempt,
        "model": job.model,
        "user_id": job.user_id,
    }


def _is_running(job_id: str) -> bool:
    job = _load_job(job_id)
    return job is not None and job.status == "running"


def _touch(job_id: str, reservation_id: int | None, attempt: int | None) -> None:
    db = SessionLocal()
    try:
        db.execute(
            update(models.VideoGenerationJob)
            .where(
                models.VideoGenerationJob.id == job_id,
                models.VideoGenerationJob.status.in_(("running", "finalizing")),
            )
            .values(updated_at=now())
        )
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()
    if reservation_id is not None and attempt is not None:
        billing_service.heartbeat(reservation_id, attempt)


def _transition(
    job_id: str,
    from_status: str,
    to_status: str,
    *,
    message: str | None = None,
    result_url: str | None = None,
    billing_snapshot: dict | None = None,
    set_message: bool = False,
    set_url: bool = False,
    set_snapshot: bool = False,
) -> bool:
    values: dict = {"status": to_status, "updated_at": now()}
    if to_status in _TERMINAL:
        values["finished_at"] = now()
    if set_message:
        values["message"] = None if message is None else message[:500]
    if set_url:
        values["result_url"] = result_url
    if set_snapshot:
        values["billing_snapshot"] = billing_snapshot
    db = SessionLocal()
    try:
        result = db.execute(
            update(models.VideoGenerationJob)
            .where(
                models.VideoGenerationJob.id == job_id,
                models.VideoGenerationJob.status == from_status,
            )
            .values(**values)
        )
        db.commit()
        return result.rowcount == 1
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def _fail_generation(job_id: str, runtime: dict, exc: BaseException) -> None:
    if isinstance(exc, ApiError):
        message = exc.message or "视频生成失败"
    else:
        from .model_probe import note_upstream_result

        note_upstream_result(str(runtime.get("model") or ""), 0, str(exc))
        message = f"视频生成失败: {exc}"
    if not _transition(job_id, "running", "failed", message=message, set_message=True):
        return
    rid = runtime.get("reservation_id")
    attempt = runtime.get("reservation_attempt")
    if rid is not None and attempt is not None:
        billing_service.release(rid, attempt, reason="failed")
        _save_snapshot(job_id, _billing_dict(runtime, charged=0, uncollected=False, replayed=False))


def _succeed_generation(job_id: str, runtime: dict, url: str) -> None:
    if not url:
        if _transition(job_id, "running", "failed", message="生成成功但未找到视频地址", set_message=True):
            rid = runtime.get("reservation_id")
            attempt = runtime.get("reservation_attempt")
            if rid is not None and attempt is not None:
                billing_service.release(rid, attempt, reason="empty")
                _save_snapshot(job_id, _billing_dict(runtime, charged=0, uncollected=False, replayed=False))
        return
    if not _transition(job_id, "running", "finalizing"):
        return
    rid = runtime.get("reservation_id")
    attempt = runtime.get("reservation_attempt")
    snapshot = None
    try:
        if rid is not None and attempt is not None:
            cap = billing_service.capture(
                rid,
                attempt,
                response_payload={"url": url, "job_id": job_id, "status": "succeeded"},
            )
            snapshot = _billing_dict(
                runtime,
                charged=cap.charged,
                uncollected=cap.uncollected,
                replayed=cap.replayed,
            )
    except Exception as exc:
        logger.exception("video job capture failed job_id=%s", job_id)
        if _transition(job_id, "finalizing", "failed", message=f"视频生成失败: {exc}", set_message=True):
            if rid is not None and attempt is not None:
                billing_service.release(rid, attempt, reason="capture")
                _save_snapshot(job_id, _billing_dict(runtime, charged=0, uncollected=False, replayed=False))
        return
    _transition(
        job_id,
        "finalizing",
        "succeeded",
        message=None,
        set_message=True,
        result_url=url,
        set_url=True,
        billing_snapshot=snapshot,
        set_snapshot=snapshot is not None,
    )


async def _run_generation(payload: dict) -> str:
    from .routers.ai import _generate_video_url

    return await _generate_video_url(
        model=str(payload.get("model") or ""),
        prompt=str(payload.get("prompt") or ""),
        size=str(payload.get("size") or "1280*720"),
        resolution=str(payload.get("resolution") or ""),
        duration=int(payload.get("duration") or 5),
        first_frame=payload.get("first_frame"),
        last_frame=payload.get("last_frame"),
        images=list(payload.get("images") or []),
        image_names=list(payload.get("image_names") or []),
        template=payload.get("template"),
    )


async def _wait_generation(
    job_id: str,
    gen_task: asyncio.Task,
    cancel_ev: asyncio.Event,
    reservation_id: int | None,
    attempt: int | None,
) -> asyncio.Task | None:
    ticks = 0
    while not gen_task.done():
        if cancel_ev.is_set() or not _is_running(job_id):
            gen_task.cancel()
            with suppress(asyncio.CancelledError):
                await gen_task
            return None
        if ticks % 4 == 0:
            _touch(job_id, reservation_id, attempt)
        ticks += 1
        try:
            await asyncio.wait_for(asyncio.shield(gen_task), timeout=0.5)
        except asyncio.TimeoutError:
            continue
        except Exception:
            # The generation task stored this error; the caller reads task.exception().
            break
    if gen_task.cancelled():
        return None
    return gen_task


async def execute(job_id: str) -> None:
    runtime = _load_runtime(job_id)
    if runtime is None:
        return
    cancel_ev = asyncio.Event()
    _CANCEL_EVENTS[job_id] = cancel_ev
    gen_task = asyncio.create_task(_run_generation(runtime["payload"]), name=f"video-gen-{job_id}")
    try:
        if not _is_running(job_id):
            return
        finished = await _wait_generation(
            job_id,
            gen_task,
            cancel_ev,
            runtime.get("reservation_id"),
            runtime.get("reservation_attempt"),
        )
        if finished is None:
            return
        exc = finished.exception()
        if exc is not None:
            _fail_generation(job_id, runtime, exc)
            return
        _succeed_generation(job_id, runtime, finished.result())
    except Exception as exc:
        logger.exception("video job crashed job_id=%s", job_id)
        message = f"视频生成失败: {exc}"
        if _transition(job_id, "running", "failed", message=message, set_message=True):
            rid = runtime.get("reservation_id")
            attempt = runtime.get("reservation_attempt")
            if rid is not None and attempt is not None:
                billing_service.release(rid, attempt, reason="crashed")
                _save_snapshot(job_id, _billing_dict(runtime, charged=0, uncollected=False, replayed=False))
        else:
            _transition(job_id, "finalizing", "failed", message=message, set_message=True)
    finally:
        _CANCEL_EVENTS.pop(job_id, None)
        if not gen_task.done():
            gen_task.cancel()
            with suppress(asyncio.CancelledError):
                await gen_task


def claim_next() -> str | None:
    db = SessionLocal()
    try:
        running_rows = (
            db.query(models.VideoGenerationJob.user_id)
            .filter(models.VideoGenerationJob.status.in_(("running", "finalizing")))
            .all()
        )
        if len(running_rows) >= _global_cap():
            return None
        counts: dict[int, int] = {}
        for (user_id,) in running_rows:
            counts[user_id] = counts.get(user_id, 0) + 1
        queued = (
            db.query(models.VideoGenerationJob)
            .filter(models.VideoGenerationJob.status == "queued")
            .order_by(models.VideoGenerationJob.created_at.asc(), models.VideoGenerationJob.id.asc())
            .all()
        )
        per_user = _per_user_cap()
        for job in queued:
            if counts.get(job.user_id, 0) >= per_user:
                continue
            result = db.execute(
                update(models.VideoGenerationJob)
                .where(
                    models.VideoGenerationJob.id == job.id,
                    models.VideoGenerationJob.status == "queued",
                )
                .values(status="running", message="生成中", started_at=now(), updated_at=now())
            )
            db.commit()
            if result.rowcount == 1:
                return job.id
        return None
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def heartbeat_queued() -> None:
    db = SessionLocal()
    try:
        rows = (
            db.query(models.VideoGenerationJob.reservation_id, models.VideoGenerationJob.reservation_attempt)
            .filter(
                models.VideoGenerationJob.status == "queued",
                models.VideoGenerationJob.reservation_id.is_not(None),
            )
            .all()
        )
    finally:
        db.close()
    for reservation_id, attempt in rows:
        if reservation_id is None or attempt is None:
            continue
        try:
            billing_service.heartbeat(reservation_id, attempt)
        except Exception:
            logger.exception("video job heartbeat failed reservation=%s", reservation_id)


def reclaim_stale_running() -> int:
    cutoff = now() - STALE_RUNNING
    db = SessionLocal()
    changed = 0
    try:
        rows = (
            db.query(models.VideoGenerationJob)
            .filter(models.VideoGenerationJob.status.in_(("running", "finalizing")))
            .all()
        )
        for row in rows:
            if row.id in _CANCEL_EVENTS:
                continue
            updated = row.updated_at
            if updated is not None and updated.tzinfo is None:
                updated = updated.replace(tzinfo=cutoff.tzinfo)
            if updated is not None and updated >= cutoff:
                continue
            row.status = "queued"
            row.message = "排队中"
            row.started_at = None
            row.updated_at = now()
            changed += 1
        if changed:
            db.commit()
        else:
            db.rollback()
        return changed
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def launch_available() -> int:
    started = 0
    for _ in range(_global_cap()):
        job_id = claim_next()
        if not job_id:
            break
        task = asyncio.create_task(execute(job_id), name=f"video-job-{job_id}")
        _BACKGROUND.add(task)
        task.add_done_callback(_BACKGROUND.discard)
        started += 1
    return started


async def worker_tick() -> None:
    reclaim_stale_running()
    heartbeat_queued()
    launch_available()


async def drain(max_rounds: int = 30) -> None:
    """Test helper: run queued jobs to a terminal state, respecting the cap."""
    for _ in range(max_rounds):
        batch: list[asyncio.Task] = []
        for _ in range(64):
            job_id = claim_next()
            if not job_id:
                break
            batch.append(asyncio.create_task(execute(job_id)))
        if not batch:
            return
        await asyncio.gather(*batch)
