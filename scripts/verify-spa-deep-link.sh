#!/usr/bin/env bash
# Build (if needed) and prove history deep links load absolute /assets JS.
#   npm run build && bash scripts/verify-spa-deep-link.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f dist/index.html ]]; then
  npm run build
fi

node "$ROOT/scripts/check-spa-assets.mjs"

PORT="${SPA_VERIFY_PORT:-4179}"
npx vite preview --host 127.0.0.1 --port "$PORT" --strictPort >/tmp/mangacanvas-preview.log 2>&1 &
PID=$!
cleanup() {
  kill "$PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT

ok=0
for _ in $(seq 1 50); do
  if curl -fsS "http://127.0.0.1:$PORT/" >/dev/null; then
    ok=1
    break
  fi
  sleep 0.2
done

if [[ "$ok" -ne 1 ]]; then
  echo "vite preview failed to start; log:" >&2
  cat /tmp/mangacanvas-preview.log >&2
  exit 1
fi

html="$(curl -fsS "http://127.0.0.1:$PORT/project/6/scenes")"
if ! grep -q 'src="/assets/' <<<"$html"; then
  echo "deep link /project/6/scenes did not reference /assets/*" >&2
  echo "$html" >&2
  exit 1
fi

if grep -q 'src="./assets/' <<<"$html"; then
  echo "deep link HTML still has relative ./assets/ URLs" >&2
  exit 1
fi

js_path="$(printf '%s' "$html" | sed -n 's/.*src="\(\/assets\/[^"]*index-[^"]*\.js\)".*/\1/p' | head -n 1)"
if [[ -z "$js_path" ]]; then
  echo "could not parse entry JS from deep-link HTML" >&2
  exit 1
fi

headers="$(curl -fsS -D - -o /tmp/mangacanvas-entry.js "http://127.0.0.1:$PORT$js_path")"
ctype="$(printf '%s' "$headers" | awk 'tolower($1)=="content-type:"{print $2; exit}')"
if ! grep -qi 'javascript' <<<"$ctype"; then
  echo "GET $js_path returned Content-Type=$ctype (expected JavaScript)" >&2
  echo "$headers" >&2
  exit 1
fi

wrong_headers="$(curl -sS -D - -o /tmp/mangacanvas-wrong.js "http://127.0.0.1:$PORT/project/6$js_path" || true)"
wrong_ctype="$(printf '%s' "$wrong_headers" | awk 'tolower($1)=="content-type:"{print $2; exit}')"
if grep -qi 'javascript' <<<"$wrong_ctype"; then
  echo "unexpected: /project/6$js_path served JavaScript" >&2
  exit 1
fi

echo "SPA deep-link verify OK"
echo "  /project/6/scenes -> $js_path ($ctype)"
