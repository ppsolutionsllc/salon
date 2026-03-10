#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-$(cd "${SCRIPT_DIR}/.." && pwd)}"

# shellcheck disable=SC1091
source "${SCRIPT_DIR}/deploy_lib.sh"

TARGET_REF_ARG=""
USE_PREVIOUS="true"
RUN_MIGRATIONS="false"
REASON="manual"
ACTOR="${DEPLOY_ACTOR:-${GITHUB_ACTOR:-${USER:-unknown}}}"
FAILED_CMD=""

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Options:
  --to <ref>             Rollback to specific branch/tag/commit
  --previous             Rollback to PREVIOUS_REF from state (default)
  --no-migrations        Do not run migrations during rollback (default)
  --with-migrations      Run alembic upgrade head after rollback
  --reason <text>        Reason for rollback logging
  --help                 Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --to)
      TARGET_REF_ARG="${2:-}"
      USE_PREVIOUS="false"
      shift 2
      ;;
    --previous)
      USE_PREVIOUS="true"
      shift
      ;;
    --no-migrations)
      RUN_MIGRATIONS="false"
      shift
      ;;
    --with-migrations)
      RUN_MIGRATIONS="true"
      shift
      ;;
    --reason)
      REASON="${2:-manual}"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

trap 'FAILED_CMD=${BASH_COMMAND}' ERR

run_rollback() {
  local target_ref resolved_ref old_head new_head

  log "Starting rollback"
  cd "${APP_DIR}"

  require_cmd git
  require_cmd docker

  if [[ ! -d .git ]]; then
    echo "${APP_DIR} is not a git repository" >&2
    return 1
  fi

  source_env_file
  setup_compose_files
  print_compose_context
  ensure_dirs
  load_state

  if [[ -n "${TARGET_REF_ARG}" ]]; then
    target_ref="${TARGET_REF_ARG}"
  elif [[ "${USE_PREVIOUS}" == "true" ]]; then
    target_ref="${PREVIOUS_REF:-}"
  else
    target_ref="${PREVIOUS_REF:-}"
  fi

  if [[ -z "${target_ref}" ]]; then
    echo "No rollback target available (PREVIOUS_REF is empty)" >&2
    return 1
  fi

  old_head="$(git rev-parse HEAD)"

  log "Fetching repository"
  git fetch --all --prune --tags

  resolved_ref="$(resolve_ref "${target_ref}" || true)"
  if [[ -z "${resolved_ref}" ]]; then
    echo "Unable to resolve rollback ref: ${target_ref}" >&2
    return 1
  fi

  LAST_ACTION="rollback"
  LAST_ACTOR="${ACTOR}"
  LAST_STATUS="IN_PROGRESS"
  LAST_ERROR=""
  LAST_DEPLOY_AT="$(now_utc)"
  save_state

  log "Checking out ${resolved_ref}"
  git reset --hard "${resolved_ref}"

  log "Building and starting services"
  dc up -d --build

  if [[ "${RUN_MIGRATIONS}" == "true" ]]; then
    log "Running alembic migrations (explicit --with-migrations)"
    dc run --rm api alembic upgrade head
  else
    log "Skipping DB migrations during rollback (default)"
  fi

  wait_for_services_ready 80 2
  run_healthchecks

  new_head="$(git rev-parse HEAD)"
  CURRENT_REF="${new_head}"
  PREVIOUS_REF="${old_head}"
  LAST_ACTION="rollback"
  LAST_ACTOR="${ACTOR}"
  LAST_STATUS="ROLLBACK_SUCCESS"
  LAST_ERROR=""
  LAST_DEPLOY_AT="$(now_utc)"
  save_state

  append_release_log "rollback" "${new_head}" "${ACTOR}" "SUCCESS" "reason=${REASON}"
  log "Rollback finished successfully: ${new_head}"
}

if run_rollback; then
  exit 0
fi

ERROR_MSG="rollback failed"
if [[ -n "${FAILED_CMD}" ]]; then
  ERROR_MSG="rollback failed at: ${FAILED_CMD}"
fi

cd "${APP_DIR}" || true
load_state
CURRENT_REF="$(git rev-parse HEAD 2>/dev/null || echo "")"
LAST_ACTION="rollback"
LAST_ACTOR="${ACTOR}"
LAST_STATUS="ROLLBACK_FAIL"
LAST_ERROR="${ERROR_MSG}"
LAST_DEPLOY_AT="$(now_utc)"
save_state
append_release_log "rollback" "${TARGET_REF_ARG:-${PREVIOUS_REF:-unknown}}" "${ACTOR}" "FAIL" "${ERROR_MSG}; reason=${REASON}"

exit 1
