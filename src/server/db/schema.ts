import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

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

export const sessions = sqliteTable("sessions", {
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
});

export const events = sqliteTable("events", {
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
});

export const tokenUsage = sqliteTable("token_usage", {
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
});

export const dailySummary = sqliteTable("daily_summary", {
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
});

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
