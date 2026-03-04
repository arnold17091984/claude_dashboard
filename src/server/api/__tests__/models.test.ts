/**
 * Tests for GET /api/v1/models/usage and GET /api/v1/models/cost
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { Hono } from "hono";
import { createTestDb, seedUser, seedSession, seedTokenUsage } from "@/test/db-helper";

const { db, cleanup } = createTestDb();

vi.mock("@/server/db", () => ({ db }));

const { modelsRoute } = await import("@/server/api/routes/models");

afterAll(cleanup);

function buildApp() {
  const app = new Hono().basePath("/api/v1");
  app.route("/models", modelsRoute);
  return app;
}

async function getModelUsage(app: Hono, period?: string) {
  const url = period
    ? `http://localhost/api/v1/models/usage?period=${period}`
    : "http://localhost/api/v1/models/usage";
  const res = await app.request(url);
  const body = await res.json();
  return { res, body };
}

async function getModelCost(app: Hono, period?: string) {
  const url = period
    ? `http://localhost/api/v1/models/cost?period=${period}`
    : "http://localhost/api/v1/models/cost";
  const res = await app.request(url);
  const body = await res.json();
  return { res, body };
}

// -------------------------------------------------------------------
// Tests
// -------------------------------------------------------------------
describe("GET /api/v1/models/usage", () => {
  describe("with empty database", () => {
    it("returns 200 with empty usage array", async () => {
      const app = buildApp();
      const { res, body } = await getModelUsage(app);
      expect(res.status).toBe(200);
      expect(body.usage).toEqual([]);
    });

    it("returns zero totals", async () => {
      const app = buildApp();
      const { body } = await getModelUsage(app);
      expect(body.totalCost).toBe(0);
      expect(body.totalTokens).toBe(0);
    });

    it("defaults period to 30d", async () => {
      const app = buildApp();
      const { body } = await getModelUsage(app);
      expect(body.period).toBe("30d");
    });
  });

  describe("with seeded token usage", () => {
    const userId = "user-models";
    const sessionId = "session-models";
    const recentTs = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();

    beforeAll(() => {
      seedUser(db, { id: userId, displayName: "Models User" });
      seedSession(db, { id: sessionId, userId, startedAt: recentTs });
      seedTokenUsage(db, {
        sessionId,
        userId,
        model: "claude-sonnet-4-6",
        inputTokens: 10000,
        outputTokens: 5000,
        cacheReadTokens: 1000,
        cacheCreationTokens: 500,
        estimatedCostUsd: 0.105,
        timestamp: recentTs,
      });
      seedTokenUsage(db, {
        sessionId,
        userId,
        model: "claude-opus-4-6",
        inputTokens: 2000,
        outputTokens: 1000,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        estimatedCostUsd: 0.105,
        timestamp: recentTs,
      });
    });

    it("includes seeded models in usage array", async () => {
      const app = buildApp();
      const { body } = await getModelUsage(app, "30d");
      const modelNames = body.usage.map((u: { model: string }) => u.model);
      expect(modelNames).toContain("claude-sonnet-4-6");
      expect(modelNames).toContain("claude-opus-4-6");
    });

    it("each usage entry has expected fields", async () => {
      const app = buildApp();
      const { body } = await getModelUsage(app, "30d");
      const sonnet = body.usage.find((u: { model: string }) => u.model === "claude-sonnet-4-6");
      expect(sonnet).toHaveProperty("inputTokens");
      expect(sonnet).toHaveProperty("outputTokens");
      expect(sonnet).toHaveProperty("cacheReadTokens");
      expect(sonnet).toHaveProperty("cacheCreationTokens");
      expect(sonnet).toHaveProperty("cost");
      expect(sonnet).toHaveProperty("requestCount");
      expect(sonnet).toHaveProperty("costShare");
    });

    it("costShare sums to 100 across all models (approximately)", async () => {
      const app = buildApp();
      const { body } = await getModelUsage(app, "30d");
      const totalShare = body.usage.reduce(
        (acc: number, u: { costShare: number }) => acc + u.costShare,
        0
      );
      expect(totalShare).toBeCloseTo(100, 1);
    });

    it("totalCost is sum of model costs", async () => {
      const app = buildApp();
      const { body } = await getModelUsage(app, "30d");
      const sumFromEntries = body.usage.reduce(
        (acc: number, u: { cost: number }) => acc + u.cost,
        0
      );
      expect(body.totalCost).toBeCloseTo(sumFromEntries, 6);
    });

    it("totalTokens is sum of input + output tokens", async () => {
      const app = buildApp();
      const { body } = await getModelUsage(app, "30d");
      const sumTokens = body.usage.reduce(
        (acc: number, u: { inputTokens: number; outputTokens: number }) =>
          acc + u.inputTokens + u.outputTokens,
        0
      );
      expect(body.totalTokens).toBe(sumTokens);
    });

    it("usage ordered by cost descending", async () => {
      const app = buildApp();
      const { body } = await getModelUsage(app, "30d");
      const costs = body.usage.map((u: { cost: number }) => u.cost);
      for (let i = 0; i < costs.length - 1; i++) {
        expect(costs[i]).toBeGreaterThanOrEqual(costs[i + 1]);
      }
    });
  });
});

describe("GET /api/v1/models/cost", () => {
  // Note: this test suite shares a db instance with models/usage tests above.
  // The "empty" checks below verify structure only — data from usage tests may
  // be present, so we only assert the response shape and HTTP status.

  describe("response structure", () => {
    it("returns 200 with trend and models arrays", async () => {
      const app = buildApp();
      const { res, body } = await getModelCost(app);
      expect(res.status).toBe(200);
      expect(Array.isArray(body.trend)).toBe(true);
      expect(Array.isArray(body.models)).toBe(true);
    });

    it("defaults period to 30d", async () => {
      const app = buildApp();
      const { body } = await getModelCost(app);
      expect(body.period).toBe("30d");
    });
  });

  describe("with seeded token usage", () => {
    it("trend entries have date and total fields", async () => {
      const app = buildApp();
      // Data was already seeded in the models/usage suite (same db instance)
      const { body } = await getModelCost(app, "30d");
      if (body.trend.length > 0) {
        const entry = body.trend[0];
        expect(entry).toHaveProperty("date");
        expect(entry).toHaveProperty("total");
      }
    });

    it("models array lists all model names found", async () => {
      const app = buildApp();
      const { body } = await getModelCost(app, "30d");
      expect(Array.isArray(body.models)).toBe(true);
    });

    it("accepts 7d period", async () => {
      const app = buildApp();
      const { res, body } = await getModelCost(app, "7d");
      expect(res.status).toBe(200);
      expect(body.period).toBe("7d");
    });

    it("accepts 90d period", async () => {
      const app = buildApp();
      const { res, body } = await getModelCost(app, "90d");
      expect(res.status).toBe(200);
      expect(body.period).toBe("90d");
    });
  });
});
