import { Hono } from "hono";
import { db } from "@/server/db";
import { aiInsights } from "@/server/db/schema";
import { desc, eq } from "drizzle-orm";

export const aiInsightsRoute = new Hono();

// Get latest insights
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

// Generate new insight (requires ANTHROPIC_API_KEY)
aiInsightsRoute.post("/generate", async (c) => {
  try {
    const { generateWeeklyInsight } = await import(
      "@/server/services/ai-insight-generator"
    );
    const content = await generateWeeklyInsight();
    return c.json({ success: true, content });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return c.json({ success: false, error: message }, 500);
  }
});
