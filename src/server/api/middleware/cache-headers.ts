/**
 * cache-headers.ts
 *
 * HTTP caching middleware for Hono.
 *
 * Sets Cache-Control headers based on route pattern and HTTP method.
 * Also implements a lightweight ETag mechanism using body length + time bucket
 * to enable 304 Not Modified responses for unchanged data.
 *
 * Cache strategy:
 *  - Dashboard data routes: 30s fresh, 60s stale-while-revalidate
 *  - Session list:          15s fresh, 30s stale-while-revalidate
 *  - Session detail:        60s fresh, 120s stale-while-revalidate
 *  - AI insights (GET):     120s fresh, 300s stale-while-revalidate
 *  - Health/ping:           no-cache
 *  - Mutating methods:      no-store
 */

import type { Context, Next } from "hono";

interface CachePolicy {
  maxAge: number;
  staleWhileRevalidate: number;
}

/**
 * Returns the cache policy for a given pathname, or null for no-cache routes.
 * Returns undefined to signal no-store (mutating method or unknown).
 */
function resolveCachePolicy(
  method: string,
  pathname: string
): CachePolicy | null | undefined {
  // Mutating methods must never be cached
  if (method === "POST" || method === "PUT" || method === "DELETE" || method === "PATCH") {
    return undefined; // no-store
  }

  // Strip /api/v1 prefix for matching
  const path = pathname.replace(/^\/api\/v1/, "");

  // Health and liveness checks — must always be fresh
  if (path === "/health" || path.startsWith("/health/") || path === "/ping") {
    return null; // no-cache
  }

  // AI insights — expensive to generate, longer cache
  if (path === "/ai-insights" || path.startsWith("/ai-insights/")) {
    return { maxAge: 120, staleWhileRevalidate: 300 };
  }

  // Session detail: /sessions/:id (has a segment after /sessions/)
  if (/^\/sessions\/[^/]+/.test(path)) {
    return { maxAge: 60, staleWhileRevalidate: 120 };
  }

  // Session list
  if (path === "/sessions" || path.startsWith("/sessions?")) {
    return { maxAge: 15, staleWhileRevalidate: 30 };
  }

  // Main dashboard data routes
  const dashboardRoutes = [
    "/overview",
    "/ranking",
    "/users",
    "/tools",
    "/models",
    "/projects",
  ];
  for (const route of dashboardRoutes) {
    if (path === route || path.startsWith(`${route}/`) || path.startsWith(`${route}?`)) {
      return { maxAge: 30, staleWhileRevalidate: 60 };
    }
  }

  // Default: no specific policy — skip cache header
  return undefined;
}

/**
 * Generates a simple ETag value from the response body length and
 * a time bucket aligned to the cache's max-age period.
 *
 * Format: W/"<bodyLength>-<timeBucket>"
 * This is a weak ETag (W/) because the value is heuristic, not a content hash.
 */
function buildETag(bodyLength: number, maxAge: number): string {
  const bucket = Math.floor(Date.now() / 1000 / maxAge);
  return `W/"${bodyLength}-${bucket}"`;
}

export async function cacheHeadersMiddleware(c: Context, next: Next): Promise<void> {
  const method = c.req.method.toUpperCase();
  const pathname = new URL(c.req.url).pathname;

  await next();

  // Only process 2xx JSON responses
  const status = c.res.status;
  if (status < 200 || status >= 300) {
    return;
  }

  const policy = resolveCachePolicy(method, pathname);

  // Mutating method or unconfigured route — mark as no-store
  if (policy === undefined) {
    // Only set no-store for mutating methods; leave GET routes without explicit
    // policy alone to avoid overriding any response-level headers set by routes.
    if (method !== "GET" && method !== "HEAD") {
      c.header("Cache-Control", "no-store");
    }
    return;
  }

  // Health / liveness — always revalidate
  if (policy === null) {
    c.header("Cache-Control", "no-cache");
    return;
  }

  // Set Cache-Control
  c.header(
    "Cache-Control",
    `public, max-age=${policy.maxAge}, stale-while-revalidate=${policy.staleWhileRevalidate}`
  );

  // ETag + conditional request handling
  // We need the response body length to compute the ETag.
  // Clone the response to read the body without consuming the original.
  const originalRes = c.res;

  try {
    const bodyText = await originalRes.clone().text();
    const etag = buildETag(bodyText.length, policy.maxAge);

    c.header("ETag", etag);

    // Check If-None-Match for 304 shortcut
    const ifNoneMatch = c.req.header("If-None-Match");
    if (ifNoneMatch && ifNoneMatch === etag) {
      // Replace the response with a 304 — preserve original headers
      const headers = new Headers();
      // Copy cache-related headers to the 304 response
      headers.set("Cache-Control", `public, max-age=${policy.maxAge}, stale-while-revalidate=${policy.staleWhileRevalidate}`);
      headers.set("ETag", etag);
      c.res = new Response(null, { status: 304, headers });
    }
  } catch {
    // If we cannot read the body (streaming, etc.), skip ETag silently
  }
}
