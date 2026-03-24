/**
 * health.ts
 *
 * GET /api/v1/health        — basic liveness check
 * GET /api/v1/health/ready  — readiness probe (DB alive, memory, uptime, cache stats)
 * GET /api/v1/health/data   — data consistency report
 *
 * The /data endpoint checks for three categories of anomaly:
 *   1. Sessions that have no matching events in the events table.
 *   2. daily_summary rows where active_minutes IS NULL or = 0 despite sessions
 *      existing for that user+date (likely created before the derived fields
 *      were populated).
 *   3. Orphaned events — events whose session_id does not match any session row.
 *
 * No writes are performed; this is a read-only diagnostic endpoint.
 */
import { Hono } from "hono";
import { db } from "@/server/db";
import { sessions, events, dailySummary } from "@/server/db/schema";
import { sql, count } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { cache } from "@/server/lib/cache";

export const healthRoute = new Hono();

// ---------------------------------------------------------------------------
// GET /health  — liveness
// ---------------------------------------------------------------------------

healthRoute.get("/", (c) =>
  c.json({ status: "ok", timestamp: new Date().toISOString() })
);

// ---------------------------------------------------------------------------
// GET /health/ready  — readiness probe
// ---------------------------------------------------------------------------

healthRoute.get("/ready", (c) => {
  // 1. Verify DB is alive with a synchronous SELECT 1
  let dbOk = false;
  let dbError: string | null = null;
  try {
    db.select({ one: sql<number>`1` }).from(sessions).limit(1).all();
    dbOk = true;
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
  }

  // 2. DB file size (best-effort — falls back to null if path is unavailable)
  let dbFileSizeBytes: number | null = null;
  try {
    const dbPath =
      process.env.DATABASE_URL ??
      path.join(process.cwd(), "data", "dashboard.db");
    const stat = fs.statSync(dbPath);
    dbFileSizeBytes = stat.size;
  } catch {
    // Not critical — ignore
  }

  // 3. Cache stats
  const cacheEntries = cache.size;

  // 4. Process memory usage
  const mem = process.memoryUsage();

  // 5. Process uptime (seconds)
  const uptimeSeconds = Math.floor(process.uptime());

  const status = dbOk ? 200 : 503;

  return c.json(
    {
      ready: dbOk,
      checkedAt: new Date().toISOString(),
      db: {
        ok: dbOk,
        ...(dbError ? { error: dbError } : {}),
        fileSizeBytes: dbFileSizeBytes,
      },
      cache: {
        entries: cacheEntries,
      },
      memory: {
        rss: mem.rss,
        heapUsed: mem.heapUsed,
        heapTotal: mem.heapTotal,
        external: mem.external,
      },
      uptimeSeconds,
    },
    status
  );
});

// ---------------------------------------------------------------------------
// GET /health/data  — consistency report
// ---------------------------------------------------------------------------

healthRoute.get("/data", async (c) => {
  const [
    sessionsWithoutEvents,
    summaryRowsMissingActiveMinutes,
    orphanedEvents,
    totals,
  ] = await Promise.all([
    // 1. Sessions that have no events at all
    db
      .select({
        sessionId: sessions.id,
        userId: sessions.userId,
        startedAt: sessions.startedAt,
      })
      .from(sessions)
      .where(
        sql`NOT EXISTS (
          SELECT 1 FROM ${events}
          WHERE ${events.sessionId} = ${sessions.id}
        )`
      )
      .limit(100),

    // 2. daily_summary rows missing active_minutes (NULL or 0) where the user
    //    has at least one session on that date (so the field should be set).
    db
      .select({
        id: dailySummary.id,
        userId: dailySummary.userId,
        date: dailySummary.date,
        activeMinutes: dailySummary.activeMinutes,
        primaryModel: dailySummary.primaryModel,
        topTool: dailySummary.topTool,
        topProject: dailySummary.topProject,
      })
      .from(dailySummary)
      .where(
        sql`(
          ${dailySummary.activeMinutes} IS NULL
          OR ${dailySummary.activeMinutes} = 0
          OR ${dailySummary.primaryModel} IS NULL
          OR ${dailySummary.topTool} IS NULL
          OR ${dailySummary.topProject} IS NULL
        ) AND EXISTS (
          SELECT 1 FROM ${sessions} s
          WHERE s.user_id = ${dailySummary.userId}
            AND substr(s.started_at, 1, 10) = ${dailySummary.date}
        )`
      )
      .limit(100),

    // 3. Orphaned events — no matching session
    db
      .select({
        eventId: events.id,
        sessionId: events.sessionId,
        userId: events.userId,
        timestamp: events.timestamp,
      })
      .from(events)
      .where(
        sql`NOT EXISTS (
          SELECT 1 FROM ${sessions}
          WHERE ${sessions.id} = ${events.sessionId}
        )`
      )
      .limit(100),

    // Totals for context
    Promise.all([
      db.select({ n: count() }).from(sessions),
      db.select({ n: count() }).from(events),
      db.select({ n: count() }).from(dailySummary),
    ]),
  ]);

  const [sessionTotal, eventTotal, summaryTotal] = totals;

  const issues = {
    sessionsWithoutEvents: sessionsWithoutEvents.length,
    summaryRowsMissingDerivedFields: summaryRowsMissingActiveMinutes.length,
    orphanedEvents: orphanedEvents.length,
  };

  const healthy =
    issues.sessionsWithoutEvents === 0 &&
    issues.summaryRowsMissingDerivedFields === 0 &&
    issues.orphanedEvents === 0;

  return c.json({
    healthy,
    checkedAt: new Date().toISOString(),
    totals: {
      sessions: Number(sessionTotal[0]?.n ?? 0),
      events: Number(eventTotal[0]?.n ?? 0),
      dailySummaryRows: Number(summaryTotal[0]?.n ?? 0),
    },
    issues,
    details: {
      sessionsWithoutEvents,
      summaryRowsMissingDerivedFields: summaryRowsMissingActiveMinutes,
      orphanedEvents,
    },
  });
});
