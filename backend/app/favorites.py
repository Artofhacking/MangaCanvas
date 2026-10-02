import json
from urllib.parse import urlparse

from .util import media_path

COLLECT_SOURCES = ("favorite", "collect")


def coerce_metadata(metadata: object | None) -> dict | None:
    """Return a dict even when a JSON column comes back as a string."""
    if isinstance(metadata, dict):
        return metadata
    if isinstance(metadata, str):
        text = metadata.strip()
        if not text:
            return None
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            return None
        if isinstance(parsed, dict):
            return parsed
    return None


def is_collected_metadata(metadata: object | None) -> bool:
    data = coerce_metadata(metadata)
    if not data:
        return False
    if data.get("source") in COLLECT_SOURCES:
        return True
    favorited_at = data.get("favoritedAt")
    return isinstance(favorited_at, str) and bool(favorited_at)


def metadata_node_id(metadata: object | None) -> str | None:
    data = coerce_metadata(metadata)
    if not data:
        return None
    node_id = data.get("nodeId")
    if isinstance(node_id, str) and node_id.strip():
        return node_id
    return None


def media_identity(url: str | None) -> str:
    """Stable identity for a stored or preview URL, ignoring host and query."""
    if not url or not isinstance(url, str):
        return ""
    path = media_path(url)
    if path:
        return path.split("?", 1)[0]
    parsed = urlparse(url)
    if parsed.scheme and parsed.netloc:
        return f"{parsed.scheme}://{parsed.netloc}{parsed.path}".rstrip("/")
    return url.split("?", 1)[0].rstrip("/")


def metadata_text(metadata: object | None, key: str) -> str | None:
    data = coerce_metadata(metadata)
    if not data:
        return None
    value = data.get(key)
    return value if isinstance(value, str) and value.strip() else None


def same_media_target(
    row_url: str | None,
    row_metadata: object | None,
    url: str | None,
    node_id: str | None,
    source_url: str | None = None,
) -> bool:
    stored = {media_identity(row_url), media_identity(metadata_text(row_metadata, "sourceUrl"))}
    incoming = {media_identity(url), media_identity(source_url)}
    stored.discard("")
    incoming.discard("")
    if not stored or not incoming or stored.isdisjoint(incoming):
        return False
    if node_id:
        existing = metadata_node_id(row_metadata)
        if existing and existing != node_id:
            return False
    return True
