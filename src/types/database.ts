/**
 * database.ts
 *
 * Database entity types derived from the Drizzle ORM schema defined in
 * src/server/db/schema.ts. These types represent the exact shape of rows
 * returned from SQLite via Drizzle's select queries.
 *
 * Conventions:
 *  - All timestamp / date columns are stored as ISO-8601 strings in SQLite.
 *  - Nullable columns (no `.notNull()`) are typed `string | null`.
 *  - Integer columns with `.default(0)` are typed `number | null` because
 *    Drizzle infers them as potentially null when selected without a fallback.
 *  - `real` columns follow the same convention.
 */

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------

/** Full row from the `users` table. */
export interface DbUser {
  id: string;
  displayName: string;
  email: string | null;
  team: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Minimal projection used in listings / lookups. */
export interface DbUserSummary
  extends Pick<DbUser, "id" | "displayName" | "email" | "team" | "avatarUrl"> {}

// ---------------------------------------------------------------------------
// sessions
// ---------------------------------------------------------------------------

/** Full row from the `sessions` table. */
export interface DbSession {
  id: string;
  userId: string;
  projectPath: string;
  projectName: string | null;
  gitBranch: string | null;
  claudeVersion: string | null;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  messageCount: number | null;
  toolCallCount: number | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// events
// ---------------------------------------------------------------------------

/** Full row from the `events` table. */
export interface DbEvent {
  id: number;
  sessionId: string;
  userId: string;
  eventType: string;
  role: string | null;
  toolName: string | null;
  skillName: string | null;
  subagentType: string | null;
  model: string | null;
  timestamp: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// token_usage
// ---------------------------------------------------------------------------

/** Full row from the `token_usage` table. */
export interface DbTokenUsage {
  id: number;
  sessionId: string;
  userId: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadTokens: number | null;
  cacheCreationTokens: number | null;
  estimatedCostUsd: number | null;
  timestamp: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// daily_summary
// ---------------------------------------------------------------------------

/** Full row from the `daily_summary` table. */
export interface DbDailySummary {
  id: number;
  userId: string;
  date: string;
  sessionCount: number | null;
  messageCount: number | null;
  toolCallCount: number | null;
  totalInputTokens: number | null;
  totalOutputTokens: number | null;
  totalCacheReadTokens: number | null;
  totalCacheCreationTokens: number | null;
  estimatedCostUsd: number | null;
  activeMinutes: number | null;
  primaryModel: string | null;
  topTool: string | null;
  topProject: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// ai_insights
// ---------------------------------------------------------------------------

/** Enumerated insight type values used by the application. */
export type InsightType =
  | "weekly_summary"
  | "cost_optimization"
  | "anomaly"
  | "user_insight"
  | (string & {}); // allow arbitrary future types without breaking existing code

/** Full row from the `ai_insights` table. */
export interface DbAiInsight {
  id: number;
  insightType: InsightType;
  targetUserId: string | null;
  content: string;
  metadata: string | null;
  generatedAt: string;
  expiresAt: string | null;
}

// ---------------------------------------------------------------------------
// Tool categories (derived from constants, not a DB table)
// ---------------------------------------------------------------------------

export type ToolCategory = "builtin" | "skill" | "subagent" | "mcp" | "other";
