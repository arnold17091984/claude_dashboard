/**
 * auth.ts
 *
 * Shared API key authentication middleware for Hono routes.
 *
 * Behaviour:
 *  - If the environment variable DASHBOARD_API_KEY is NOT set, all requests
 *    are allowed through (development / zero-config mode).
 *  - If DASHBOARD_API_KEY IS set, the incoming request must supply an
 *    "X-API-Key" header whose value matches the configured key exactly.
 *    Mismatches return a 401 JSON response and short-circuit the handler.
 *
 * Usage:
 *   import { apiKeyAuth } from "@/server/api/middleware/auth";
 *
 *   // Apply to all routes under a router:
 *   myRoute.use("*", apiKeyAuth);
 *
 *   // Or apply per-route:
 *   myRoute.post("/session", apiKeyAuth, async (c) => { ... });
 */

import type { Context, Next } from "hono";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result of an auth check. */
interface AuthResult {
  authorized: boolean;
  /** True when no DASHBOARD_API_KEY is configured (dev mode). */
  devMode: boolean;
}

// ---------------------------------------------------------------------------
// Core helper — exported so unit tests can call it directly
// ---------------------------------------------------------------------------

/**
 * Checks whether `apiKey` satisfies the configured secret.
 *
 * @param apiKey - The value of the incoming X-API-Key header (may be undefined).
 */
export function checkApiKey(apiKey: string | undefined): AuthResult {
  const expected = process.env.DASHBOARD_API_KEY;

  // Development mode: no key configured → allow everything
  if (!expected || expected.trim() === "") {
    return { authorized: true, devMode: true };
  }

  return {
    authorized: apiKey === expected,
    devMode: false,
  };
}

// ---------------------------------------------------------------------------
// Hono middleware
// ---------------------------------------------------------------------------

/**
 * Hono middleware that enforces API key authentication.
 *
 * Mount it with `route.use("*", apiKeyAuth)` or inline on individual handlers.
 *
 * On failure it returns:
 * ```json
 * { "error": "Unauthorized", "message": "A valid X-API-Key header is required." }
 * ```
 * with HTTP status 401 and Content-Type: application/json.
 */
export async function apiKeyAuth(c: Context, next: Next): Promise<Response | void> {
  const apiKey = c.req.header("X-API-Key");
  const { authorized, devMode } = checkApiKey(apiKey);

  if (!authorized) {
    return c.json(
      {
        error: "Unauthorized",
        message: "A valid X-API-Key header is required.",
      },
      401
    );
  }

  // Attach a flag to the context so downstream handlers know auth status
  c.set("devMode", devMode);

  await next();
}
