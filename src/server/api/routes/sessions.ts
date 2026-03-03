import { Hono } from "hono";
import { db } from "@/server/db";
import { sessions, users, events, tokenUsage } from "@/server/db/schema";
import { sql, sum, count, desc, eq, gte, and } from "drizzle-orm";

export const sessionsRoute = new Hono();

sessionsRoute.get("/", async (c) => {
  const page = parseInt(c.req.query("page") || "1", 10);
  const limit = parseInt(c.req.query("limit") || "20", 10);
  const offset = (page - 1) * limit;
  const period = c.req.query("period") || "30d";
  const daysBack = period === "90d" ? 90 : period === "30d" ? 30 : 7;
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

  const [sessionList, totalCount] = await Promise.all([
    db
      .select({
        id: sessions.id,
        userId: sessions.userId,
        displayName: users.displayName,
        projectName: sessions.projectName,
        projectPath: sessions.projectPath,
        gitBranch: sessions.gitBranch,
        startedAt: sessions.startedAt,
        endedAt: sessions.endedAt,
        durationMs: sessions.durationMs,
        messageCount: sessions.messageCount,
        toolCallCount: sessions.toolCallCount,
      })
      .from(sessions)
      .leftJoin(users, eq(sessions.userId, users.id))
      .where(gte(sessions.startedAt, since))
      .orderBy(desc(sessions.startedAt))
      .limit(limit)
      .offset(offset),

    db
      .select({ count: count() })
      .from(sessions)
      .where(gte(sessions.startedAt, since)),
  ]);

  return c.json({
    sessions: sessionList,
    pagination: {
      page,
      limit,
      total: totalCount[0]?.count || 0,
      totalPages: Math.ceil((totalCount[0]?.count || 0) / limit),
    },
    period,
  });
});

sessionsRoute.get("/:id", async (c) => {
  const sessionId = c.req.param("id");

  const [sessionInfo, sessionEvents, tokenStats] = await Promise.all([
    db
      .select({
        id: sessions.id,
        userId: sessions.userId,
        displayName: users.displayName,
        projectName: sessions.projectName,
        projectPath: sessions.projectPath,
        gitBranch: sessions.gitBranch,
        claudeVersion: sessions.claudeVersion,
        startedAt: sessions.startedAt,
        endedAt: sessions.endedAt,
        durationMs: sessions.durationMs,
        messageCount: sessions.messageCount,
        toolCallCount: sessions.toolCallCount,
      })
      .from(sessions)
      .leftJoin(users, eq(sessions.userId, users.id))
      .where(eq(sessions.id, sessionId))
      .limit(1),

    db
      .select({
        toolName: events.toolName,
        count: count(),
      })
      .from(events)
      .where(and(eq(events.sessionId, sessionId), sql`${events.toolName} IS NOT NULL`))
      .groupBy(events.toolName)
      .orderBy(desc(count())),

    db
      .select({
        model: tokenUsage.model,
        inputTokens: sum(tokenUsage.inputTokens),
        outputTokens: sum(tokenUsage.outputTokens),
        cost: sum(tokenUsage.estimatedCostUsd),
      })
      .from(tokenUsage)
      .where(eq(tokenUsage.sessionId, sessionId))
      .groupBy(tokenUsage.model),
  ]);

  if (!sessionInfo[0]) {
    return c.json({ error: "Session not found" }, 404);
  }

  return c.json({
    session: sessionInfo[0],
    toolUsage: sessionEvents,
    tokenStats,
  });
});
