/**
 * repair-daily-summary.ts
 *
 * Recalculates active_minutes, primary_model, top_tool, and top_project for
 * every existing daily_summary row from the raw events, token_usage, and
 * sessions tables.
 *
 * This is safe to run repeatedly — it only UPDATEs existing rows, never
 * inserts new ones. It does not touch numeric counters (session_count,
 * message_count, etc.) or cost figures; those are intentionally left as-is.
 *
 * Usage:
 *   pnpm db:repair
 *   pnpm db:repair --dry-run
 *   pnpm db:repair --user-id some-user
 */
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../src/server/db/schema";
import { eq, and, sql, count, sum, desc } from "drizzle-orm";
import path from "node:path";
import fs from "node:fs";

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(): { dryRun: boolean; userId: string | null; verbose: boolean } {
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
    dryRun: args["dry-run"] === "true",
    userId: args["user-id"] ?? null,
    verbose: args["verbose"] === "true",
  };
}

// ---------------------------------------------------------------------------
// DB setup
// ---------------------------------------------------------------------------

function setupDb() {
  const dbPath =
    process.env.DATABASE_URL ??
    path.join(process.cwd(), "data", "dashboard.db");

  if (!fs.existsSync(dbPath)) {
    console.error(`ERROR: Database not found at ${dbPath}`);
    process.exit(1);
  }

  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  return drizzle(sqlite, { schema });
}

// ---------------------------------------------------------------------------
// Per-row repair logic
// ---------------------------------------------------------------------------

interface DerivedFields {
  primaryModel: string | null;
  topTool: string | null;
  topProject: string | null;
  activeMinutes: number;
}

async function computeDerivedFields(
  db: ReturnType<typeof setupDb>,
  userId: string,
  date: string
): Promise<DerivedFields> {
  // SQLite stores timestamps as ISO strings; use prefix matching for the date.
  // e.g. "2025-01-15" matches "2025-01-15T14:32:00.000Z"
  const datePrefix = `${date}%`;

  // Primary model: model with most output tokens on this calendar date
  const modelRows = await db
    .select({
      model: schema.tokenUsage.model,
      outputTokens: sum(schema.tokenUsage.outputTokens),
    })
    .from(schema.tokenUsage)
    .where(
      and(
        eq(schema.tokenUsage.userId, userId),
        sql`${schema.tokenUsage.timestamp} LIKE ${datePrefix}`
      )
    )
    .groupBy(schema.tokenUsage.model)
    .orderBy(desc(sum(schema.tokenUsage.outputTokens)))
    .limit(1);

  const primaryModel = modelRows[0]?.model ?? null;

  // Top tool: most frequently called tool on this date
  const toolRows = await db
    .select({
      toolName: schema.events.toolName,
      cnt: count(),
    })
    .from(schema.events)
    .where(
      and(
        eq(schema.events.userId, userId),
        sql`${schema.events.timestamp} LIKE ${datePrefix}`,
        sql`${schema.events.toolName} IS NOT NULL`
      )
    )
    .groupBy(schema.events.toolName)
    .orderBy(desc(count()))
    .limit(1);

  const topTool = toolRows[0]?.toolName ?? null;

  // Top project: project with most sessions starting on this date
  const projectRows = await db
    .select({
      projectName: schema.sessions.projectName,
      cnt: count(),
    })
    .from(schema.sessions)
    .where(
      and(
        eq(schema.sessions.userId, userId),
        sql`${schema.sessions.startedAt} LIKE ${datePrefix}`,
        sql`${schema.sessions.projectName} IS NOT NULL`
      )
    )
    .groupBy(schema.sessions.projectName)
    .orderBy(desc(count()))
    .limit(1);

  const topProject = projectRows[0]?.projectName ?? null;

  // Active minutes: sum of session durations on this date
  const durationRows = await db
    .select({
      totalMs: sum(schema.sessions.durationMs),
    })
    .from(schema.sessions)
    .where(
      and(
        eq(schema.sessions.userId, userId),
        sql`${schema.sessions.startedAt} LIKE ${datePrefix}`
      )
    );

  const totalMs = Number(durationRows[0]?.totalMs ?? 0);
  const activeMinutes = Math.round(totalMs / 60_000);

  return { primaryModel, topTool, topProject, activeMinutes };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { dryRun, userId: filterUserId, verbose } = parseArgs();

  console.log("=".repeat(60));
  console.log("daily_summary repair script");
  console.log("=".repeat(60));
  console.log(`dry-run    : ${dryRun}`);
  console.log(`user-id    : ${filterUserId ?? "(all users)"}`);
  console.log(`verbose    : ${verbose}`);
  console.log("");

  if (dryRun) {
    console.log("[DRY RUN] No database writes will occur.\n");
  }

  const db = setupDb();

  // Fetch all daily_summary rows (optionally filtered by userId)
  let rows: Array<{ id: number; userId: string; date: string }>;

  if (filterUserId) {
    rows = await db
      .select({
        id: schema.dailySummary.id,
        userId: schema.dailySummary.userId,
        date: schema.dailySummary.date,
      })
      .from(schema.dailySummary)
      .where(eq(schema.dailySummary.userId, filterUserId))
      .orderBy(schema.dailySummary.userId, schema.dailySummary.date);
  } else {
    rows = await db
      .select({
        id: schema.dailySummary.id,
        userId: schema.dailySummary.userId,
        date: schema.dailySummary.date,
      })
      .from(schema.dailySummary)
      .orderBy(schema.dailySummary.userId, schema.dailySummary.date);
  }

  console.log(`Found ${rows.length} daily_summary rows to repair.\n`);

  if (rows.length === 0) {
    console.log("Nothing to repair.");
    return;
  }

  let updatedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const prefix = `[${i + 1}/${rows.length}]`;

    if (verbose) {
      console.log(`${prefix} user=${row.userId} date=${row.date}`);
    } else if ((i + 1) % 50 === 0 || i + 1 === rows.length) {
      console.log(`${prefix} Processing...`);
    }

    try {
      const derived = await computeDerivedFields(db, row.userId, row.date);

      if (verbose) {
        console.log(
          `  -> primaryModel=${derived.primaryModel ?? "null"} ` +
          `topTool=${derived.topTool ?? "null"} ` +
          `topProject=${derived.topProject ?? "null"} ` +
          `activeMinutes=${derived.activeMinutes}`
        );
      }

      if (!dryRun) {
        await db
          .update(schema.dailySummary)
          .set({
            primaryModel: derived.primaryModel,
            topTool: derived.topTool,
            topProject: derived.topProject,
            activeMinutes: derived.activeMinutes,
          })
          .where(eq(schema.dailySummary.id, row.id));
      }

      updatedCount++;
    } catch (err) {
      errorCount++;
      console.error(
        `${prefix} ERROR user=${row.userId} date=${row.date}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  console.log("");
  console.log("=".repeat(60));
  console.log(`Repair ${dryRun ? "(DRY RUN) " : ""}complete.`);
  console.log(`  Updated : ${updatedCount}`);
  console.log(`  Errors  : ${errorCount}`);
  console.log(`  Total   : ${rows.length}`);
  console.log("=".repeat(60));
}

await main();
