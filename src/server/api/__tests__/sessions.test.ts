/**
 * Tests for GET /api/v1/sessions and GET /api/v1/sessions/:id
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { Hono } from "hono";
import { createTestDb, seedUser, seedSession, seedTokenUsage, seedEvent } from "@/test/db-helper";

const { db, cleanup } = createTestDb();

vi.mock("@/server/db", () => ({ db }));

const { sessionsRoute } = await import("@/server/api/routes/sessions");

afterAll(cleanup);

function buildApp() {
  const app = new Hono().basePath("/api/v1");
  app.route("/sessions", sessionsRoute);
  return app;
}

async function getSessions(app: Hono, query = "") {
  const res = await app.request(`http://localhost/api/v1/sessions${query}`);
  const body = await res.json();
  return { res, body };
}

async function getSession(app: Hono, id: string) {
  const res = await app.request(`http://localhost/api/v1/sessions/${id}`);
  const body = await res.json();
  return { res, body };
}

// -------------------------------------------------------------------
// Tests
// -------------------------------------------------------------------
describe("GET /api/v1/sessions", () => {
  describe("with empty database", () => {
    it("returns 200 with empty sessions array", async () => {
      const app = buildApp();
      const { res, body } = await getSessions(app);
      expect(res.status).toBe(200);
      expect(body.sessions).toEqual([]);
    });

    it("returns valid pagination metadata", async () => {
      const app = buildApp();
      const { body } = await getSessions(app);
      expect(body.pagination).toMatchObject({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      });
    });

    it("defaults period to 30d", async () => {
      const app = buildApp();
      const { body } = await getSessions(app);
      expect(body.period).toBe("30d");
    });
  });

  describe("with seeded data", () => {
    const userId = "user-sessions";
    const sessionId = "session-sessions";
    const recentDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();

    beforeAll(() => {
      seedUser(db, { id: userId, displayName: "Session User" });
      seedSession(db, {
        id: sessionId,
        userId,
        projectName: "session-project",
        startedAt: recentDate,
        messageCount: 10,
        toolCallCount: 6,
      });
    });

    it("returns the seeded session", async () => {
      const app = buildApp();
      const { body } = await getSessions(app, "?period=30d");
      expect(body.sessions.length).toBeGreaterThanOrEqual(1);
      const found = body.sessions.find((s: { id: string }) => s.id === sessionId);
      expect(found).toBeDefined();
      expect(found.projectName).toBe("session-project");
    });

    it("pagination total reflects the seeded session", async () => {
      const app = buildApp();
      const { body } = await getSessions(app, "?period=30d");
      expect(body.pagination.total).toBeGreaterThanOrEqual(1);
    });

    it("respects limit query parameter", async () => {
      const app = buildApp();
      const { body } = await getSessions(app, "?period=30d&limit=1");
      expect(body.sessions.length).toBeLessThanOrEqual(1);
      expect(body.pagination.limit).toBe(1);
    });

    it("respects page query parameter", async () => {
      const app = buildApp();
      // page 2 of a 1-item list should return empty
      const { body } = await getSessions(app, "?period=30d&page=2&limit=1");
      expect(body.pagination.page).toBe(2);
    });

    it("session object has expected fields", async () => {
      const app = buildApp();
      const { body } = await getSessions(app, "?period=30d");
      const session = body.sessions.find((s: { id: string }) => s.id === sessionId);
      expect(session).toHaveProperty("id");
      expect(session).toHaveProperty("userId");
      expect(session).toHaveProperty("projectName");
      expect(session).toHaveProperty("startedAt");
      expect(session).toHaveProperty("messageCount");
      expect(session).toHaveProperty("toolCallCount");
    });
  });
});

describe("GET /api/v1/sessions/:id", () => {
  const userId = "user-session-detail";
  const sessionId = "session-detail";
  const ts = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  beforeAll(() => {
    seedUser(db, { id: userId, displayName: "Detail User" });
    seedSession(db, {
      id: sessionId,
      userId,
      projectName: "detail-project",
      startedAt: ts,
    });
    seedEvent(db, {
      sessionId,
      userId,
      toolName: "Read",
      timestamp: ts,
    });
    seedEvent(db, {
      sessionId,
      userId,
      toolName: "Bash",
      timestamp: ts,
    });
    seedTokenUsage(db, {
      sessionId,
      userId,
      model: "claude-sonnet-4-6",
      inputTokens: 3000,
      outputTokens: 1500,
      estimatedCostUsd: 0.031,
      timestamp: ts,
    });
  });

  it("returns session details for valid id", async () => {
    const app = buildApp();
    const { res, body } = await getSession(app, sessionId);
    expect(res.status).toBe(200);
    expect(body.session.id).toBe(sessionId);
    expect(body.session.projectName).toBe("detail-project");
  });

  it("returns toolUsage array", async () => {
    const app = buildApp();
    const { body } = await getSession(app, sessionId);
    expect(Array.isArray(body.toolUsage)).toBe(true);
    const toolNames = body.toolUsage.map((t: { toolName: string }) => t.toolName);
    expect(toolNames).toContain("Read");
    expect(toolNames).toContain("Bash");
  });

  it("returns tokenStats array", async () => {
    const app = buildApp();
    const { body } = await getSession(app, sessionId);
    expect(Array.isArray(body.tokenStats)).toBe(true);
    expect(body.tokenStats.length).toBeGreaterThan(0);
    expect(body.tokenStats[0].model).toBe("claude-sonnet-4-6");
  });

  it("returns 404 for non-existent session id", async () => {
    const app = buildApp();
    const { res, body } = await getSession(app, "nonexistent-session-id");
    expect(res.status).toBe(404);
    expect(body.error).toBe("Session not found");
  });

  it("response has session, toolUsage, and tokenStats keys", async () => {
    const app = buildApp();
    const { body } = await getSession(app, sessionId);
    expect(body).toHaveProperty("session");
    expect(body).toHaveProperty("toolUsage");
    expect(body).toHaveProperty("tokenStats");
  });
});
