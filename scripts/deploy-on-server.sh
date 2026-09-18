#!/usr/bin/env bash
# Publish MangaCanvas ON the ECS host as ecs-user.
# Used by GitHub Actions (self-hosted runner) and by scripts/deploy.sh over SSH.
# Never overwrite /opt/mangacanvas/backend/.env (database and API keys stay on the host).
#
# Usage:
#   scripts/deploy-on-server.sh RELEASE_DIR
#   scripts/deploy-on-server.sh --dist DIR --backend DIR [--nginx FILE] [--spa-helper FILE]
#
# RELEASE_DIR layout:
#   dist/index.html
#   backend/app/
#   backend/requirements.txt
#   deploy/nginx/mangacanvas.conf
#   scripts/ensure-nginx-spa.py
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WEB_ROOT="${MANGACANVAS_WEB_ROOT:-/var/www/mangacanvas}"
APP_ROOT="${MANGACANVAS_APP_ROOT:-/opt/mangacanvas/backend}"
NGINX_CONF="${MANGACANVAS_NGINX_CONF:-/etc/nginx/conf.d/mangacanvas.conf}"
HEALTH_URL="${MANGACANVAS_HEALTH_URL:-http://127.0.0.1:18999/api/v1/health}"
SPA_URL="${MANGACANVAS_SPA_URL:-http://127.0.0.1:18999/project/6/scenes}"
OWNER="${MANGACANVAS_OWNER:-${USER:-ecs-user}}"

RELEASE_DIR=""
DIST_SRC=""
BACKEND_SRC=""
NGINX_TEMPLATE=""
SPA_HELPER=""

usage() {
  cat <<'EOF'
Usage:
  scripts/deploy-on-server.sh RELEASE_DIR
  scripts/deploy-on-server.sh --dist DIR --backend DIR [--nginx FILE] [--spa-helper FILE]
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dist)
      DIST_SRC="${2:?}"
      shift 2
      ;;
    --backend)
      BACKEND_SRC="${2:?}"
      shift 2
      ;;
    --nginx)
      NGINX_TEMPLATE="${2:?}"
      shift 2
      ;;
    --spa-helper)
      SPA_HELPER="${2:?}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --)
      shift
      break
      ;;
    -*)
      echo "unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
    *)
      if [[ -n "$RELEASE_DIR" ]]; then
        echo "unexpected argument: $1" >&2
        usage >&2
        exit 1
      fi
      RELEASE_DIR="$1"
      shift
      ;;
  esac
done

if [[ -n "$RELEASE_DIR" ]]; then
  DIST_SRC="${DIST_SRC:-$RELEASE_DIR/dist}"
  BACKEND_SRC="${BACKEND_SRC:-$RELEASE_DIR/backend}"
  NGINX_TEMPLATE="${NGINX_TEMPLATE:-$RELEASE_DIR/deploy/nginx/mangacanvas.conf}"
  SPA_HELPER="${SPA_HELPER:-$RELEASE_DIR/scripts/ensure-nginx-spa.py}"
fi

SPA_HELPER="${SPA_HELPER:-$SCRIPT_DIR/ensure-nginx-spa.py}"

if [[ -z "$DIST_SRC" || -z "$BACKEND_SRC" ]]; then
  echo "need RELEASE_DIR or --dist and --backend" >&2
  usage >&2
  exit 1
fi

if [[ -z "$WEB_ROOT" || "$WEB_ROOT" == "/" || -z "$APP_ROOT" || "$APP_ROOT" == "/" ]]; then
  echo "refusing unsafe WEB_ROOT or APP_ROOT" >&2
  exit 1
fi

if [[ ! -f "$DIST_SRC/index.html" ]]; then
  echo "missing frontend build at $DIST_SRC/index.html" >&2
  exit 1
fi
if [[ ! -d "$BACKEND_SRC/app" || ! -f "$BACKEND_SRC/requirements.txt" ]]; then
  echo "missing backend payload under $BACKEND_SRC" >&2
  exit 1
fi
if [[ ! -f "$BACKEND_SRC/app/main.py" ]]; then
  echo "missing $BACKEND_SRC/app/main.py" >&2
  exit 1
fi
if [[ -e "$BACKEND_SRC/.env" || -e "$BACKEND_SRC/app/.env" ]]; then
  echo "payload contains .env; refusing to continue" >&2
  exit 1
fi
if [[ ! -d "$APP_ROOT" ]]; then
  echo "missing $APP_ROOT" >&2
  exit 1
fi
if [[ ! -x "$APP_ROOT/.venv/bin/pip" ]]; then
  echo "missing $APP_ROOT/.venv/bin/pip" >&2
  exit 1
fi
if [[ ! -f "$SPA_HELPER" ]]; then
  echo "missing nginx SPA helper: $SPA_HELPER" >&2
  exit 1
fi

env_stat_before=""
if [[ -f "$APP_ROOT/.env" ]]; then
  env_stat_before="$(stat -c '%i %s %Y' "$APP_ROOT/.env" 2>/dev/null || stat -f '%i %z %m' "$APP_ROOT/.env")"
fi

echo "==> install frontend -> $WEB_ROOT"
sudo mkdir -p "$WEB_ROOT"
sudo find "$WEB_ROOT" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
sudo cp -a "$DIST_SRC"/. "$WEB_ROOT"/
sudo chown -R "$OWNER:$OWNER" "$WEB_ROOT"

echo "==> sync backend -> $APP_ROOT (preserving .env)"
cp -a "$BACKEND_SRC/app/." "$APP_ROOT/app/"
cp "$BACKEND_SRC/requirements.txt" "$APP_ROOT/requirements.txt"

if [[ -e "$APP_ROOT/.env" && -n "$env_stat_before" ]]; then
  env_stat_after="$(stat -c '%i %s %Y' "$APP_ROOT/.env" 2>/dev/null || stat -f '%i %z %m' "$APP_ROOT/.env")"
  if [[ "$env_stat_before" != "$env_stat_after" ]]; then
    echo "$APP_ROOT/.env changed during sync; aborting" >&2
    exit 1
  fi
fi

echo "==> install Python deps"
# shellcheck disable=SC2164
cd "$APP_ROOT"
.venv/bin/pip install -r requirements.txt -q

echo "==> apply nginx SPA config"
if [[ ! -f "$NGINX_CONF" ]]; then
  if [[ -n "$NGINX_TEMPLATE" && -f "$NGINX_TEMPLATE" ]]; then
    sudo cp "$NGINX_TEMPLATE" "$NGINX_CONF"
  else
    echo "missing $NGINX_CONF" >&2
    exit 1
  fi
fi
sudo sed -i 's/proxy_read_timeout [0-9]\+s;/proxy_read_timeout 600s;/' "$NGINX_CONF"
sudo python3 "$SPA_HELPER" "$NGINX_CONF"

echo "==> restart services"
sudo systemctl restart mangacanvas
sudo nginx -t
sudo systemctl reload nginx

echo "==> health check $HEALTH_URL"
ok=0
for _ in 1 2 3 4 5 6 7 8 9 10 11 12 15; do
  if body="$(curl -fsS --max-time 5 "$HEALTH_URL" 2>/dev/null)"; then
    printf '%s\n' "$body"
    if grep -q '"status"[[:space:]]*:[[:space:]]*"ok"' <<<"$body" || grep -q '"code"[[:space:]]*:[[:space:]]*0' <<<"$body"; then
      ok=1
      break
    fi
  fi
  sleep 1
done

if [[ "$ok" -ne 1 ]]; then
  echo "health check failed; last service logs:" >&2
  sudo journalctl -u mangacanvas -n 40 --no-pager >&2 || true
  exit 1
fi

echo "==> spa deep-link check $SPA_URL"
spa_ok=0
html="$(curl -fsS --max-time 8 "$SPA_URL" 2>/dev/null || true)"
if [[ -n "$html" ]] && grep -qi '<html' <<<"$html" && grep -q 'src="/assets/' <<<"$html"; then
  echo "deep link OK  $SPA_URL"
  spa_ok=1
fi
if [[ "$spa_ok" -ne 1 ]]; then
  alt_url="http://127.0.0.1/project/6/scenes"
  html="$(curl -fsS --max-time 8 "$alt_url" 2>/dev/null || true)"
  if [[ -n "$html" ]] && grep -qi '<html' <<<"$html" && grep -q 'src="/assets/' <<<"$html"; then
    echo "deep link OK  $alt_url"
    spa_ok=1
  fi
fi
if [[ "$spa_ok" -ne 1 ]]; then
  echo "deep-link check failed (index.html must reference /assets/..., not ./assets/...)" >&2
  exit 1
fi

echo "release ok  $HEALTH_URL"
