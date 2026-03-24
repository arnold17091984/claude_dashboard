#!/bin/bash
# =============================================================================
# sync-skills.sh — Sync Claude Code skill inventory to the dashboard API
# =============================================================================
#
# DESCRIPTION
#   Scans the ~/.claude/ directory for installed commands, agents, skills,
#   plugins, and MCP servers, then POSTs a JSON inventory to the dashboard.
#
# USAGE
#   bash scripts/sync-skills.sh
#
# ENVIRONMENT VARIABLES (all optional)
#   DASHBOARD_URL      Base URL of the dashboard (default: http://localhost:3000)
#   DASHBOARD_API_KEY  Bearer token for API auth (default: dev-api-key-12345)
#
# POSITIONAL ARGUMENTS (override env vars)
#   $1   DASHBOARD_URL
#   $2   DASHBOARD_API_KEY
#
# EXAMPLES
#   # Manual run
#   bash scripts/sync-skills.sh
#
#   # With explicit URL and key
#   bash scripts/sync-skills.sh https://dashboard.example.com my-secret-key
#
#   # As a Claude Code PostToolUse hook (in ~/.claude/settings.json):
#   # "hooks": { "PostToolUse": [{ "command": "bash /path/to/sync-skills.sh" }] }
#
# REQUIREMENTS
#   - bash 3.2+ (macOS default)
#   - curl
#   - jq  (required for JSON assembly; MCP parsing is also skipped without it)
#
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
DASHBOARD_URL="${1:-${DASHBOARD_URL:-http://localhost:3000}}"
API_KEY="${2:-${DASHBOARD_API_KEY:-dev-api-key-12345}}"
CLAUDE_DIR="${HOME}/.claude"
ENDPOINT="${DASHBOARD_URL}/api/v1/skills/inventory"

# ---------------------------------------------------------------------------
# Preflight checks
# ---------------------------------------------------------------------------
if ! command -v curl >/dev/null 2>&1; then
  echo "ERROR: curl is required but not found in PATH." >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq is required but not found in PATH." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Helper: collect items from a flat directory of .md files
#   Usage: collect_md_dir <dir> <type>
#   Returns a JSON array of {"name":"...","type":"..."} objects via stdout
# ---------------------------------------------------------------------------
collect_md_dir() {
  local dir="$1"
  local type="$2"

  if [ ! -d "$dir" ]; then
    echo "[]"
    return
  fi

  local names
  names=$(find "$dir" -maxdepth 1 -name "*.md" -type f 2>/dev/null \
    | while IFS= read -r f; do basename "$f" .md; done \
    | sort -u)

  if [ -z "$names" ]; then
    echo "[]"
    return
  fi

  echo "$names" \
    | jq -R -s --arg t "$type" \
        'split("\n") | map(select(length > 0)) | map({name: ., type: $t})'
}

# ---------------------------------------------------------------------------
# Helper: collect skill directories (non-.md entries)
#   Usage: collect_skill_dirs <dir>
#   Returns a JSON array of {"name":"...","type":"skill"} objects via stdout
# ---------------------------------------------------------------------------
collect_skill_dirs() {
  local dir="$1"

  if [ ! -d "$dir" ]; then
    echo "[]"
    return
  fi

  local names
  names=$(find "$dir" -maxdepth 1 -mindepth 1 -type d 2>/dev/null \
    | while IFS= read -r d; do basename "$d"; done \
    | sort -u)

  if [ -z "$names" ]; then
    echo "[]"
    return
  fi

  echo "$names" \
    | jq -R -s \
        'split("\n") | map(select(length > 0)) | map({name: ., type: "skill"})'
}

# ---------------------------------------------------------------------------
# Helper: collect plugin commands
#   Path pattern: ~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/commands/<cmd>.md
#   Item name format: <plugin>:<cmd>
#   Returns a JSON array of {"name":"<plugin>:<cmd>","type":"plugin"} objects
# ---------------------------------------------------------------------------
collect_plugins() {
  local cache_dir="${CLAUDE_DIR}/plugins/cache"

  if [ ! -d "$cache_dir" ]; then
    echo "[]"
    return
  fi

  local pairs
  pairs=$(find "$cache_dir" -path "*/commands/*.md" -type f 2>/dev/null \
    | while IFS= read -r path; do
        # Extract <plugin> from .../cache/<marketplace>/<plugin>/<version>/commands/<cmd>.md
        plugin=$(echo "$path" \
          | sed 's|.*/cache/[^/]*/\([^/]*\)/[^/]*/commands/.*|\1|')
        cmd=$(basename "$path" .md)
        echo "${plugin}:${cmd}"
      done \
    | sort -u)

  if [ -z "$pairs" ]; then
    echo "[]"
    return
  fi

  echo "$pairs" \
    | jq -R -s \
        'split("\n") | map(select(length > 0)) | map({name: ., type: "plugin"})'
}

# ---------------------------------------------------------------------------
# Helper: collect MCP server names from settings.json
#   Requires jq. Silently returns [] if the key is absent or jq unavailable.
# ---------------------------------------------------------------------------
collect_mcp_servers() {
  local settings="${CLAUDE_DIR}/settings.json"

  if [ ! -f "$settings" ]; then
    echo "[]"
    return
  fi

  local servers
  servers=$(jq -r '
    if .mcpServers then
      .mcpServers | keys[]
    else
      empty
    end
  ' "$settings" 2>/dev/null | sort -u || true)

  if [ -z "$servers" ]; then
    echo "[]"
    return
  fi

  echo "$servers" \
    | jq -R -s \
        'split("\n") | map(select(length > 0)) | map({name: ., type: "mcp-server"})'
}

# ---------------------------------------------------------------------------
# Collect all categories
# ---------------------------------------------------------------------------
echo "Scanning ${CLAUDE_DIR} ..."

commands=$(collect_md_dir "${CLAUDE_DIR}/commands"  "command")
agents=$(collect_md_dir   "${CLAUDE_DIR}/agents"    "agent")
skills=$(collect_skill_dirs "${CLAUDE_DIR}/skills")
plugins=$(collect_plugins)
mcp_servers=$(collect_mcp_servers)

# Merge all arrays into one
all_items=$(jq -s 'add' \
  <(echo "$commands") \
  <(echo "$agents") \
  <(echo "$skills") \
  <(echo "$plugins") \
  <(echo "$mcp_servers"))

# Count per category
cmd_count=$(echo "$commands"    | jq 'length')
agent_count=$(echo "$agents"    | jq 'length')
skill_count=$(echo "$skills"    | jq 'length')
plugin_count=$(echo "$plugins"  | jq 'length')
mcp_count=$(echo "$mcp_servers" | jq 'length')
total=$(echo "$all_items"       | jq 'length')

# ---------------------------------------------------------------------------
# Build JSON payload
# ---------------------------------------------------------------------------
payload=$(jq -n \
  --arg     userId      "$(whoami)" \
  --argjson items       "$all_items" \
  '{
    userId: $userId,
    items:  $items
  }')

# ---------------------------------------------------------------------------
# Print summary
# ---------------------------------------------------------------------------
echo ""
echo "Inventory summary:"
echo "  Commands   : ${cmd_count}"
echo "  Agents     : ${agent_count}"
echo "  Skills     : ${skill_count}"
echo "  Plugins    : ${plugin_count}"
echo "  MCP servers: ${mcp_count}"
echo "  Total      : ${total}"
echo ""
echo "Posting to ${ENDPOINT} ..."

# ---------------------------------------------------------------------------
# POST to dashboard API
# ---------------------------------------------------------------------------
response=$(curl -s -w "\n%{http_code}" \
  -X POST "${ENDPOINT}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${API_KEY}" \
  --max-time 15 \
  -d "$payload")

http_status=$(echo "$response" | tail -n 1)
response_body=$(echo "$response" | head -n -1)

if [ "$http_status" = "200" ] || [ "$http_status" = "201" ]; then
  echo "Sync successful (HTTP ${http_status})"
  echo "$response_body" | jq '.' 2>/dev/null || echo "$response_body"
else
  echo "Sync failed (HTTP ${http_status})" >&2
  echo "$response_body" >&2
  exit 1
fi
