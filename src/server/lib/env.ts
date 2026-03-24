/**
 * env.ts
 *
 * Environment variable validation using Zod.
 *
 * Validates all required and optional environment variables on first access.
 * Provides clear error messages for missing or malformed configuration.
 *
 * Usage:
 *   import { env } from "@/server/lib/env";
 *   console.log(env.DATABASE_URL);
 */

import { z } from "zod/v4";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const envSchema = z.object({
  // Database
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required. Set the path to your SQLite database file.")
    .default("./data/dashboard.db"),

  // API Authentication (optional in dev mode)
  DASHBOARD_API_KEY: z
    .string()
    .optional()
    .transform((v) => (v?.trim() === "" ? undefined : v)),

  // AI Insights (optional)
  ANTHROPIC_API_KEY: z
    .string()
    .optional()
    .transform((v) => (v?.trim() === "" ? undefined : v)),

  // Collector settings (optional)
  DASHBOARD_URL: z
    .string()
    .url("DASHBOARD_URL must be a valid URL (e.g., http://localhost:3000)")
    .optional()
    .default("http://localhost:3000"),

  DASHBOARD_USER_ID: z
    .string()
    .optional(),

  // Invite code for new user registration (optional — open registration if not set)
  INVITE_CODE: z
    .string()
    .optional()
    .transform((v) => (v?.trim() === "" ? undefined : v)),

  // Node environment
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

export type Env = z.infer<typeof envSchema>;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

let _env: Env | null = null;

/**
 * Validate and return the parsed environment variables.
 * Throws a descriptive error on first call if validation fails.
 */
export function validateEnv(): Env {
  if (_env) return _env;

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => {
        const path = issue.path.join(".");
        return `  - ${path}: ${issue.message}`;
      })
      .join("\n");

    const message = [
      "",
      "=== Environment Variable Validation Failed ===",
      "",
      "The following environment variables have issues:",
      errors,
      "",
      "Please check your .env file or environment configuration.",
      "See .env.example for reference.",
      "",
      "================================================",
      "",
    ].join("\n");

    console.error(message);
    throw new Error(`Environment validation failed:\n${errors}`);
  }

  _env = result.data;
  return _env;
}

/**
 * Lazily validated environment variables.
 * Access triggers validation on first use.
 */
export const env: Env = new Proxy({} as Env, {
  get(_target, prop: string) {
    const validated = validateEnv();
    return validated[prop as keyof Env];
  },
});

/**
 * Check whether the application is running in production mode.
 */
export function isProduction(): boolean {
  return validateEnv().NODE_ENV === "production";
}

/**
 * Check whether the application is running in development mode.
 */
export function isDevelopment(): boolean {
  return validateEnv().NODE_ENV === "development";
}
