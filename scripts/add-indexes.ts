/**
 * add-indexes.ts
 *
 * Applies performance indexes to the existing SQLite database.
 * Safe to run multiple times (uses CREATE INDEX IF NOT EXISTS).
 *
 * Usage:
 *   pnpm tsx scripts/add-indexes.ts
 */
import Database from "better-sqlite3";
import path from "path";

const DB_PATH =
  process.env.DATABASE_URL ||
  path.join(process.cwd(), "data", "dashboard.db");

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

const indexes: string[] = [
  // sessions
  "CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at)",
  "CREATE INDEX IF NOT EXISTS idx_sessions_user_id_started_at ON sessions(user_id, started_at)",
  "CREATE INDEX IF NOT EXISTS idx_sessions_project_name ON sessions(project_name)",

  // events
  "CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp)",
  "CREATE INDEX IF NOT EXISTS idx_events_session_id ON events(session_id)",
  "CREATE INDEX IF NOT EXISTS idx_events_user_id_timestamp ON events(user_id, timestamp)",
  "CREATE INDEX IF NOT EXISTS idx_events_tool_name ON events(tool_name)",

  // token_usage
  "CREATE INDEX IF NOT EXISTS idx_token_usage_timestamp ON token_usage(timestamp)",
  "CREATE INDEX IF NOT EXISTS idx_token_usage_session_id ON token_usage(session_id)",
  "CREATE INDEX IF NOT EXISTS idx_token_usage_user_id_timestamp ON token_usage(user_id, timestamp)",
  "CREATE INDEX IF NOT EXISTS idx_token_usage_model ON token_usage(model)",

  // daily_summary
  "CREATE INDEX IF NOT EXISTS idx_daily_summary_date ON daily_summary(date)",
  "CREATE INDEX IF NOT EXISTS idx_daily_summary_user_id_date ON daily_summary(user_id, date)",
];

console.log(`Applying ${indexes.length} indexes to ${DB_PATH} ...`);

for (const sql of indexes) {
  const name = sql.match(/idx_\w+/)?.[0] ?? sql;
  try {
    db.exec(sql);
    console.log(`  OK  ${name}`);
  } catch (err) {
    console.error(`  FAIL ${name}:`, err);
  }
}

db.close();
console.log("Done.");
