/**
 * backfill-transcripts.ts
 *
 * 既存のトランスクリプトを一括で解析・インポートするスクリプト。
 * ~/.claude/projects/ 配下の全プロジェクトディレクトリをスキャンし、
 * 各 .jsonl ファイルを transcript-parser で解析して DB に保存する。
 *
 * 使い方:
 *   npx tsx scripts/backfill-transcripts.ts
 *   npx tsx scripts/backfill-transcripts.ts --user-id my-user
 *   npx tsx scripts/backfill-transcripts.ts --dry-run
 *   npx tsx scripts/backfill-transcripts.ts --force        (re-process existing sessions)
 *   npx tsx scripts/backfill-transcripts.ts --claude-dir /custom/path/.claude
 */
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../src/server/db/schema";
import { eq, and } from "drizzle-orm";
import { parseTranscriptFile } from "../src/server/services/transcript-parser";
import { aggregateSession } from "../src/server/services/session-aggregator";
import { calculateSessionCost } from "../src/server/services/cost-calculator";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ImportResult {
  success: boolean;
  skipped: boolean;
  message: string;
}

// ---------------------------------------------------------------------------
// CLI 引数のパース
// ---------------------------------------------------------------------------

function parseArgs(): {
  userId: string;
  dryRun: boolean;
  force: boolean;
  claudeDir: string;
  verbose: boolean;
} {
  const argv = process.argv.slice(2);
  const args: Record<string, string> = {};

  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].replace(/^--/, "");
      if (argv[i + 1] && !argv[i + 1].startsWith("--")) {
        args[key] = argv[i + 1];
        i++;
      } else {
        args[key] = "true";
      }
    }
  }

  return {
    userId: args["user-id"] ?? process.env.USER ?? "local-user",
    dryRun: args["dry-run"] === "true",
    force: args["force"] === "true",
    claudeDir:
      args["claude-dir"] ??
      path.join(process.env.HOME ?? "~", ".claude"),
    verbose: args["verbose"] === "true",
  };
}

// ---------------------------------------------------------------------------
// ~/.claude/projects/ 以下の .jsonl ファイルをスキャン
// ---------------------------------------------------------------------------

interface FoundTranscript {
  filePath: string;
  projectDir: string;
  projectName: string;
}

function scanTranscripts(claudeDir: string): FoundTranscript[] {
  const projectsDir = path.join(claudeDir, "projects");
  const results: FoundTranscript[] = [];

  if (!fs.existsSync(projectsDir)) {
    console.warn(`WARN: projects ディレクトリが見つかりません: ${projectsDir}`);
    return results;
  }

  const projectDirs = fs.readdirSync(projectsDir, { withFileTypes: true });

  for (const dirent of projectDirs) {
    if (!dirent.isDirectory()) continue;

    const projectDir = path.join(projectsDir, dirent.name);
    const files = fs.readdirSync(projectDir, { withFileTypes: true });

    for (const file of files) {
      if (!file.isFile() || !file.name.endsWith(".jsonl")) continue;

      results.push({
        filePath: path.join(projectDir, file.name),
        projectDir,
        projectName: dirent.name,
      });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// DB のセットアップ (Drizzle)
// ---------------------------------------------------------------------------

function setupDb() {
  const dbPath =
    process.env.DATABASE_URL ??
    path.join(process.cwd(), "data", "dashboard.db");

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  return drizzle(sqlite, { schema });
}

// ---------------------------------------------------------------------------
// ユーザーの確保
// ---------------------------------------------------------------------------

async function ensureUser(
  db: ReturnType<typeof setupDb>,
  userId: string
): Promise<void> {
  const existing = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(schema.users).values({ id: userId, displayName: userId });
    console.log(`ユーザー作成: ${userId}`);
  }
}

// ---------------------------------------------------------------------------
// デイリーサマリーの更新
// ---------------------------------------------------------------------------

interface DailySummaryDelta {
  sessionCount?: number;
  messageCount?: number;
  toolCallCount?: number;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  costUsd?: number;
  activeMinutes?: number;
  primaryModel?: string | null;
  topTool?: string | null;
  topProject?: string | null;
}

async function upsertDailySummary(
  db: ReturnType<typeof setupDb>,
  userId: string,
  date: string,
  delta: DailySummaryDelta
): Promise<void> {
  const existing = await db
    .select()
    .from(schema.dailySummary)
    .where(
      and(
        eq(schema.dailySummary.userId, userId),
        eq(schema.dailySummary.date, date)
      )
    )
    .limit(1);

  if (existing.length === 0) {
    await db.insert(schema.dailySummary).values({
      userId,
      date,
      sessionCount: delta.sessionCount ?? 0,
      messageCount: delta.messageCount ?? 0,
      toolCallCount: delta.toolCallCount ?? 0,
      totalInputTokens: delta.inputTokens ?? 0,
      totalOutputTokens: delta.outputTokens ?? 0,
      totalCacheReadTokens: delta.cacheReadTokens ?? 0,
      totalCacheCreationTokens: delta.cacheCreationTokens ?? 0,
      estimatedCostUsd: delta.costUsd ?? 0,
      activeMinutes: delta.activeMinutes ?? 0,
      primaryModel: delta.primaryModel ?? null,
      topTool: delta.topTool ?? null,
      topProject: delta.topProject ?? null,
    });
    return;
  }

  const row = existing[0];
  // For derived string fields: prefer the incoming value, fall back to existing.
  await db
    .update(schema.dailySummary)
    .set({
      sessionCount: (row.sessionCount ?? 0) + (delta.sessionCount ?? 0),
      messageCount: (row.messageCount ?? 0) + (delta.messageCount ?? 0),
      toolCallCount: (row.toolCallCount ?? 0) + (delta.toolCallCount ?? 0),
      totalInputTokens: (row.totalInputTokens ?? 0) + (delta.inputTokens ?? 0),
      totalOutputTokens: (row.totalOutputTokens ?? 0) + (delta.outputTokens ?? 0),
      totalCacheReadTokens: (row.totalCacheReadTokens ?? 0) + (delta.cacheReadTokens ?? 0),
      totalCacheCreationTokens:
        (row.totalCacheCreationTokens ?? 0) + (delta.cacheCreationTokens ?? 0),
      estimatedCostUsd: (row.estimatedCostUsd ?? 0) + (delta.costUsd ?? 0),
      activeMinutes: (row.activeMinutes ?? 0) + (delta.activeMinutes ?? 0),
      primaryModel: delta.primaryModel ?? row.primaryModel,
      topTool: delta.topTool ?? row.topTool,
      topProject: delta.topProject ?? row.topProject,
    })
    .where(
      and(
        eq(schema.dailySummary.userId, userId),
        eq(schema.dailySummary.date, date)
      )
    );
}

// ---------------------------------------------------------------------------
// Edge-case guards — called before heavy parsing work
// ---------------------------------------------------------------------------

function checkFileEdgeCases(filePath: string): ImportResult | null {
  if (!fs.existsSync(filePath)) {
    return { success: false, skipped: true, message: "ファイルが見つかりません (スキップ)" };
  }
  if (fs.statSync(filePath).size === 0) {
    return { success: true, skipped: true, message: "空ファイル (スキップ)" };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Persist session + child rows (insert or force-overwrite)
// ---------------------------------------------------------------------------

async function persistSession(
  db: ReturnType<typeof setupDb>,
  aggregated: Awaited<ReturnType<typeof aggregateSession>>,
  userId: string,
  projectPath: string,
  projectName: string,
  isExisting: boolean
): Promise<void> {
  const BATCH_SIZE = 200;

  if (isExisting) {
    // Overwrite session row, then clear stale child rows.
    await db
      .update(schema.sessions)
      .set({
        projectPath,
        projectName,
        startedAt: aggregated.startedAt,
        endedAt: aggregated.endedAt,
        durationMs: aggregated.durationMs,
        messageCount: aggregated.messageCount,
        toolCallCount: aggregated.toolCallCount,
      })
      .where(eq(schema.sessions.id, aggregated.sessionId));

    await db.delete(schema.events).where(eq(schema.events.sessionId, aggregated.sessionId));
    await db.delete(schema.tokenUsage).where(eq(schema.tokenUsage.sessionId, aggregated.sessionId));
  } else {
    await db.insert(schema.sessions).values({
      id: aggregated.sessionId,
      userId,
      projectPath,
      projectName,
      startedAt: aggregated.startedAt,
      endedAt: aggregated.endedAt,
      durationMs: aggregated.durationMs,
      messageCount: aggregated.messageCount,
      toolCallCount: aggregated.toolCallCount,
    });
  }

  // Events (batched)
  for (let i = 0; i < aggregated.toolEvents.length; i += BATCH_SIZE) {
    const batch = aggregated.toolEvents.slice(i, i + BATCH_SIZE);
    await db.insert(schema.events).values(
      batch.map((e) => ({
        sessionId: aggregated.sessionId,
        userId,
        eventType: "tool_use",
        role: e.role ?? "assistant",
        toolName: e.toolName,
        skillName: e.skillName,
        subagentType: e.subagentType,
        model: e.model,
        timestamp: e.timestamp,
      }))
    );
  }

  // Token usage (batched)
  const costResult = calculateSessionCost(aggregated);
  for (let i = 0; i < aggregated.tokenUsageEvents.length; i += BATCH_SIZE) {
    const batch = aggregated.tokenUsageEvents.slice(i, i + BATCH_SIZE);
    await db.insert(schema.tokenUsage).values(
      batch.map((u, batchIdx) => ({
        sessionId: aggregated.sessionId,
        userId,
        model: u.model,
        inputTokens: u.inputTokens,
        outputTokens: u.outputTokens,
        cacheReadTokens: u.cacheReadInputTokens,
        cacheCreationTokens: u.cacheCreationInputTokens,
        estimatedCostUsd: costResult.perTurn[i + batchIdx] ?? 0,
        timestamp: u.timestamp,
      }))
    );
  }
}

// ---------------------------------------------------------------------------
// 単一トランスクリプトのインポート
// ---------------------------------------------------------------------------

async function importTranscript(
  db: ReturnType<typeof setupDb>,
  found: FoundTranscript,
  userId: string,
  dryRun: boolean,
  verbose: boolean,
  force: boolean
): Promise<ImportResult> {
  const { filePath, projectName } = found;

  // Quick edge-case checks before doing any I/O
  const edgeResult = checkFileEdgeCases(filePath);
  if (edgeResult) return edgeResult;

  // Parse — corrupted/unreadable lines are silently skipped inside the parser
  let transcript;
  try {
    transcript = await parseTranscriptFile(filePath);
  } catch (parseErr) {
    return {
      success: false,
      skipped: true,
      message: `解析エラー: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
    };
  }

  if (transcript.entries.length === 0) {
    return { success: true, skipped: true, message: "エントリなし (スキップ)" };
  }

  const aggregated = aggregateSession(transcript);
  const costResult = calculateSessionCost(aggregated);

  if (verbose) {
    console.log(
      `  解析完了: entries=${transcript.entries.length}, tools=${aggregated.toolCallCount}, cost=$${costResult.totalCostUsd.toFixed(4)}`
    );
  }

  if (dryRun) {
    return {
      success: true,
      skipped: false,
      message: `[DRY RUN] session=${aggregated.sessionId}, messages=${aggregated.messageCount}, cost=$${costResult.totalCostUsd.toFixed(4)}`,
    };
  }

  // Check whether the session already exists
  const existingSession = await db
    .select({ id: schema.sessions.id })
    .from(schema.sessions)
    .where(eq(schema.sessions.id, aggregated.sessionId))
    .limit(1);

  const isExisting = existingSession.length > 0;

  if (isExisting && !force) {
    return { success: true, skipped: true, message: "既存セッション (スキップ)" };
  }

  const projectPath = `~/.claude/projects/${projectName}`;
  await persistSession(db, aggregated, userId, projectPath, projectName, isExisting);

  // Daily summary
  const date = aggregated.startedAt.slice(0, 10);
  const activeMinutes = aggregated.durationMs
    ? Math.round(aggregated.durationMs / 60_000)
    : 0;

  const toolCounts: Record<string, number> = {};
  for (const e of aggregated.toolEvents) {
    toolCounts[e.toolName] = (toolCounts[e.toolName] ?? 0) + 1;
  }
  const topTool = Object.entries(toolCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  await upsertDailySummary(db, userId, date, {
    // Do not double-count sessionCount when force-reprocessing an existing session.
    sessionCount: isExisting ? 0 : 1,
    messageCount: aggregated.messageCount,
    toolCallCount: aggregated.toolCallCount,
    inputTokens: aggregated.totalTokenUsage.inputTokens,
    outputTokens: aggregated.totalTokenUsage.outputTokens,
    cacheReadTokens: aggregated.totalTokenUsage.cacheReadInputTokens,
    cacheCreationTokens: aggregated.totalTokenUsage.cacheCreationInputTokens,
    costUsd: costResult.totalCostUsd,
    activeMinutes,
    primaryModel: aggregated.primaryModel ?? null,
    topTool,
    topProject: projectName,
  });

  const action = isExisting ? "上書き完了" : "インポート完了";
  return {
    success: true,
    skipped: false,
    message: `${action}: session=${aggregated.sessionId}, messages=${aggregated.messageCount}, tools=${aggregated.toolCallCount}, cost=$${costResult.totalCostUsd.toFixed(4)}`,
  };
}

// ---------------------------------------------------------------------------
// メイン
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { userId, dryRun, force, claudeDir, verbose } = parseArgs();

  console.log("=".repeat(60));
  console.log("Claude Code トランスクリプト バックフィル");
  console.log("=".repeat(60));
  console.log(`claude-dir : ${claudeDir}`);
  console.log(`user-id    : ${userId}`);
  console.log(`dry-run    : ${dryRun}`);
  console.log(`force      : ${force}`);
  console.log(`verbose    : ${verbose}`);
  console.log("");

  const transcripts = scanTranscripts(claudeDir);
  console.log(`発見したトランスクリプト: ${transcripts.length} ファイル`);

  if (transcripts.length === 0) {
    console.log("インポートするファイルがありません。");
    return;
  }

  if (dryRun) {
    console.log("[DRY RUN モード] DBへの書き込みは行いません\n");
  }

  const db = setupDb();

  if (!dryRun) {
    await ensureUser(db, userId);
  }

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (let i = 0; i < transcripts.length; i++) {
    const found = transcripts[i];
    const prefix = `[${i + 1}/${transcripts.length}]`;
    const shortPath = found.filePath.replace(process.env.HOME ?? "", "~");

    if (verbose) {
      console.log(`${prefix} 処理中: ${shortPath}`);
    }

    try {
      const result = await importTranscript(db, found, userId, dryRun, verbose, force);

      if (result.skipped) {
        skipCount++;
        if (verbose) {
          console.log(`  -> ${result.message}`);
        }
      } else {
        successCount++;
        console.log(`${prefix} ${result.message}`);
      }
    } catch (err) {
      errorCount++;
      console.error(`${prefix} ERROR: ${shortPath}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log("");
  console.log("=".repeat(60));
  console.log("バックフィル完了");
  console.log(`  成功: ${successCount}`);
  console.log(`  スキップ: ${skipCount}`);
  console.log(`  エラー: ${errorCount}`);
  console.log(`  合計: ${transcripts.length}`);
  console.log("=".repeat(60));
}

await main();
