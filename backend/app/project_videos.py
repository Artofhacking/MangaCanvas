import re

from .favorites import coerce_metadata

VIDEO_EXT = re.compile(r"\.(mp4|webm|mov|m4v|mkv|avi)(?:$|[?#])", re.IGNORECASE)


def is_project_video(url: object, metadata: object | None) -> bool:
    """Project-asset rows that belong on 视频管理."""
    data = coerce_metadata(metadata) or {}
    if data.get("category") == "video" or data.get("mediaType") == "video":
        return True
    return isinstance(url, str) and bool(VIDEO_EXT.search(url))
