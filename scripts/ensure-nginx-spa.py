#!/usr/bin/env python3
"""Idempotently make /etc/nginx/conf.d/mangacanvas.conf SPA-safe.

- Hashed Vite files stay at /assets/* and never fall back to HTML.
- History routes use `try_files $uri /index.html` (no $uri/ directory redirect).
"""
import re
import sys
from pathlib import Path

CONF = Path(sys.argv[1] if len(sys.argv) > 1 else "/etc/nginx/conf.d/mangacanvas.conf")
ASSETS_BLOCK = """
    location ^~ /assets/ {
        try_files $uri =404;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
"""


def main() -> None:
    if not CONF.exists():
        raise SystemExit(f"missing {CONF}")

    text = CONF.read_text()
    original = text

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
