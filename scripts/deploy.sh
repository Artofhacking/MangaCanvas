#!/usr/bin/env bash
# Publish MangaCanvas from a developer machine.
# Does not overwrite server backend/.env (database and API keys stay on the host).
#
#   export MANGACANVAS_SSH_KEY=/path/to/key.pem
#   npm run deploy
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${MANGACANVAS_SSH_HOST:-47.104.138.144}"
USER="${MANGACANVAS_SSH_USER:-ecs-user}"
KEY="${MANGACANVAS_SSH_KEY:-}"
WEB_ROOT=/var/www/mangacanvas
APP_ROOT=/opt/mangacanvas/backend
TARGET="$USER@$HOST"

if [[ -z "$KEY" ]]; then
  echo "Set MANGACANVAS_SSH_KEY to your SSH private key path." >&2
  echo "Example: MANGACANVAS_SSH_KEY=~/.ssh/mangacanvas.pem npm run deploy" >&2
  exit 1
fi

if [[ ! -f "$KEY" ]]; then
  echo "SSH key not found: $KEY" >&2
  exit 1
fi

chmod 400 "$KEY" 2>/dev/null || true

ssh_cmd() {
  ssh -i "$KEY" -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes "$TARGET" "$@"
}

echo "==> build frontend"
cd "$ROOT"
npm run build
if [[ ! -f "$ROOT/dist/index.html" ]]; then
  echo "frontend build missing dist/index.html" >&2
  exit 1
fi
node "$ROOT/scripts/check-spa-assets.mjs"

echo "==> upload frontend -> $WEB_ROOT"
COPYFILE_DISABLE=1 tar czf - -C "$ROOT/dist" . | ssh_cmd \
  "sudo mkdir -p '$WEB_ROOT' && sudo rm -rf '$WEB_ROOT'/* && sudo tar xzf - -C '$WEB_ROOT' && sudo chown -R '$USER:$USER' '$WEB_ROOT'"

echo "==> upload backend -> $APP_ROOT/app"
COPYFILE_DISABLE=1 tar czf - -C "$ROOT/backend" app requirements.txt | ssh_cmd \
  "mkdir -p /tmp/mangacanvas-release && rm -rf /tmp/mangacanvas-release/* && tar xzf - -C /tmp/mangacanvas-release && test -f /tmp/mangacanvas-release/app/main.py && test -f /tmp/mangacanvas-release/requirements.txt && cp -a /tmp/mangacanvas-release/app/. '$APP_ROOT/app/' && cp /tmp/mangacanvas-release/requirements.txt '$APP_ROOT/requirements.txt'"

echo "==> upload nginx SPA template + patcher"
scp -i "$KEY" -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes \
  "$ROOT/deploy/nginx/mangacanvas.conf" "$ROOT/scripts/ensure-nginx-spa.py" \
  "$TARGET:/tmp/"

echo "==> install deps and restart"
ssh_cmd "cd '$APP_ROOT' && .venv/bin/pip install -r requirements.txt -q && sudo systemctl restart mangacanvas && sudo sed -i 's/proxy_read_timeout [0-9]\\+s;/proxy_read_timeout 600s;/' /etc/nginx/conf.d/mangacanvas.conf && sudo python3 /tmp/ensure-nginx-spa.py && sudo nginx -t && sudo systemctl reload nginx"

echo "==> health check"
ok=0
for _ in 1 2 3 4 5 6 7 8 9 10 11 12 15; do
  if curl -fsS --max-time 5 "http://$HOST/api/v1/health" >/dev/null; then
    curl -fsS --max-time 5 "http://$HOST/api/v1/health"
    echo
    ok=1
    break
  fi
  sleep 1
done

if [[ "$ok" -ne 1 ]]; then
  echo "health check failed; last service logs:" >&2
  ssh_cmd "sudo journalctl -u mangacanvas -n 40 --no-pager" >&2
  exit 1
fi

echo "==> spa deep-link check"
spa_ok=0
for url in "http://$HOST:18999/project/6/scenes" "http://$HOST/project/6/scenes"; do
  if html="$(curl -fsS --max-time 8 "$url" 2>/dev/null)" && grep -q 'src="/assets/' <<<"$html"; then
    echo "deep link OK  $url"
    spa_ok=1
    break
  fi
done
if [[ "$spa_ok" -ne 1 ]]; then
  echo "deep-link check failed (index.html must reference /assets/..., not ./assets/...)" >&2
  exit 1
fi

echo "release ok  http://$HOST:18999/"
