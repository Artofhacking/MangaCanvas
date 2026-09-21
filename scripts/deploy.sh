#!/usr/bin/env bash
# Publish MangaCanvas from a developer machine (local fallback).
# Production CI uses the ECS self-hosted runner — see .github/workflows/deploy.yml.
# Does not overwrite server backend/.env (database and API keys stay on the host).
# nginx proxy_read_timeout is 600s; video reservation TTL is 20 min — do not treat them as equal.
#
#   export MANGACANVAS_SSH_KEY=/path/to/key.pem
#   npm run deploy
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${MANGACANVAS_SSH_HOST:-47.104.138.144}"
USER="${MANGACANVAS_SSH_USER:-ecs-user}"
KEY="${MANGACANVAS_SSH_KEY:-}"
TARGET="$USER@$HOST"
REMOTE_RELEASE=/tmp/mangacanvas-release

if [[ -z "$KEY" ]]; then
  echo "Set MANGACANVAS_SSH_KEY to your SSH private key path." >&2
  echo "Example: MANGACANVAS_SSH_KEY=~/.ssh/mangacanvas.pem npm run deploy" >&2
  echo "Production publish: push to main or run the Deploy workflow (ECS self-hosted runner)." >&2
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

STAGE="$(mktemp -d)"
cleanup() {
  rm -rf "$STAGE"
}
trap cleanup EXIT

echo "==> stage release payload"
mkdir -p "$STAGE/backend" "$STAGE/deploy/nginx" "$STAGE/scripts"
cp -a "$ROOT/dist" "$STAGE/dist"
cp -a "$ROOT/backend/app" "$STAGE/backend/app"
cp "$ROOT/backend/requirements.txt" "$STAGE/backend/requirements.txt"
cp "$ROOT/deploy/nginx/mangacanvas.conf" "$STAGE/deploy/nginx/mangacanvas.conf"
cp "$ROOT/scripts/ensure-nginx-spa.py" "$STAGE/scripts/ensure-nginx-spa.py"
cp "$ROOT/scripts/deploy-on-server.sh" "$STAGE/scripts/deploy-on-server.sh"
chmod +x "$STAGE/scripts/deploy-on-server.sh" "$STAGE/scripts/ensure-nginx-spa.py"
if [[ -e "$STAGE/backend/.env" || -e "$STAGE/backend/app/.env" ]]; then
  echo "refusing to upload a payload that includes .env" >&2
  exit 1
fi

echo "==> upload release -> $TARGET:$REMOTE_RELEASE"
COPYFILE_DISABLE=1 tar czf - -C "$STAGE" . | ssh_cmd \
  "rm -rf '$REMOTE_RELEASE' && mkdir -p '$REMOTE_RELEASE' && tar xzf - -C '$REMOTE_RELEASE' && test -f '$REMOTE_RELEASE/scripts/deploy-on-server.sh'"

echo "==> publish on server"
ssh_cmd "bash '$REMOTE_RELEASE/scripts/deploy-on-server.sh' '$REMOTE_RELEASE'"

echo "release ok  http://$HOST:18999/"
