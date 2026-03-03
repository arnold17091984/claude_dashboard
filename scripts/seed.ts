/**
 * Seed script: Import stats-cache.json into SQLite
 * Usage: npx tsx scripts/seed.ts
 */
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { estimateCost } from "../src/server/lib/constants";

const DB_PATH = path.join(process.cwd(), "data", "dashboard.db");
const STATS_PATH = path.join(
  process.env.HOME || "~",
  ".claude",
  "stats-cache.json"
);

// Ensure data directory exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

// Create tables
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
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, date)
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

  CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at);
  CREATE INDEX IF NOT EXISTS idx_events_session_id ON events(session_id);
  CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
  CREATE INDEX IF NOT EXISTS idx_events_tool_name ON events(tool_name);
  CREATE INDEX IF NOT EXISTS idx_token_usage_session_id ON token_usage(session_id);
  CREATE INDEX IF NOT EXISTS idx_token_usage_model ON token_usage(model);
  CREATE INDEX IF NOT EXISTS idx_daily_summary_date ON daily_summary(date);
  CREATE INDEX IF NOT EXISTS idx_daily_summary_user_date ON daily_summary(user_id, date);
`);

console.log("Tables created successfully.");

// Read stats-cache.json
if (!fs.existsSync(STATS_PATH)) {
  console.error(`Stats cache not found at ${STATS_PATH}`);
  process.exit(1);
}

const stats = JSON.parse(fs.readFileSync(STATS_PATH, "utf-8"));

// Create default user
const userId = process.env.USER || "local-user";
const insertUser = sqlite.prepare(
  `INSERT OR IGNORE INTO users (id, display_name, email, team) VALUES (?, ?, ?, ?)`
);
insertUser.run(userId, userId, null, "default");
console.log(`User created: ${userId}`);

// Import daily activity as daily_summary
const insertDailySummary = sqlite.prepare(`
  INSERT OR REPLACE INTO daily_summary
  (user_id, date, session_count, message_count, tool_call_count,
   total_input_tokens, total_output_tokens, total_cache_read_tokens, total_cache_creation_tokens,
   estimated_cost_usd, primary_model)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

// Build model tokens lookup by date
const modelTokensByDate: Record<
  string,
  Record<string, number>
> = {};
if (stats.dailyModelTokens) {
  for (const entry of stats.dailyModelTokens) {
    modelTokensByDate[entry.date] = entry.tokensByModel;
  }
}

const insertDailySummaryTx = sqlite.transaction(() => {
  for (const day of stats.dailyActivity || []) {
    const modelTokens = modelTokensByDate[day.date] || {};
    const models = Object.entries(modelTokens);
    const primaryModel =
      models.length > 0
        ? models.sort((a, b) => (b[1] as number) - (a[1] as number))[0][0]
        : null;

    // Estimate tokens split (output tokens are roughly the dailyModelTokens values)
    let totalOutputTokens = 0;
    let totalInputTokens = 0;
    let totalCost = 0;

    for (const [model, tokens] of models) {
      const outputTokens = tokens as number;
      // Rough estimate: input tokens are ~10x output for typical sessions
      const inputTokens = outputTokens * 10;
      totalOutputTokens += outputTokens;
      totalInputTokens += inputTokens;
      totalCost += estimateCost(model, inputTokens, outputTokens, 0, 0);
    }

    insertDailySummary.run(
      userId,
      day.date,
      day.sessionCount,
      day.messageCount,
      day.toolCallCount,
      totalInputTokens,
      totalOutputTokens,
      0,
      0,
      totalCost,
      primaryModel
    );
  }
});
insertDailySummaryTx();
console.log(
  `Imported ${stats.dailyActivity?.length || 0} daily summaries.`
);

// Create synthetic sessions from daily data
const insertSession = sqlite.prepare(`
  INSERT OR IGNORE INTO sessions
  (id, user_id, project_path, project_name, started_at, ended_at, duration_ms, message_count, tool_call_count)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

// Create synthetic token_usage from modelUsage
const insertTokenUsage = sqlite.prepare(`
  INSERT INTO token_usage
  (session_id, user_id, model, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, estimated_cost_usd, timestamp)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertSessionsTx = sqlite.transaction(() => {
  let sessionIndex = 0;
  for (const day of stats.dailyActivity || []) {
    for (let i = 0; i < day.sessionCount; i++) {
      const sessionId = `seed-${day.date}-${i}`;
      const startHour = 9 + Math.floor(Math.random() * 10);
      const startedAt = `${day.date}T${String(startHour).padStart(2, "0")}:00:00.000Z`;
      const durationMs = 600000 + Math.floor(Math.random() * 3600000); // 10-70 min
      const endedAt = new Date(
        new Date(startedAt).getTime() + durationMs
      ).toISOString();

      const messagesPerSession = Math.ceil(
        day.messageCount / day.sessionCount
      );
      const toolCallsPerSession = Math.ceil(
        day.toolCallCount / day.sessionCount
      );

      insertSession.run(
        sessionId,
        userId,
        "/Users/user/projects/app",
        "app",
        startedAt,
        endedAt,
        durationMs,
        messagesPerSession,
        toolCallsPerSession
      );

      // Add token usage for each session
      const modelTokens = modelTokensByDate[day.date] || {};
      for (const [model, tokens] of Object.entries(modelTokens)) {
        const outputTokens = Math.ceil(
          (tokens as number) / day.sessionCount
        );
        const inputTokens = outputTokens * 10;
        const cost = estimateCost(model, inputTokens, outputTokens, 0, 0);
        insertTokenUsage.run(
          sessionId,
          userId,
          model,
          inputTokens,
          outputTokens,
          0,
          0,
          cost,
          startedAt
        );
      }

      sessionIndex++;
    }
  }
  return sessionIndex;
});
const totalSessions = insertSessionsTx();
console.log(`Created ${totalSessions} synthetic sessions.`);

// Create synthetic tool events
const tools = [
  "Edit",
  "Read",
  "Bash",
  "Write",
  "Grep",
  "Glob",
  "Agent",
  "Skill",
  "WebSearch",
  "WebFetch",
  "TodoWrite",
];
const toolWeights = [25, 20, 15, 10, 8, 7, 5, 4, 3, 2, 1];
const totalWeight = toolWeights.reduce((a, b) => a + b, 0);

const insertEvent = sqlite.prepare(`
  INSERT INTO events (session_id, user_id, event_type, role, tool_name, skill_name, subagent_type, model, timestamp)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertEventsTx = sqlite.transaction(() => {
  let eventCount = 0;
  for (const day of stats.dailyActivity || []) {
    for (let i = 0; i < day.sessionCount; i++) {
      const sessionId = `seed-${day.date}-${i}`;
      const toolCallsPerSession = Math.ceil(
        day.toolCallCount / day.sessionCount
      );

      for (let j = 0; j < toolCallsPerSession; j++) {
        // Weighted random tool selection
        let rand = Math.random() * totalWeight;
        let toolIndex = 0;
        for (let k = 0; k < toolWeights.length; k++) {
          rand -= toolWeights[k];
          if (rand <= 0) {
            toolIndex = k;
            break;
          }
        }
        const toolName = tools[toolIndex];
        const skillName =
          toolName === "Skill"
            ? ["commit", "review-pr", "frontend-design"][
                Math.floor(Math.random() * 3)
              ]
            : null;
        const subagentType =
          toolName === "Agent"
            ? ["Explore", "Plan", "general-purpose"][
                Math.floor(Math.random() * 3)
              ]
            : null;

        const modelTokens = modelTokensByDate[day.date] || {};
        const model =
          Object.keys(modelTokens)[0] || "claude-opus-4-6";

        insertEvent.run(
          sessionId,
          userId,
          "tool_use",
          "assistant",
          toolName,
          skillName,
          subagentType,
          model,
          `${day.date}T${String(9 + Math.floor(Math.random() * 10)).padStart(2, "0")}:${String(Math.floor(Math.random() * 60)).padStart(2, "0")}:00.000Z`
        );
        eventCount++;
      }
    }
  }
  return eventCount;
});
const totalEvents = insertEventsTx();
console.log(`Created ${totalEvents} synthetic tool events.`);

// Import overall model usage as token_usage summary
const modelUsage = stats.modelUsage || {};
for (const [model, usage] of Object.entries(modelUsage)) {
  const u = usage as {
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens: number;
    cacheCreationInputTokens: number;
  };
  const cost = estimateCost(
    model,
    u.inputTokens,
    u.outputTokens,
    u.cacheReadInputTokens,
    u.cacheCreationInputTokens
  );
  console.log(
    `Model ${model}: input=${u.inputTokens}, output=${u.outputTokens}, cache_read=${u.cacheReadInputTokens}, cache_write=${u.cacheCreationInputTokens}, cost=$${cost.toFixed(2)}`
  );
}

sqlite.close();
console.log("\nSeed complete! Database at:", DB_PATH);
