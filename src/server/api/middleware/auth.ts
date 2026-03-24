/**
 * auth.ts
 *
 * API key authentication middleware for Hono ingest routes.
 *
 * Behaviour:
 *  - If DASHBOARD_API_KEY is NOT set, all requests are allowed (dev mode).
 *  - If DASHBOARD_API_KEY IS set, the incoming request must supply an
 *    "X-API-Key" header that matches EITHER:
 *      1. The global DASHBOARD_API_KEY env var (admin/global key), OR
 *      2. A personal API key row in the `personal_api_keys` table (dk_xxx...)
 *  - When a personal key matches, `lastUsedAt` is updated and the account's
 *    `linkedUserId` is attached to the context as `linkedUserId`.
 *
 * Usage:
 *   import { apiKeyAuth } from "@/server/api/middleware/auth";
 *   myRoute.use("*", apiKeyAuth);
 */

import { timingSafeEqual } from "node:crypto";
import type { Context, Next } from "hono";
import { db } from "@/server/db";
import { personalApiKeys, accounts } from "@/server/db/schema";
import { eq } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuthResult {
  authorized: boolean;
  devMode: boolean;
  linkedUserId?: string | null;
}

// ---------------------------------------------------------------------------
// Core helper
// ---------------------------------------------------------------------------

/**
 * Checks whether `apiKey` satisfies the configured secret or a personal key.
 */
export function checkApiKey(apiKey: string | undefined): AuthResult {
  const expected = process.env.DASHBOARD_API_KEY;

  // Development mode: no key configured → allow everything
  if (!expected || expected.trim() === "") {
    return { authorized: true, devMode: true };
  }

  if (!apiKey) {
    return { authorized: false, devMode: false };
  }

  // Check global DASHBOARD_API_KEY (timing-safe)
  const expectedBuf = Buffer.from(expected);
  const suppliedBuf = Buffer.from(apiKey);
  const isLengthMatch = expectedBuf.length === suppliedBuf.length;
  const compareTarget = isLengthMatch ? suppliedBuf : expectedBuf;
  const isMatch = timingSafeEqual(expectedBuf, compareTarget) && isLengthMatch;

  if (isMatch) {
    return { authorized: true, devMode: false };
  }

  // Check personal API keys (dk_xxx format)
  if (apiKey.startsWith("dk_")) {
    try {
      const rows = db
        .select({
          keyId: personalApiKeys.id,
          accountId: personalApiKeys.accountId,
          linkedUserId: accounts.linkedUserId,
        })
        .from(personalApiKeys)
        .leftJoin(accounts, eq(personalApiKeys.accountId, accounts.id))
        .where(eq(personalApiKeys.id, apiKey))
        .limit(1)
        .all();

      if (rows.length > 0) {
        // Update lastUsedAt asynchronously (fire-and-forget)
        db.update(personalApiKeys)
          .set({ lastUsedAt: new Date().toISOString() })
          .where(eq(personalApiKeys.id, apiKey))
          .run();

        return {
          authorized: true,
          devMode: false,
          linkedUserId: rows[0].linkedUserId ?? null,
        };
      }
    } catch (err) {
      console.error("[auth] Personal API key lookup failed:", err);
    }
  }

  return { authorized: false, devMode: false };
}

// ---------------------------------------------------------------------------
// Hono middleware
// ---------------------------------------------------------------------------

export async function apiKeyAuth(c: Context, next: Next): Promise<Response | void> {
  const apiKey = c.req.header("X-API-Key");
  const { authorized, devMode, linkedUserId } = checkApiKey(apiKey);

  if (!authorized) {
    return c.json(
      {
        error: "Unauthorized",
        message: "A valid X-API-Key header is required.",
      },
      401
    );
  }

  c.set("devMode", devMode);
  // Attach linkedUserId so ingest routes can use it for user association
  if (linkedUserId !== undefined) {
    c.set("linkedUserId", linkedUserId);
  }

  await next();
}
