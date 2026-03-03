#!/bin/bash
# collect-on-session-end.sh
#
# Executed by the Claude Code SessionEnd hook.
# Reads the hook event JSON from stdin, parses the session transcript, and
# forwards the data to the dashboard API.
#
# Environment variables:
#   DASHBOARD_URL         Dashboard base URL (default: http://localhost:3000)
#   DASHBOARD_API_KEY     API key for the dashboard (optional, but recommended)
#   COLLECT_FILTER_DIRS   Colon-separated list of directories to include
#                         (all directories included when unset)
#   COLLECT_EXCLUDE_DIRS  Colon-separated list of directories to exclude

# ---------------------------------------------------------------------------
# PATH — ensure node / npx / pnpm are discoverable even from a hook context
# ---------------------------------------------------------------------------
export PATH="/Users/maemuraeisuke/.nvm/versions/node/v22.22.0/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
DASHBOARD_URL="${DASHBOARD_URL:-http://localhost:3000}"
DASHBOARD_API_KEY="${DASHBOARD_API_KEY:-}"
USER_ID="${USER:-local-user}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

LOG_FILE="${HOME}/.claude/collector.log"
MAX_LOG_LINES=2000

# ---------------------------------------------------------------------------
# Logging helpers
# Never writes to stdout/stderr so Claude Code's hook runner is not disturbed.
# ---------------------------------------------------------------------------
log() {
  local level="$1"
  shift
  local message="$*"
  local ts
  ts="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  printf '[%s] [%-5s] %s\n' "${ts}" "${level}" "${message}" >> "${LOG_FILE}" 2>/dev/null || true
}

log_info()  { log "INFO"  "$@"; }
log_warn()  { log "WARN"  "$@"; }
log_error() { log "ERROR" "$@"; }

# Rotate the log file when it grows beyond MAX_LOG_LINES
trim_log() {
  if [[ -f "${LOG_FILE}" ]]; then
    local line_count
    line_count=$(wc -l < "${LOG_FILE}" 2>/dev/null || echo 0)
    if [[ "${line_count}" -gt "${MAX_LOG_LINES}" ]]; then
      local tmp="${LOG_FILE}.tmp.$$"
      tail -n "${MAX_LOG_LINES}" "${LOG_FILE}" > "${tmp}" 2>/dev/null && \
        mv "${tmp}" "${LOG_FILE}" 2>/dev/null || true
    fi
  fi
}

# ---------------------------------------------------------------------------
# Ensure the log directory exists
# ---------------------------------------------------------------------------
mkdir -p "$(dirname "${LOG_FILE}")" 2>/dev/null || true

log_info "--- collect-on-session-end started ---"

# ---------------------------------------------------------------------------
# Read hook event JSON from stdin (with a generous timeout)
# ---------------------------------------------------------------------------
HOOK_EVENT=""
if IFS= read -r -t 10 FIRST_LINE 2>/dev/null; then
  HOOK_EVENT="${FIRST_LINE}"
  # Accumulate additional lines (multi-line JSON payloads)
  while IFS= read -r -t 2 line 2>/dev/null; do
    HOOK_EVENT="${HOOK_EVENT}
${line}"
  done
fi

if [[ -z "${HOOK_EVENT}" ]]; then
  log_warn "No hook event received from stdin — exiting"
  trim_log
  exit 0
fi

log_info "Raw hook event (first 300 chars): ${HOOK_EVENT:0:300}"

# ---------------------------------------------------------------------------
# Dependency check
# ---------------------------------------------------------------------------
if ! command -v jq &>/dev/null; then
  log_error "jq not found — cannot parse hook event"
  trim_log
  exit 0
fi

# ---------------------------------------------------------------------------
# Validate that the input is parseable JSON
# ---------------------------------------------------------------------------
if ! echo "${HOOK_EVENT}" | jq . &>/dev/null; then
  log_error "Hook event is not valid JSON: ${HOOK_EVENT:0:300}"
  trim_log
  exit 0
fi

# ---------------------------------------------------------------------------
# Extract fields from the hook event
# ---------------------------------------------------------------------------
SESSION_ID="$(echo "${HOOK_EVENT}"      | jq -r '.session_id      // empty' 2>/dev/null)"
TRANSCRIPT_PATH="$(echo "${HOOK_EVENT}" | jq -r '.transcript_path // empty' 2>/dev/null)"
CWD="$(echo "${HOOK_EVENT}"             | jq -r '.cwd             // empty' 2>/dev/null)"
HOOK_EVENT_NAME="$(echo "${HOOK_EVENT}" | jq -r '.hook_event_name // empty' 2>/dev/null)"

if [[ -z "${SESSION_ID}" ]]; then
  log_warn "session_id missing from hook event: ${HOOK_EVENT:0:200}"
  trim_log
  exit 0
fi

log_info "SessionEnd received: session_id=${SESSION_ID} hook=${HOOK_EVENT_NAME} cwd=${CWD}"

# ---------------------------------------------------------------------------
# Directory filtering
# ---------------------------------------------------------------------------

# Include filter: if set, cwd must start with one of the listed directories
if [[ -n "${COLLECT_FILTER_DIRS:-}" ]] && [[ -n "${CWD}" ]]; then
  IFS=':' read -ra FILTER_DIRS <<< "${COLLECT_FILTER_DIRS}"
  MATCHED=false
  for dir in "${FILTER_DIRS[@]}"; do
    if [[ "${CWD}" == "${dir}"* ]]; then
      MATCHED=true
      break
    fi
  done
  if [[ "${MATCHED}" == "false" ]]; then
    log_info "Skipped (not in COLLECT_FILTER_DIRS): cwd=${CWD}"
    trim_log
    exit 0
  fi
fi

# Exclude filter: skip if cwd starts with any excluded directory
if [[ -n "${COLLECT_EXCLUDE_DIRS:-}" ]] && [[ -n "${CWD}" ]]; then
  IFS=':' read -ra EXCLUDE_DIRS <<< "${COLLECT_EXCLUDE_DIRS}"
  for dir in "${EXCLUDE_DIRS[@]}"; do
    if [[ "${CWD}" == "${dir}"* ]]; then
      log_info "Skipped (in COLLECT_EXCLUDE_DIRS): cwd=${CWD}"
      trim_log
      exit 0
    fi
  done
fi

# ---------------------------------------------------------------------------
# Helper: send a JSON payload to the dashboard
# ---------------------------------------------------------------------------
send_to_dashboard() {
  local endpoint="$1"
  local payload="$2"

  local url="${DASHBOARD_URL}/api/v1/ingest/${endpoint}"

  local http_code
  http_code=$(
    curl -s -o /dev/null -w "%{http_code}" \
      -X POST \
      -H "Content-Type: application/json" \
      -H "X-API-Key: ${DASHBOARD_API_KEY}" \
      --max-time 15 \
      --data "${payload}" \
      "${url}" \
    2>/dev/null || echo "0"
  )

  log_info "POST ${endpoint} => HTTP ${http_code}"
  echo "${http_code}"
}

# ---------------------------------------------------------------------------
# Primary path: parse transcript with tsx if available
# ---------------------------------------------------------------------------
PARSE_SUCCESS=false

if [[ -n "${TRANSCRIPT_PATH}" ]] && [[ -f "${TRANSCRIPT_PATH}" ]]; then
  log_info "Transcript found: ${TRANSCRIPT_PATH}"

  TSX_BIN=""
  if command -v tsx &>/dev/null; then
    TSX_BIN="tsx"
  elif command -v npx &>/dev/null; then
    TSX_BIN="npx tsx"
  fi

  PARSE_SCRIPT="${PROJECT_ROOT}/scripts/parse-and-send.ts"

  if [[ -n "${TSX_BIN}" ]] && [[ -f "${PARSE_SCRIPT}" ]]; then
    log_info "Running parse-and-send.ts with ${TSX_BIN}"

    PARSE_OUTPUT=$(
      cd "${PROJECT_ROOT}" && \
      ${TSX_BIN} "${PARSE_SCRIPT}" \
        --session-id    "${SESSION_ID}" \
        --transcript-path "${TRANSCRIPT_PATH}" \
        --user-id       "${USER_ID}" \
        --cwd           "${CWD}" \
        --dashboard-url "${DASHBOARD_URL}" \
        --api-key       "${DASHBOARD_API_KEY}" \
      2>> "${LOG_FILE}" || true
    )

    if [[ -n "${PARSE_OUTPUT}" ]]; then
      log_info "parse-and-send output: ${PARSE_OUTPUT:0:300}"
      PARSE_SUCCESS=true
    else
      log_warn "parse-and-send.ts produced no output"
    fi
  else
    log_warn "tsx not found or parse script missing — falling back to metadata extraction"
  fi
else
  log_warn "Transcript not available: path='${TRANSCRIPT_PATH}'"
fi

# ---------------------------------------------------------------------------
# Fallback: extract basic metadata from the transcript file directly,
# then send a minimal session payload.
# ---------------------------------------------------------------------------
if [[ "${PARSE_SUCCESS}" == "false" ]]; then
  log_info "Using fallback metadata extraction"

  NOW_ISO="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  PROJECT_NAME="$(basename "${CWD:-unknown}")"
  GIT_BRANCH=""
  MESSAGE_COUNT=0
  TOOL_CALL_COUNT=0
  STARTED_AT="${NOW_ISO}"
  ENDED_AT="${NOW_ISO}"

  # --- Extract metadata from the transcript JSONL if readable ---
  if [[ -n "${TRANSCRIPT_PATH}" ]] && [[ -f "${TRANSCRIPT_PATH}" ]]; then
    log_info "Parsing transcript for metadata: ${TRANSCRIPT_PATH}"

    # Count assistant messages
    MESSAGE_COUNT=$(grep -c '"role":"assistant"' "${TRANSCRIPT_PATH}" 2>/dev/null || echo 0)

    # Count tool_use entries (tool calls made by the assistant)
    TOOL_CALL_COUNT=$(grep -c '"type":"tool_use"' "${TRANSCRIPT_PATH}" 2>/dev/null || echo 0)

    # Try to get git branch from project path context
    if [[ -n "${CWD}" ]] && command -v git &>/dev/null; then
      GIT_BRANCH="$(git -C "${CWD}" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
    fi

    # Attempt to read first-line timestamp (transcript lines have a "ts" field)
    FIRST_LINE_TS="$(head -n 1 "${TRANSCRIPT_PATH}" 2>/dev/null | jq -r '.timestamp // .ts // empty' 2>/dev/null || true)"
    if [[ -n "${FIRST_LINE_TS}" ]]; then
      STARTED_AT="${FIRST_LINE_TS}"
    fi

    # Last-line timestamp for session end
    LAST_LINE_TS="$(tail -n 1 "${TRANSCRIPT_PATH}" 2>/dev/null | jq -r '.timestamp // .ts // empty' 2>/dev/null || true)"
    if [[ -n "${LAST_LINE_TS}" ]]; then
      ENDED_AT="${LAST_LINE_TS}"
    fi

    log_info "Extracted: messages=${MESSAGE_COUNT} tools=${TOOL_CALL_COUNT} branch=${GIT_BRANCH}"
    log_info "Extracted: started=${STARTED_AT} ended=${ENDED_AT}"
  fi

  # Build the minimal session payload
  PAYLOAD=$(jq -n \
    --arg sessionId    "${SESSION_ID}" \
    --arg userId       "${USER_ID}" \
    --arg projectPath  "${CWD:-unknown}" \
    --arg projectName  "${PROJECT_NAME}" \
    --arg gitBranch    "${GIT_BRANCH}" \
    --arg startedAt    "${STARTED_AT}" \
    --arg endedAt      "${ENDED_AT}" \
    --argjson msgCount "${MESSAGE_COUNT}" \
    --argjson toolCount "${TOOL_CALL_COUNT}" \
    '{
      session: {
        sessionId:    $sessionId,
        userId:       $userId,
        projectPath:  $projectPath,
        projectName:  $projectName,
        gitBranch:    (if $gitBranch == "" then null else $gitBranch end),
        startedAt:    $startedAt,
        endedAt:      $endedAt,
        messageCount: $msgCount,
        toolCallCount: $toolCount
      },
      events:          [],
      tokenUsageEvents: []
    }' 2>/dev/null)

  if [[ -n "${PAYLOAD}" ]]; then
    HTTP_CODE="$(send_to_dashboard "session" "${PAYLOAD}")"
    if [[ "${HTTP_CODE}" == "200" ]]; then
      log_info "Fallback session sent successfully: session_id=${SESSION_ID}"
    else
      log_error "Fallback session send failed (HTTP ${HTTP_CODE}): session_id=${SESSION_ID}"
    fi
  else
    log_error "Failed to build fallback payload for session_id=${SESSION_ID}"
  fi
fi

# ---------------------------------------------------------------------------
# Cleanup and exit (always exit 0 — never block Claude Code)
# ---------------------------------------------------------------------------
log_info "--- collect-on-session-end finished ---"
trim_log
exit 0
