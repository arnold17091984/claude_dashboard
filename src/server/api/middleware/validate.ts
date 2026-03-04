/**
 * validate.ts
 *
 * Shared input validation utilities for API routes.
 *
 * Provides Zod schemas and helper functions for common query parameters:
 *  - Period validation (7d, 30d, 90d)
 *  - Pagination validation (page > 0, limit 1-100)
 *  - String sanitization
 *  - Sort parameter validation
 */

import { z } from "zod/v4";

// ---------------------------------------------------------------------------
// Period validation
// ---------------------------------------------------------------------------

/** Valid period values for time-range queries. */
export const VALID_PERIODS = ["7d", "30d", "90d"] as const;
export type Period = (typeof VALID_PERIODS)[number];

export const periodSchema = z
  .enum(VALID_PERIODS)
  .default("7d");

/**
 * Parse and validate a period query parameter.
 * Returns the validated period or the default ("7d") if invalid.
 */
export function parsePeriod(value: string | undefined): Period {
  const result = periodSchema.safeParse(value);
  return result.success ? result.data : "7d";
}

/**
 * Convert a period string to number of days.
 */
export function periodToDays(period: Period): number {
  switch (period) {
    case "90d":
      return 90;
    case "30d":
      return 30;
    case "7d":
    default:
      return 7;
  }
}

/**
 * Get the ISO date string for the start of a period.
 */
export function periodToSince(period: Period): string {
  const days = periodToDays(period);
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

// ---------------------------------------------------------------------------
// Pagination validation
// ---------------------------------------------------------------------------

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type Pagination = z.infer<typeof paginationSchema>;

/**
 * Parse and validate pagination query parameters.
 */
export function parsePagination(
  page: string | undefined,
  limit: string | undefined
): Pagination {
  const result = paginationSchema.safeParse({
    page: page || "1",
    limit: limit || "20",
  });
  return result.success ? result.data : { page: 1, limit: 20 };
}

// ---------------------------------------------------------------------------
// Sort parameter validation
// ---------------------------------------------------------------------------

/**
 * Validate a sort parameter against a whitelist of allowed values.
 */
export function parseSortBy<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  defaultValue: T
): T {
  if (value && (allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  return defaultValue;
}

// ---------------------------------------------------------------------------
// Limit query parameter
// ---------------------------------------------------------------------------

export const limitSchema = z.coerce.number().int().min(1).max(100).default(10);

/**
 * Parse and validate a limit query parameter.
 */
export function parseLimit(value: string | undefined): number {
  const result = limitSchema.safeParse(value || "10");
  return result.success ? result.data : 10;
}

// ---------------------------------------------------------------------------
// String sanitization
// ---------------------------------------------------------------------------

/**
 * Sanitize a string by removing potentially dangerous characters.
 * Strips HTML tags, null bytes, and control characters.
 */
export function sanitizeString(input: string): string {
  return input
    // Remove null bytes
    .replace(/\0/g, "")
    // Remove HTML tags
    .replace(/<[^>]*>/g, "")
    // Remove control characters (except newline, tab)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    // Trim whitespace
    .trim();
}

/**
 * Validate an insight type query parameter.
 */
export const insightTypeSchema = z
  .string()
  .min(1)
  .max(50)
  .regex(/^[a-zA-Z0-9_-]+$/, "Invalid insight type format")
  .optional();

export function parseInsightType(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const result = insightTypeSchema.safeParse(value);
  return result.success ? result.data : undefined;
}
