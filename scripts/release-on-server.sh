#!/usr/bin/env bash
# Compatibility wrapper for the older two-argument on-box release helper.
# Prefer scripts/deploy-on-server.sh.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ON_SERVER="$SCRIPT_DIR/deploy-on-server.sh"

if [[ $# -ge 2 && "$1" != -* && "$2" != -* ]]; then
  exec bash "$ON_SERVER" --dist "$1" --backend "$2" "${@:3}"
fi

exec bash "$ON_SERVER" "$@"
