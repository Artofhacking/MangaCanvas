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

    async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
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


async def dashscope_chat(messages: list, model: str) -> str:
    if not settings.dashscope_api_key:
        user_text = next((m.get("content") for m in reversed(messages) if m.get("role") == "user"), "")
        return f"{user_text}，电影感，细节丰富，8K"
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"{settings.dashscope_base_url.rstrip('/')}/chat/completions",
            headers={"Authorization": f"Bearer {settings.dashscope_api_key}"},
            json={"model": model or "qwen-plus", "messages": messages, "stream": False},
        )
        if resp.status_code >= 400:
            fail(3001, f"润色失败: {resp.text}", 502)
        payload = resp.json()
        return (((payload.get("choices") or [{}])[0].get("message") or {}).get("content")) or ""
