import asyncio
import base64
import re
import secrets
import time
from pathlib import Path
from urllib.parse import urlparse

import httpx

from .config import settings
from .errors import ApiError, fail
from .util import media_path, rewrite_stored_media_url

DASHSCOPE_NATIVE = "https://dashscope.aliyuncs.com/api/v1"
PLACEHOLDER_SVG = """<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
  <rect width="100%" height="100%" fill="#1a1a1a"/>
  <text x="50%" y="48%" text-anchor="middle" fill="#f5c16c" font-size="48" font-family="sans-serif">MangaCanvas</text>
  <text x="50%" y="56%" text-anchor="middle" fill="#888" font-size="24" font-family="sans-serif">generated placeholder</text>
</svg>
"""


def _public_url(path: str) -> str:
    if not path.startswith("/"):
        path = f"/{path}"
    return path


def _is_local_url(url: str) -> bool:
    return media_path(url) is not None


def persist_bytes(data: bytes, suffix: str) -> str:
    dest_dir = settings.upload_dir / "generated"
    dest_dir.mkdir(parents=True, exist_ok=True)
    filename = f"gen_{int(time.time() * 1000)}_{secrets.token_hex(4)}{suffix}"
    (dest_dir / filename).write_bytes(data)
    return _public_url(f"/static/uploads/generated/{filename}")


def persist_placeholder() -> str:
    return persist_bytes(PLACEHOLDER_SVG.encode("utf-8"), ".svg")


def local_file_for_url(url: str) -> Path | None:
    path = urlparse(url).path if "://" in url else url
    marker = "/static/uploads/"
    if marker not in path:
        return None
    relative = path.split(marker, 1)[1]
    candidate = settings.upload_dir / relative
    return candidate if candidate.exists() else None


async def persist_remote_url(url: str) -> str:
    if not url:
        fail(1001, "缺少媒体地址", 400)
    if url.startswith("data:"):
        header, _, payload = url.partition(",")
        suffix = ".png"
        if "jpeg" in header or "jpg" in header:
            suffix = ".jpg"
        elif "webp" in header:
            suffix = ".webp"
        elif "svg" in header:
            suffix = ".svg"
        elif "mp4" in header:
            suffix = ".mp4"
        return persist_bytes(base64.b64decode(payload), suffix)

    if _is_local_url(url):
        local = local_file_for_url(url)
        rewritten = rewrite_stored_media_url(url) or url
        if local:
            if rewritten.startswith("/"):
                return rewritten
            path = urlparse(url).path if "://" in url else rewritten
            return _public_url(path if path.startswith("/") else f"/{path}")
        if rewritten.startswith("/"):
            return rewritten
        return url

    async with httpx.AsyncClient(timeout=180, follow_redirects=True) as client:
        resp = await client.get(url, headers={"User-Agent": "MangaCanvas/1.0"})
        if resp.status_code >= 400:
            fail(3001, f"拉取生成结果失败: {resp.status_code}", 502)
        ctype = (resp.headers.get("content-type") or "").split(";")[0].strip().lower()
        suffix = ".bin"
        if "jpeg" in ctype or "jpg" in ctype:
            suffix = ".jpg"
        elif "png" in ctype:
            suffix = ".png"
        elif "webp" in ctype:
            suffix = ".webp"
        elif "svg" in ctype:
            suffix = ".svg"
        elif "mp4" in ctype:
            suffix = ".mp4"
        elif "webm" in ctype:
            suffix = ".webm"
        elif url.lower().endswith((".jpg", ".jpeg", ".png", ".webp", ".svg", ".mp4", ".webm")):
            suffix = Path(urlparse(url).path).suffix
        return persist_bytes(resp.content, suffix)


def persist_b64_image(b64_data: str, suffix: str = ".png") -> str:
    return persist_bytes(base64.b64decode(b64_data), suffix)


def openai_size(size: str | None) -> str:
    raw = str(size or "1024x1024").replace("*", "x").lower()
    mapping = {
        "1280x1280": "1024x1024",
        "1440x1440": "1024x1024",
        "1024x1024": "1024x1024",
        "1696x960": "1536x1024",
        "1280x720": "1536x1024",
        "1472x1104": "1536x1024",
        "1280x960": "1536x1024",
        "960x1696": "1024x1536",
        "720x1280": "1024x1536",
        "1104x1472": "1024x1536",
        "960x1280": "1024x1536",
        "1024x1536": "1024x1536",
        "1536x1024": "1536x1024",
    }
    return mapping.get(raw, raw if "x" in raw else "1024x1024")


def openai_quality(quality: str | None) -> str:
    raw = (quality or "medium").lower()
    mapping = {
        "standard": "medium",
        "hd": "high",
        "low": "low",
        "medium": "medium",
        "high": "high",
    }
    return mapping.get(raw, "medium")


async def load_image_bytes(url: str) -> bytes:
    if url.startswith("data:"):
        _, _, payload = url.partition(",")
        return base64.b64decode(payload)
    local = local_file_for_url(url)
    if local:
        return local.read_bytes()
    async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
        resp = await client.get(url, headers={"User-Agent": "MangaCanvas/1.0"})
        if resp.status_code >= 400:
            fail(3001, f"读取参考图失败: {resp.status_code}", 502)
        return resp.content


def persist_openai_images(payload: dict) -> list[str]:
    urls: list[str] = []
    for item in payload.get("data") or []:
        if not isinstance(item, dict):
            continue
        if item.get("b64_json"):
            fmt = str(payload.get("output_format") or "png").lower()
            suffix = ".jpg" if fmt in {"jpeg", "jpg"} else f".{fmt}" if fmt in {"png", "webp"} else ".png"
            urls.append(persist_b64_image(item["b64_json"], suffix))
        elif item.get("url"):
            urls.append(item["url"])
    return urls


async def openai_image_generate(
    *,
    prompt: str,
    model: str,
    size: str,
    n: int,
    quality: str,
    images: list[str] | None = None,
) -> dict:
    if not settings.openai_api_key:
        fail(3001, "未配置图片模型 API Key", 503)
    base = settings.openai_base_url.rstrip("/")
    headers = {"Authorization": f"Bearer {settings.openai_api_key}"}
    async with httpx.AsyncClient(timeout=180) as client:
        if images:
            image_bytes = await load_image_bytes(images[0])
            files = {"image": ("reference.png", image_bytes, "image/png")}
            data = {
                "model": model,
                "prompt": prompt or "edit this image",
                "n": str(max(n, 1)),
                "size": size,
                "quality": quality,
            }
            resp = await client.post(f"{base}/images/edits", headers=headers, files=files, data=data)
        else:
            resp = await client.post(
                f"{base}/images/generations",
                headers={**headers, "Content-Type": "application/json"},
                json={
                    "model": model,
                    "prompt": prompt or "manga still",
                    "n": max(n, 1),
                    "size": size,
                    "quality": quality,
                },
            )
        if resp.status_code >= 400:
            from .model_probe import note_upstream_result

            note_upstream_result(model, resp.status_code, resp.text)
            fail(3001, f"生成任务失败: {resp.text[:500]}", 502)
        return resp.json()


def openai_video_size(size: str | None, resolution: str | None) -> str:
    raw = str(size or "").replace("x", "*").replace("X", "*")
    res = (resolution or "").upper()
    upgrades = {
        "1280*720": "1920*1080",
        "720*1280": "1080*1920",
        "960*960": "1440*1440",
        "1088*832": "1632*1248",
        "832*1088": "1248*1632",
    }
    if res == "1080P":
        if raw in upgrades:
            return upgrades[raw]
        if "*" in raw and raw not in {"*", ""}:
            return raw
        return "1920*1080"
    if "*" in raw and raw not in {"*", ""}:
        return raw
    return "1280*720"


SEEDANCE_MODEL_IDS = (
    "doubao-seedance-2-0-260128",
    "doubao-seedance-2-0-fast-260128",
    "doubao-seedance-2-0-mini-260615",
    "doubao-seedance-2-5-260628",
)
MINIMAX_MODEL_IDS = (
    "MiniMax-H3",
    "MiniMax-H3-Max",
)
VIDU_MODEL_IDS = (
    "viduq2",
    "viduq3",
    "viduq3-pro",
    "viduq3-turbo",
    "viduq3-mix",
    "viduq2-pro",
    "viduq1",
    "vidu2.0",
)
VIDU_R2V_MODEL = "viduq2"
VIDU_R2V_ALLOWED = {
    "viduq2": "viduq2",
    "viduq3": "viduq3",
    "viduq3-turbo": "viduq3-turbo",
    "viduq3-mix": "viduq3-mix",
    "viduq2-pro": "viduq2-pro",
    "viduq1": "viduq1",
    "vidu2.0": "vidu2.0",
}
_SEEDANCE_CANONICAL = {item.lower(): item for item in SEEDANCE_MODEL_IDS}
_MINIMAX_CANONICAL = {item.lower(): item for item in MINIMAX_MODEL_IDS}
_VIDU_CANONICAL = {item.lower(): item for item in VIDU_MODEL_IDS}

SEEDANCE_RATIO_BY_SIZE = {
    "1280*720": "16:9",
    "1920*1080": "16:9",
    "720*1280": "9:16",
    "1080*1920": "9:16",
    "960*960": "1:1",
    "1440*1440": "1:1",
    "1088*832": "4:3",
    "1632*1248": "4:3",
    "832*1088": "3:4",
    "1248*1632": "3:4",
}


def is_seedance_model(model: str) -> bool:
    name = (model or "").lower()
    return name in _SEEDANCE_CANONICAL or "seedance" in name


def is_minimax_model(model: str) -> bool:
    name = (model or "").lower()
    return name in _MINIMAX_CANONICAL or name.startswith("minimax") or "hailuo" in name


def is_vidu_model(model: str) -> bool:
    name = (model or "").lower()
    return name in _VIDU_CANONICAL or name.startswith("vidu")


def resolve_vidu_r2v_model(model: str) -> str:
    return VIDU_R2V_ALLOWED.get((model or "").strip().lower(), VIDU_R2V_MODEL)


def vidu_subject_name(raw: str, index: int) -> str:
    text = re.sub(r"[^\w\u4e00-\u9fff]+", "", str(raw or ""), flags=re.UNICODE)
    return (text[:20] if text else "") or f"图{index + 1}"


def mention_image_roles(prompt: str, names: list[str] | None) -> str:
    text = (prompt or "").strip() or "cinematic motion"
    roles = [str(item).strip() for item in (names or []) if str(item).strip()]
    if not roles:
        return text
    hints = "，".join(f"第{index + 1}张参考图是{name}" for index, name in enumerate(roles))
    if hints in text:
        return text
    return f"{hints}。按以下剧情生成有声视频，保持人物外貌与场景一致：\n{text}"


def collect_video_refs(first_frame: str | None, images: list[str] | None, limit: int = 3) -> list[str]:
    refs: list[str] = []
    for item in [first_frame, *(images or [])]:
        url = str(item or "").strip()
        if url and url not in refs:
            refs.append(url)
        if len(refs) >= limit:
            break
    return refs


def build_happyhorse_video_body(
    *,
    model: str,
    prompt: str,
    size: str,
    duration: int,
    image_urls: list[str],
    names: list[str] | None = None,
) -> dict:
    refs = [url for url in image_urls if url][:3]
    if refs and (len(refs) >= 2 or "r2v" in (model or "").lower()):
        resolved = "happyhorse-1.1-r2v"
    elif refs:
        resolved = "happyhorse-1.1-i2v"
    else:
        resolved = resolve_video_model(model, False)
    seconds = duration if duration in {5, 10, 15} else 5
    text = (prompt or "cinematic motion").strip()
    if names:
        text = mention_image_roles(text, names)
    body: dict = {
        "model": resolved,
        "prompt": text,
        "duration": seconds,
        "size": size,
        "audio": True,
    }
    if not refs:
        return body
    if resolved.endswith("r2v"):
        media = [{"type": "reference_image", "url": url} for url in refs]
        body["metadata"] = {"input": {"media": media}}
        body["images"] = refs
        body["reference_images"] = refs
        body["img_url"] = refs[0]
        return body
    media = [{"type": "first_frame", "url": refs[0]}]
    body["metadata"] = {"input": {"media": media}}
    body["images"] = [refs[0]]
    body["img_url"] = refs[0]
    return body


def resolve_video_model(model: str, has_image: bool) -> str:
    raw = (model or "").strip()
    for table in (_SEEDANCE_CANONICAL, _MINIMAX_CANONICAL, _VIDU_CANONICAL):
        known = table.get(raw.lower())
        if known:
            return known
    name = raw.lower()
    if "seedance" in name or name.startswith("minimax") or "hailuo" in name or name.startswith("vidu"):
        return raw
    if "r2v" in name:
        return "happyhorse-1.1-r2v"
    if has_image:
        return "happyhorse-1.1-i2v"
    if "t2v" in name:
        return "happyhorse-1.1-t2v"
    if "i2v" in name or "kf2v" in name:
        return "happyhorse-1.1-i2v"
    return "happyhorse-1.1-t2v"


def seedance_ratio(size: str | None) -> str:
    raw = str(size or "").replace("x", "*").replace("X", "*")
    return SEEDANCE_RATIO_BY_SIZE.get(raw, "16:9")


def seedance_resolution(model: str, size: str | None, resolution: str | None) -> str:
    raw = str(size or "").lower()
    res = (resolution or "").lower().replace(" ", "")
    if "1080" in raw or res in {"1080p", "1080"}:
        out = "1080p"
    elif "480" in raw or res in {"480p", "480"}:
        out = "480p"
    else:
        out = "720p"
    low = (model or "").lower()
    if ("fast" in low or "mini" in low) and out in {"1080p", "4k"}:
        return "720p"
    return out


def seedance_duration(model: str, duration: int) -> int:
    try:
        seconds = int(duration)
    except (TypeError, ValueError):
        seconds = 5
    low = (model or "").lower()
    if ("2-5" in low or "2.5" in low) and 16 <= seconds <= 30:
        return 15
    if seconds in {5, 10, 15} or 4 <= seconds <= 15:
        return seconds
    return 5


def minimax_resolution(model: str, size: str | None, resolution: str | None) -> str:
    raw = str(size or "").lower()
    res = (resolution or "").upper().replace(" ", "")
    wants_hi = "1080" in raw or "1920" in raw or res in {"1080P", "2K"}
    if "h3-max" in (model or "").lower():
        return "768P"
    return "2K" if wants_hi else "768P"


def vidu_resolution(size: str | None, resolution: str | None) -> str:
    raw = str(size or "").lower()
    res = (resolution or "").lower().replace(" ", "")
    if "1080" in raw or "1920" in raw or res in {"1080p", "1080"}:
        return "1080p"
    return "720p"


def clamp_video_duration(duration: int, *, low: int = 5, high: int = 15) -> int:
    try:
        seconds = int(duration)
    except (TypeError, ValueError):
        seconds = 5
    if seconds in {5, 10, 15}:
        return seconds
    if low <= seconds <= high:
        return seconds
    return 5


def _http_url(value) -> str | None:
    if isinstance(value, str) and value.startswith("http"):
        return value
    return None


def extract_video_url(payload: dict) -> str | None:
    if not isinstance(payload, dict):
        return None
    for key in ("url", "video_url"):
        found = _http_url(payload.get(key))
        if found:
            return found
    content = payload.get("content")
    if isinstance(content, dict):
        found = extract_video_url(content)
        if found:
            return found
    elif isinstance(content, list):
        for item in content:
            if isinstance(item, dict):
                found = extract_video_url(item)
                if found:
                    return found
    task = payload.get("task")
    if isinstance(task, dict):
        found = extract_video_url(task)
        if found:
            return found
    creations = payload.get("creations")
    if isinstance(creations, list):
        for item in creations:
            if isinstance(item, dict):
                found = extract_video_url(item)
                if found:
                    return found
    meta = payload.get("metadata")
    if isinstance(meta, dict):
        for key in ("url", "video_url"):
            found = _http_url(meta.get(key))
            if found:
                return found
    data = payload.get("data")
    if isinstance(data, dict):
        found = extract_video_url(data)
        if found:
            return found
        output = data.get("output")
        if isinstance(output, dict):
            found = extract_video_url(output)
            if found:
                return found
            results = output.get("results") or output.get("video_url")
            if isinstance(results, list) and results:
                first = results[0]
                if isinstance(first, dict):
                    return extract_video_url(first)
                found = _http_url(first)
                if found:
                    return found
            found = _http_url(results)
            if found:
                return found
    return extract_media_url(payload)


def _video_status(payload: dict) -> str:
    if not isinstance(payload, dict):
        return ""
    status = payload.get("status") or payload.get("task_status") or payload.get("state")
    for nest in ("task", "data"):
        inner = payload.get(nest)
        if not status and isinstance(inner, dict):
            status = inner.get("status") or inner.get("task_status") or inner.get("state")
    return str(status or "").lower()


def _video_fail_reason(payload: dict) -> str:
    if not isinstance(payload, dict):
        return "生成失败"
    data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    meta = payload.get("metadata") if isinstance(payload.get("metadata"), dict) else {}
    task = payload.get("task") if isinstance(payload.get("task"), dict) else {}
    reason = (
        payload.get("fail_reason")
        or payload.get("error")
        or payload.get("err_code")
        or payload.get("message")
        or task.get("fail_reason")
        or task.get("error")
        or data.get("fail_reason")
        or data.get("error")
        or meta.get("fail_reason")
        or meta.get("error")
        or "生成失败"
    )
    if isinstance(reason, dict):
        reason = reason.get("message") or reason.get("msg") or str(reason)
    return str(reason)[:400]


def _video_task_id(payload: dict) -> str | None:
    if not isinstance(payload, dict):
        return None
    for key in ("task_id", "id"):
        value = payload.get(key)
        if isinstance(value, (str, int)) and str(value):
            return str(value)
    for nest in ("task", "data"):
        inner = payload.get(nest)
        if isinstance(inner, dict):
            for key in ("task_id", "id"):
                value = inner.get(key)
                if isinstance(value, (str, int)) and str(value):
                    return str(value)
    return None


def _host_is_local(url: str) -> bool:
    host = urlparse(url).hostname or ""
    return host in {"127.0.0.1", "localhost"}


async def video_image_ref(url: str) -> str:
    if not url:
        return ""
    if url.startswith("http") and not _is_local_url(url):
        return url
    persisted = await persist_remote_url(url)
    if persisted.startswith("http") and not _host_is_local(persisted):
        return persisted
    return await video_image_data_uri(persisted or url)


async def video_image_data_uri(url: str) -> str:
    if not url:
        return ""
    if url.startswith("data:"):
        return url
    raw = await load_image_bytes(url)
    suffix = (urlparse(url).path or url).lower()
    ctype = "image/png"
    if suffix.endswith(".jpg") or suffix.endswith(".jpeg"):
        ctype = "image/jpeg"
    elif suffix.endswith(".webp"):
        ctype = "image/webp"
    return f"data:{ctype};base64,{base64.b64encode(raw).decode('ascii')}"


async def openai_video_generate(
    *,
    prompt: str,
    model: str,
    size: str,
    duration: int,
    first_frame: str | None = None,
    images: list[str] | None = None,
    names: list[str] | None = None,
) -> str:
    if not settings.openai_api_key:
        fail(3001, "未配置视频模型 API Key", 503)
    refs = collect_video_refs(first_frame, images)
    needs_image = "i2v" in (model or "").lower() or "r2v" in (model or "").lower()
    if needs_image and not refs:
        fail(3001, "图生视频需要参考图片", 400)
    resolved_urls = [await video_image_ref(url) for url in refs]
    body = build_happyhorse_video_body(
        model=model,
        prompt=prompt,
        size=size,
        duration=duration,
        image_urls=resolved_urls,
        names=names,
    )
    resolved = str(body.get("model") or resolve_video_model(model, bool(refs)))
    base = settings.openai_base_url.rstrip("/")
    headers = {"Authorization": f"Bearer {settings.openai_api_key}", "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=60) as client:
        submit = await client.post(f"{base}/video/generations", headers=headers, json=body)
        if submit.status_code >= 400:
            from .model_probe import note_upstream_result

            note_upstream_result(resolved, submit.status_code, submit.text)
            fail(3001, f"视频任务提交失败: {submit.text[:500]}", 502)
        submitted = submit.json()
        task_id = _video_task_id(submitted)
        if not task_id:
            fail(3001, "视频任务未返回 task_id", 502)
        auth_headers = {"Authorization": headers["Authorization"]}
        for _ in range(110):
            await asyncio.sleep(5)
            poll = await client.get(f"{base}/videos/{task_id}", headers=auth_headers)
            if poll.status_code >= 400:
                alt = await client.get(f"{base}/video/generations/{task_id}", headers=auth_headers)
                if alt.status_code >= 400:
                    fail(3001, f"查询视频任务失败: {poll.text[:400]}", 502)
                payload = alt.json()
            else:
                payload = poll.json()
            status = _video_status(payload)
            if status in {"completed", "succeeded", "success", "finished"}:
                url = extract_video_url(payload)
                if not url:
                    fail(3001, "视频生成成功但未返回地址", 502)
                return url
            if status in {"failed", "failure", "error", "canceled", "cancelled"}:
                fail(3001, f"视频生成失败: {_video_fail_reason(payload)}", 502)
        fail(3001, "视频生成超时，请稍后重试", 504)
    return ""


def _baidu_error_text(resp: httpx.Response) -> str:
    text = (resp.text or "")[:500]
    ctype = (resp.headers.get("content-type") or "").lower()
    if text.lstrip().startswith("<") or "text/html" in ctype:
        return f"HTTP {resp.status_code} 非 JSON 响应"
    return text or f"HTTP {resp.status_code}"


async def baidu_video_generate(
    *,
    prompt: str,
    model: str,
    size: str,
    duration: int,
    resolution: str | None = None,
    first_frame: str | None = None,
    last_frame: str | None = None,
) -> str:
    if not settings.baidu_enabled:
        fail(3001, "百度云视频渠道已禁用", 503)
    if not settings.baidu_api_key:
        fail(3001, "未配置百度网关 API Key", 503)
    resolved = resolve_video_model(model, bool(first_frame or last_frame))
    root = settings.baidu_root()
    headers = {
        "Authorization": f"Bearer {settings.baidu_api_key}",
        "Content-Type": "application/json",
        "User-Agent": "MangaCanvas/1.0",
    }
    content: list[dict] = [{"type": "text", "text": prompt or "cinematic motion"}]
    if first_frame:
        content.append(
            {
                "type": "image_url",
                "image_url": {"url": await video_image_ref(first_frame)},
                "role": "first_frame",
            }
        )
    if last_frame:
        content.append(
            {
                "type": "image_url",
                "image_url": {"url": await video_image_ref(last_frame)},
                "role": "last_frame",
            }
        )
    body = {
        "model": resolved,
        "content": content,
        "duration": seedance_duration(resolved, duration),
        "resolution": seedance_resolution(resolved, size, resolution),
        "ratio": seedance_ratio(size),
        "watermark": False,
        "generate_audio": True,
    }
    timeout = httpx.Timeout(60.0, connect=10.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        submit = await client.post(f"{root}/api/v3/contents/generations/tasks", headers=headers, json=body)
        if submit.status_code >= 400:
            from .model_probe import note_upstream_result

            note_upstream_result(resolved, submit.status_code, submit.text)
            fail(3001, f"视频任务提交失败: {_baidu_error_text(submit)}", 502)
        try:
            submitted = submit.json()
        except ValueError:
            fail(3001, f"视频任务提交失败: {_baidu_error_text(submit)}", 502)
        task_id = _video_task_id(submitted)
        if not task_id:
            fail(3001, "视频任务未返回 task_id", 502)
        poll_headers = {
            "Authorization": headers["Authorization"],
            "User-Agent": headers["User-Agent"],
        }
        for _ in range(110):
            await asyncio.sleep(5)
            poll = await client.get(f"{root}/api/v3/contents/generations/tasks/{task_id}", headers=poll_headers)
            if poll.status_code >= 400:
                fail(3001, f"查询视频任务失败: {_baidu_error_text(poll)}", 502)
            try:
                payload = poll.json()
            except ValueError:
                fail(3001, f"查询视频任务失败: {_baidu_error_text(poll)}", 502)
            status = _video_status(payload)
            if status in {"completed", "succeeded", "success", "finished"}:
                url = extract_video_url(payload)
                if not url:
                    fail(3001, "视频生成成功但未返回地址", 502)
                return url
            if status in {"failed", "failure", "error", "canceled", "cancelled", "expired"}:
                fail(3001, f"视频生成失败: {_video_fail_reason(payload)}", 502)
        fail(3001, "视频生成超时，请稍后重试", 504)
    return ""


async def minimax_video_generate(
    *,
    prompt: str,
    model: str,
    size: str,
    duration: int,
    resolution: str | None = None,
    first_frame: str | None = None,
    last_frame: str | None = None,
) -> str:
    if not settings.minimax_enabled:
        fail(3001, "MiniMax 视频渠道已禁用", 503)
    if not settings.minimax_api_key:
        fail(3001, "未配置 MiniMax API Key", 503)
    resolved = resolve_video_model(model, bool(first_frame or last_frame))
    root = settings.minimax_root()
    headers = {
        "Authorization": f"Bearer {settings.minimax_api_key}",
        "Content-Type": "application/json",
        "User-Agent": "MangaCanvas/1.0",
    }
    content: list[dict] = [{"type": "text", "text": prompt or "cinematic motion"}]
    if first_frame:
        content.append(
            {
                "type": "image_url",
                "image_url": {"url": await video_image_ref(first_frame)},
                "role": "first_frame",
            }
        )
    if last_frame:
        content.append(
            {
                "type": "image_url",
                "image_url": {"url": await video_image_ref(last_frame)},
                "role": "last_frame",
            }
        )
    body = {
        "model": resolved,
        "content": content,
        "duration": clamp_video_duration(duration, low=5 if "max" in resolved.lower() else 4, high=15),
        "resolution": minimax_resolution(resolved, size, resolution),
        "ratio": "adaptive" if first_frame or last_frame else seedance_ratio(size),
        "aigc_watermark": False,
    }
    timeout = httpx.Timeout(60.0, connect=10.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        submit = await client.post(f"{root}/v2/video_generation", headers=headers, json=body)
        if submit.status_code >= 400:
            from .model_probe import note_upstream_result

            note_upstream_result(resolved, submit.status_code, submit.text)
            fail(3001, f"视频任务提交失败: {_baidu_error_text(submit)}", 502)
        try:
            submitted = submit.json()
        except ValueError:
            fail(3001, f"视频任务提交失败: {_baidu_error_text(submit)}", 502)
        task_id = _video_task_id(submitted)
        if not task_id:
            fail(3001, "视频任务未返回 task_id", 502)
        poll_headers = {
            "Authorization": headers["Authorization"],
            "User-Agent": headers["User-Agent"],
        }
        for _ in range(110):
            await asyncio.sleep(5)
            poll = await client.get(f"{root}/v2/query/video_generation/{task_id}", headers=poll_headers)
            if poll.status_code >= 400:
                fail(3001, f"查询视频任务失败: {_baidu_error_text(poll)}", 502)
            try:
                payload = poll.json()
            except ValueError:
                fail(3001, f"查询视频任务失败: {_baidu_error_text(poll)}", 502)
            status = _video_status(payload)
            if status in {"completed", "succeeded", "success", "finished"}:
                url = extract_video_url(payload)
                if not url:
                    fail(3001, "视频生成成功但未返回地址", 502)
                return url
            if status in {"failed", "failure", "error", "canceled", "cancelled", "expired"}:
                fail(3001, f"视频生成失败: {_video_fail_reason(payload)}", 502)
        fail(3001, "视频生成超时，请稍后重试", 504)
    return ""


async def vidu_video_generate(
    *,
    prompt: str,
    model: str,
    size: str,
    duration: int,
    resolution: str | None = None,
    first_frame: str | None = None,
    last_frame: str | None = None,
    images: list[str] | None = None,
    names: list[str] | None = None,
) -> str:
    if not settings.vidu_enabled:
        fail(3001, "Vidu 视频渠道已禁用", 503)
    if not settings.vidu_api_key:
        fail(3001, "未配置 Vidu API Key", 503)
    refs = [item for item in (images or []) if item][:3]
    if first_frame and first_frame not in refs:
        refs = [first_frame, *refs][:3]
    if last_frame:
        resolved = model if is_vidu_model(model) else "viduq3-pro"
    elif len(refs) >= 2:
        resolved = resolve_vidu_r2v_model(model)
    elif is_vidu_model(model):
        resolved = model
    else:
        resolved = "viduq3-pro"
    if resolved in {"viduq1"}:
        seconds = 5
    elif resolved == "vidu2.0":
        seconds = 4
    elif resolved.startswith("viduq3"):
        seconds = clamp_video_duration(duration, low=3, high=16)
    else:
        seconds = clamp_video_duration(duration, low=1, high=10)
    root = settings.vidu_root()
    headers = {
        "Authorization": f"Token {settings.vidu_api_key}",
        "Content-Type": "application/json",
        "User-Agent": "MangaCanvas/1.0",
    }
    body: dict = {
        "model": resolved,
        "prompt": prompt or "cinematic motion",
        "duration": seconds,
        "resolution": vidu_resolution(size, resolution),
        "watermark": False,
        "audio": True,
        "off_peak": False,
    }
    if last_frame:
        if not first_frame:
            fail(3001, "首尾帧视频需要首帧图片", 400)
        path = "/ent/v2/start-end2video"
        body["images"] = [await video_image_data_uri(first_frame), await video_image_data_uri(last_frame)]
    elif len(refs) >= 2:
        path = "/ent/v2/reference2video"
        payloads = [await video_image_data_uri(url) for url in refs[:3]]
        body["images"] = payloads
        body["prompt"] = mention_image_roles(body["prompt"], names)
        body["aspect_ratio"] = seedance_ratio(size)
    elif refs:
        path = "/ent/v2/img2video"
        body["images"] = [await video_image_data_uri(refs[0])]
    else:
        path = "/ent/v2/text2video"
        body["aspect_ratio"] = seedance_ratio(size)
    timeout = httpx.Timeout(60.0, connect=10.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        submit = await client.post(f"{root}{path}", headers=headers, json=body)
        if submit.status_code >= 400:
            from .model_probe import note_upstream_result

            note_upstream_result(resolved, submit.status_code, submit.text)
            fail(3001, f"视频任务提交失败: {_baidu_error_text(submit)}", 502)
        try:
            submitted = submit.json()
        except ValueError:
            fail(3001, f"视频任务提交失败: {_baidu_error_text(submit)}", 502)
        task_id = _video_task_id(submitted)
        if not task_id:
            fail(3001, "视频任务未返回 task_id", 502)
        poll_headers = {
            "Authorization": headers["Authorization"],
            "User-Agent": headers["User-Agent"],
        }
        for _ in range(110):
            await asyncio.sleep(5)
            poll = await client.get(f"{root}/ent/v2/tasks/{task_id}/creations", headers=poll_headers)
            if poll.status_code >= 400:
                fail(3001, f"查询视频任务失败: {_baidu_error_text(poll)}", 502)
            try:
                payload = poll.json()
            except ValueError:
                fail(3001, f"查询视频任务失败: {_baidu_error_text(poll)}", 502)
            status = _video_status(payload)
            if status in {"completed", "succeeded", "success", "finished"}:
                url = extract_video_url(payload)
                if not url:
                    fail(3001, "视频生成成功但未返回地址", 502)
                return url
            if status in {"failed", "failure", "error", "canceled", "cancelled", "expired"}:
                fail(3001, f"视频生成失败: {_video_fail_reason(payload)}", 502)
        fail(3001, "视频生成超时，请稍后重试", 504)
    return ""


def extract_media_url(payload: dict) -> str | None:
    output = payload.get("output") if isinstance(payload, dict) else None
    if isinstance(output, dict):
        if output.get("video_url"):
            return output["video_url"]
        results = output.get("results") or output.get("choices") or []
        if results:
            first = results[0]
            if isinstance(first, dict):
                if first.get("url"):
                    return first["url"]
                content = ((first.get("message") or {}).get("content")) or []
                for item in content:
                    if isinstance(item, dict) and item.get("image"):
                        return item["image"]
    data = payload.get("data")
    if isinstance(data, list) and data:
        first = data[0]
        if isinstance(first, dict) and first.get("url"):
            return first["url"]
    return None


async def dashscope_async(path: str, body: dict, *, poll_interval: float = 1.5, max_attempts: int = 120) -> dict:
    if not settings.dashscope_api_key:
        fail(3001, "未配置 DashScope API Key", 503)
    headers = {
        "Authorization": f"Bearer {settings.dashscope_api_key}",
        "Content-Type": "application/json",
        "X-DashScope-Async": "enable",
    }
    async with httpx.AsyncClient(timeout=180) as client:
        submit = await client.post(f"{DASHSCOPE_NATIVE}{path}", headers=headers, json=body)
        if submit.status_code >= 400:
            fail(3001, f"生成任务提交失败: {submit.text}", 502)
        submitted = submit.json()
        task_id = ((submitted.get("output") or {}).get("task_id"))
        if not task_id:
            fail(3001, "生成任务未返回 task_id", 502)
        poll_headers = {"Authorization": f"Bearer {settings.dashscope_api_key}"}
        for _ in range(max_attempts):
            await asyncio.sleep(poll_interval)
            poll = await client.get(f"{DASHSCOPE_NATIVE}/tasks/{task_id}", headers=poll_headers)
            if poll.status_code >= 400:
                fail(3001, f"查询生成任务失败: {poll.text}", 502)
            payload = poll.json()
            status = ((payload.get("output") or {}).get("task_status") or "").upper()
            if status in {"SUCCEEDED", "SUCCESS"}:
                return payload
            if status in {"FAILED", "CANCELED", "UNKNOWN"}:
                message = (payload.get("output") or {}).get("message") or "生成失败"
                fail(3001, f"生成失败: {message}", 502)
        fail(3001, "生成超时，请稍后重试", 504)
    return {}


VIDEO_TEMPLATE_PROMPTS = {
    "squish": "主体被轻轻捏扁后弹性回弹，解压捏捏的卡通物理效果，镜头固定，保持原图构图、角色外貌和画风",
    "rotation": "主体原地顺时针转圈，镜头轻微环绕，保持原图主体、服装和画风",
    "singleheart": "主体比心并露出爱意表情，空中浮出粉色爱心，保持原图人物和画风",
    "dance1": "主体跟着节奏左右摇摆跳舞，身体有弹性，保持原图人物、服装和画风",
    "dance2": "主体甩动手臂热舞，节奏感强，保持原图人物和画风",
    "dance3": "主体做星光摇摆舞蹈，灯光闪烁，保持原图人物和画风",
    "dance4": "主体用手指点拍节奏跳舞，轻快，保持原图人物和画风",
    "dance5": "主体突然开始跳舞并切换舞步，保持原图人物和画风",
    "graduation": "主体戴上学士帽并抛起庆祝毕业，保持原图人物和画风",
    "money": "金币从天而降洒在主体周围，主体开心地接住，保持原图人物和画风",
    "flying": "主体魔法悬浮升空，衣摆飘动，保持原图人物和画风",
    "rose": "主体手持玫瑰递出，花瓣微微飘落，保持原图人物和画风",
    "crystalrose": "主体手中出现闪亮水晶玫瑰，光芒闪烁，保持原图人物和画风",
    "hug": "两人深情拥抱，动作自然温柔，保持原图人物外貌、服装和画风",
    "frenchkiss": "两人轻轻亲吻，动作克制自然，保持原图人物外貌和画风",
    "coupleheart": "两人一起比心，甜蜜互动，保持原图人物外貌和画风",
}


def video_template_prompt(template: str | None, prompt: str | None) -> str:
    mapped = VIDEO_TEMPLATE_PROMPTS.get((template or "").strip().lower(), "")
    parts = [part for part in (mapped, (prompt or "").strip()) if part]
    return "，".join(parts) or "让画面自然动起来，保持原图构图和画风"


def resolve_chat_endpoint(preferred_model: str | None = None) -> tuple[str, str, str] | None:
    if settings.xai_api_key:
        return settings.xai_api_key, settings.xai_base_url, preferred_model or "grok-4.5"
    if settings.openai_api_key:
        return settings.openai_api_key, settings.openai_base_url, preferred_model or "qwen-plus"
    if settings.dashscope_api_key:
        return settings.dashscope_api_key, settings.dashscope_base_url, preferred_model or "qwen-plus"
    return None


async def llm_complete(
    messages: list,
    model: str | None = None,
    timeout: float = 180,
    fail_on_error: bool = True,
) -> tuple[str, str | None]:
    endpoint = resolve_chat_endpoint(model)
    if not endpoint:
        return "", None
    key, base, chat_model = endpoint
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(
                f"{base.rstrip('/')}/chat/completions",
                headers={"Authorization": f"Bearer {key}"},
                json={"model": chat_model, "messages": messages, "stream": False, "temperature": 0.2},
            )
            if resp.status_code >= 400:
                if fail_on_error:
                    fail(3001, f"剧本解析失败: {resp.text[:500]}", 502)
                return "", chat_model
            payload = resp.json()
            content = (((payload.get("choices") or [{}])[0].get("message") or {}).get("content")) or ""
            return content, chat_model
    except ApiError:
        raise
    except Exception as exc:
        if fail_on_error:
            fail(3001, f"剧本解析失败: {exc}", 502)
        return "", chat_model


async def dashscope_chat(messages: list, model: str) -> str:
    user_text = next((m.get("content") for m in reversed(messages) if isinstance(m, dict) and m.get("role") == "user"), "")
    content, _used = await llm_complete(
        messages,
        model="qwen-plus" if settings.openai_api_key and not settings.xai_api_key else (model or "qwen-plus"),
        timeout=60,
        fail_on_error=bool(resolve_chat_endpoint()),
    )
    if content:
        return content
    if not resolve_chat_endpoint():
        return f"{user_text}，电影感，细节丰富，8K"
    return content
