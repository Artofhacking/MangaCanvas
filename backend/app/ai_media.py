import asyncio
import base64
import secrets
import time
from pathlib import Path
from urllib.parse import urlparse

import httpx

from .config import settings
from .errors import fail

DASHSCOPE_NATIVE = "https://dashscope.aliyuncs.com/api/v1"
PLACEHOLDER_SVG = """<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
  <rect width="100%" height="100%" fill="#1a1a1a"/>
  <text x="50%" y="48%" text-anchor="middle" fill="#f5c16c" font-size="48" font-family="sans-serif">MangaCanvas</text>
  <text x="50%" y="56%" text-anchor="middle" fill="#888" font-size="24" font-family="sans-serif">generated placeholder</text>
</svg>
"""


def _public_url(path: str) -> str:
    return f"{settings.public_base_url.rstrip('/')}{path}"


def _is_local_url(url: str) -> bool:
    if not url:
        return False
    if url.startswith("/static/"):
        return True
    base = settings.public_base_url.rstrip("/")
    return url.startswith(base) or "127.0.0.1" in url or "localhost" in url


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
        if local:
            if url.startswith("http"):
                return url
            return _public_url(url if url.startswith("/") else f"/{url}")
        if url.startswith("/"):
            return _public_url(url)
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


def resolve_video_model(model: str, has_image: bool) -> str:
    name = (model or "").lower()
    if "t2v" in name:
        return "happyhorse-1.1-t2v"
    if "i2v" in name or "kf2v" in name or has_image:
        return "happyhorse-1.1-i2v"
    return "happyhorse-1.1-t2v"


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
    status = payload.get("status") or payload.get("task_status")
    data = payload.get("data")
    if not status and isinstance(data, dict):
        status = data.get("status") or data.get("task_status")
    return str(status or "").lower()


def _video_fail_reason(payload: dict) -> str:
    if not isinstance(payload, dict):
        return "生成失败"
    data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    meta = payload.get("metadata") if isinstance(payload.get("metadata"), dict) else {}
    reason = (
        payload.get("fail_reason")
        or payload.get("error")
        or payload.get("message")
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
        if isinstance(value, str) and value:
            return value
    data = payload.get("data")
    if isinstance(data, dict):
        for key in ("task_id", "id"):
            value = data.get(key)
            if isinstance(value, str) and value:
                return value
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
    raw = await load_image_bytes(persisted or url)
    suffix = (urlparse(persisted or url).path or url).lower()
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
) -> str:
    if not settings.openai_api_key:
        fail(3001, "未配置视频模型 API Key", 503)
    base = settings.openai_base_url.rstrip("/")
    headers = {"Authorization": f"Bearer {settings.openai_api_key}", "Content-Type": "application/json"}
    resolved = resolve_video_model(model, bool(first_frame))
    seconds = duration if duration in {5, 10, 15} else 5
    body: dict = {
        "model": resolved,
        "prompt": prompt or "cinematic motion",
        "duration": seconds,
        "size": size,
    }
    if resolved.endswith("i2v"):
        if not first_frame:
            fail(3001, "图生视频需要首帧图片", 400)
        image_ref = await video_image_ref(first_frame)
        # nexcor's Ali converter only forwards HappyHorse first-frame via metadata.input.media
        body["metadata"] = {
            "input": {
                "media": [{"type": "first_frame", "url": image_ref}],
            }
        }
    async with httpx.AsyncClient(timeout=60) as client:
        submit = await client.post(f"{base}/video/generations", headers=headers, json=body)
        if submit.status_code >= 400:
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


async def dashscope_chat(messages: list, model: str) -> str:
    user_text = next((m.get("content") for m in reversed(messages) if isinstance(m, dict) and m.get("role") == "user"), "")
    if settings.openai_api_key:
        key = settings.openai_api_key
        base = settings.openai_base_url
        chat_model = "qwen-plus"
    elif settings.dashscope_api_key:
        key = settings.dashscope_api_key
        base = settings.dashscope_base_url
        chat_model = model or "qwen-plus"
    else:
        return f"{user_text}，电影感，细节丰富，8K"
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"{base.rstrip('/')}/chat/completions",
            headers={"Authorization": f"Bearer {key}"},
            json={"model": chat_model, "messages": messages, "stream": False},
        )
        if resp.status_code >= 400:
            fail(3001, f"润色失败: {resp.text[:500]}", 502)
        payload = resp.json()
        return (((payload.get("choices") or [{}])[0].get("message") or {}).get("content")) or ""
