/**
 * Hono middleware: request duration logging.
 *
 * Every request logs its method, path, status, and elapsed time.
 * Requests that take longer than SLOW_THRESHOLD_MS are flagged as WARN.
 */
import type { MiddlewareHandler } from "hono";

const SLOW_THRESHOLD_MS = 500;

export const timingMiddleware: MiddlewareHandler = async (c, next) => {
  const start = Date.now();
  await next();
  const elapsed = Date.now() - start;
  const method = c.req.method;
  const path = new URL(c.req.url).pathname;
  const status = c.res.status;
  const msg = `${method} ${path} ${status} — ${elapsed}ms`;

  if (elapsed >= SLOW_THRESHOLD_MS) {
    console.warn(`[SLOW] ${msg}`);
  } else {
    console.log(`[API]  ${msg}`);
  }
};
