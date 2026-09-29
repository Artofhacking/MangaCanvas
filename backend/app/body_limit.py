"""Reject oversized HTTP bodies with a JSON error.

FastAPI's validation handler already returns JSON for a bad payload. A request
that never reaches the app — nginx dropping a huge canvas PUT, or the client
resetting while that body is still uploading — shows up in the access log as
`400 0` or an HTML 413. This middleware is the in-process backstop: when
Content-Length is above the same limit as nginx `client_max_body_size`, the
client gets a non-empty JSON body it can display.
"""

from __future__ import annotations

import json
from typing import Any

# Keep in sync with client_max_body_size in deploy/nginx/mangacanvas.conf.
MAX_REQUEST_BODY_BYTES = 128 * 1024 * 1024

BODY_TOO_LARGE_MESSAGE = "请求体过大，未能写入。请缩小图片或文件后重试"


def _content_length(scope: dict[str, Any]) -> int | None:
    for name, value in scope.get("headers") or []:
        if name.lower() == b"content-length":
            try:
                return int(value)
            except (TypeError, ValueError):
                return None
    return None


class RequestSizeLimitMiddleware:
    def __init__(self, app: Any, max_bytes: int = MAX_REQUEST_BODY_BYTES) -> None:
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: dict[str, Any], receive: Any, send: Any) -> None:
        if scope.get("type") == "http":
            length = _content_length(scope)
            if length is not None and length > self.max_bytes:
                payload = json.dumps(
                    {"code": 1001, "message": BODY_TOO_LARGE_MESSAGE, "data": None},
                    ensure_ascii=False,
                ).encode("utf-8")
                await send(
                    {
                        "type": "http.response.start",
                        "status": 413,
                        "headers": [
                            (b"content-type", b"application/json; charset=utf-8"),
                            (b"content-length", str(len(payload)).encode("ascii")),
                        ],
                    }
                )
                await send({"type": "http.response.body", "body": payload})
                return
        await self.app(scope, receive, send)
