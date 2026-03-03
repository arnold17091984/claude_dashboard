#!/bin/bash
# install.sh
#
# Installs the Claude Code SessionEnd hook for the dashboard collector.
# Merges (does not overwrite) existing hooks configuration.
#
# Usage:
#   bash collector/install.sh
#
# Environment variables:
#   DASHBOARD_URL      Dashboard base URL (default: http://localhost:3000)
#   DASHBOARD_API_KEY  API key (auto-generated if not provided)

set -euo pipefail

# ---------------------------------------------------------------------------
# Color output helpers
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

info()    { echo -e "${BLUE}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*" >&2; }
error()   { echo -e "${RED}[ERROR]${RESET} $*" >&2; }
header()  { echo -e "\n${BOLD}${CYAN}==> $*${RESET}"; }

# ---------------------------------------------------------------------------
# Detect OS
# ---------------------------------------------------------------------------
detect_os() {
  case "$(uname -s)" in
    Darwin) echo "macos" ;;
    Linux)  echo "linux" ;;
    *)      echo "unknown" ;;
  esac
}

OS="$(detect_os)"
info "Detected OS: ${OS}"

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
CLAUDE_DIR="${HOME}/.claude"
SETTINGS_FILE="${CLAUDE_DIR}/settings.json"
COLLECTOR_SCRIPT_NAME="collect-on-session-end.sh"

# Resolve this script's directory to an absolute path
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COLLECTOR_SCRIPT="${SCRIPT_DIR}/${COLLECTOR_SCRIPT_NAME}"

# Dashboard env file (written at project root, one level up from collector/)
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_LOCAL="${PROJECT_ROOT}/.env.local"

# ---------------------------------------------------------------------------
# Dependency checks
# ---------------------------------------------------------------------------
header "Checking dependencies"

MISSING_DEPS=()

if ! command -v jq &>/dev/null; then
  MISSING_DEPS+=("jq")
fi

if ! command -v curl &>/dev/null; then
  MISSING_DEPS+=("curl")
fi

if [[ ${#MISSING_DEPS[@]} -gt 0 ]]; then
  error "Missing required tools: ${MISSING_DEPS[*]}"
  if [[ "${OS}" == "macos" ]]; then
    echo "  Install with: brew install ${MISSING_DEPS[*]}"
  else
    echo "  Install with: sudo apt-get install ${MISSING_DEPS[*]}"
  fi
  exit 1
fi

success "All dependencies found (jq, curl)"

# ---------------------------------------------------------------------------
# Dashboard URL
# ---------------------------------------------------------------------------
header "Dashboard URL configuration"

DASHBOARD_URL="${DASHBOARD_URL:-http://localhost:3000}"
info "Dashboard URL: ${DASHBOARD_URL}"

# ---------------------------------------------------------------------------
# API key — generate one if not provided
# ---------------------------------------------------------------------------
header "API key configuration"

if [[ -z "${DASHBOARD_API_KEY:-}" ]]; then
  # Generate a cryptographically random 32-byte hex key
  if command -v openssl &>/dev/null; then
    DASHBOARD_API_KEY="$(openssl rand -hex 32)"
  elif [[ -r /dev/urandom ]]; then
    DASHBOARD_API_KEY="$(head -c 32 /dev/urandom | xxd -p | tr -d '\n')"
  else
    # Fallback: combine multiple sources of entropy
    DASHBOARD_API_KEY="$(date +%s%N 2>/dev/null || date +%s)-${RANDOM}-${RANDOM}-${RANDOM}"
  fi
  warn "No DASHBOARD_API_KEY set — generated a new one:"
  echo -e "  ${BOLD}${DASHBOARD_API_KEY}${RESET}"
else
  success "Using provided DASHBOARD_API_KEY"
fi

# ---------------------------------------------------------------------------
# Collector script existence check
# ---------------------------------------------------------------------------
header "Locating collector script"

if [[ ! -f "${COLLECTOR_SCRIPT}" ]]; then
  error "Collector script not found: ${COLLECTOR_SCRIPT}"
  exit 1
fi

chmod +x "${COLLECTOR_SCRIPT}"
success "Collector script found and made executable: ${COLLECTOR_SCRIPT}"

# ---------------------------------------------------------------------------
# Create ~/.claude directory
# ---------------------------------------------------------------------------
mkdir -p "${CLAUDE_DIR}"

# ---------------------------------------------------------------------------
# Create .env.local for the dashboard if it doesn't already exist
# ---------------------------------------------------------------------------
header "Dashboard .env.local configuration"

if [[ -f "${ENV_LOCAL}" ]]; then
  info ".env.local already exists at ${ENV_LOCAL} — skipping creation"
  # Still check if DASHBOARD_API_KEY line is present; append if missing
  if ! grep -q "^DASHBOARD_API_KEY=" "${ENV_LOCAL}" 2>/dev/null; then
    echo "" >> "${ENV_LOCAL}"
    echo "DASHBOARD_API_KEY=${DASHBOARD_API_KEY}" >> "${ENV_LOCAL}"
    success "Appended DASHBOARD_API_KEY to existing .env.local"
  fi
else
  cat > "${ENV_LOCAL}" <<EOF
# Claude Dashboard — local environment configuration
# Generated by collector/install.sh on $(date -u '+%Y-%m-%dT%H:%M:%SZ')

# API key that the collector uses when posting data to this dashboard.
# Must match the DASHBOARD_API_KEY value exported in the shell that runs
# collect-on-session-end.sh (or set via your shell profile).
DASHBOARD_API_KEY=${DASHBOARD_API_KEY}

# Uncomment and set a custom database path if needed:
# DATABASE_URL=file:./data/dashboard.db
EOF
  success "Created .env.local at ${ENV_LOCAL}"
fi

# ---------------------------------------------------------------------------
# Load existing settings.json (or start with an empty object)
# ---------------------------------------------------------------------------
header "Configuring Claude Code hooks"

if [[ -f "${SETTINGS_FILE}" ]]; then
  CURRENT_SETTINGS="$(cat "${SETTINGS_FILE}")"
  if ! echo "${CURRENT_SETTINGS}" | jq . &>/dev/null; then
    warn "${SETTINGS_FILE} contains invalid JSON — backing up and resetting"
    cp "${SETTINGS_FILE}" "${SETTINGS_FILE}.bak.$(date +%s)"
    CURRENT_SETTINGS="{}"
  fi
else
  CURRENT_SETTINGS="{}"
  info "No existing settings.json found — will create: ${SETTINGS_FILE}"
fi

# ---------------------------------------------------------------------------
# Check whether the hook is already registered
# ---------------------------------------------------------------------------
EXISTING_HOOKS=$(
  echo "${CURRENT_SETTINGS}" | jq -r '
    if .hooks.SessionEnd then
      [ .hooks.SessionEnd[] |
        if type == "object" then .command else . end
      ] | join("\n")
    else
      ""
    end
  '
)

if echo "${EXISTING_HOOKS}" | grep -qF "${COLLECTOR_SCRIPT}"; then
  success "Hook is already registered in ${SETTINGS_FILE} — no changes needed"
else
  # Build the new hook entry
  NEW_HOOK_ENTRY=$(jq -n \
    --arg cmd "${COLLECTOR_SCRIPT}" \
    '{
      type: "command",
      command: $cmd,
      async: true
    }'
  )

  # Merge with existing settings
  UPDATED_SETTINGS=$(
    echo "${CURRENT_SETTINGS}" | jq \
      --argjson newHook "${NEW_HOOK_ENTRY}" \
      '
        if .hooks == null then .hooks = {} else . end |
        if .hooks.SessionEnd == null then .hooks.SessionEnd = [] else . end |
        .hooks.SessionEnd += [$newHook]
      '
  )

  echo "${UPDATED_SETTINGS}" | jq . > "${SETTINGS_FILE}"
  success "Hook registered in ${SETTINGS_FILE}"
  info "Current SessionEnd hooks:"
  echo "${UPDATED_SETTINGS}" | jq '.hooks.SessionEnd'
fi

# ---------------------------------------------------------------------------
# Write shell profile snippet
# ---------------------------------------------------------------------------
header "Shell profile hint"

PROFILE_SNIPPET="export DASHBOARD_URL=\"${DASHBOARD_URL}\"
export DASHBOARD_API_KEY=\"${DASHBOARD_API_KEY}\""

DETECTED_PROFILE=""
if [[ "${OS}" == "macos" ]]; then
  # macOS default is zsh since Catalina
  DETECTED_PROFILE="${HOME}/.zshrc"
elif [[ -f "${HOME}/.bashrc" ]]; then
  DETECTED_PROFILE="${HOME}/.bashrc"
fi

if [[ -n "${DETECTED_PROFILE}" ]]; then
  if grep -q "DASHBOARD_API_KEY" "${DETECTED_PROFILE}" 2>/dev/null; then
    info "DASHBOARD_API_KEY already present in ${DETECTED_PROFILE}"
  else
    echo ""
    warn "Add the following lines to ${DETECTED_PROFILE} so every terminal session" \
         "inherits the API key (the hook runs in a fresh shell):"
    echo ""
    echo "  # --- Claude Dashboard collector ---"
    echo "  ${PROFILE_SNIPPET}" | sed 's/^/  /'
    echo "  # -----------------------------------"
    echo ""
    # Ask the user whether to append automatically
    if [[ -t 0 ]]; then
      read -r -p "$(echo -e "${CYAN}Append automatically to ${DETECTED_PROFILE}? [y/N]: ${RESET}")" APPEND_CHOICE
      if [[ "${APPEND_CHOICE}" =~ ^[Yy]$ ]]; then
        {
          echo ""
          echo "# --- Claude Dashboard collector (added by install.sh) ---"
          echo "${PROFILE_SNIPPET}"
          echo "# ---------------------------------------------------------"
        } >> "${DETECTED_PROFILE}"
        success "Appended to ${DETECTED_PROFILE}"
        info "Run 'source ${DETECTED_PROFILE}' or open a new terminal to apply"
      fi
    fi
  fi
fi

# ---------------------------------------------------------------------------
# Test connection to dashboard
# ---------------------------------------------------------------------------
header "Testing dashboard connection"

info "Sending health check to ${DASHBOARD_URL}/api/v1/health ..."

HTTP_CODE=$(
  curl -s -o /dev/null -w "%{http_code}" \
    --max-time 5 \
    "${DASHBOARD_URL}/api/v1/health" \
  2>/dev/null || echo "0"
)

if [[ "${HTTP_CODE}" == "200" ]]; then
  success "Dashboard is reachable (HTTP ${HTTP_CODE})"
else
  warn "Dashboard health check returned HTTP ${HTTP_CODE}"
  if [[ "${HTTP_CODE}" == "0" ]]; then
    warn "Could not reach ${DASHBOARD_URL} — is the dashboard running?"
  fi
  info "You can still run the hook; it will retry on the next session end."
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
header "Installation complete"

echo ""
echo -e "  ${BOLD}Settings file :${RESET} ${SETTINGS_FILE}"
echo -e "  ${BOLD}Hook script   :${RESET} ${COLLECTOR_SCRIPT}"
echo -e "  ${BOLD}Dashboard URL :${RESET} ${DASHBOARD_URL}"
echo -e "  ${BOLD}.env.local    :${RESET} ${ENV_LOCAL}"
echo ""
echo -e "  ${GREEN}The collector will send data whenever a Claude Code session ends.${RESET}"
echo ""
