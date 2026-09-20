COLLECT_SOURCES = ("favorite", "collect")


def is_collected_metadata(metadata: object | None) -> bool:
    if not isinstance(metadata, dict):
        return False
    if metadata.get("source") in COLLECT_SOURCES:
        return True
    favorited_at = metadata.get("favoritedAt")
    return isinstance(favorited_at, str) and bool(favorited_at)
