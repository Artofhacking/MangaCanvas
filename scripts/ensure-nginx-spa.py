#!/usr/bin/env python3
"""Idempotently make /etc/nginx/conf.d/mangacanvas.conf SPA-safe.

- Hashed Vite files stay at /assets/* and never fall back to HTML.
- History routes use `try_files $uri /index.html` (no $uri/ directory redirect).
"""
import re
import sys
from pathlib import Path

CONF = Path(sys.argv[1] if len(sys.argv) > 1 else "/etc/nginx/conf.d/mangacanvas.conf")
# Same ceiling as backend.app.body_limit.MAX_REQUEST_BODY_BYTES and the nginx templates.
CLIENT_MAX_BODY = "client_max_body_size 128m;"
BODY_TOO_LARGE_PAGE = "error_page 413 @canvas_body_too_large;"
BODY_TOO_LARGE_LOCATION = """
    location @canvas_body_too_large {
        default_type application/json;
        return 413 '{"code":1001,"message":"请求体过大，未能写入。请缩小图片或文件后重试","data":null}';
    }
"""
ASSETS_BLOCK = """
    location ^~ /assets/ {
        try_files $uri =404;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
"""


def ensure_canvas_body_limits(text: str) -> str:
    """Raise the body cap and serve a JSON 413. Idempotent for an already-patched file."""
    if re.search(r"client_max_body_size\s+[^;]+;", text):
        text = re.sub(r"client_max_body_size\s+[^;]+;", CLIENT_MAX_BODY, text)
    else:
        anchor = re.search(r"server_name\s+[^;]+;\n", text)
        if not anchor:
            raise SystemExit(f"{CONF} has no server_name; cannot set {CLIENT_MAX_BODY}")
        text = text[: anchor.end()] + f"    {CLIENT_MAX_BODY}\n" + text[anchor.end() :]

    if re.search(r"error_page\s+413\s+", text):
        text = re.sub(r"error_page\s+413\s+[^;]+;", BODY_TOO_LARGE_PAGE, text)
    else:
        text = text.replace(f"{CLIENT_MAX_BODY}\n", f"{CLIENT_MAX_BODY}\n    {BODY_TOO_LARGE_PAGE}\n", 1)

    if "location @canvas_body_too_large" not in text:
        match = re.search(r"[ \t]*location\s+/\s*\{", text)
        if not match:
            raise SystemExit(f"{CONF} has no `location /` block to attach the 413 JSON page")
        text = text[: match.start()] + BODY_TOO_LARGE_LOCATION.strip("\n") + "\n\n" + text[match.start() :]
    return text


def main() -> None:
    if not CONF.exists():
        raise SystemExit(f"missing {CONF}")

    text = CONF.read_text()
    original = text

    text = ensure_canvas_body_limits(text)

    if "location ^~ /assets/" not in text and not re.search(r"location\s+/assets/", text):
        match = re.search(r"location\s+/\s*\{", text)
        if not match:
            raise SystemExit(f"{CONF} has no `location /` block to patch")
        text = text[:match.start()] + ASSETS_BLOCK + "\n    " + text[match.start():]

    text = text.replace("try_files $uri $uri/ /index.html;", "try_files $uri /index.html;")

    if text == original:
        print("nginx spa locations already present")
        return

    backup = Path(str(CONF) + ".bak-spa")
    backup.write_text(original)
    CONF.write_text(text)
    print(f"nginx spa locations updated (backup {backup})")


if __name__ == "__main__":
    main()
