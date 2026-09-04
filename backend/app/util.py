from datetime import datetime, timezone
from typing import Any


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


def paginate(items: list, page: int, size: int) -> tuple[list, dict]:
    page = max(page or 1, 1)
    size = min(max(size or 20, 1), 100)
    total = len(items)
    start = (page - 1) * size
    return items[start : start + size], {"page": page, "size": size, "total": total}
