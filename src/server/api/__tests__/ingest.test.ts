/**
 * Tests for POST /api/v1/ingest/session and POST /api/v1/ingest/events
 *
 * Authentication:
 *  - When DASHBOARD_API_KEY is unset → dev mode, all requests allowed
 *  - When DASHBOARD_API_KEY is set   → must supply matching X-API-Key header
 */
import { describe, it, expect, afterAll, beforeEach, vi } from "vitest";
import { Hono } from "hono";
import { createTestDb } from "@/test/db-helper";
import { schema } from "@/test/db-helper";
import { eq } from "drizzle-orm";

const { db, cleanup } = createTestDb();

vi.mock("@/server/db", () => ({ db }));

const { ingestRoute } = await import("@/server/api/routes/ingest");

afterAll(cleanup);

function buildApp() {
  const app = new Hono().basePath("/api/v1");
  app.route("/ingest", ingestRoute);
  return app;
}

// -------------------------------------------------------------------
// Helper: build a valid session payload
// -------------------------------------------------------------------
function makeSessionPayload(overrides: Record<string, unknown> = {}) {
  return {
    session: {
      sessionId: `session-${Date.now()}-${Math.random()}`,
      userId: "user-ingest-1",
      projectPath: "/projects/myapp",
      projectName: "myapp",
      startedAt: new Date().toISOString(),
      messageCount: 5,
      toolCallCount: 3,
      ...overrides,
    },
    events: [],
    tokenUsageEvents: [],
  };
}

function makeEventPayload(sessionId: string, userId: string) {
  return {
    events: [
      {
        sessionId,
        userId,
        eventType: "tool_use",
        toolName: "Read",
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

// Ensure DASHBOARD_API_KEY is not set in dev mode tests
const originalApiKey = process.env.DASHBOARD_API_KEY;

// -------------------------------------------------------------------
// POST /ingest/session
// -------------------------------------------------------------------
describe("POST /api/v1/ingest/session", () => {
  beforeEach(() => {
    // Reset to dev mode (no auth required)
    delete process.env.DASHBOARD_API_KEY;
  });

  afterAll(() => {
    process.env.DASHBOARD_API_KEY = originalApiKey;
  });

  it("returns 200 ok for a valid session payload", async () => {
    const app = buildApp();
    const payload = makeSessionPayload({ userId: "user-ingest-1" });

    // Seed the user first (ingest will call ensureUser)
    db.insert(schema.users).values({ id: "user-ingest-1", displayName: "Ingest User 1" }).run();

    const res = await app.request("http://localhost/api/v1/ingest/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(typeof body.sessionId).toBe("string");
  });

  it("creates a new session in the database", async () => {
    const app = buildApp();
    const userId = "user-ingest-create";
    const sessionId = `session-create-${Date.now()}`;
    db.insert(schema.users).values({ id: userId, displayName: "Create User" }).run();

    const payload = makeSessionPayload({ sessionId, userId });

    await app.request("http://localhost/api/v1/ingest/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const rows = db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.id, sessionId))
      .all();
    expect(rows.length).toBe(1);
    expect(rows[0].projectName).toBe("myapp");
  });

  it("upserts an existing session (updates instead of duplicating)", async () => {
    const app = buildApp();
    const userId = "user-ingest-upsert";
    const sessionId = `session-upsert-${Date.now()}`;
    db.insert(schema.users).values({ id: userId, displayName: "Upsert User" }).run();

    const payload1 = makeSessionPayload({ sessionId, userId, messageCount: 3 });
    const payload2 = makeSessionPayload({ sessionId, userId, messageCount: 10 });

    await app.request("http://localhost/api/v1/ingest/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload1),
    });

    await app.request("http://localhost/api/v1/ingest/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload2),
    });

    const rows = db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.id, sessionId))
      .all();
    expect(rows.length).toBe(1);
    expect(rows[0].messageCount).toBe(10);
  });

  it("returns 400 for invalid JSON body", async () => {
    const app = buildApp();
    const res = await app.request("http://localhost/api/v1/ingest/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toBe("Invalid JSON body");
  });

  it("returns 400 when required fields are missing", async () => {
    const app = buildApp();
    const res = await app.request("http://localhost/api/v1/ingest/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session: { sessionId: "abc" } }), // missing required fields
    });
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toBe("Validation failed");
  });

  it("inserts events when provided in payload", async () => {
    const app = buildApp();
    const userId = "user-ingest-events";
    const sessionId = `session-events-${Date.now()}`;
    db.insert(schema.users).values({ id: userId, displayName: "Events User" }).run();

    const payload = {
      session: {
        sessionId,
        userId,
        projectPath: "/projects/test",
        startedAt: new Date().toISOString(),
        messageCount: 1,
        toolCallCount: 1,
      },
      events: [
        {
          sessionId,
          userId,
          eventType: "tool_use",
          toolName: "Bash",
          timestamp: new Date().toISOString(),
        },
      ],
      tokenUsageEvents: [],
    };

    const res = await app.request("http://localhost/api/v1/ingest/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.eventsInserted).toBe(1);
  });

  it("inserts token usage events when provided", async () => {
    const app = buildApp();
    const userId = "user-ingest-tokens";
    const sessionId = `session-tokens-${Date.now()}`;
    db.insert(schema.users).values({ id: userId, displayName: "Tokens User" }).run();

    const payload = {
      session: {
        sessionId,
        userId,
        projectPath: "/projects/test",
        startedAt: new Date().toISOString(),
        messageCount: 1,
        toolCallCount: 0,
      },
      events: [],
      tokenUsageEvents: [
        {
          sessionId,
          userId,
          model: "claude-sonnet-4-6",
          inputTokens: 1000,
          outputTokens: 500,
          cacheReadInputTokens: 100,
          cacheCreationInputTokens: 50,
          timestamp: new Date().toISOString(),
        },
      ],
    };

    const res = await app.request("http://localhost/api/v1/ingest/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.tokenUsageEventsInserted).toBe(1);
  });

  describe("authentication", () => {
    it("allows request without API key when DASHBOARD_API_KEY is not set (dev mode)", async () => {
      delete process.env.DASHBOARD_API_KEY;
      const app = buildApp();
      const userId = "user-auth-dev";
      const sessionId = `session-auth-dev-${Date.now()}`;
      db.insert(schema.users).values({ id: userId, displayName: "Auth Dev User" }).run();

      const payload = makeSessionPayload({ sessionId, userId });
      const res = await app.request("http://localhost/api/v1/ingest/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      expect(res.status).toBe(200);
    });

    it("returns 401 when DASHBOARD_API_KEY is set but no key provided", async () => {
      process.env.DASHBOARD_API_KEY = "secret-test-key";
      const app = buildApp();
      const payload = makeSessionPayload();
      const res = await app.request("http://localhost/api/v1/ingest/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      expect(res.status).toBe(401);
    });

    it("returns 401 when wrong API key is provided", async () => {
      process.env.DASHBOARD_API_KEY = "secret-test-key";
      const app = buildApp();
      const payload = makeSessionPayload();
      const res = await app.request("http://localhost/api/v1/ingest/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": "wrong-key",
        },
        body: JSON.stringify(payload),
      });
      expect(res.status).toBe(401);
    });

    it("allows request with correct API key", async () => {
      process.env.DASHBOARD_API_KEY = "secret-test-key";
      const app = buildApp();
      const userId = "user-auth-key";
      const sessionId = `session-auth-key-${Date.now()}`;
      db.insert(schema.users).values({ id: userId, displayName: "Auth Key User" }).run();

      const payload = makeSessionPayload({ sessionId, userId });
      const res = await app.request("http://localhost/api/v1/ingest/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": "secret-test-key",
        },
        body: JSON.stringify(payload),
      });
      expect(res.status).toBe(200);
    });
  });
});

// -------------------------------------------------------------------
// POST /ingest/events
// -------------------------------------------------------------------
describe("POST /api/v1/ingest/events", () => {
  beforeEach(() => {
    delete process.env.DASHBOARD_API_KEY;
  });

  it("returns 200 ok for valid events payload", async () => {
    const app = buildApp();
    const userId = "user-events-1";
    const sessionId = `session-events-only-${Date.now()}`;

    db.insert(schema.users).values({ id: userId, displayName: "Events Only User" }).run();
    db.insert(schema.sessions).values({
      id: sessionId,
      userId,
      projectPath: "/projects/test",
      startedAt: new Date().toISOString(),
    }).run();

    const payload = makeEventPayload(sessionId, userId);
    const res = await app.request("http://localhost/api/v1/ingest/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.eventsInserted).toBe(1);
  });

  it("returns 400 for empty events array", async () => {
    const app = buildApp();
    const res = await app.request("http://localhost/api/v1/ingest/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: [] }),
    });
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toBe("Validation failed");
  });

  it("returns 400 for invalid JSON", async () => {
    const app = buildApp();
    const res = await app.request("http://localhost/api/v1/ingest/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "bad json",
    });
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toBe("Invalid JSON body");
  });

  it("inserts multiple events at once", async () => {
    const app = buildApp();
    const userId = "user-multi-events";
    const sessionId = `session-multi-${Date.now()}`;

    db.insert(schema.users).values({ id: userId, displayName: "Multi Events User" }).run();
    db.insert(schema.sessions).values({
      id: sessionId,
      userId,
      projectPath: "/projects/test",
      startedAt: new Date().toISOString(),
    }).run();

    const payload = {
      events: [
        { sessionId, userId, eventType: "tool_use", toolName: "Read", timestamp: new Date().toISOString() },
        { sessionId, userId, eventType: "tool_use", toolName: "Bash", timestamp: new Date().toISOString() },
        { sessionId, userId, eventType: "message", role: "assistant", timestamp: new Date().toISOString() },
      ],
    };

    const res = await app.request("http://localhost/api/v1/ingest/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.eventsInserted).toBe(3);
  });
});
