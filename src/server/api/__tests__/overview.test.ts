/**
 * Tests for GET /api/v1/overview
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { Hono } from "hono";
import {
  createTestDb,
  seedUser,
  seedSession,
  seedTokenUsage,
  seedDailySummary,
  seedEvent,
} from "@/test/db-helper";

// -------------------------------------------------------------------
// Set up an isolated in-memory database before any module is loaded
// -------------------------------------------------------------------
const { db, cleanup } = createTestDb();

vi.mock("@/server/db", () => ({ db }));

// Import AFTER the mock is registered so the route module picks up testDb
const { overviewRoute } = await import("@/server/api/routes/overview");

afterAll(cleanup);

// -------------------------------------------------------------------
// Build a minimal Hono app that mounts the route under its real prefix
// -------------------------------------------------------------------
function buildApp() {
  const app = new Hono().basePath("/api/v1");
  app.route("/overview", overviewRoute);
  return app;
}

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------
async function getOverview(app: Hono, period?: string) {
  const url = period
    ? `http://localhost/api/v1/overview?period=${period}`
    : "http://localhost/api/v1/overview";
  const res = await app.request(url);
  const body = await res.json();
  return { res, body };
}

// -------------------------------------------------------------------
// Tests
// -------------------------------------------------------------------
describe("GET /api/v1/overview", () => {
  describe("with empty database", () => {
    it("returns 200 with zero KPI values", async () => {
      const app = buildApp();
      const { res, body } = await getOverview(app);

      expect(res.status).toBe(200);
      expect(body.kpi.totalUsers).toBe(0);
      expect(body.kpi.totalSessions).toBe(0);
      expect(body.kpi.recentSessions).toBe(0);
      expect(body.kpi.totalCost).toBe(0);
    });

    it("returns empty arrays for dailyActivity, topTools, topModels, topProjects", async () => {
      const app = buildApp();
      const { body } = await getOverview(app);

      expect(body.dailyActivity).toEqual([]);
      expect(body.topTools).toEqual([]);
      expect(body.topModels).toEqual([]);
      expect(body.topProjects).toEqual([]);
    });

    it("defaults period to 7d", async () => {
      const app = buildApp();
      const { body } = await getOverview(app);
      expect(body.period).toBe("7d");
    });
  });

  describe("with seeded data", () => {
    beforeAll(() => {
      // Seed a user, session, token usage and daily summary
      seedUser(db, { id: "user-overview", displayName: "Overview User" });
      const startedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(); // 2 days ago
      seedSession(db, {
        id: "session-overview",
        userId: "user-overview",
        projectName: "my-project",
        startedAt,
      });
      seedTokenUsage(db, {
        id: undefined,
        sessionId: "session-overview",
        userId: "user-overview",
        model: "claude-sonnet-4-6",
        inputTokens: 5000,
        outputTokens: 2000,
        estimatedCostUsd: 0.045,
        timestamp: startedAt,
      });
      seedDailySummary(db, {
        userId: "user-overview",
        date: startedAt.slice(0, 10),
        sessionCount: 1,
        messageCount: 8,
        toolCallCount: 4,
        estimatedCostUsd: 0.045,
        topTool: "Read",
      });
      seedEvent(db, {
        sessionId: "session-overview",
        userId: "user-overview",
        toolName: "Read",
        timestamp: startedAt,
      });
      seedEvent(db, {
        sessionId: "session-overview",
        userId: "user-overview",
        toolName: "Bash",
        timestamp: startedAt,
      });
    });

    it("returns correct user count", async () => {
      const app = buildApp();
      const { body } = await getOverview(app, "30d");
      expect(body.kpi.totalUsers).toBeGreaterThanOrEqual(1);
    });

    it("returns correct session count", async () => {
      const app = buildApp();
      const { body } = await getOverview(app, "30d");
      expect(body.kpi.totalSessions).toBeGreaterThanOrEqual(1);
    });

    it("returns cost > 0", async () => {
      const app = buildApp();
      const { body } = await getOverview(app, "30d");
      expect(body.kpi.totalCost).toBeGreaterThan(0);
    });

    it("includes topTools entries", async () => {
      const app = buildApp();
      const { body } = await getOverview(app, "30d");
      expect(Array.isArray(body.topTools)).toBe(true);
      expect(body.topTools.length).toBeGreaterThan(0);
      const toolNames = body.topTools.map((t: { toolName: string }) => t.toolName);
      expect(toolNames).toContain("Read");
    });

    it("includes topModels entries", async () => {
      const app = buildApp();
      const { body } = await getOverview(app, "30d");
      expect(body.topModels.length).toBeGreaterThan(0);
    });

    it("includes topProjects entries", async () => {
      const app = buildApp();
      const { body } = await getOverview(app, "30d");
      const projectNames = body.topProjects.map((p: { projectName: string }) => p.projectName);
      expect(projectNames).toContain("my-project");
    });

    it("dailyActivity contains date entries", async () => {
      const app = buildApp();
      const { body } = await getOverview(app, "30d");
      expect(body.dailyActivity.length).toBeGreaterThan(0);
      const entry = body.dailyActivity[0];
      expect(entry).toHaveProperty("date");
      expect(entry).toHaveProperty("sessions");
      expect(entry).toHaveProperty("messages");
    });
  });

  describe("period query parameter", () => {
    it("accepts 30d period", async () => {
      const app = buildApp();
      const { res, body } = await getOverview(app, "30d");
      expect(res.status).toBe(200);
      expect(body.period).toBe("30d");
    });

    it("accepts 90d period", async () => {
      const app = buildApp();
      const { res, body } = await getOverview(app, "90d");
      expect(res.status).toBe(200);
      expect(body.period).toBe("90d");
    });

    it("treats unknown period as 7d", async () => {
      const app = buildApp();
      const { body } = await getOverview(app, "invalid");
      expect(body.period).toBe("invalid"); // echoed back as-is
    });
  });

  describe("response shape", () => {
    it("kpi object has all required fields", async () => {
      const app = buildApp();
      const { body } = await getOverview(app);
      const { kpi } = body;
      expect(kpi).toHaveProperty("totalUsers");
      expect(kpi).toHaveProperty("totalSessions");
      expect(kpi).toHaveProperty("recentSessions");
      expect(kpi).toHaveProperty("totalInputTokens");
      expect(kpi).toHaveProperty("totalOutputTokens");
      expect(kpi).toHaveProperty("totalCacheReadTokens");
      expect(kpi).toHaveProperty("totalCost");
    });
  });
});
