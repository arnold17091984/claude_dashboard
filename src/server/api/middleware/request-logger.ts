/**
 * request-logger.ts
 *
 * Request logging middleware for Hono.
 *
 * Logs every API request with:
 *  - HTTP method
 *  - Request path
 *  - Response status code
 *  - Response time in milliseconds
 *  - Client IP (from X-Forwarded-For or fallback)
 *
 * Sensitive headers (API keys, authorization tokens) are masked in logs.
 */

import type { Context, Next } from "hono";

// ---------------------------------------------------------------------------
// Header masking
// ---------------------------------------------------------------------------

/** Headers whose values should be masked in log output. */
const SENSITIVE_HEADERS = new Set([
  "x-api-key",
  "authorization",
  "cookie",
  "set-cookie",
  "x-auth-token",
]);

/**
 * Mask a header value, showing only the first 4 characters.
 */
function maskValue(value: string): string {
  if (value.length <= 4) return "****";
  return value.slice(0, 4) + "****";
}

/**
 * Build a safe representation of request headers for logging.
 * Only includes a curated set of useful headers, masking sensitive ones.
 */
function getSafeHeaders(c: Context): Record<string, string> {
  const safe: Record<string, string> = {};
  const headersToLog = [
    "content-type",
    "user-agent",
    "x-forwarded-for",
    "x-api-key",
    "authorization",
  ];

  for (const name of headersToLog) {
    const value = c.req.header(name);
    if (value) {
      safe[name] = SENSITIVE_HEADERS.has(name) ? maskValue(value) : value;
    }
  }

  return safe;
}

// ---------------------------------------------------------------------------
// Client IP extraction
// ---------------------------------------------------------------------------

function getClientIp(c: Context): string {
  const forwarded = c.req.header("X-Forwarded-For");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export async function requestLogger(c: Context, next: Next): Promise<void> {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;
  const clientIp = getClientIp(c);

  try {
    await next();
  } catch (error) {
    const duration = Date.now() - start;
    console.error(
      JSON.stringify({
        level: "error",
        timestamp: new Date().toISOString(),
        method,
        path,
        clientIp,
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : "Unknown error",
        headers: getSafeHeaders(c),
      })
    );
    throw error;
  }

  const duration = Date.now() - start;
  const status = c.res.status;

  const logEntry = {
    level: status >= 500 ? "error" : status >= 400 ? "warn" : "info",
    timestamp: new Date().toISOString(),
    method,
    path,
    status,
    duration: `${duration}ms`,
    clientIp,
  };

  // Log at appropriate level
  if (status >= 500) {
    console.error(JSON.stringify(logEntry));
  } else if (status >= 400) {
    console.warn(JSON.stringify(logEntry));
  } else {
    console.log(JSON.stringify(logEntry));
  }
}
