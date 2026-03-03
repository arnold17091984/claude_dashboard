import { Hono } from "hono";
import { db } from "@/server/db";
import { sessions, events, tokenUsage, dailySummary, users } from "@/server/db/schema";
import { sql, count, sum, desc, eq, gte } from "drizzle-orm";

export const overviewRoute = new Hono();

overviewRoute.get("/", async (c) => {
  const period = c.req.query("period") || "7d";
  const daysBack = period === "30d" ? 30 : period === "90d" ? 90 : 7;
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

  const [
    totalUsers,
    totalSessions,
    recentSessions,
    totalTokens,
    dailyActivity,
    topTools,
    topModels,
    topProjects,
  ] = await Promise.all([
    // Total users
    db.select({ count: count() }).from(users),

    // Total sessions all time
    db.select({ count: count() }).from(sessions),

    // Sessions in period
    db
      .select({ count: count() })
      .from(sessions)
      .where(gte(sessions.startedAt, since)),

    // Total tokens in period
    db
      .select({
        inputTokens: sum(tokenUsage.inputTokens),
        outputTokens: sum(tokenUsage.outputTokens),
        cacheReadTokens: sum(tokenUsage.cacheReadTokens),
        totalCost: sum(tokenUsage.estimatedCostUsd),
      })
      .from(tokenUsage)
      .where(gte(tokenUsage.timestamp, since)),

    // Daily activity
    db
      .select({
        date: dailySummary.date,
        sessions: sum(dailySummary.sessionCount),
        messages: sum(dailySummary.messageCount),
        toolCalls: sum(dailySummary.toolCallCount),
        cost: sum(dailySummary.estimatedCostUsd),
      })
      .from(dailySummary)
      .where(gte(dailySummary.date, since.slice(0, 10)))
      .groupBy(dailySummary.date)
      .orderBy(dailySummary.date),

    // Top tools
    db
      .select({
        toolName: events.toolName,
        count: count(),
      })
      .from(events)
      .where(gte(events.timestamp, since))
      .groupBy(events.toolName)
      .orderBy(desc(count()))
      .limit(10),

    // Model distribution
    db
      .select({
        model: tokenUsage.model,
        inputTokens: sum(tokenUsage.inputTokens),
        outputTokens: sum(tokenUsage.outputTokens),
        cost: sum(tokenUsage.estimatedCostUsd),
      })
      .from(tokenUsage)
      .where(gte(tokenUsage.timestamp, since))
      .groupBy(tokenUsage.model)
      .orderBy(desc(sum(tokenUsage.estimatedCostUsd))),

    // Top projects
    db
      .select({
        projectName: sessions.projectName,
        count: count(),
      })
      .from(sessions)
      .where(gte(sessions.startedAt, since))
      .groupBy(sessions.projectName)
      .orderBy(desc(count()))
      .limit(8),
  ]);

  return c.json({
    kpi: {
      totalUsers: totalUsers[0]?.count || 0,
      totalSessions: totalSessions[0]?.count || 0,
      recentSessions: recentSessions[0]?.count || 0,
      totalInputTokens: Number(totalTokens[0]?.inputTokens || 0),
      totalOutputTokens: Number(totalTokens[0]?.outputTokens || 0),
      totalCacheReadTokens: Number(totalTokens[0]?.cacheReadTokens || 0),
      totalCost: Number(totalTokens[0]?.totalCost || 0),
    },
    dailyActivity,
    topTools,
    topModels,
    topProjects,
    period,
  });
});
