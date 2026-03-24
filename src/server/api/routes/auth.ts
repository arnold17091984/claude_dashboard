/**
 * auth.ts
 *
 * Authentication routes for the Claude Code Dashboard.
 *
 * POST /auth/register  — Register with invite code, get API key
 * POST /auth/login     — Login with nickname + password
 * POST /auth/logout    — Invalidate session
 * GET  /auth/me        — Get current account
 * POST /auth/api-keys  — Create a new personal API key
 * GET  /auth/api-keys  — List personal API keys (masked)
 * DELETE /auth/api-keys/:keyId — Delete a personal API key
 */

import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { db } from "@/server/db";
import { accounts, personalApiKeys, authSessions } from "@/server/db/schema";
import { eq, and, gt } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SESSION_COOKIE_NAME = "session_token";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

// ---------------------------------------------------------------------------
// Crypto helpers
// ---------------------------------------------------------------------------

/**
 * Hash a password using scrypt with a random salt.
 * Returns format: "salt:hash" (both hex-encoded).
 */
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Verify a password against a stored "salt:hash" string.
 * Uses timing-safe comparison to prevent timing attacks.
 */
function verifyPassword(password: string, stored: string): boolean {
  const [salt, storedHash] = stored.split(":");
  if (!salt || !storedHash) return false;
  const hash = scryptSync(password, salt, 64).toString("hex");
  const storedBuf = Buffer.from(storedHash, "hex");
  const hashBuf = Buffer.from(hash, "hex");
  if (storedBuf.length !== hashBuf.length) return false;
  return timingSafeEqual(storedBuf, hashBuf);
}

/**
 * Generate a personal API key in the format: dk_<32 hex chars>
 */
function generateApiKey(): string {
  return `dk_${randomBytes(16).toString("hex")}`;
}

/**
 * Compute session expiry date (30 days from now).
 */
function sessionExpiresAt(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// Session resolution helper (used by middleware too — exported)
// ---------------------------------------------------------------------------

export interface AuthAccount {
  id: string;
  nickname: string;
  role: string;
  linkedUserId: string | null;
}

/**
 * Resolve a session token to an account.
 * Returns null if the token is invalid or expired.
 */
/**
 * Check if any accounts exist in the database.
 * Used to allow unauthenticated access during initial setup.
 */
export function hasAnyAccounts(): boolean {
  const rows = db.select({ id: accounts.id }).from(accounts).limit(1).all();
  return rows.length > 0;
}

export function resolveSession(token: string): AuthAccount | null {
  const now = new Date().toISOString();
  const rows = db
    .select({
      sessionId: authSessions.id,
      expiresAt: authSessions.expiresAt,
      accountId: accounts.id,
      nickname: accounts.nickname,
      role: accounts.role,
      linkedUserId: accounts.linkedUserId,
    })
    .from(authSessions)
    .innerJoin(accounts, eq(authSessions.accountId, accounts.id))
    .where(and(eq(authSessions.id, token), gt(authSessions.expiresAt, now)))
    .limit(1)
    .all();

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    id: row.accountId,
    nickname: row.nickname,
    role: row.role,
    linkedUserId: row.linkedUserId ?? null,
  };
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export const authRoute = new Hono();

// ---------------------------------------------------------------------------
// POST /register
// ---------------------------------------------------------------------------

authRoute.post("/register", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const { nickname, password, inviteCode } = body as Record<string, unknown>;

  // Validate invite code
  const expectedInvite = process.env.INVITE_CODE;
  if (expectedInvite && expectedInvite.trim() !== "") {
    if (!inviteCode || inviteCode !== expectedInvite) {
      return c.json({ error: "Invalid invite code" }, 403);
    }
  }

  // Validate inputs
  if (!nickname || typeof nickname !== "string" || nickname.trim().length < 2) {
    return c.json({ error: "Nickname must be at least 2 characters" }, 400);
  }
  if (!password || typeof password !== "string" || password.length < 6) {
    return c.json({ error: "Password must be at least 6 characters" }, 400);
  }

  const trimmedNickname = nickname.trim();

  // Check for duplicate nickname
  const existing = db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.nickname, trimmedNickname))
    .limit(1)
    .all();

  if (existing.length > 0) {
    return c.json({ error: "Nickname already taken" }, 409);
  }

  // Create account + API key + session in one transaction
  const accountId = randomUUID();
  const apiKeyId = generateApiKey();
  const sessionId = randomBytes(32).toString("hex");
  const passwordHash = hashPassword(password);
  const expiresAt = sessionExpiresAt();

  db.transaction((tx) => {
    tx.insert(accounts).values({
      id: accountId,
      nickname: trimmedNickname,
      passwordHash,
      role: "member",
    }).run();

    tx.insert(personalApiKeys).values({
      id: apiKeyId,
      accountId,
      label: "default",
    }).run();

    tx.insert(authSessions).values({
      id: sessionId,
      accountId,
      expiresAt,
    }).run();
  });

  setCookie(c, SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return c.json({
    account: { id: accountId, nickname: trimmedNickname, role: "member" },
    apiKey: apiKeyId,
  });
});

// ---------------------------------------------------------------------------
// POST /login
// ---------------------------------------------------------------------------

authRoute.post("/login", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const { nickname, password } = body as Record<string, unknown>;

  if (!nickname || typeof nickname !== "string") {
    return c.json({ error: "Nickname is required" }, 400);
  }
  if (!password || typeof password !== "string") {
    return c.json({ error: "Password is required" }, 400);
  }

  const rows = db
    .select()
    .from(accounts)
    .where(eq(accounts.nickname, nickname.trim()))
    .limit(1)
    .all();

  if (rows.length === 0) {
    return c.json({ error: "Invalid nickname or password" }, 401);
  }

  const account = rows[0];
  if (!verifyPassword(password, account.passwordHash)) {
    return c.json({ error: "Invalid nickname or password" }, 401);
  }

  const sessionId = randomBytes(32).toString("hex");
  const expiresAt = sessionExpiresAt();

  db.insert(authSessions).values({
    id: sessionId,
    accountId: account.id,
    expiresAt,
  }).run();

  setCookie(c, SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return c.json({
    account: { id: account.id, nickname: account.nickname, role: account.role },
  });
});

// ---------------------------------------------------------------------------
// POST /logout
// ---------------------------------------------------------------------------

authRoute.post("/logout", async (c) => {
  const token = getCookie(c, SESSION_COOKIE_NAME);
  if (token) {
    db.delete(authSessions).where(eq(authSessions.id, token)).run();
  }
  deleteCookie(c, SESSION_COOKIE_NAME, { path: "/" });
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// GET /me
// ---------------------------------------------------------------------------

authRoute.get("/me", async (c) => {
  const token = getCookie(c, SESSION_COOKIE_NAME);
  if (!token) {
    return c.json({ error: "Not authenticated" }, 401);
  }

  const account = resolveSession(token);
  if (!account) {
    return c.json({ error: "Session expired or invalid" }, 401);
  }

  return c.json({ account });
});

// ---------------------------------------------------------------------------
// POST /api-keys
// ---------------------------------------------------------------------------

authRoute.post("/api-keys", async (c) => {
  const token = getCookie(c, SESSION_COOKIE_NAME);
  if (!token) {
    return c.json({ error: "Not authenticated" }, 401);
  }

  const account = resolveSession(token);
  if (!account) {
    return c.json({ error: "Session expired or invalid" }, 401);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }

  const label = (body as Record<string, unknown>).label;
  const keyLabel = typeof label === "string" && label.trim().length > 0
    ? label.trim()
    : "default";

  const apiKeyId = generateApiKey();
  db.insert(personalApiKeys).values({
    id: apiKeyId,
    accountId: account.id,
    label: keyLabel,
  }).run();

  return c.json({ apiKey: apiKeyId, label: keyLabel });
});

// ---------------------------------------------------------------------------
// GET /api-keys
// ---------------------------------------------------------------------------

authRoute.get("/api-keys", async (c) => {
  const token = getCookie(c, SESSION_COOKIE_NAME);
  if (!token) {
    return c.json({ error: "Not authenticated" }, 401);
  }

  const account = resolveSession(token);
  if (!account) {
    return c.json({ error: "Session expired or invalid" }, 401);
  }

  const keys = db
    .select()
    .from(personalApiKeys)
    .where(eq(personalApiKeys.accountId, account.id))
    .all();

  // Mask key: show only last 8 chars
  const masked = keys.map((k) => ({
    id: k.id,
    maskedKey: `dk_...${k.id.slice(-8)}`,
    label: k.label,
    createdAt: k.createdAt,
    lastUsedAt: k.lastUsedAt,
  }));

  return c.json({ apiKeys: masked });
});

// ---------------------------------------------------------------------------
// DELETE /api-keys/:keyId
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// GET /setup-script?key=dk_xxx — Returns a shell script that auto-configures hooks
// ---------------------------------------------------------------------------

authRoute.get("/setup-script", async (c) => {
  const apiKey = c.req.query("key");
  if (!apiKey || !apiKey.startsWith("dk_")) {
    return c.text("echo 'Error: Invalid API key'; exit 1", 400);
  }

  // Verify the key exists
  const keyRow = db
    .select({ id: personalApiKeys.id })
    .from(personalApiKeys)
    .where(eq(personalApiKeys.id, apiKey))
    .limit(1)
    .all();

  if (keyRow.length === 0) {
    return c.text("echo 'Error: API key not found'; exit 1", 404);
  }

  // Determine dashboard URL from request
  const proto = c.req.header("x-forwarded-proto") || "http";
  const host = c.req.header("host") || "localhost:3000";
  const dashboardUrl = `${proto}://${host}`;

  const script = `#!/bin/bash
# Claude Code Dashboard — Auto Hook Setup
# This script adds the dashboard hook to ~/.claude/settings.json
set -euo pipefail

SETTINGS="$HOME/.claude/settings.json"
API_KEY="${apiKey}"
DASHBOARD_URL="${dashboardUrl}"

echo ""
echo "=== Claude Code Dashboard Hook Setup ==="
echo ""

# Create ~/.claude if it doesn't exist
mkdir -p "$HOME/.claude"

# Create settings.json if missing
if [ ! -f "$SETTINGS" ]; then
  echo '{}' > "$SETTINGS"
  echo "Created $SETTINGS"
fi

# Check if jq is available
if ! command -v jq &>/dev/null; then
  echo "Error: jq is required. Install with: brew install jq (macOS) or apt install jq (Linux)"
  exit 1
fi

# Build the hook command
HOOK_CMD="curl -sf -X POST $DASHBOARD_URL/api/v1/ingest/session -H 'Authorization: Bearer $API_KEY' -H 'Content-Type: application/json' -d @- < /dev/null || true"
SYNC_CMD="DASHBOARD_URL=$DASHBOARD_URL DASHBOARD_API_KEY=$API_KEY bash $DASHBOARD_URL/api/v1/auth/sync-skills-script 2>/dev/null || true"

# Add hooks to settings.json (merge, don't overwrite)
TEMP=$(mktemp)
jq --arg hook_cmd "$HOOK_CMD" '
  .hooks //= {} |
  .hooks.SessionEnd //= [] |
  if (.hooks.SessionEnd | map(select(.command | contains("dashboard"))) | length) == 0
  then .hooks.SessionEnd += [{"command": $hook_cmd}]
  else .
  end
' "$SETTINGS" > "$TEMP" && mv "$TEMP" "$SETTINGS"

echo "Hook added to $SETTINGS"
echo ""
echo "Dashboard URL: $DASHBOARD_URL"
echo "API Key: \${API_KEY:0:10}..."
echo ""
echo "Setup complete! Session data will be sent when Claude Code sessions end."
echo ""
`;

  c.header("Content-Type", "text/plain; charset=utf-8");
  return c.text(script);
});

authRoute.delete("/api-keys/:keyId", async (c) => {
  const token = getCookie(c, SESSION_COOKIE_NAME);
  if (!token) {
    return c.json({ error: "Not authenticated" }, 401);
  }

  const account = resolveSession(token);
  if (!account) {
    return c.json({ error: "Session expired or invalid" }, 401);
  }

  const keyId = c.req.param("keyId");

  // Ensure the key belongs to this account
  const rows = db
    .select({ id: personalApiKeys.id })
    .from(personalApiKeys)
    .where(
      and(
        eq(personalApiKeys.id, keyId),
        eq(personalApiKeys.accountId, account.id)
      )
    )
    .limit(1)
    .all();

  if (rows.length === 0) {
    return c.json({ error: "API key not found" }, 404);
  }

  db.delete(personalApiKeys).where(eq(personalApiKeys.id, keyId)).run();
  return c.json({ ok: true });
});
