import asyncio
import time

import httpx

from .config import settings

PROBE_TIMEOUT = 2.5
CACHE_TTL = 90.0
DOWN_TTL = 180.0

IMAGE_CATALOG = [
    {"id": "gpt-image-2", "name": "GPT Image 2 文生图", "owned_by": "nexcor", "modality": "image"},
    {"id": "wan2.7-image", "name": "万相 2.7 文生图", "owned_by": "nexcor", "modality": "image"},
    {"id": "wan2.7-image-pro", "name": "万相 2.7 文生图 Pro", "owned_by": "nexcor", "modality": "image"},
    {"id": "qwen-image-2.0", "name": "通义千问生图", "owned_by": "nexcor", "modality": "image"},
    {"id": "qwen-image-2.0-pro", "name": "通义千问生图 Pro", "owned_by": "nexcor", "modality": "image"},
    {"id": "wan2.6-t2i", "name": "万相 2.6 文生图", "owned_by": "dashscope", "modality": "image"},
    {"id": "wan2.6-image", "name": "万相 2.6 图生图", "owned_by": "dashscope", "modality": "image"},
]

VIDEO_CATALOG = [
    {"id": "happyhorse-1.1-t2v", "name": "HappyHorse 文生视频", "owned_by": "nexcor", "modality": "video"},
    {"id": "happyhorse-1.1-i2v", "name": "HappyHorse 图生视频", "owned_by": "nexcor", "modality": "video"},
]

TEXT_CATALOG = [
    {"id": "qwen-plus", "name": "通义千问 Plus", "owned_by": "nexcor", "modality": "text"},
]

_cache: dict[str, tuple[float, list[dict]]] = {}
_down_until: dict[str, float] = {}
_lock = asyncio.Lock()


def mark_down(model: str, seconds: float = DOWN_TTL) -> None:
    if model:
        _down_until[model] = time.monotonic() + seconds


def note_upstream_result(model: str, status: int, text: str = "") -> None:
    if _looks_unavailable(status, text):
        mark_down(model)


def _looks_unavailable(status: int, text: str) -> bool:
    if status in {0, 408, 502, 503, 504}:
        return True
    low = (text or "").lower()
    return any(
        token in low
        for token in (
            "no available channel",
            "model_not_found",
            "does not exist",
            "timed out",
        )
    )


def _is_validation_ok(status: int, text: str) -> bool:
    if _looks_unavailable(status, text):
        return False
    return 200 <= status < 500


async def _post(client: httpx.AsyncClient, path: str, body: dict) -> tuple[int, str]:
    if not settings.openai_api_key:
        return 503, "missing openai key"
    try:
        resp = await client.post(
            f"{settings.openai_base_url.rstrip('/')}{path}",
            headers={
                "Authorization": f"Bearer {settings.openai_api_key}",
                "Content-Type": "application/json",
            },
            json=body,
        )
        return resp.status_code, resp.text[:400]
    except (httpx.TimeoutException, httpx.TransportError) as exc:
        return 0, str(exc)


async def _probe_image(client: httpx.AsyncClient, model_id: str) -> bool:
    status, text = await _post(client, "/images/generations", {"model": model_id, "prompt": ""})
    if not _is_validation_ok(status, text):
        return False
    # Empty-prompt 400 only means the validator saw the model. n=0 hits the
    # generate worker; a hang here is what gpt-image-2 currently does.
    status, text = await _post(
        client,
        "/images/generations",
        {"model": model_id, "prompt": "x", "n": 0},
    )
    if status == 0:
        return False
    return _is_validation_ok(status, text)


async def _probe_video(client: httpx.AsyncClient, model_id: str) -> bool:
    status, text = await _post(client, "/video/generations", {"model": model_id})
    return _is_validation_ok(status, text)


async def _probe_text(client: httpx.AsyncClient, model_id: str) -> bool:
    status, text = await _post(
        client,
        "/chat/completions",
        {"model": model_id, "messages": [{"role": "user", "content": "ping"}], "max_tokens": 1},
    )
    return 200 <= status < 300 or _is_validation_ok(status, text)


async def _live_ids(kind: str) -> set[str]:
    now = time.monotonic()
    down = {model for model, until in _down_until.items() if until > now}
    if kind == "image":
        catalog = [item for item in IMAGE_CATALOG if item["owned_by"] == "nexcor" or (item["owned_by"] == "dashscope" and settings.dashscope_api_key)]
        probe = _probe_image
    elif kind == "video":
        catalog = list(VIDEO_CATALOG)
        probe = _probe_video
    else:
        catalog = list(TEXT_CATALOG)
        probe = _probe_text

    nexcor_ids = [item["id"] for item in catalog if item["owned_by"] != "dashscope"]
    dashscope_ids = {item["id"] for item in catalog if item["owned_by"] == "dashscope"}
    live: set[str] = set(dashscope_ids)
    if not settings.openai_api_key:
        return live - down

    timeout = httpx.Timeout(PROBE_TIMEOUT, connect=1.5)
    async with httpx.AsyncClient(timeout=timeout) as client:
        results = await asyncio.gather(*(probe(client, model_id) for model_id in nexcor_ids), return_exceptions=True)
    for model_id, result in zip(nexcor_ids, results):
        if result is True:
            live.add(model_id)
    return live - down


async def available_models(modality: str | None = None) -> list[dict]:
    kinds = ["image", "video", "text"] if not modality else [modality]
    now = time.monotonic()
    async with _lock:
        missing = [kind for kind in kinds if kind not in _cache or now - _cache[kind][0] > CACHE_TTL]
        for kind in missing:
            live = await _live_ids(kind)
            if kind == "image":
                catalog = IMAGE_CATALOG
            elif kind == "video":
                catalog = VIDEO_CATALOG
            else:
                catalog = TEXT_CATALOG
            rows = []
            for item in catalog:
                if item["owned_by"] == "dashscope" and not settings.dashscope_api_key:
                    continue
                if item["id"] not in live:
                    continue
                rows.append({**item, "status": "active", "isEnabled": True})
            _cache[kind] = (now, rows)

    out: list[dict] = []
    for kind in kinds:
        out.extend(_cache.get(kind, (0, []))[1])
    return out
