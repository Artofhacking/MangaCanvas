"""Per-episode delivery package derived from finalized storyboard shots."""

EXPORT_NOTE = "按镜号排列的定稿文件地址。zip 打包留待后续。"
FILE_EXTENSIONS = {"png", "jpg", "jpeg", "webp", "gif", "mp4", "webm"}


def delivery_file_code(code: str) -> str:
    chars = []
    for ch in (code or "").strip():
        if ("0" <= ch <= "9") or ("A" <= ch <= "Z") or ("a" <= ch <= "z") or ch in "._-":
            chars.append(ch)
        elif "\u4e00" <= ch <= "\u9fff":
            chars.append(ch)
        else:
            chars.append("_")
    cleaned = "".join(chars)
    while "__" in cleaned:
        cleaned = cleaned.replace("__", "_")
    cleaned = cleaned.strip("._")
    return cleaned or "episode"


def _extension(url: str) -> str:
    path = url.split("?", 1)[0].split("#", 1)[0]
    if "." not in path:
        return "png"
    ext = path.rsplit(".", 1)[-1].lower()
    if 2 <= len(ext) <= 5 and ext in FILE_EXTENSIONS:
        return ext
    return "png"


def delivery_filename(code: str, shot_number: int, url: str) -> str:
    return f"{delivery_file_code(code)}_镜{int(shot_number):02d}.{_extension(url)}"


def _gap_reason(shot: dict) -> str:
    if shot.get("finalized"):
        return "missing-file"
    if shot.get("imageUrl"):
        return "unfinalized"
    return "no-frame"


def build_episode_delivery(episode: dict, *, exported_at: str | None = None) -> dict:
    """Ordered finalized files, plus gaps that stay out of the package."""
    shots = list(episode.get("storyboard") or [])
    shots.sort(key=lambda shot: int(shot.get("index") or 0))
    items = []
    gaps = []
    code = str(episode.get("code") or "")
    for shot in shots:
        number = int(shot.get("index") or 0)
        finalized = bool(shot.get("finalized"))
        file_url = ""
        if finalized:
            file_url = str(shot.get("finalizedImageUrl") or shot.get("imageUrl") or "")
        prompt = str(shot.get("prompt") or "")
        shot_id = str(shot.get("id") or "")
        if finalized and file_url:
            item = {
                "shotId": shot_id,
                "shotNumber": number,
                "prompt": prompt,
                "fileUrl": file_url,
                "filename": delivery_filename(code, number, file_url),
            }
            if shot.get("finalizedAt"):
                item["finalizedAt"] = shot.get("finalizedAt")
            items.append(item)
            continue
        gaps.append(
            {
                "shotId": shot_id,
                "shotNumber": number,
                "prompt": prompt,
                "reason": _gap_reason(shot),
            }
        )
    payload = {
        "version": 1,
        "episodeId": episode.get("id"),
        "episodeName": episode.get("name") or "",
        "episodeCode": code,
        "items": items,
        "gaps": gaps,
        "export": {
            "format": "manifest",
            "zip": False,
            "note": EXPORT_NOTE,
        },
    }
    if exported_at:
        payload["exportedAt"] = exported_at
    return payload
