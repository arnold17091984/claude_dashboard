/**
 * rate-limit.ts
 *
 * Simple in-memory rate limiter middleware for Hono.
 *
 * Uses a sliding window approach with automatic cleanup of expired entries.
 * No external dependencies (no Redis required).
 *
 * Rate limit tiers:
 *  - AI insight generation:  10 requests per minute
 *  - Ingest endpoints:      100 requests per minute
 *  - General API:           200 requests per minute
 */

import type { Context, Next } from "hono";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RateLimitConfig {
  /** Maximum number of requests allowed in the window. */
  maxRequests: number;
  /** Window duration in milliseconds. */
  windowMs: number;
}

interface RequestRecord {
  /** Timestamps of requests within the current window. */
  timestamps: number[];
}

// ---------------------------------------------------------------------------
// Rate limit store
// ---------------------------------------------------------------------------

const store = new Map<string, RequestRecord>();

// Periodic cleanup of expired entries to prevent memory leaks.
// Runs every 60 seconds.
const CLEANUP_INTERVAL_MS = 60_000;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function startCleanup(windowMs: number): void {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [key, record] of store) {
      record.timestamps = record.timestamps.filter((t) => t > cutoff);
      if (record.timestamps.length === 0) {
        store.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS);

  // Allow the process to exit without waiting for the timer
  if (cleanupTimer && typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    cleanupTimer.unref();
  }
}

// ---------------------------------------------------------------------------
// Key extraction
// ---------------------------------------------------------------------------

/**
 * Derive a rate-limit key from the request.
 * Uses X-Forwarded-For (behind proxy) or falls back to a generic key.
 */
function getClientKey(c: Context, prefix: string): string {
  const forwarded = c.req.header("X-Forwarded-For");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  return `${prefix}:${ip}`;
}

// ---------------------------------------------------------------------------
// Core check
// ---------------------------------------------------------------------------

function isRateLimited(key: string, config: RateLimitConfig): {
  limited: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  const windowStart = now - config.windowMs;

  let record = store.get(key);
  if (!record) {
    record = { timestamps: [] };
    store.set(key, record);
  }

  // Remove timestamps outside the window
  record.timestamps = record.timestamps.filter((t) => t > windowStart);

  if (record.timestamps.length >= config.maxRequests) {
    // Find when the oldest request in the window expires
    const oldestInWindow = record.timestamps[0];
    const resetAt = oldestInWindow + config.windowMs;
    return {
      limited: true,
      remaining: 0,
      resetAt,
    };
  }

  // Record this request
  record.timestamps.push(now);

  return {
    limited: false,
    remaining: config.maxRequests - record.timestamps.length,
    resetAt: now + config.windowMs,
  };
}

// ---------------------------------------------------------------------------
// Middleware factory
// ---------------------------------------------------------------------------

/**
 * Creates a Hono rate-limit middleware with the given configuration.
 *
 * @param prefix - Namespace prefix for the rate limit key (e.g., "ai", "ingest", "api")
 * @param config - Rate limit configuration
 */
export function rateLimit(prefix: string, config: RateLimitConfig) {
  startCleanup(config.windowMs);

  return async (c: Context, next: Next): Promise<Response | void> => {
    const key = getClientKey(c, prefix);
    const result = isRateLimited(key, config);

    // Set rate limit headers on every response
    c.header("X-RateLimit-Limit", String(config.maxRequests));
    c.header("X-RateLimit-Remaining", String(result.remaining));
    c.header("X-RateLimit-Reset", String(Math.ceil(result.resetAt / 1000)));

    if (result.limited) {
      const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
      c.header("Retry-After", String(retryAfter));

      return c.json(
        {
          error: "Too Many Requests",
          message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
          retryAfter,
        },
        429
      );
    }

    await next();
  };
}

// ---------------------------------------------------------------------------
// Pre-configured middleware instances
// ---------------------------------------------------------------------------

/** AI insight generation: 10 requests per minute */
export const aiRateLimit = rateLimit("ai", {
  maxRequests: 10,
  windowMs: 60_000,
});

/** Ingest endpoints: 100 requests per minute */
export const ingestRateLimit = rateLimit("ingest", {
  maxRequests: 100,
  windowMs: 60_000,
});

/** General API: 200 requests per minute */
export const generalRateLimit = rateLimit("api", {
  maxRequests: 200,
  windowMs: 60_000,
});
