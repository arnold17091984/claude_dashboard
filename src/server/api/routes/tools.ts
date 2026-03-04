import { Hono } from "hono";
import { db } from "@/server/db";
import { events, dailySummary } from "@/server/db/schema";
import { sql, count, sum, desc, gte, and } from "drizzle-orm";
import { cache, TTL, toolsUsageKey, toolsTrendKey } from "@/server/lib/cache";

export const toolsRoute = new Hono();

toolsRoute.get("/usage", async (c) => {
  const period = c.req.query("period") || "30d";
  const cacheKey = toolsUsageKey(period);

  const cached = cache.get(cacheKey);
  if (cached) {
    return c.json(cached);
  }

  const daysBack = period === "90d" ? 90 : period === "30d" ? 30 : 7;
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

  const [allTools, skills, subagents, builtins, mcpTools] = await Promise.all([
    // 全ツール使用統計
    db
      .select({
        toolName: events.toolName,
        count: count(),
      })
      .from(events)
      .where(and(gte(events.timestamp, since), sql`${events.toolName} IS NOT NULL`))
      .groupBy(events.toolName)
      .orderBy(desc(count()))
      .limit(30),

    // スキル別集計
    db
      .select({
        skillName: events.skillName,
        count: count(),
      })
      .from(events)
      .where(and(gte(events.timestamp, since), sql`${events.skillName} IS NOT NULL`))
      .groupBy(events.skillName)
      .orderBy(desc(count()))
      .limit(20),

    // サブエージェント別集計
    db
      .select({
        subagentType: events.subagentType,
        count: count(),
      })
      .from(events)
      .where(and(gte(events.timestamp, since), sql`${events.subagentType} IS NOT NULL`))
      .groupBy(events.subagentType)
      .orderBy(desc(count()))
      .limit(20),

    // ビルトインツール (toolNameあり、skillName/subagentTypeなし、mcp__で始まらない)
    db
      .select({
        toolName: events.toolName,
        count: count(),
      })
      .from(events)
      .where(
        and(
          gte(events.timestamp, since),
          sql`${events.toolName} IS NOT NULL`,
          sql`${events.skillName} IS NULL`,
          sql`${events.subagentType} IS NULL`,
          sql`${events.toolName} NOT LIKE 'mcp__%'`
        )
      )
      .groupBy(events.toolName)
      .orderBy(desc(count()))
      .limit(20),

    // MCPツール (mcp__で始まるもの)
    db
      .select({
        toolName: events.toolName,
        count: count(),
      })
      .from(events)
      .where(
        and(
          gte(events.timestamp, since),
          sql`${events.toolName} LIKE 'mcp__%'`
        )
      )
      .groupBy(events.toolName)
      .orderBy(desc(count()))
      .limit(20),
  ]);

  // カテゴリ別サマリー
  const totalSkills = skills.reduce((acc, s) => acc + s.count, 0);
  const totalSubagents = subagents.reduce((acc, s) => acc + s.count, 0);
  const totalBuiltins = builtins.reduce((acc, b) => acc + b.count, 0);
  const totalMcp = mcpTools.reduce((acc, m) => acc + m.count, 0);

  const categorySummary = [
    { category: "builtin", label: "ビルトイン", total: totalBuiltins },
    { category: "skill", label: "スキル", total: totalSkills },
    { category: "subagent", label: "サブエージェント", total: totalSubagents },
    { category: "mcp", label: "MCP", total: totalMcp },
  ];

  const result = {
    categorySummary,
    allTools,
    skills,
    subagents,
    builtins,
    mcpTools,
    period,
  };

  cache.set(cacheKey, result, TTL.AGGREGATIONS);
  return c.json(result);
});

toolsRoute.get("/trend", async (c) => {
  const period = c.req.query("period") || "30d";
  const cacheKey = toolsTrendKey(period);

  const cached = cache.get(cacheKey);
  if (cached) {
    return c.json(cached);
  }

  const daysBack = period === "90d" ? 90 : period === "30d" ? 30 : 7;
  const sinceDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const trend = await db
    .select({
      date: dailySummary.date,
      toolCalls: sum(dailySummary.toolCallCount),
      sessions: sum(dailySummary.sessionCount),
    })
    .from(dailySummary)
    .where(gte(dailySummary.date, sinceDate))
    .groupBy(dailySummary.date)
    .orderBy(dailySummary.date);

  const result = { trend, period };
  cache.set(cacheKey, result, TTL.AGGREGATIONS);
  return c.json(result);
});
