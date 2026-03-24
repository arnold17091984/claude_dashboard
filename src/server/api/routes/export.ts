/**
 * export.ts
 *
 * GET /api/v1/export/csv?period=30d&type=sessions|users|costs
 *
 * Returns CSV data with appropriate Content-Type and Content-Disposition headers.
 *
 * type=sessions : date, user, project, duration, tokens, cost
 * type=users    : user, sessions, tokens, cost, top_tool
 * type=costs    : date, model, input_tokens, output_tokens, cost
 */
import { Hono } from "hono";
import { db } from "@/server/db";
import { sessions, tokenUsage, users, events } from "@/server/db/schema";
import { sql, count, sum, eq, gte, desc } from "drizzle-orm";
import { parsePeriod, periodToSince } from "@/server/api/middleware/validate";

export const exportRoute = new Hono();

// ---------------------------------------------------------------------------
// CSV helpers
// ---------------------------------------------------------------------------

/** Escape a single CSV field value (RFC 4180). */
function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  // Wrap in quotes if the value contains comma, newline, or double-quote.
  if (str.includes(",") || str.includes("\n") || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Convert an array of row objects to a CSV string. */
function toCsv(headers: string[], rows: unknown[][]): string {
  const headerLine = headers.map(escapeCsvField).join(",");
  const dataLines = rows.map((row) => row.map(escapeCsvField).join(","));
  return [headerLine, ...dataLines].join("\r\n");
}

// ---------------------------------------------------------------------------
// GET /csv
// ---------------------------------------------------------------------------

exportRoute.get("/csv", async (c) => {
  const period = parsePeriod(c.req.query("period"));
  const since = periodToSince(period);
  const type = c.req.query("type");

  if (!type || !["sessions", "users", "costs"].includes(type)) {
    return c.json(
      { error: "Invalid or missing 'type' parameter. Must be sessions, users, or costs." },
      400
    );
  }

  let csv: string;
  let filename: string;

  if (type === "sessions") {
    // date, user, project, duration_ms, total_tokens, estimated_cost_usd
    const rows = await db
      .select({
        date: sql<string>`substr(${sessions.startedAt}, 1, 10)`,
        user: sessions.userId,
        project: sessions.projectName,
        durationMs: sessions.durationMs,
        totalTokens: sql<number>`
          COALESCE((
            SELECT SUM(${tokenUsage.inputTokens}) + SUM(${tokenUsage.outputTokens})
            FROM ${tokenUsage}
            WHERE ${tokenUsage.sessionId} = ${sessions.id}
          ), 0)
        `,
        estimatedCostUsd: sql<number>`
          COALESCE((
            SELECT SUM(${tokenUsage.estimatedCostUsd})
            FROM ${tokenUsage}
            WHERE ${tokenUsage.sessionId} = ${sessions.id}
          ), 0)
        `,
      })
      .from(sessions)
      .where(gte(sessions.startedAt, since))
      .orderBy(desc(sessions.startedAt));

    const headers = ["date", "user", "project", "duration_ms", "total_tokens", "estimated_cost_usd"];
    const data = rows.map((r) => [
      r.date,
      r.user,
      r.project ?? "",
      r.durationMs ?? 0,
      r.totalTokens,
      Number(r.estimatedCostUsd).toFixed(6),
    ]);
    csv = toCsv(headers, data);
    filename = `sessions-${period}.csv`;

  } else if (type === "users") {
    // user, sessions, tokens, cost, top_tool
    const sessionAgg = db
      .select({
        userId: sessions.userId,
        sessionCount: count(sessions.id).as("session_count"),
      })
      .from(sessions)
      .where(gte(sessions.startedAt, since))
      .groupBy(sessions.userId)
      .as("session_agg");

    const costAgg = db
      .select({
        userId: tokenUsage.userId,
        totalCost: sum(tokenUsage.estimatedCostUsd).as("total_cost"),
        totalTokens: sql<number>`
          COALESCE(SUM(${tokenUsage.inputTokens}), 0) +
          COALESCE(SUM(${tokenUsage.outputTokens}), 0)
        `.as("total_tokens"),
      })
      .from(tokenUsage)
      .where(gte(tokenUsage.timestamp, since))
      .groupBy(tokenUsage.userId)
      .as("cost_agg");

    const rows = await db
      .select({
        user: users.id,
        sessionCount: sql<number>`COALESCE(${sessionAgg.sessionCount}, 0)`,
        totalTokens: sql<number>`COALESCE(${costAgg.totalTokens}, 0)`,
        totalCostUsd: sql<number>`COALESCE(${costAgg.totalCost}, 0)`,
        topTool: sql<string | null>`(
          SELECT ${events.toolName}
          FROM ${events}
          WHERE ${events.userId} = ${users.id}
            AND ${events.timestamp} >= ${since}
            AND ${events.toolName} IS NOT NULL
          GROUP BY ${events.toolName}
          ORDER BY COUNT(*) DESC
          LIMIT 1
        )`,
      })
      .from(users)
      .leftJoin(sessionAgg, eq(users.id, sessionAgg.userId))
      .leftJoin(costAgg, eq(users.id, costAgg.userId))
      .orderBy(sql`COALESCE(${costAgg.totalCost}, 0) DESC`);

    const headers = ["user", "sessions", "tokens", "cost_usd", "top_tool"];
    const data = rows.map((r) => [
      r.user,
      r.sessionCount,
      r.totalTokens,
      Number(r.totalCostUsd).toFixed(6),
      r.topTool ?? "",
    ]);
    csv = toCsv(headers, data);
    filename = `users-${period}.csv`;

  } else {
    // costs: date, model, input_tokens, output_tokens, cost
    const rows = await db
      .select({
        date: sql<string>`substr(${tokenUsage.timestamp}, 1, 10)`,
        model: tokenUsage.model,
        inputTokens: sum(tokenUsage.inputTokens),
        outputTokens: sum(tokenUsage.outputTokens),
        estimatedCostUsd: sum(tokenUsage.estimatedCostUsd),
      })
      .from(tokenUsage)
      .where(gte(tokenUsage.timestamp, since))
      .groupBy(
        sql`substr(${tokenUsage.timestamp}, 1, 10)`,
        tokenUsage.model
      )
      .orderBy(
        sql`substr(${tokenUsage.timestamp}, 1, 10) DESC`,
        tokenUsage.model
      );

    const headers = ["date", "model", "input_tokens", "output_tokens", "estimated_cost_usd"];
    const data = rows.map((r) => [
      r.date,
      r.model,
      r.inputTokens ?? 0,
      r.outputTokens ?? 0,
      Number(r.estimatedCostUsd ?? 0).toFixed(6),
    ]);
    csv = toCsv(headers, data);
    filename = `costs-${period}.csv`;
  }

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});
