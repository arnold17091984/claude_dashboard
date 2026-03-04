import { Hono } from "hono";
import { db } from "@/server/db";
import { users, sessions, dailySummary, events, tokenUsage } from "@/server/db/schema";
import { sql, sum, count, desc, eq, gte, and } from "drizzle-orm";
import { parsePeriod, periodToSince } from "@/server/api/middleware/validate";

export const usersRoute = new Hono();

usersRoute.get("/", async (c) => {
  const userList = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      email: users.email,
      team: users.team,
      avatarUrl: users.avatarUrl,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(users.displayName);

  return c.json({ users: userList });
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
