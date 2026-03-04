import { Hono } from "hono";
import { db } from "@/server/db";
import { users, sessions, dailySummary, events, tokenUsage } from "@/server/db/schema";
import { sql, sum, count, desc, eq, gte, and } from "drizzle-orm";
import { parsePeriod, periodToSince } from "@/server/api/middleware/validate";

export const usersRoute = new Hono();

usersRoute.get("/", async (c) => {
  // Return all users with their cumulative (all-time) stats aggregated from
  // daily_summary. This differs from the ranking endpoint which filters by a
  // rolling time window. Sorted by total cost descending by default.

  const summaryRows = await db
    .select({
      userId: dailySummary.userId,
      sessions: sum(dailySummary.sessionCount),
      messages: sum(dailySummary.messageCount),
      toolCalls: sum(dailySummary.toolCallCount),
      cost: sum(dailySummary.estimatedCostUsd),
      activeMinutes: sum(dailySummary.activeMinutes),
    })
    .from(dailySummary)
    .groupBy(dailySummary.userId);

  const userList = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      email: users.email,
      team: users.team,
      avatarUrl: users.avatarUrl,
      createdAt: users.createdAt,
    })
    .from(users);

  // Top tool per user (all-time): most frequent toolName across events
  const topToolRows = await db
    .select({
      userId: events.userId,
      toolName: events.toolName,
      cnt: count(),
    })
    .from(events)
    .where(sql`${events.toolName} IS NOT NULL`)
    .groupBy(events.userId, events.toolName)
    .orderBy(desc(count()));

  const topToolMap = new Map<string, string>();
  for (const row of topToolRows) {
    // First occurrence per user after ordering by count desc is the top tool
    if (!topToolMap.has(row.userId)) {
      topToolMap.set(row.userId, row.toolName!);
    }
  }

  const summaryMap = new Map(summaryRows.map((r) => [r.userId, r]));

  const userStats = userList.map((u) => {
    const stats = summaryMap.get(u.id);
    return {
      userId: u.id,
      displayName: u.displayName,
      email: u.email,
      team: u.team,
      avatarUrl: u.avatarUrl,
      createdAt: u.createdAt,
      sessions: Number(stats?.sessions ?? 0),
      messages: Number(stats?.messages ?? 0),
      toolCalls: Number(stats?.toolCalls ?? 0),
      cost: Number(stats?.cost ?? 0),
      activeMinutes: Number(stats?.activeMinutes ?? 0),
      topTool: topToolMap.get(u.id) ?? null,
    };
  });

  // Sort by cumulative cost descending
  userStats.sort((a, b) => b.cost - a.cost);

  return c.json({ users: userStats });
});

usersRoute.get("/:id", async (c) => {
  const userId = c.req.param("id");
  const period = parsePeriod(c.req.query("period") || "30d");
  const since = periodToSince(period);
  const sinceDate = since.slice(0, 10);

  const [userInfo, sessionHistory, dailyTrend, toolDist, tokenStats] =
    await Promise.all([
      db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1),

      db
        .select({
          id: sessions.id,
          projectName: sessions.projectName,
          projectPath: sessions.projectPath,
          startedAt: sessions.startedAt,
          endedAt: sessions.endedAt,
          durationMs: sessions.durationMs,
          messageCount: sessions.messageCount,
          toolCallCount: sessions.toolCallCount,
        })
        .from(sessions)
        .where(and(eq(sessions.userId, userId), gte(sessions.startedAt, since)))
        .orderBy(desc(sessions.startedAt))
        .limit(20),

      db
        .select({
          date: dailySummary.date,
          sessions: dailySummary.sessionCount,
          messages: dailySummary.messageCount,
          toolCalls: dailySummary.toolCallCount,
          cost: dailySummary.estimatedCostUsd,
        })
        .from(dailySummary)
        .where(and(eq(dailySummary.userId, userId), gte(dailySummary.date, sinceDate)))
        .orderBy(dailySummary.date),

      db
        .select({
          toolName: events.toolName,
          count: count(),
        })
        .from(events)
        .where(
          and(
            eq(events.userId, userId),
            gte(events.timestamp, since),
            sql`${events.toolName} IS NOT NULL`
          )
        )
        .groupBy(events.toolName)
        .orderBy(desc(count()))
        .limit(10),

      db
        .select({
          model: tokenUsage.model,
          inputTokens: sum(tokenUsage.inputTokens),
          outputTokens: sum(tokenUsage.outputTokens),
          cost: sum(tokenUsage.estimatedCostUsd),
        })
        .from(tokenUsage)
        .where(and(eq(tokenUsage.userId, userId), gte(tokenUsage.timestamp, since)))
        .groupBy(tokenUsage.model)
        .orderBy(desc(sum(tokenUsage.estimatedCostUsd))),
    ]);

  if (!userInfo[0]) {
    return c.json({ error: "User not found" }, 404);
  }

  return c.json({
    user: userInfo[0],
    sessionHistory,
    dailyTrend,
    toolDistribution: toolDist,
    tokenStats,
    period,
  });
});
