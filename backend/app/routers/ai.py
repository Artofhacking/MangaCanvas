import asyncio
import time

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from .. import billing_service, models
from ..ai_media import (
    baidu_video_generate,
    dashscope_async,
    dashscope_chat,
    extract_media_url,
    resolve_chat_endpoint,
    is_minimax_model,
    is_seedance_model,
    is_vidu_model,
    minimax_video_generate,
    openai_image_generate,
    openai_quality,
    openai_size,
    openai_video_generate,
    openai_video_size,
    persist_openai_images,
    require_happyhorse_duration,
    persist_placeholder,
    persist_remote_url,
    _is_local_url,
    video_template_prompt,
    vidu_video_generate,
)
from ..config import settings
from ..db import SessionLocal, get_db
from ..deps import current_user, current_user_detached, resolve_project_detached
from ..errors import ApiError, fail, ok
from ..model_probe import available_models, note_upstream_result
from ..pricing import quote_request

router = APIRouter(prefix="/ai")


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


async def _generate_image_urls(body: dict, model: str, prompt: str, images: list, n: int, quality: str | None) -> list[str]:
    if str(model).startswith("wan") and settings.dashscope_api_key:
        size = str(body.get("size") or "1280*1280").replace("x", "*")
        content = []
        if prompt:
            content.append({"text": prompt})
        for image_url in images:
            content.append({"image": image_url})
        payload = await dashscope_async(
            "/services/aigc/image-generation/generation",
            {
                "model": model,
                "input": {"messages": [{"role": "user", "content": content or [{"text": prompt or "manga still"}]}]},
                "parameters": {
                    "prompt_extend": False,
                    "watermark": False,
                    "n": n,
                    "negative_prompt": body.get("negative_prompt") or body.get("negativePrompt") or "",
                    "size": size,
                },
            },
        )
        url = extract_media_url(payload)
        if not url:
            fail(3001, "生成结果为空", 502)
        return [await persist_remote_url(url)]

    if settings.openai_api_key:
        resolved = model
        if str(model).startswith("wan") and not str(model).startswith("wan2.7"):
            resolved = "wan2.7-image"
        payload = await openai_image_generate(
            prompt=prompt,
            model=resolved,
            size=openai_size(body.get("size")),
            n=n,
            quality=openai_quality(quality),
            images=images or None,
        )
        urls = persist_openai_images(payload)
        if not urls:
            remote = extract_media_url(payload)
            if not remote:
                fail(3001, "生成结果为空", 502)
            return [await persist_remote_url(remote)]
        persisted = []
        for url in urls:
            persisted.append(url if _is_local_url(url) else await persist_remote_url(url))
        if not persisted:
            fail(3001, "生成结果为空", 502)
        return persisted

    fail(3001, "未配置图片模型 API Key", 503)
    raise RuntimeError("unreachable")


@router.post("/images/generations")
async def images(request: Request, user: models.User = Depends(current_user_detached)):
    body = await request.json()
    model = body.get("model") or "gpt-image-2"
    prompt = body.get("prompt") or ""
    images = [item for item in (body.get("images") or ([] if not body.get("image") else [body.get("image")])) if item]
    try:
        n = int(body.get("n") or 1)
    except (TypeError, ValueError):
        fail(1001, "n 必须为 1–4", 400)
    if n < 1 or n > 4:
        fail(1001, "n 必须为 1–4", 400)
    if str(model).startswith("wan") and n != 1:
        fail(1001, "该模型暂不支持 n>1", 400)
    quality = body.get("quality")

    has_openai = bool(settings.openai_api_key)
    has_dashscope = bool(settings.dashscope_api_key)
    can_generate = (str(model).startswith("wan") and has_dashscope) or has_openai
    if not can_generate:
        if settings.allow_placeholder and not settings.billing_enabled:
            urls = [persist_placeholder() for _ in range(n)]
            return ok({"created": int(time.time()), "data": [{"url": url} for url in urls]})
        fail(3001, "未配置图片模型 API Key", 503)

    project = resolve_project_detached(user, body.get("projectId"))
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
                    model=str(model),
                    modality="image",
                    n=n,
                    quality=quality,
                    size=body.get("size"),
                    image_count=len(images),
                )
            finally:
                quote_db.close()
            reservation = billing_service.reserve(
                user_id=user.id,
                quote=quoted,
                request_body=body,
                reference_type="ai_image",
                organization_id=(project or {}).get("organization_id"),
                project_id=(project or {}).get("id"),
                idempotency_key=_idempotency_key(request, body),
            )
            if reservation.status == "captured" and reservation.response_payload:
                captured = True
                payload = dict(reservation.response_payload)
                payload.pop("billing", None)
                replay = billing_service.CaptureResult(False, 0, True, True, payload)
                return ok(_with_fresh_billing(payload, user.id, replay, reservation))
            beat = asyncio.create_task(_heartbeat_loop(reservation, stop))

        urls = await _generate_image_urls(body, str(model), prompt, images, n, quality)
        media = {"created": int(time.time()), "data": [{"url": url} for url in urls]}
        if reservation is not None:
            cap = billing_service.capture(reservation.id, reservation.attempt, response_payload=media)
            captured = True
            return ok(_with_fresh_billing(media, user.id, cap, reservation))
        return ok(media)
    except ApiError:
        raise
    except Exception as exc:
        note_upstream_result(str(model), 0, str(exc))
        fail(3001, f"生成任务失败: {exc}", 502)
    finally:
        stop.set()
        if beat is not None:
            beat.cancel()
        if reservation is not None and not captured:
            billing_service.release(reservation.id, reservation.attempt, reason="finally")


def _assert_video_channel(model: str) -> None:
    if is_seedance_model(model):
        if not settings.baidu_enabled:
            fail(3001, "百度云视频渠道已禁用", 503)
        if not settings.baidu_api_key:
            fail(3001, "未配置百度网关 API Key", 503)
        return
    if is_minimax_model(model):
        if not settings.minimax_enabled:
            fail(3001, "MiniMax 视频渠道已禁用", 503)
        if not settings.minimax_api_key:
            fail(3001, "未配置 MiniMax API Key", 503)
        return
    if is_vidu_model(model):
        if not settings.vidu_enabled:
            fail(3001, "Vidu 视频渠道已禁用", 503)
        if not settings.vidu_api_key:
            fail(3001, "未配置 Vidu API Key", 503)
        return
    if settings.openai_api_key or settings.dashscope_api_key:
        return
    fail(3001, "未配置视频模型 API Key", 503)


async def _generate_video_url(
    *,
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
) -> str:
    if is_seedance_model(model):
        url = await baidu_video_generate(
            prompt=prompt,
            model=model,
            size=size,
            resolution=str(resolution or ""),
            duration=duration,
            first_frame=first_frame,
            last_frame=last_frame,
        )
        return await persist_remote_url(url)

    if is_minimax_model(model):
        url = await minimax_video_generate(
            prompt=prompt,
            model=model,
            size=size,
            resolution=str(resolution or ""),
            duration=duration,
            first_frame=first_frame,
            last_frame=last_frame,
        )
        return await persist_remote_url(url)

    if is_vidu_model(model):
        url = await vidu_video_generate(
            prompt=prompt,
            model=model,
            size=size,
            resolution=str(resolution or ""),
            duration=duration,
            first_frame=first_frame,
            last_frame=last_frame,
            images=images,
            names=image_names,
        )
        return await persist_remote_url(url)

    if settings.openai_api_key:
        url = await openai_video_generate(
            prompt=prompt,
            model=model,
            size=openai_video_size(size, resolution),
            duration=duration,
            first_frame=first_frame,
            images=images,
            names=image_names,
        )
        return await persist_remote_url(url)

    if not settings.dashscope_api_key:
        fail(3001, "未配置视频模型 API Key", 503)

    if template and first_frame:
        payload = await dashscope_async(
            "/services/aigc/video-generation/video-synthesis",
            {
                "model": model,
                "input": {"img_url": first_frame, "template": template},
                "parameters": {"resolution": resolution},
            },
            poll_interval=3,
            max_attempts=180,
        )
    elif "kf2v" in str(model):
        payload = await dashscope_async(
            "/services/aigc/image2video/video-synthesis",
            {
                "model": model,
                "input": {
                    "first_frame_url": first_frame,
                    "last_frame_url": last_frame,
                    "prompt": prompt,
                },
                "parameters": {"resolution": resolution, "prompt_extend": False},
            },
            poll_interval=3,
            max_attempts=180,
        )
    elif "i2v" in str(model):
        payload = await dashscope_async(
            "/services/aigc/video-generation/video-synthesis",
            {
                "model": model,
                "input": {"prompt": prompt, "img_url": first_frame},
                "parameters": {
                    "resolution": resolution,
                    "prompt_extend": False,
                    "duration": duration,
                    "shot_type": "multi",
                },
            },
            poll_interval=3,
            max_attempts=180,
        )
    else:
        payload = await dashscope_async(
            "/services/aigc/video-generation/video-synthesis",
            {
                "model": model,
                "input": {"prompt": prompt},
                "parameters": {
                    "size": size,
                    "prompt_extend": True,
                    "duration": duration,
                    "shot_type": "multi",
                },
            },
            poll_interval=3,
            max_attempts=180,
        )
    url = extract_media_url(payload)
    if not url:
        fail(3001, "生成成功但未找到视频地址", 502)
    return await persist_remote_url(url)


@router.post("/videos/generations")
async def videos(request: Request, user: models.User = Depends(current_user_detached)):
    body = await request.json()
    model = body.get("model") or "happyhorse-1.1-t2v"
    prompt = body.get("prompt") or ""
    size = str(body.get("size") or "1280*720").replace("x", "*")
    resolution = body.get("resolution") or "720P"
    try:
        duration = int(body.get("duration") or body.get("seconds") or 5)
    except (TypeError, ValueError):
        fail(1001, "duration 必须是 5、10 或 15", 400)
    first_frame = body.get("firstFrameImage") or body.get("image")
    last_frame = body.get("lastFrameImage")
    raw_images = body.get("images") or []
    if isinstance(raw_images, str):
        raw_images = [raw_images]
    images = [item for item in raw_images if item]
    if first_frame and first_frame not in images:
        images = [first_frame, *images]
    if images:
        first_frame = images[0]
    raw_names = body.get("imageNames") or body.get("image_names") or []
    if isinstance(raw_names, str):
        raw_names = [raw_names]
    image_names = [str(item) for item in raw_names if item]
    template = body.get("template")

    if template:
        if not first_frame:
            fail(3001, "特效视频需要首帧图片", 400)
        prompt = video_template_prompt(template, prompt)
        model = "happyhorse-1.1-i2v"

    if not (is_seedance_model(model) or is_minimax_model(model) or is_vidu_model(model)):
        duration = require_happyhorse_duration(duration)

    _assert_video_channel(str(model))

    project = resolve_project_detached(user, body.get("projectId"))
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
                    model=str(model),
                    modality="video",
                    size=size,
                    resolution=resolution,
                    duration=duration,
                    image_count=len(images),
                    template=template,
                )
            finally:
                quote_db.close()
            reservation = billing_service.reserve(
                user_id=user.id,
                quote=quoted,
                request_body=body,
                reference_type="ai_video",
                organization_id=(project or {}).get("organization_id"),
                project_id=(project or {}).get("id"),
                idempotency_key=_idempotency_key(request, body),
            )
            if reservation.status == "captured" and reservation.response_payload:
                captured = True
                payload = dict(reservation.response_payload)
                payload.pop("billing", None)
                replay = billing_service.CaptureResult(False, 0, True, True, payload)
                return ok(_with_fresh_billing(payload, user.id, replay, reservation))
            beat = asyncio.create_task(_heartbeat_loop(reservation, stop))

        persisted = await _generate_video_url(
            model=str(model),
            prompt=prompt,
            size=size,
            resolution=str(resolution or ""),
            duration=duration,
            first_frame=first_frame,
            last_frame=last_frame,
            images=images,
            image_names=image_names,
            template=template,
        )
        media = {"url": persisted}
        if reservation is not None:
            cap = billing_service.capture(reservation.id, reservation.attempt, response_payload=media)
            captured = True
            return ok(_with_fresh_billing(media, user.id, cap, reservation))
        return ok(media)
    except ApiError:
        raise
    except Exception as exc:
        note_upstream_result(str(model), 0, str(exc))
        fail(3001, f"视频生成失败: {exc}", 502)
    finally:
        stop.set()
        if beat is not None:
            beat.cancel()
        if reservation is not None and not captured:
            billing_service.release(reservation.id, reservation.attempt, reason="finally")


@router.post("/persist-media")
async def persist_media(request: Request, user: models.User = Depends(current_user)):
    body = await request.json()
    url = body.get("url")
    if not url:
        fail(1001, "缺少 url", 400)
    persisted = await persist_remote_url(url)
    return ok({"url": persisted})


@router.post("/chat/completions")
async def chat(request: Request, user: models.User = Depends(current_user_detached)):
    body = await request.json()
    messages = body.get("messages") or []
    model = body.get("model") or "qwen-plus"
    project = resolve_project_detached(user, body.get("projectId"))
    reservation = None
    captured = False
    stop = asyncio.Event()
    beat = None
    try:
        if settings.billing_enabled:
            if not resolve_chat_endpoint():
                fail(3001, "未配置文本模型 API Key", 503)
            quote_db = SessionLocal()
            try:
                quoted = quote_request(
                    quote_db,
                    model=str(model),
                    modality="text",
                    unit="chat_request",
                )
            finally:
                quote_db.close()
            reservation = billing_service.reserve(
                user_id=user.id,
                quote=quoted,
                request_body=body,
                reference_type="ai_chat",
                organization_id=(project or {}).get("organization_id"),
                project_id=(project or {}).get("id"),
                idempotency_key=_idempotency_key(request, body),
            )
            if reservation.status == "captured" and reservation.response_payload:
                captured = True
                payload = dict(reservation.response_payload)
                payload.pop("billing", None)
                replay = billing_service.CaptureResult(False, 0, True, True, payload)
                return ok(_with_fresh_billing(payload, user.id, replay, reservation))
            beat = asyncio.create_task(_heartbeat_loop(reservation, stop))

        content = await dashscope_chat(messages, model)
        media = {"choices": [{"message": {"role": "assistant", "content": content}}]}
        if reservation is not None:
            cap = billing_service.capture(reservation.id, reservation.attempt, response_payload=media)
            captured = True
            return ok(_with_fresh_billing(media, user.id, cap, reservation))
        return ok(media)
    except ApiError:
        raise
    except Exception as exc:
        fail(3001, f"生成任务失败: {exc}", 502)
    finally:
        stop.set()
        if beat is not None:
            beat.cancel()
        if reservation is not None and not captured:
            billing_service.release(reservation.id, reservation.attempt, reason="finally")


@router.get("/models")
async def models_list(modality: str | None = None, _user: models.User = Depends(current_user)):
    kind = (modality or "").strip().lower() or None
    if kind not in {None, "image", "video", "text"}:
        kind = None
    return ok({"list": await available_models(kind)})


@router.get("/balance")
def balance(user: models.User = Depends(current_user)):
    return ok({"balance": user.credits})


@router.get("/bills")
def bills(
    page: int = 1,
    page_size: int = 20,
    user: models.User = Depends(current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(models.BillingLedger)
        .filter_by(user_id=user.id)
        .order_by(models.BillingLedger.id.desc())
        .offset((max(page, 1) - 1) * page_size)
        .limit(page_size)
        .all()
    )
    total = db.query(models.BillingLedger).filter_by(user_id=user.id).count()
    return ok(
        {
            "list": [
                {
                    "order_id": f"bill_{r.id}",
                    "bill_type": r.entry_type,
                    "amount": r.amount,
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                }
                for r in rows
            ],
            "pagination": {"page": page, "page_size": page_size, "total": total},
        }
    )
