#!/usr/bin/env bash
set -euo pipefail

DIST_SRC=${1:-/tmp/mangacanvas-dist}
BACKEND_SRC=${2:-/tmp/mangacanvas-backend}

WEB_ROOT=/var/www/mangacanvas
APP_ROOT=/opt/mangacanvas/backend

if [ ! -f "$DIST_SRC/index.html" ]; then
  echo "missing frontend build at $DIST_SRC/index.html" >&2
  exit 1
fi
if [ ! -d "$BACKEND_SRC/app" ] || [ ! -f "$BACKEND_SRC/requirements.txt" ]; then
  echo "missing backend payload under $BACKEND_SRC" >&2
  exit 1
fi

rsync -a --delete --exclude '.git' "$DIST_SRC"/ "$WEB_ROOT"/
rsync -a "$BACKEND_SRC/app/" "$APP_ROOT/app/"
cp "$BACKEND_SRC/requirements.txt" "$APP_ROOT/requirements.txt"

cd "$APP_ROOT"
.venv/bin/pip install -r requirements.txt
sudo systemctl restart mangacanvas
sudo systemctl reload nginx

for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS http://127.0.0.1/api/v1/health >/dev/null; then
    curl -fsS http://127.0.0.1/api/v1/health
    echo
    echo "release ok"
    exit 0
  fi
  sleep 1
done

echo "health check failed" >&2
sudo journalctl -u mangacanvas -n 40 --no-pager >&2
exit 1
