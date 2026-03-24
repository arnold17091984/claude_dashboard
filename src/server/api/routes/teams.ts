/**
 * teams.ts
 *
 * GET /api/v1/teams/summary?period=30d
 *
 * Returns team-level aggregation using the `team` field on the users table.
 * Per team: member count, session count, total cost, avg cost per user, total tokens.
 */
import { Hono } from "hono";
import { db } from "@/server/db";
import { sessions, tokenUsage, users } from "@/server/db/schema";
import { sql, count, sum, eq, gte } from "drizzle-orm";
import { parsePeriod, periodToSince } from "@/server/api/middleware/validate";

export const teamsRoute = new Hono();

// ---------------------------------------------------------------------------
// GET /summary
// ---------------------------------------------------------------------------

teamsRoute.get("/summary", async (c) => {
  const period = parsePeriod(c.req.query("period"));
  const since = periodToSince(period);

  // Aggregate sessions per user within the period
  const sessionAgg = db
    .select({
      userId: sessions.userId,
      sessionCount: count(sessions.id).as("session_count"),
    })
    .from(sessions)
    .where(gte(sessions.startedAt, since))
    .groupBy(sessions.userId)
    .as("session_agg");

  // Aggregate token usage cost per user within the period
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

  // Join users with aggregates and group by team
  const rows = await db
    .select({
      team: sql<string>`COALESCE(${users.team}, 'unassigned')`,
      memberCount: sql<number>`COUNT(DISTINCT ${users.id})`,
      sessionCount: sql<number>`COALESCE(SUM(${sessionAgg.sessionCount}), 0)`,
      totalCostUsd: sql<number>`COALESCE(SUM(${costAgg.totalCost}), 0)`,
      totalTokens: sql<number>`COALESCE(SUM(${costAgg.totalTokens}), 0)`,
    })
    .from(users)
    .leftJoin(sessionAgg, eq(users.id, sessionAgg.userId))
    .leftJoin(costAgg, eq(users.id, costAgg.userId))
    .groupBy(sql`COALESCE(${users.team}, 'unassigned')`)
    .orderBy(sql`COALESCE(SUM(${costAgg.totalCost}), 0) DESC`);

  const teams = rows.map((row) => {
    const memberCount = Number(row.memberCount);
    const totalCostUsd = Number(row.totalCostUsd);
    return {
      team: row.team,
      memberCount,
      sessionCount: Number(row.sessionCount),
      totalCostUsd,
      avgCostPerUser: memberCount > 0 ? totalCostUsd / memberCount : 0,
      totalTokens: Number(row.totalTokens),
    };
  });

  return c.json({ period, teams });
});
