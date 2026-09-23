"""Asset shaping (定型) for characters, scenes, and props.

Status is derived, not stored:

- unset: prompt is not locked. A cover image does not count until the prompt is locked.
- semi: prompt is locked and there is no cover yet.
- final: prompt is locked and a cover image is saved.

Unlock clears the lock and returns to unset. The cover file stays, but it does not
count again until the prompt is locked once more.
"""

from . import models
from .errors import fail
from .util import iso, now

UNSET = "unset"
SEMI = "semi"
FINAL = "final"


def cover_value(row) -> str | None:
    raw = row.avatar if isinstance(row, models.Character) else row.image
    text = (raw or "").strip()
    return text or None


def shaping_status(row) -> str:
    if not bool(getattr(row, "prompt_locked", False)):
        return UNSET
    return FINAL if cover_value(row) else SEMI


def shaping_payload(row) -> dict:
    cover = cover_value(row)
    return {
        "promptLocked": bool(getattr(row, "prompt_locked", False)),
        "promptLockedAt": iso(getattr(row, "prompt_locked_at", None)),
        "hasCover": bool(cover),
        "shapingStatus": shaping_status(row),
    }


def _same_text(current: str | None, incoming: str | None) -> bool:
    return (current or "").strip() == (incoming or "").strip()


def ensure_description_change(row, new_description: str | None) -> None:
    if new_description is None or not bool(getattr(row, "prompt_locked", False)):
        return
    if _same_text(row.description, new_description):
        return
    fail(1001, "提示词已锁定，请先解锁", 400)


def ensure_cover_change(row, new_cover: str | None) -> None:
    if new_cover is None:
        return
    current = cover_value(row)
    incoming = (new_cover or "").strip() or None
    if current == incoming:
        return
    if bool(getattr(row, "prompt_locked", False)) and current:
        fail(1001, "已定妆，换定妆前请先解锁", 400)


def lock_prompt(row) -> None:
    if not (row.description or "").strip():
        fail(1001, "请先填写提示词", 400)
    if not bool(row.prompt_locked):
        row.prompt_locked = True
        row.prompt_locked_at = now()
    row.updated_at = now()


def unlock_prompt(row) -> None:
    row.prompt_locked = False
    row.prompt_locked_at = None
    row.updated_at = now()
