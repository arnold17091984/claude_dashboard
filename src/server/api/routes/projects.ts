import { Hono } from "hono";
import { db } from "@/server/db";
import { sessions, events, tokenUsage, users } from "@/server/db/schema";
import { sql, count, sum, desc, eq, gte, and } from "drizzle-orm";

export const projectsRoute = new Hono();

projectsRoute.get("/", async (c) => {
  const period = c.req.query("period") || "30d";
  const daysBack = period === "90d" ? 90 : period === "30d" ? 30 : 7;
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

  const projectStats = await db
    .select({
      projectName: sessions.projectName,
      sessionCount: count(),
      totalMessages: sum(sessions.messageCount),
      totalToolCalls: sum(sessions.toolCallCount),
      totalDurationMs: sum(sessions.durationMs),
      lastUsed: sql<string>`MAX(${sessions.startedAt})`,
      userCount: sql<number>`COUNT(DISTINCT ${sessions.userId})`,
    })
    .from(sessions)
    .where(gte(sessions.startedAt, since))
    .groupBy(sessions.projectName)
    .orderBy(desc(count()));

  // Get cost per project
  const projectCosts = await db
    .select({
      projectName: sessions.projectName,
      cost: sum(tokenUsage.estimatedCostUsd),
    })
    .from(tokenUsage)
    .innerJoin(sessions, eq(tokenUsage.sessionId, sessions.id))
    .where(gte(sessions.startedAt, since))
    .groupBy(sessions.projectName);

  const costMap = new Map(
    projectCosts.map((p) => [p.projectName, Number(p.cost || 0)])
  );

  const projects = projectStats.map((p) => ({
    projectName: p.projectName,
    sessionCount: p.sessionCount,
    totalMessages: Number(p.totalMessages || 0),
    totalToolCalls: Number(p.totalToolCalls || 0),
    totalDurationMs: Number(p.totalDurationMs || 0),
    lastUsed: p.lastUsed,
    userCount: p.userCount,
    cost: costMap.get(p.projectName) || 0,
  }));

  return c.json({ projects, period });
});

projectsRoute.get("/:name", async (c) => {
  const projectName = decodeURIComponent(c.req.param("name"));
  const period = c.req.query("period") || "30d";
  const daysBack = period === "90d" ? 90 : period === "30d" ? 30 : 7;
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

  const [projectSessions, toolStats, costStats] = await Promise.all([
    db
      .select({
        id: sessions.id,
        userId: sessions.userId,
        displayName: users.displayName,
        startedAt: sessions.startedAt,
        endedAt: sessions.endedAt,
        durationMs: sessions.durationMs,
        messageCount: sessions.messageCount,
        toolCallCount: sessions.toolCallCount,
      })
      .from(sessions)
      .leftJoin(users, eq(sessions.userId, users.id))
      .where(
        and(eq(sessions.projectName, projectName), gte(sessions.startedAt, since))
      )
      .orderBy(desc(sessions.startedAt))
      .limit(50),

    db
      .select({
        toolName: events.toolName,
        count: count(),
      })
      .from(events)
      .innerJoin(sessions, eq(events.sessionId, sessions.id))
      .where(
        and(
          eq(sessions.projectName, projectName),
          gte(sessions.startedAt, since),
          sql`${events.toolName} IS NOT NULL`
        )
      )
      .groupBy(events.toolName)
      .orderBy(desc(count()))
      .limit(15),

    db
      .select({
        model: tokenUsage.model,
        inputTokens: sum(tokenUsage.inputTokens),
        outputTokens: sum(tokenUsage.outputTokens),
        cost: sum(tokenUsage.estimatedCostUsd),
      })
      .from(tokenUsage)
      .innerJoin(sessions, eq(tokenUsage.sessionId, sessions.id))
      .where(
        and(eq(sessions.projectName, projectName), gte(sessions.startedAt, since))
      )
      .groupBy(tokenUsage.model)
      .orderBy(desc(sum(tokenUsage.estimatedCostUsd))),
  ]);

  return c.json({
    projectName,
    sessions: projectSessions,
    toolStats,
    costStats,
    period,
  });
});
