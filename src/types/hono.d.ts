/**
 * hono.d.ts
 *
 * Extends Hono's context variable map so TypeScript knows the shape of
 * values attached via c.set() / c.get() across all routes.
 */

import type { AuthAccount } from "@/components/auth-guard";

declare module "hono" {
  interface ContextVariableMap {
    /** Set by apiKeyAuth middleware in dev mode */
    devMode: boolean;
    /** Set by apiKeyAuth when a personal API key is used */
    linkedUserId: string | null;
    /** Set by sessionAuth when a valid web session is present */
    account: AuthAccount;
  }
}
