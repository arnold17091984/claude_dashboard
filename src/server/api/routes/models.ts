import { Hono } from "hono";
import { db } from "@/server/db";
import { tokenUsage } from "@/server/db/schema";
import { sql, sum, count, desc, gte } from "drizzle-orm";
import { parsePeriod, periodToSince } from "@/server/api/middleware/validate";

export const modelsRoute = new Hono();

modelsRoute.get("/usage", async (c) => {
  const period = parsePeriod(c.req.query("period") || "30d");
  const since = periodToSince(period);

  const usage = await db
    .select({
      model: tokenUsage.model,
      inputTokens: sum(tokenUsage.inputTokens),
      outputTokens: sum(tokenUsage.outputTokens),
      cacheReadTokens: sum(tokenUsage.cacheReadTokens),
      cacheCreationTokens: sum(tokenUsage.cacheCreationTokens),
      cost: sum(tokenUsage.estimatedCostUsd),
      requestCount: count(),
    })
    .from(tokenUsage)
    .where(gte(tokenUsage.timestamp, since))
    .groupBy(tokenUsage.model)
    .orderBy(desc(sum(tokenUsage.estimatedCostUsd)));

  const totalCost = usage.reduce((acc, u) => acc + Number(u.cost || 0), 0);
  const totalTokens = usage.reduce(
    (acc, u) => acc + Number(u.inputTokens || 0) + Number(u.outputTokens || 0),
    0
  );

  return c.json({
    usage: usage.map((u) => ({
      model: u.model,
      inputTokens: Number(u.inputTokens || 0),
      outputTokens: Number(u.outputTokens || 0),
      cacheReadTokens: Number(u.cacheReadTokens || 0),
      cacheCreationTokens: Number(u.cacheCreationTokens || 0),
      cost: Number(u.cost || 0),
      requestCount: u.requestCount,
      costShare: totalCost > 0 ? (Number(u.cost || 0) / totalCost) * 100 : 0,
    })),
    totalCost,
    totalTokens,
    period,
  });
});

modelsRoute.get("/cost", async (c) => {
  const period = parsePeriod(c.req.query("period") || "30d");
  const since = periodToSince(period);

  // 日別 x モデル別コスト
  const dailyCost = await db
    .select({
      date: sql<string>`substr(${tokenUsage.timestamp}, 1, 10)`,
      model: tokenUsage.model,
      cost: sum(tokenUsage.estimatedCostUsd),
      inputTokens: sum(tokenUsage.inputTokens),
      outputTokens: sum(tokenUsage.outputTokens),
    })
    .from(tokenUsage)
    .where(gte(tokenUsage.timestamp, since))
    .groupBy(sql`substr(${tokenUsage.timestamp}, 1, 10)`, tokenUsage.model)
    .orderBy(sql`substr(${tokenUsage.timestamp}, 1, 10)`);

  // ユニーク日付とモデル
  const dates = [...new Set(dailyCost.map((r) => r.date))].sort();
  const models = [...new Set(dailyCost.map((r) => r.model))];

  // ピボット: 日付 -> モデル別コスト
  const pivotMap = new Map<string, Record<string, number>>();
  for (const date of dates) {
    pivotMap.set(date, {});
  }
  for (const row of dailyCost) {
    const entry = pivotMap.get(row.date)!;
    entry[row.model] = Number(row.cost || 0);
  }

  const trend = dates.map((date) => {
    const entry = pivotMap.get(date)!;
    const record: Record<string, number | string> = { date };
    let total = 0;
    for (const model of models) {
      const v = entry[model] || 0;
      record[model] = v;
      total += v;
    }
    record.total = total;
    return record;
  });

  return c.json({ trend, models, period });
});
