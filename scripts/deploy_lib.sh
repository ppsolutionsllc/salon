#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-$(pwd)}"
ENVIRONMENT="${ENVIRONMENT:-development}"
DEPLOY_DIR="${APP_DIR}/.deploy"
STATE_FILE="${DEPLOY_DIR}/state.env"
RELEASES_LOG="${DEPLOY_DIR}/releases.log"
BACKUP_DIR="${APP_DIR}/backups"
BACKUP_DB_DIR="${BACKUP_DIR}/db"
BACKUP_UPLOADS_DIR="${BACKUP_DIR}/uploads"
DB_BACKUP_KEEP="${DB_BACKUP_KEEP:-20}"
UPLOADS_BACKUP_KEEP="${UPLOADS_BACKUP_KEEP:-10}"
HEALTHCHECK_PORT="${HEALTHCHECK_PORT:-8080}"
HEALTHCHECK_RETRIES="${HEALTHCHECK_RETRIES:-30}"
HEALTHCHECK_DELAY="${HEALTHCHECK_DELAY:-2}"

COMPOSE_FILES=( -f docker-compose.yml )

CURRENT_REF=""
PREVIOUS_REF=""
LAST_DEPLOY_AT=""
LAST_STATUS=""
LAST_ERROR=""
LAST_ACTION=""
LAST_ACTOR=""

now_utc() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

log() {
  echo "[$(date +"%Y-%m-%d %H:%M:%S")] $*"
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Required command not found: $cmd" >&2
    return 1
  fi
}

source_env_file() {
  if [[ -f "${APP_DIR}/.env" ]]; then
    while IFS= read -r line || [[ -n "$line" ]]; do
      line="${line%$'\r'}"
      [[ -z "${line}" ]] && continue
      [[ "${line:0:1}" == "#" ]] && continue
      [[ "${line}" != *=* ]] && continue

      local key value
      key="${line%%=*}"
      value="${line#*=}"

      key="$(printf '%s' "${key}" | xargs)"
      value="$(printf '%s' "${value}" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"

      # Strip one pair of surrounding quotes if present.
      if [[ "${value}" =~ ^\".*\"$ ]] || [[ "${value}" =~ ^\'.*\'$ ]]; then
        value="${value:1:${#value}-2}"
      fi

      export "${key}=${value}"
    done < "${APP_DIR}/.env"
  fi
}

setup_compose_files() {
  COMPOSE_FILES=( -f docker-compose.yml )
  if [[ "${ENVIRONMENT}" == "production" && -f "${APP_DIR}/docker-compose.prod.yml" ]]; then
    COMPOSE_FILES+=( -f docker-compose.prod.yml )
  fi
}

dc() {
  docker compose "${COMPOSE_FILES[@]}" "$@"
}

ensure_dirs() {
  mkdir -p "${DEPLOY_DIR}" "${BACKUP_DB_DIR}" "${BACKUP_UPLOADS_DIR}"
  touch "${RELEASES_LOG}"
}

load_state() {
  CURRENT_REF=""
  PREVIOUS_REF=""
  LAST_DEPLOY_AT=""
  LAST_STATUS=""
  LAST_ERROR=""
  LAST_ACTION=""
  LAST_ACTOR=""

  if [[ -f "${STATE_FILE}" ]]; then
    # shellcheck disable=SC1090
    source "${STATE_FILE}"
  fi
}

save_state() {
  {
    printf 'CURRENT_REF=%q\n' "${CURRENT_REF:-}"
    printf 'PREVIOUS_REF=%q\n' "${PREVIOUS_REF:-}"
    printf 'LAST_DEPLOY_AT=%q\n' "${LAST_DEPLOY_AT:-}"
    printf 'LAST_STATUS=%q\n' "${LAST_STATUS:-}"
    printf 'LAST_ERROR=%q\n' "${LAST_ERROR:-}"
    printf 'LAST_ACTION=%q\n' "${LAST_ACTION:-}"
    printf 'LAST_ACTOR=%q\n' "${LAST_ACTOR:-}"
  } > "${STATE_FILE}"
}

append_release_log() {
  local action="$1"
  local ref="$2"
  local actor="$3"
  local status="$4"
  local message="$5"

  printf '%s\taction=%s\tref=%s\tactor=%s\tstatus=%s\tmessage=%s\n' \
    "$(now_utc)" "$action" "$ref" "$actor" "$status" "$message" >> "${RELEASES_LOG}"
}

resolve_ref() {
  local input_ref="$1"

  if [[ -z "${input_ref}" ]]; then
    echo ""
    return 1
  fi

  if git show-ref --verify --quiet "refs/remotes/origin/${input_ref}"; then
    echo "origin/${input_ref}"
    return 0
  fi

  if git show-ref --verify --quiet "refs/tags/${input_ref}"; then
    echo "${input_ref}"
    return 0
  fi

  if git cat-file -e "${input_ref}^{commit}" 2>/dev/null; then
    echo "${input_ref}"
    return 0
  fi

  return 1
}

backup_db() {
  local ts file pg_user pg_db
  ts="$(date +"%Y%m%d_%H%M%S")"
  file="${BACKUP_DB_DIR}/${ts}.sql.gz"
  pg_user="${POSTGRES_USER:-postgres}"
  pg_db="${POSTGRES_DB:-salon_db}"

  log "Creating DB backup: ${file}"
  dc exec -T db sh -c "pg_dump -U \"${pg_user}\" \"${pg_db}\"" | gzip -9 > "${file}"

  cleanup_backups "${BACKUP_DB_DIR}" "*.sql.gz" "${DB_BACKUP_KEEP}"
}

backup_uploads() {
  local ts file
  ts="$(date +"%Y%m%d_%H%M%S")"
  file="${BACKUP_UPLOADS_DIR}/${ts}.tar.gz"

  if [[ ! -d "${APP_DIR}/uploads" ]]; then
    log "Uploads dir not found, skipping uploads backup"
    return 0
  fi

  log "Creating uploads backup: ${file}"
  tar -czf "${file}" -C "${APP_DIR}" uploads
  cleanup_backups "${BACKUP_UPLOADS_DIR}" "*.tar.gz" "${UPLOADS_BACKUP_KEEP}"
}

cleanup_backups() {
  local dir="$1"
  local pattern="$2"
  local keep="$3"
  local files=()

  shopt -s nullglob
  files=("${dir}"/${pattern})
  shopt -u nullglob

  if (( ${#files[@]} <= keep )); then
    return 0
  fi

  IFS=$'\n' read -r -d '' -a sorted < <(ls -1t "${files[@]}" && printf '\0')
  for ((i=keep; i<${#sorted[@]}; i++)); do
    rm -f "${sorted[$i]}"
  done
}

container_status() {
  local container_id="$1"
  docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${container_id}"
}

wait_for_services_ready() {
  local retries="${1:-60}"
  local delay="${2:-2}"
  local services=(db redis api web worker)
  local attempt status id all_ok

  if [[ "${ENVIRONMENT}" != "production" ]]; then
    services+=(nginx)
  fi

  for ((attempt=1; attempt<=retries; attempt++)); do
    all_ok=1

    for svc in "${services[@]}"; do
      id="$(dc ps -q "${svc}" 2>/dev/null || true)"
      if [[ -z "${id}" ]]; then
        all_ok=0
        continue
      fi

      status="$(container_status "${id}")"
      if [[ "${status}" != "healthy" && "${status}" != "running" ]]; then
        all_ok=0
      fi
    done

    if (( all_ok == 1 )); then
      log "All services are ready"
      return 0
    fi

    sleep "${delay}"
  done

  dc ps || true
  return 1
}

http_ok() {
  local url="$1"

  if command -v curl >/dev/null 2>&1; then
    curl -fsS --max-time 8 "${url}" >/dev/null
    return $?
  fi

  if command -v wget >/dev/null 2>&1; then
    wget -qO- --timeout=8 "${url}" >/dev/null
    return $?
  fi

  python3 - "${url}" <<'PY'
import sys
import urllib.request
url = sys.argv[1]
try:
    with urllib.request.urlopen(url, timeout=8) as resp:
        raise SystemExit(0 if 200 <= resp.getcode() < 400 else 1)
except Exception:
    raise SystemExit(1)
PY
}

wait_http_ok() {
  local url="$1"
  local retries="$2"
  local delay="$3"
  local i

  for ((i=1; i<=retries; i++)); do
    if http_ok "${url}"; then
      return 0
    fi
    sleep "${delay}"
  done

  return 1
}

run_healthchecks() {
  local base="http://localhost:${HEALTHCHECK_PORT}"

  log "Healthcheck API: ${base}/api/v1/health"
  wait_http_ok "${base}/api/v1/health" "${HEALTHCHECK_RETRIES}" "${HEALTHCHECK_DELAY}"

  log "Smoke check web login: ${base}/login"
  wait_http_ok "${base}/login" "${HEALTHCHECK_RETRIES}" "${HEALTHCHECK_DELAY}"

  log "Smoke check CRM login: ${base}/crm/login"
  wait_http_ok "${base}/crm/login" "${HEALTHCHECK_RETRIES}" "${HEALTHCHECK_DELAY}"
}

print_compose_context() {
  log "Compose files: ${COMPOSE_FILES[*]}"
  log "Environment: ${ENVIRONMENT}"
}
