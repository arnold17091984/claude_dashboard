/**
 * Tests for GET /api/v1/ranking
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { Hono } from "hono";
import { createTestDb, seedUser, seedDailySummary } from "@/test/db-helper";

const { db, cleanup } = createTestDb();

vi.mock("@/server/db", () => ({ db }));

const { rankingRoute } = await import("@/server/api/routes/ranking");

afterAll(cleanup);

function buildApp() {
  const app = new Hono().basePath("/api/v1");
  app.route("/ranking", rankingRoute);
  return app;
}

async function getRanking(app: Hono, query = "") {
  const res = await app.request(`http://localhost/api/v1/ranking${query}`);
  const body = await res.json();
  return { res, body };
}

// -------------------------------------------------------------------
// Tests
// -------------------------------------------------------------------
describe("GET /api/v1/ranking", () => {
  describe("with empty database", () => {
    it("returns 200 with empty ranking array", async () => {
      const app = buildApp();
      const { res, body } = await getRanking(app);
      expect(res.status).toBe(200);
      expect(body.ranking).toEqual([]);
    });

    it("defaults period to 7d and sortBy to cost", async () => {
      const app = buildApp();
      const { body } = await getRanking(app);
      expect(body.period).toBe("7d");
      expect(body.sortBy).toBe("cost");
    });
  });

  describe("with seeded users and summaries", () => {
    const today = new Date().toISOString().slice(0, 10);

    beforeAll(() => {
      // User A: high cost
      seedUser(db, { id: "rank-user-a", displayName: "Alice", team: "alpha" });
      seedDailySummary(db, {
        userId: "rank-user-a",
        date: today,
        sessionCount: 10,
        messageCount: 100,
        toolCallCount: 50,
        estimatedCostUsd: 5.0,
        activeMinutes: 120,
        topTool: "Read",
      });

      // User B: high sessions
      seedUser(db, { id: "rank-user-b", displayName: "Bob", team: "beta" });
      seedDailySummary(db, {
        userId: "rank-user-b",
        date: today,
        sessionCount: 20,
        messageCount: 200,
        toolCallCount: 10,
        estimatedCostUsd: 1.0,
        activeMinutes: 60,
        topTool: "Bash",
      });

      // User C: high toolCalls
      seedUser(db, { id: "rank-user-c", displayName: "Carol", team: "gamma" });
      seedDailySummary(db, {
        userId: "rank-user-c",
        date: today,
        sessionCount: 5,
        messageCount: 50,
        toolCallCount: 200,
        estimatedCostUsd: 2.0,
        activeMinutes: 90,
        topTool: "Bash",
      });
    });

    it("returns ranking entries for all seeded users", async () => {
      const app = buildApp();
      const { body } = await getRanking(app, "?period=7d");
      expect(body.ranking.length).toBeGreaterThanOrEqual(3);
    });

    it("each ranking entry has a rank field starting at 1", async () => {
      const app = buildApp();
      const { body } = await getRanking(app, "?period=7d");
      const ranks = body.ranking.map((r: { rank: number }) => r.rank);
      expect(ranks[0]).toBe(1);
    });

    it("ranking entries have expected fields", async () => {
      const app = buildApp();
      const { body } = await getRanking(app, "?period=7d");
      const entry = body.ranking[0];
      expect(entry).toHaveProperty("userId");
      expect(entry).toHaveProperty("displayName");
      expect(entry).toHaveProperty("sessions");
      expect(entry).toHaveProperty("messages");
      expect(entry).toHaveProperty("toolCalls");
      expect(entry).toHaveProperty("cost");
      expect(entry).toHaveProperty("activeMinutes");
      expect(entry).toHaveProperty("rank");
    });

    describe("sortBy=cost", () => {
      it("sorts descending by cost", async () => {
        const app = buildApp();
        const { body } = await getRanking(app, "?sortBy=cost&period=7d");
        const costs = body.ranking.map((r: { cost: number }) => r.cost);
        for (let i = 0; i < costs.length - 1; i++) {
          expect(costs[i]).toBeGreaterThanOrEqual(costs[i + 1]);
        }
        // Alice should be first (highest cost)
        expect(body.ranking[0].displayName).toBe("Alice");
      });
    });

    describe("sortBy=sessions", () => {
      it("sorts descending by sessions", async () => {
        const app = buildApp();
        const { body } = await getRanking(app, "?sortBy=sessions&period=7d");
        const sessions = body.ranking.map((r: { sessions: number }) => r.sessions);
        for (let i = 0; i < sessions.length - 1; i++) {
          expect(sessions[i]).toBeGreaterThanOrEqual(sessions[i + 1]);
        }
        // Bob should be first (20 sessions)
        expect(body.ranking[0].displayName).toBe("Bob");
      });
    });

    describe("sortBy=toolCalls", () => {
      it("sorts descending by toolCalls", async () => {
        const app = buildApp();
        const { body } = await getRanking(app, "?sortBy=toolCalls&period=7d");
        const toolCalls = body.ranking.map((r: { toolCalls: number }) => r.toolCalls);
        for (let i = 0; i < toolCalls.length - 1; i++) {
          expect(toolCalls[i]).toBeGreaterThanOrEqual(toolCalls[i + 1]);
        }
        // Carol should be first (200 tool calls)
        expect(body.ranking[0].displayName).toBe("Carol");
      });
    });

    describe("period filtering", () => {
      it("respects 30d period", async () => {
        const app = buildApp();
        const { res, body } = await getRanking(app, "?period=30d");
        expect(res.status).toBe(200);
        expect(body.period).toBe("30d");
        // Today's data is within 30d so we still get results
        expect(body.ranking.length).toBeGreaterThan(0);
      });

      it("90d period is accepted", async () => {
        const app = buildApp();
        const { res, body } = await getRanking(app, "?period=90d");
        expect(res.status).toBe(200);
        expect(body.period).toBe("90d");
      });
    });

    it("topTool is populated when daily_summary has topTool set", async () => {
      const app = buildApp();
      const { body } = await getRanking(app, "?period=7d");
      const alice = body.ranking.find((r: { displayName: string }) => r.displayName === "Alice");
      expect(alice?.topTool).toBe("Read");
    });
  });
});
