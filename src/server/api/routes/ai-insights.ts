import { Hono } from "hono";
import { db } from "@/server/db";
import { aiInsights } from "@/server/db/schema";
import { desc, eq } from "drizzle-orm";
import { parseLimit, parseInsightType } from "@/server/api/middleware/validate";
import { aiRateLimit } from "@/server/api/middleware/rate-limit";

export const aiInsightsRoute = new Hono();

// Get latest insights
aiInsightsRoute.get("/", async (c) => {
  const limit = parseLimit(c.req.query("limit"));
  const type = parseInsightType(c.req.query("type"));

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
// Rate limited to 10 requests per minute
aiInsightsRoute.post("/generate", aiRateLimit, async (c) => {
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
