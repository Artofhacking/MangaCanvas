"""Store canvas bitmaps as files instead of inline data URLs.

Paste, upload, and video-frame capture put the same bitmap in both `url` and
`base64`. Autosave then PUTs that JSON. A few images are enough to blow past
nginx's body limit; the access log shows `400 0` when the browser resets the
upload, or an HTML 413 when nginx finishes the rejection. Neither is the
FastAPI JSON error handler.
"""

from __future__ import annotations

import base64
import logging
from typing import Any
from urllib.parse import unquote_to_bytes

from .ai_media import persist_bytes
from .errors import fail

logger = logging.getLogger(__name__)

# Decoded bytes of one inline image/video/audio value.
MAX_INLINE_MEDIA_BYTES = 32 * 1024 * 1024
_MAX_DATA_URL_CHARS = MAX_INLINE_MEDIA_BYTES * 2

_SUFFIXES = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/svg+xml": ".svg",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "audio/mpeg": ".mp3",
    "audio/wav": ".wav",
    "audio/mp4": ".m4a",
}


def _is_inline_media(value: str) -> bool:
    if not value.startswith("data:"):
        return False
    header = value.split(",", 1)[0].lower()
    return header.startswith(("data:image/", "data:video/", "data:audio/"))


def _suffix_for_mime(mime: str) -> str:
    return _SUFFIXES.get(mime.lower(), ".bin")


def _store_data_url(value: str) -> str:
    header, separator, data = value.partition(",")
    if not separator:
        fail(1001, "画布内嵌图片无法解析", 400)
    if len(data) > _MAX_DATA_URL_CHARS:
        fail(1001, "单张内嵌图片过大，未能写入画布。请换一张较小的图片", 413)
    mime = header[5:].split(";", 1)[0].strip().lower() or "application/octet-stream"
    try:
        raw = base64.b64decode(data, validate=False) if ";base64" in header.lower() else unquote_to_bytes(data)
    except Exception:
        fail(1001, "画布内嵌图片无法解析", 400)
    if len(raw) > MAX_INLINE_MEDIA_BYTES:
        fail(1001, "单张内嵌图片过大，未能写入画布。请换一张较小的图片", 413)
    return persist_bytes(raw, _suffix_for_mime(mime))


def persist_inline_canvas(value: Any, cache: dict[str, str] | None = None) -> Any:
    """Replace inline media with /static/uploads/... paths. Identical data URLs share one file."""
    cache = cache if cache is not None else {}
    if isinstance(value, str):
        if value.startswith("blob:"):
            return ""
        if not _is_inline_media(value):
            return value
        stored = cache.get(value)
        if stored is None:
            stored = _store_data_url(value)
            cache[value] = stored
        return stored
    if isinstance(value, list):
        return [persist_inline_canvas(item, cache) for item in value]
    if isinstance(value, dict):
        rewritten = {key: persist_inline_canvas(item, cache) for key, item in value.items()}
        url = rewritten.get("url")
        encoded = rewritten.get("base64")
        if isinstance(encoded, str) and (encoded == "" or encoded == url):
            rewritten.pop("base64", None)
        elif isinstance(encoded, str) and encoded.startswith("/static/") and not url:
            rewritten["url"] = encoded
            rewritten.pop("base64", None)
        return rewritten
    return value


def persist_inline_canvas_logged(canvas: dict | None) -> dict | None:
    if not isinstance(canvas, dict):
        return canvas
    cache: dict[str, str] = {}
    rewritten = persist_inline_canvas(canvas, cache)
    if cache:
        logger.info("externalized %s inline canvas media object(s)", len(cache))
    return rewritten
