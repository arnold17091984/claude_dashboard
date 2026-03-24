/**
 * session-auth.ts
 *
 * Web UI authentication middleware.
 *
 * Behaviour:
 *  - Checks `session_token` cookie against the `auth_sessions` table.
 *  - If a valid session is found, attaches `account` to the Hono context.
 *  - If no valid session exists but DASHBOARD_AUTH_TOKEN is set and the
 *    request provides a matching Bearer token, passes through for backward
 *    compatibility (admin/global bearer token).
 *  - If neither condition is met, returns 401.
 *
 * Skipped for:
 *  - /auth/* paths (login, register, me)
 *  - /ingest/* paths (use API key auth)
 *  - /health/* paths
 *  - When DASHBOARD_AUTH_TOKEN is NOT set AND no session cookie present in dev
 */

import { timingSafeEqual } from "node:crypto";
import { getCookie } from "hono/cookie";
import type { Context, Next } from "hono";
import { resolveSession } from "@/server/api/routes/auth";

// Paths that do not require session auth
const PUBLIC_PATH_PREFIXES = ["/api/v1/auth/", "/api/v1/ingest/", "/api/v1/health/"];

function isPublicPath(path: string): boolean {
  return PUBLIC_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export async function sessionAuth(c: Context, next: Next): Promise<Response | void> {
  const path = c.req.path;

  // Skip auth for public paths
  if (isPublicPath(path)) {
    await next();
    return;
  }

  // Check cookie session first
  const token = getCookie(c, "session_token");
  if (token) {
    const account = resolveSession(token);
    if (account) {
      c.set("account", account);
      await next();
      return;
    }
  }

  // Fallback: legacy DASHBOARD_AUTH_TOKEN bearer token (backward compatibility)
  const expected = process.env.DASHBOARD_AUTH_TOKEN;
  if (expected && expected.trim() !== "") {
    // Only accept bearer on GET requests (same as original behaviour)
    if (c.req.method === "GET") {
      const authHeader = c.req.header("Authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const supplied = authHeader.slice(7);
        const expectedBuf = Buffer.from(expected);
        const suppliedBuf = Buffer.from(supplied);
        const isLengthMatch = expectedBuf.length === suppliedBuf.length;
        const compareTarget = isLengthMatch ? suppliedBuf : expectedBuf;
        const isMatch = timingSafeEqual(expectedBuf, compareTarget) && isLengthMatch;
        if (isMatch) {
          await next();
          return;
        }
      }
      return c.json(
        {
          error: "Unauthorized",
          message: "A valid session cookie or Authorization: Bearer <token> header is required.",
        },
        401
      );
    }
    // Non-GET requests in bearer-only mode: pass through (handled by apiKeyAuth)
    await next();
    return;
  }

  // If no accounts exist yet (fresh install), allow access so first user can set up
  const { hasAnyAccounts } = await import("@/server/api/routes/auth");
  if (!hasAnyAccounts()) {
    await next();
    return;
  }

  return c.json(
    {
      error: "Unauthorized",
      message: "Authentication required. Please log in.",
    },
    401
  );
}
