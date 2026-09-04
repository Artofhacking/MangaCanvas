import time

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from .. import models
from ..ai_media import (
    dashscope_async,
    dashscope_chat,
    extract_media_url,
    openai_image_generate,
    openai_quality,
    openai_size,
    persist_openai_images,
    persist_placeholder,
    persist_remote_url,
)
from ..config import settings
from ..db import get_db
from ..deps import current_user
from ..errors import ApiError, fail, ok

router = APIRouter(prefix="/ai")


def _record_usage(db: Session, user: models.User, description: str, reference_type: str) -> None:
    db.add(
        models.BillingLedger(
            user_id=user.id,
            entry_type="consume",
            amount=0,
            balance_after=user.credits,
            description=(description or "")[:200],
            reference_type=reference_type,
        )
    )


async def _persist_or_placeholder(url: str | None) -> str:
    if url:
        try:
            return await persist_remote_url(url)
        except ApiError:
            pass
    return persist_placeholder()


@router.post("/images/generations")
async def images(request: Request, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    body = await request.json()
    model = body.get("model") or "gpt-image-2"
    prompt = body.get("prompt") or ""
    images = [item for item in (body.get("images") or ([] if not body.get("image") else [body.get("image")])) if item]
    n = int(body.get("n") or 1)
    quality = body.get("quality")
    _record_usage(db, user, prompt, "ai_image")

    try:
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
                        "n": max(n, 1),
                        "negative_prompt": body.get("negative_prompt") or body.get("negativePrompt") or "",
                        "size": size,
                    },
                },
            )
            url = extract_media_url(payload)
            persisted = await _persist_or_placeholder(url)
            return ok({"created": int(time.time()), "data": [{"url": persisted}]})

        if settings.openai_api_key:
            payload = await openai_image_generate(
                prompt=prompt,
                model="gpt-image-2" if str(model).startswith("wan") else model,
                size=openai_size(body.get("size")),
                n=n,
                quality=openai_quality(quality),
                images=images or None,
            )
            urls = persist_openai_images(payload)
            if not urls:
                remote = extract_media_url(payload)
                urls = [await _persist_or_placeholder(remote)]
            else:
                persisted = []
                for url in urls:
                    persisted.append(url if url.startswith(settings.public_base_url) else await _persist_or_placeholder(url))
                urls = persisted
            return ok({"created": int(time.time()), "data": [{"url": url} for url in urls]})

        urls = [persist_placeholder() for _ in range(max(n, 1))]
        return ok({"created": int(time.time()), "data": [{"url": url} for url in urls]})
    except ApiError:
        raise
    except Exception as exc:
        fail(3001, f"生成任务失败: {exc}", 502)


@router.post("/videos/generations")
async def videos(request: Request, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    body = await request.json()
    model = body.get("model") or "wan2.6-t2v"
    prompt = body.get("prompt") or ""
    size = str(body.get("size") or "1280*720").replace("x", "*")
    resolution = body.get("resolution") or "720P"
    duration = int(body.get("duration") or body.get("seconds") or 5)
    first_frame = body.get("firstFrameImage") or body.get("image")
    last_frame = body.get("lastFrameImage")
    template = body.get("template")
    _record_usage(db, user, prompt, "ai_video")

    if not settings.dashscope_api_key:
        fail(3001, "未配置 DashScope API Key，无法生成视频", 503)

    try:
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
        persisted = await persist_remote_url(url)
        return ok({"url": persisted})
    except ApiError:
        raise
    except Exception as exc:
        fail(3001, f"视频生成失败: {exc}", 502)


@router.post("/persist-media")
async def persist_media(request: Request, user: models.User = Depends(current_user)):
    body = await request.json()
    url = body.get("url")
    if not url:
        fail(1001, "缺少 url", 400)
    persisted = await persist_remote_url(url)
    return ok({"url": persisted})


@router.post("/chat/completions")
async def chat(request: Request, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    body = await request.json()
    messages = body.get("messages") or []
    model = body.get("model") or "qwen-plus"
    _record_usage(db, user, str(messages[-1].get("content") if messages else ""), "ai_chat")
    content = await dashscope_chat(messages, model)
    return ok({"choices": [{"message": {"role": "assistant", "content": content}}]})


@router.get("/models")
def models_list(_user: models.User = Depends(current_user)):
    return ok(
        {
            "list": [
                {"id": "gpt-image-2", "owned_by": "nexcor", "modality": "image"},
                {"id": "wan2.6-t2i", "owned_by": "dashscope", "modality": "image"},
                {"id": "wan2.6-image", "owned_by": "dashscope", "modality": "image"},
                {"id": "wan2.6-t2v", "owned_by": "dashscope", "modality": "video"},
                {"id": "wan2.6-i2v-flash", "owned_by": "dashscope", "modality": "video"},
                {"id": "qwen-plus", "owned_by": "dashscope", "modality": "text"},
            ]
        }
    )


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
