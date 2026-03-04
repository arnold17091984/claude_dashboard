import { Hono } from "hono";
import { db } from "@/server/db";
import { users, dailySummary } from "@/server/db/schema";
import { sql, sum, desc, asc, eq, gte, and } from "drizzle-orm";
import { cache, TTL, rankingKey } from "@/server/lib/cache";

export const rankingRoute = new Hono();

rankingRoute.get("/", async (c) => {
  const period = c.req.query("period") || "7d";
  const sortBy = c.req.query("sortBy") || "cost";
  const cacheKey = rankingKey(period, sortBy);

  const cached = cache.get(cacheKey);
  if (cached) {
    return c.json(cached);
  }

  const daysBack = period === "90d" ? 90 : period === "30d" ? 30 : 7;
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const aggregated = await db
    .select({
      userId: dailySummary.userId,
      sessions: sum(dailySummary.sessionCount),
      messages: sum(dailySummary.messageCount),
      toolCalls: sum(dailySummary.toolCallCount),
      cost: sum(dailySummary.estimatedCostUsd),
      activeMinutes: sum(dailySummary.activeMinutes),
    })
    .from(dailySummary)
    .where(gte(dailySummary.date, since))
    .groupBy(dailySummary.userId);

  const userList = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      email: users.email,
      team: users.team,
      avatarUrl: users.avatarUrl,
    })
    .from(users);

  const userMap = new Map(userList.map((u) => [u.id, u]));

  const topToolPerUser = await db
    .select({
      userId: dailySummary.userId,
      topTool: dailySummary.topTool,
      cnt: sum(sql`1`),
    })
    .from(dailySummary)
    .where(
      and(gte(dailySummary.date, since), sql`${dailySummary.topTool} IS NOT NULL`)
    )
    .groupBy(dailySummary.userId, dailySummary.topTool);

  const topToolMap = new Map<string, string>();
  const toolCountMap = new Map<string, { tool: string; count: number }>();
  for (const row of topToolPerUser) {
    if (!row.userId || !row.topTool) continue;
    const cnt = Number(row.cnt || 0);
    const existing = toolCountMap.get(row.userId);
    if (!existing || cnt > existing.count) {
      toolCountMap.set(row.userId, { tool: row.topTool, count: cnt });
    }
  }
  for (const [userId, { tool }] of toolCountMap) {
    topToolMap.set(userId, tool);
  }

  const ranking = aggregated
    .map((row) => {
      const user = userMap.get(row.userId);
      return {
        userId: row.userId,
        displayName: user?.displayName || "Unknown",
        email: user?.email || null,
        team: user?.team || null,
        avatarUrl: user?.avatarUrl || null,
        sessions: Number(row.sessions || 0),
        messages: Number(row.messages || 0),
        toolCalls: Number(row.toolCalls || 0),
        cost: Number(row.cost || 0),
        activeMinutes: Number(row.activeMinutes || 0),
        topTool: topToolMap.get(row.userId) || null,
      };
    })
    .sort((a, b) => {
      if (sortBy === "sessions") return b.sessions - a.sessions;
      if (sortBy === "toolCalls") return b.toolCalls - a.toolCalls;
      return b.cost - a.cost;
    })
    .map((row, idx) => ({ ...row, rank: idx + 1 }));

  const result = { ranking, period, sortBy };
  cache.set(cacheKey, result, TTL.RANKING);
  return c.json(result);
});
