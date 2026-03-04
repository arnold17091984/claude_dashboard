import { Hono } from "hono";
import { db } from "@/server/db";
import { aiInsights } from "@/server/db/schema";
import { desc, eq } from "drizzle-orm";

export const aiInsightsRoute = new Hono();

// Get latest insights (optionally filtered by ?type=)
aiInsightsRoute.get("/", async (c) => {
  const limit = Number(c.req.query("limit") || "10");
  const type = c.req.query("type");

  const results = type
    ? await db
        .select()
        .from(aiInsights)
        .where(eq(aiInsights.insightType, type))
        .orderBy(desc(aiInsights.generatedAt))
        .limit(limit)
    : await db
        .select()
        .from(aiInsights)
        .orderBy(desc(aiInsights.generatedAt))
        .limit(limit);

  return c.json({ insights: results });
});

// Get latest insight
aiInsightsRoute.get("/latest", async (c) => {
  const result = await db
    .select()
    .from(aiInsights)
    .orderBy(desc(aiInsights.generatedAt))
    .limit(1);

  return c.json({ insight: result[0] || null });
});

// Compare two periods: GET /api/v1/ai-insights/compare?period1=7d&period2=30d
aiInsightsRoute.get("/compare", async (c) => {
  const period1Str = c.req.query("period1") || "7d";
  const period2Str = c.req.query("period2") || "30d";

  const parsePeriod = (p: string): number => {
    const match = p.match(/^(\d+)d$/);
    if (!match) return 7;
    const days = parseInt(match[1], 10);
    // Cap to reasonable range
    return Math.min(Math.max(days, 1), 365);
  };

  const period1Days = parsePeriod(period1Str);
  const period2Days = parsePeriod(period2Str);

  if (period1Days >= period2Days) {
    return c.json(
      { error: "period1 must be shorter than period2 (e.g. period1=7d&period2=30d)" },
      400
    );
  }

  try {
    const { comparePeriods } = await import(
      "@/server/services/ai-insight-generator"
    );
    const comparison = await comparePeriods(period1Days, period2Days);
    return c.json({ comparison });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

// Generate weekly insight
aiInsightsRoute.post("/generate", async (c) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return c.json(
      {
        success: false,
        error: "ANTHROPIC_API_KEY is not set",
        setupRequired: true,
      },
      400
    );
  }

  const type = c.req.query("type") || "weekly_summary";

  try {
    const generator = await import("@/server/services/ai-insight-generator");

    let content: string;
    switch (type) {
      case "daily_summary":
        content = await generator.generateDailySummary();
        break;
      case "cost_optimization":
        content = await generator.generateCostOptimization();
        break;
      case "productivity_trend":
        content = await generator.generateProductivityTrend();
        break;
      case "weekly_summary":
      default:
        content = await generator.generateWeeklyInsight();
        break;
    }

    return c.json({ success: true, content });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const setupRequired = message.includes("ANTHROPIC_API_KEY");
    return c.json({ success: false, error: message, setupRequired }, 500);
  }
});

// Generate insight for a specific user: POST /api/v1/ai-insights/generate/user/:userId
aiInsightsRoute.post("/generate/user/:userId", async (c) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return c.json(
      {
        success: false,
        error: "ANTHROPIC_API_KEY is not set",
        setupRequired: true,
      },
      400
    );
  }

  const userId = c.req.param("userId");
  if (!userId) {
    return c.json({ success: false, error: "userId is required" }, 400);
  }

  try {
    const { generateUserInsight } = await import(
      "@/server/services/ai-insight-generator"
    );
    const content = await generateUserInsight(userId);
    return c.json({ success: true, content, userId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const setupRequired = message.includes("ANTHROPIC_API_KEY");
    return c.json({ success: false, error: message, setupRequired }, 500);
  }
});
