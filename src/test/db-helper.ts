/**
 * db-helper.ts
 *
 * Creates a fresh in-memory SQLite database for each test suite.
 * All schema tables are created from scratch, foreign-key constraints enabled.
 *
 * Usage:
 *   import { createTestDb } from "@/test/db-helper";
 *   const { db, cleanup } = createTestDb();
 *   afterAll(cleanup);
 */
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@/server/db/schema";

// Re-export schema types for convenience
export { schema };

/** Drizzle DB type bound to the schema */
export type TestDB = ReturnType<typeof drizzle<typeof schema>>;

/** Creates an in-memory SQLite database with all tables created. */
export function createTestDb(): { db: TestDB; cleanup: () => void } {
  const sqlite = new Database(":memory:");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  // Create tables in dependency order
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      email TEXT,
      team TEXT,
      avatar_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      project_path TEXT NOT NULL,
      project_name TEXT,
      git_branch TEXT,
      claude_version TEXT,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      duration_ms INTEGER,
      message_count INTEGER DEFAULT 0,
      tool_call_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL REFERENCES sessions(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      event_type TEXT NOT NULL,
      role TEXT,
      tool_name TEXT,
      skill_name TEXT,
      subagent_type TEXT,
      model TEXT,
      timestamp TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS token_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL REFERENCES sessions(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      model TEXT NOT NULL,
      input_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      cache_read_tokens INTEGER DEFAULT 0,
      cache_creation_tokens INTEGER DEFAULT 0,
      estimated_cost_usd REAL DEFAULT 0,
      timestamp TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS daily_summary (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(id),
      date TEXT NOT NULL,
      session_count INTEGER DEFAULT 0,
      message_count INTEGER DEFAULT 0,
      tool_call_count INTEGER DEFAULT 0,
      total_input_tokens INTEGER DEFAULT 0,
      total_output_tokens INTEGER DEFAULT 0,
      total_cache_read_tokens INTEGER DEFAULT 0,
      total_cache_creation_tokens INTEGER DEFAULT 0,
      estimated_cost_usd REAL DEFAULT 0,
      active_minutes INTEGER DEFAULT 0,
      primary_model TEXT,
      top_tool TEXT,
      top_project TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ai_insights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      insight_type TEXT NOT NULL,
      target_user_id TEXT REFERENCES users(id),
      content TEXT NOT NULL,
      metadata TEXT,
      generated_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT
    );
  `);

  const db = drizzle(sqlite, { schema });

  const cleanup = () => {
    sqlite.close();
  };

  return { db, cleanup };
}

/** Seed data helpers */
export function seedUser(
  db: TestDB,
  overrides: Partial<typeof schema.users.$inferInsert> = {}
) {
  const user = {
    id: "user-1",
    displayName: "Test User",
    email: "test@example.com",
    team: "engineering",
    ...overrides,
  };
  db.insert(schema.users).values(user).run();
  return user;
}

export function seedSession(
  db: TestDB,
  overrides: Partial<typeof schema.sessions.$inferInsert> = {}
) {
  const now = new Date().toISOString();
  const session = {
    id: "session-1",
    userId: "user-1",
    projectPath: "/projects/test",
    projectName: "test-project",
    gitBranch: "main",
    startedAt: now,
    messageCount: 5,
    toolCallCount: 3,
    ...overrides,
  };
  db.insert(schema.sessions).values(session).run();
  return session;
}

export function seedTokenUsage(
  db: TestDB,
  overrides: Partial<typeof schema.tokenUsage.$inferInsert> = {}
) {
  const now = new Date().toISOString();
  const usage = {
    sessionId: "session-1",
    userId: "user-1",
    model: "claude-sonnet-4-6",
    inputTokens: 1000,
    outputTokens: 500,
    cacheReadTokens: 200,
    cacheCreationTokens: 100,
    estimatedCostUsd: 0.01,
    timestamp: now,
    ...overrides,
  };
  db.insert(schema.tokenUsage).values(usage).run();
  return usage;
}

export function seedDailySummary(
  db: TestDB,
  overrides: Partial<typeof schema.dailySummary.$inferInsert> = {}
) {
  const today = new Date().toISOString().slice(0, 10);
  const summary = {
    userId: "user-1",
    date: today,
    sessionCount: 2,
    messageCount: 10,
    toolCallCount: 5,
    totalInputTokens: 2000,
    totalOutputTokens: 1000,
    estimatedCostUsd: 0.02,
    activeMinutes: 30,
    topTool: "Read",
    ...overrides,
  };
  db.insert(schema.dailySummary).values(summary).run();
  return summary;
}

export function seedEvent(
  db: TestDB,
  overrides: Partial<typeof schema.events.$inferInsert> = {}
) {
  const now = new Date().toISOString();
  const event = {
    sessionId: "session-1",
    userId: "user-1",
    eventType: "tool_use",
    toolName: "Read",
    timestamp: now,
    ...overrides,
  };
  db.insert(schema.events).values(event).run();
  return event;
}
