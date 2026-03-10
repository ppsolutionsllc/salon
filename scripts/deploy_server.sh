#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-$(cd "${SCRIPT_DIR}/.." && pwd)}"

# shellcheck disable=SC1091
source "${SCRIPT_DIR}/deploy_lib.sh"

TARGET_REF_ARG=""
BACKUP_UPLOADS="${BACKUP_UPLOADS:-false}"
SKIP_MIGRATIONS="false"
ACTOR="${DEPLOY_ACTOR:-${GITHUB_ACTOR:-${USER:-unknown}}}"
FAILED_CMD=""

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Options:
  --ref <ref>            Deploy specific branch/tag/commit
  --backup-uploads       Create uploads backup before migrations
  --no-backup-uploads    Disable uploads backup (default)
  --skip-migrations      Do not run alembic upgrade head
  --help                 Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ref)
      TARGET_REF_ARG="${2:-}"
      shift 2
      ;;
    --backup-uploads)
      BACKUP_UPLOADS="true"
      shift
      ;;
    --no-backup-uploads)
      BACKUP_UPLOADS="false"
      shift
      ;;
    --skip-migrations)
      SKIP_MIGRATIONS="true"
      shift
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

run_deploy() {
  local target_ref resolved_ref old_head new_head

  log "Starting deploy"
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

  old_head="$(git rev-parse HEAD)"
  target_ref="${TARGET_REF_ARG:-${FORCE_REF:-${DEPLOY_REF:-${DEPLOY_BRANCH:-main}}}}"

  if [[ -z "${target_ref}" ]]; then
    target_ref="main"
  fi

  log "Fetching repository"
  git fetch --all --prune --tags

  resolved_ref="$(resolve_ref "${target_ref}" || true)"
  if [[ -z "${resolved_ref}" ]]; then
    echo "Unable to resolve ref: ${target_ref}" >&2
    return 1
  fi

  PREVIOUS_REF="${old_head}"
  LAST_ACTION="deploy"
  LAST_ACTOR="${ACTOR}"
  LAST_STATUS="IN_PROGRESS"
  LAST_ERROR=""
  LAST_DEPLOY_AT="$(now_utc)"
  save_state

  log "Checking out ${resolved_ref}"
  git reset --hard "${resolved_ref}"

  log "Building and starting services"
  dc up -d --build

  backup_db
  if [[ "${BACKUP_UPLOADS}" == "true" ]]; then
    backup_uploads
  fi

  if [[ "${SKIP_MIGRATIONS}" != "true" ]]; then
    log "Running alembic migrations"
    dc run --rm api alembic upgrade head
  else
    log "Skipping migrations (--skip-migrations)"
  fi

  wait_for_services_ready 80 2
  run_healthchecks

  new_head="$(git rev-parse HEAD)"
  CURRENT_REF="${new_head}"
  PREVIOUS_REF="${old_head}"
  LAST_ACTION="deploy"
  LAST_ACTOR="${ACTOR}"
  LAST_STATUS="SUCCESS"
  LAST_ERROR=""
  LAST_DEPLOY_AT="$(now_utc)"
  save_state

  append_release_log "deploy" "${new_head}" "${ACTOR}" "SUCCESS" "deploy completed"

  log "Pruning dangling images"
  docker image prune -f >/dev/null 2>&1 || true

  log "Deploy finished successfully: ${new_head}"
}

if run_deploy; then
  exit 0
fi

ERROR_MSG="deploy failed"
if [[ -n "${FAILED_CMD}" ]]; then
  ERROR_MSG="deploy failed at: ${FAILED_CMD}"
fi

cd "${APP_DIR}" || true
load_state
append_release_log "deploy" "${TARGET_REF_ARG:-${FORCE_REF:-${DEPLOY_REF:-${DEPLOY_BRANCH:-main}}}}" "${ACTOR}" "FAIL" "${ERROR_MSG}"

AUTO_ROLLBACK_RESULT="skipped"
if [[ -n "${PREVIOUS_REF:-}" ]]; then
  log "Deploy failed, attempting auto-rollback to ${PREVIOUS_REF}"
  if APP_DIR="${APP_DIR}" ENVIRONMENT="${ENVIRONMENT}" DEPLOY_ACTOR="${ACTOR}" \
    bash "${SCRIPT_DIR}/rollback_server.sh" --to "${PREVIOUS_REF}" --no-migrations --reason "auto_after_failed_deploy"; then
    AUTO_ROLLBACK_RESULT="success"
  else
    AUTO_ROLLBACK_RESULT="failed"
  fi
fi

load_state
CURRENT_REF="$(git rev-parse HEAD 2>/dev/null || echo "${CURRENT_REF:-}")"
LAST_ACTION="deploy"
LAST_ACTOR="${ACTOR}"
LAST_STATUS="FAIL"
LAST_ERROR="${ERROR_MSG}; auto_rollback=${AUTO_ROLLBACK_RESULT}"
LAST_DEPLOY_AT="$(now_utc)"
save_state

exit 1
