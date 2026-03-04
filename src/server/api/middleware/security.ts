/**
 * security.ts
 *
 * Security headers middleware for Hono.
 *
 * Applies industry-standard security headers to every response:
 *  - Content-Security-Policy (CSP)
 *  - X-Content-Type-Options
 *  - X-Frame-Options
 *  - X-XSS-Protection
 *  - Referrer-Policy
 *  - Strict-Transport-Security (HSTS)
 *  - Permissions-Policy
 */

import type { Context, Next } from "hono";

export async function securityHeaders(c: Context, next: Next): Promise<void> {
  await next();

  // Content-Security-Policy: restrict resource loading to same origin,
  // allow inline styles/scripts needed by Next.js, and data: URIs for images.
  // 'unsafe-inline' is required for Next.js style injection and inline scripts.
  c.header(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ")
  );

  // Prevent MIME-type sniffing
  c.header("X-Content-Type-Options", "nosniff");

  // Prevent clickjacking — deny all framing
  c.header("X-Frame-Options", "DENY");

  // XSS filter (legacy browsers)
  c.header("X-XSS-Protection", "1; mode=block");

  // Control referrer information
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");

  // HSTS: enforce HTTPS for 1 year, include subdomains
  c.header(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains"
  );

  // Restrict browser features
  c.header(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()"
  );
}
