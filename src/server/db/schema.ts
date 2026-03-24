import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  email: text("email"),
  team: text("team"),
  avatarUrl: text("avatar_url"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    projectPath: text("project_path").notNull(),
    projectName: text("project_name"),
    gitBranch: text("git_branch"),
    claudeVersion: text("claude_version"),
    startedAt: text("started_at").notNull(),
    endedAt: text("ended_at"),
    durationMs: integer("duration_ms"),
    messageCount: integer("message_count").default(0),
    toolCallCount: integer("tool_call_count").default(0),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (t) => [
    // Primary range-scan: time-ordered list/pagination queries
    index("idx_sessions_started_at").on(t.startedAt),
    // Per-user session history
    index("idx_sessions_user_id_started_at").on(t.userId, t.startedAt),
    // Per-project aggregation
    index("idx_sessions_project_name").on(t.projectName),
  ]
);

export const events = sqliteTable(
  "events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    eventType: text("event_type").notNull(),
    role: text("role"),
    toolName: text("tool_name"),
    skillName: text("skill_name"),
    subagentType: text("subagent_type"),
    model: text("model"),
    timestamp: text("timestamp").notNull(),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (t) => [
    // Time-range scans for tool aggregations
    index("idx_events_timestamp").on(t.timestamp),
    // Per-session tool lookup
    index("idx_events_session_id").on(t.sessionId),
    // Per-user tool analytics
    index("idx_events_user_id_timestamp").on(t.userId, t.timestamp),
    // Tool name grouping (filter nulls handled at query level)
    index("idx_events_tool_name").on(t.toolName),
  ]
);

export const tokenUsage = sqliteTable(
  "token_usage",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").default(0),
    outputTokens: integer("output_tokens").default(0),
    cacheReadTokens: integer("cache_read_tokens").default(0),
    cacheCreationTokens: integer("cache_creation_tokens").default(0),
    estimatedCostUsd: real("estimated_cost_usd").default(0),
    timestamp: text("timestamp").notNull(),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (t) => [
    // Time-range cost aggregations
    index("idx_token_usage_timestamp").on(t.timestamp),
    // Per-session cost rollup
    index("idx_token_usage_session_id").on(t.sessionId),
    // Per-user cost analytics
    index("idx_token_usage_user_id_timestamp").on(t.userId, t.timestamp),
    // Model cost distribution
    index("idx_token_usage_model").on(t.model),
  ]
);

export const dailySummary = sqliteTable(
  "daily_summary",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    date: text("date").notNull(),
    sessionCount: integer("session_count").default(0),
    messageCount: integer("message_count").default(0),
    toolCallCount: integer("tool_call_count").default(0),
    totalInputTokens: integer("total_input_tokens").default(0),
    totalOutputTokens: integer("total_output_tokens").default(0),
    totalCacheReadTokens: integer("total_cache_read_tokens").default(0),
    totalCacheCreationTokens: integer("total_cache_creation_tokens").default(0),
    estimatedCostUsd: real("estimated_cost_usd").default(0),
    activeMinutes: integer("active_minutes").default(0),
    primaryModel: text("primary_model"),
    topTool: text("top_tool"),
    topProject: text("top_project"),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (t) => [
    // Ranking + activity queries scan by date range
    index("idx_daily_summary_date").on(t.date),
    // Per-user daily trend
    index("idx_daily_summary_user_id_date").on(t.userId, t.date),
  ]
);

// Installed skills/commands/agents inventory per user
export const skillInventory = sqliteTable(
  "skill_inventory",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    name: text("name").notNull(),
    type: text("type").notNull(), // "command" | "skill" | "agent"
    syncedAt: text("synced_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (t) => [
    index("idx_skill_inventory_user_id").on(t.userId),
    index("idx_skill_inventory_user_type").on(t.userId, t.type),
  ]
);

export const aiInsights = sqliteTable("ai_insights", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  insightType: text("insight_type").notNull(),
  targetUserId: text("target_user_id").references(() => users.id),
  content: text("content").notNull(),
  metadata: text("metadata"),
  generatedAt: text("generated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  expiresAt: text("expires_at"),
});

// ---------------------------------------------------------------------------
// Authentication tables (dashboard login — separate from Claude Code "users")
// ---------------------------------------------------------------------------

// Dashboard accounts: nickname/password login for the web UI
export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(), // UUID
  nickname: text("nickname").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("member"), // "admin" | "member"
  linkedUserId: text("linked_user_id").references(() => users.id), // Links to Claude Code user
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Personal API keys for data ingestion via Claude Code hooks
export const personalApiKeys = sqliteTable("personal_api_keys", {
  id: text("id").primaryKey(), // The API key itself (dk_xxxxxxxxxxxx)
  accountId: text("account_id").notNull().references(() => accounts.id),
  label: text("label").notNull().default("default"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  lastUsedAt: text("last_used_at"),
});

// Web UI sessions (cookie-based auth)
export const authSessions = sqliteTable("auth_sessions", {
  id: text("id").primaryKey(), // Session token
  accountId: text("account_id").notNull().references(() => accounts.id),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});
