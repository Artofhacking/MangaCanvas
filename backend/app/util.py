from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse


def iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def now() -> datetime:
    return datetime.now(timezone.utc)


def to_camel(key: str) -> str:
    parts = key.split("_")
    return parts[0] + "".join(p[:1].upper() + p[1:] for p in parts[1:] if p)


def camelize(value: Any) -> Any:
    if isinstance(value, dict):
        return {to_camel(k) if isinstance(k, str) else k: camelize(v) for k, v in value.items()}
    if isinstance(value, list):
        return [camelize(v) for v in value]
    if isinstance(value, datetime):
        return iso(value)
    return value


def media_path(url: str | None) -> str | None:
    if not url or not isinstance(url, str):
        return None
    if url.startswith(("data:", "blob:")):
        return None
    if url.startswith("/static/") or url.startswith("/api/"):
        return url
    parsed = urlparse(url)
    path = parsed.path or "/"
    if parsed.query:
        path = f"{path}?{parsed.query}"
    if path.startswith("/static/") or path.startswith("/api/"):
        return path
    return None


def rewrite_stored_media_url(url: str | None) -> str | None:
    path = media_path(url)
    return path if path else url


def rewrite_media_tree(value: Any) -> Any:
    if isinstance(value, str):
        return rewrite_stored_media_url(value)
    if isinstance(value, list):
        return [rewrite_media_tree(item) for item in value]
    if isinstance(value, dict):
        return {key: rewrite_media_tree(item) for key, item in value.items()}
    return value


def paginate(items: list, page: int, size: int) -> tuple[list, dict]:
    page = max(page or 1, 1)
    size = min(max(size or 20, 1), 100)
    total = len(items)
    start = (page - 1) * size
    return items[start : start + size], {"page": page, "size": size, "total": total}
