/**
 * Tests for GET /api/v1/tools/usage and GET /api/v1/tools/trend
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { Hono } from "hono";
import { createTestDb, seedUser, seedSession, seedEvent, seedDailySummary } from "@/test/db-helper";

const { db, cleanup } = createTestDb();

vi.mock("@/server/db", () => ({ db }));

const { toolsRoute } = await import("@/server/api/routes/tools");

afterAll(cleanup);

function buildApp() {
  const app = new Hono().basePath("/api/v1");
  app.route("/tools", toolsRoute);
  return app;
}

async function getToolUsage(app: Hono, period?: string) {
  const url = period
    ? `http://localhost/api/v1/tools/usage?period=${period}`
    : "http://localhost/api/v1/tools/usage";
  const res = await app.request(url);
  const body = await res.json();
  return { res, body };
}

async function getToolTrend(app: Hono, period?: string) {
  const url = period
    ? `http://localhost/api/v1/tools/trend?period=${period}`
    : "http://localhost/api/v1/tools/trend";
  const res = await app.request(url);
  const body = await res.json();
  return { res, body };
}

// -------------------------------------------------------------------
// Tests
// -------------------------------------------------------------------
describe("GET /api/v1/tools/usage", () => {
  describe("with empty database", () => {
    it("returns 200", async () => {
      const app = buildApp();
      const { res } = await getToolUsage(app);
      expect(res.status).toBe(200);
    });

    it("returns empty arrays for all tool categories", async () => {
      const app = buildApp();
      const { body } = await getToolUsage(app);
      expect(body.allTools).toEqual([]);
      expect(body.skills).toEqual([]);
      expect(body.subagents).toEqual([]);
      expect(body.builtins).toEqual([]);
      expect(body.mcpTools).toEqual([]);
    });

    it("categorySummary has all four categories with zero totals", async () => {
      const app = buildApp();
      const { body } = await getToolUsage(app);
      const categories = body.categorySummary.map((c: { category: string }) => c.category);
      expect(categories).toContain("builtin");
      expect(categories).toContain("skill");
      expect(categories).toContain("subagent");
      expect(categories).toContain("mcp");
      body.categorySummary.forEach((c: { total: number }) => {
        expect(c.total).toBe(0);
      });
    });

    it("defaults period to 30d", async () => {
      const app = buildApp();
      const { body } = await getToolUsage(app);
      expect(body.period).toBe("30d");
    });
  });

  describe("with seeded events", () => {
    const userId = "user-tools";
    const sessionId = "session-tools";
    const recentTs = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();

    beforeAll(() => {
      seedUser(db, { id: userId, displayName: "Tools User" });
      seedSession(db, { id: sessionId, userId, startedAt: recentTs });

      // 3x Read (builtin)
      for (let i = 0; i < 3; i++) {
        seedEvent(db, { sessionId, userId, toolName: "Read", timestamp: recentTs });
      }
      // 2x Bash (builtin)
      for (let i = 0; i < 2; i++) {
        seedEvent(db, { sessionId, userId, toolName: "Bash", timestamp: recentTs });
      }
      // 1x Skill (skill category)
      seedEvent(db, {
        sessionId,
        userId,
        toolName: "Skill",
        skillName: "code-review",
        timestamp: recentTs,
      });
      // 1x Agent (subagent category)
      seedEvent(db, {
        sessionId,
        userId,
        toolName: "Agent",
        subagentType: "qa-expert",
        timestamp: recentTs,
      });
      // 1x MCP tool
      seedEvent(db, {
        sessionId,
        userId,
        toolName: "mcp__github__search",
        timestamp: recentTs,
      });
    });

    it("allTools includes seeded tool names", async () => {
      const app = buildApp();
      const { body } = await getToolUsage(app, "30d");
      const toolNames = body.allTools.map((t: { toolName: string }) => t.toolName);
      expect(toolNames).toContain("Read");
      expect(toolNames).toContain("Bash");
    });

    it("builtins list includes Read and Bash", async () => {
      const app = buildApp();
      const { body } = await getToolUsage(app, "30d");
      const builtinNames = body.builtins.map((b: { toolName: string }) => b.toolName);
      expect(builtinNames).toContain("Read");
      expect(builtinNames).toContain("Bash");
    });

    it("Read has count of 3", async () => {
      const app = buildApp();
      const { body } = await getToolUsage(app, "30d");
      const read = body.allTools.find((t: { toolName: string }) => t.toolName === "Read");
      expect(read?.count).toBe(3);
    });

    it("mcpTools list includes the mcp tool", async () => {
      const app = buildApp();
      const { body } = await getToolUsage(app, "30d");
      const mcpNames = body.mcpTools.map((m: { toolName: string }) => m.toolName);
      expect(mcpNames).toContain("mcp__github__search");
    });

    it("categorySummary builtin total > 0", async () => {
      const app = buildApp();
      const { body } = await getToolUsage(app, "30d");
      const builtin = body.categorySummary.find((c: { category: string }) => c.category === "builtin");
      expect(builtin?.total).toBeGreaterThan(0);
    });
  });
});

describe("GET /api/v1/tools/trend", () => {
  describe("with empty database", () => {
    it("returns 200 with empty trend array", async () => {
      const app = buildApp();
      const { res, body } = await getToolTrend(app);
      expect(res.status).toBe(200);
      expect(body.trend).toEqual([]);
    });

    it("defaults period to 30d", async () => {
      const app = buildApp();
      const { body } = await getToolTrend(app);
      expect(body.period).toBe("30d");
    });
  });

  describe("with daily summary data", () => {
    const userId = "user-tools-trend";
    const today = new Date().toISOString().slice(0, 10);

    beforeAll(() => {
      seedUser(db, { id: userId, displayName: "Trend User" });
      seedDailySummary(db, {
        userId,
        date: today,
        toolCallCount: 42,
        sessionCount: 3,
      });
    });

    it("returns trend entries for seeded daily summaries", async () => {
      const app = buildApp();
      const { body } = await getToolTrend(app, "30d");
      expect(body.trend.length).toBeGreaterThan(0);
      const entry = body.trend[0];
      expect(entry).toHaveProperty("date");
      expect(entry).toHaveProperty("toolCalls");
      expect(entry).toHaveProperty("sessions");
    });

    it("accepts 7d period", async () => {
      const app = buildApp();
      const { res, body } = await getToolTrend(app, "7d");
      expect(res.status).toBe(200);
      expect(body.period).toBe("7d");
    });

    it("accepts 90d period", async () => {
      const app = buildApp();
      const { res, body } = await getToolTrend(app, "90d");
      expect(res.status).toBe(200);
      expect(body.period).toBe("90d");
    });
  });
});
