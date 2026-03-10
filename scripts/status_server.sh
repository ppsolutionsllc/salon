#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-$(cd "${SCRIPT_DIR}/.." && pwd)}"

# shellcheck disable=SC1091
source "${SCRIPT_DIR}/deploy_lib.sh"

cd "${APP_DIR}"

source_env_file
setup_compose_files
ensure_dirs
load_state

echo "=== DEPLOY STATE ==="
echo "APP_DIR=${APP_DIR}"
echo "ENVIRONMENT=${ENVIRONMENT}"
echo "CURRENT_REF=${CURRENT_REF:-}"
echo "PREVIOUS_REF=${PREVIOUS_REF:-}"
echo "LAST_DEPLOY_AT=${LAST_DEPLOY_AT:-}"
echo "LAST_STATUS=${LAST_STATUS:-}"
echo "LAST_ACTION=${LAST_ACTION:-}"
echo "LAST_ACTOR=${LAST_ACTOR:-}"
echo "LAST_ERROR=${LAST_ERROR:-}"

if [[ -d .git ]]; then
  echo
  echo "=== GIT ==="
  echo "HEAD=$(git rev-parse HEAD 2>/dev/null || true)"
  echo "BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
fi

echo
echo "=== CONTAINERS ==="
dc ps || true

echo
echo "=== CONTAINER IMAGES ==="
dc images || true

echo
echo "=== LAST RELEASE LOG ENTRIES ==="
tail -n 20 "${RELEASES_LOG}" || true
