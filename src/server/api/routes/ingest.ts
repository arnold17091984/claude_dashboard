/**
 * ingest.ts
 *
 * データ取り込みAPIエンドポイント。
 *
 * POST /api/v1/ingest/session  — セッションデータの受信・保存
 * POST /api/v1/ingest/events   — イベントバッチの受信・保存
 *
 * 認証: X-API-Key ヘッダー (環境変数 DASHBOARD_API_KEY と照合)
 */
import { Hono } from "hono";
import { z } from "zod/v4";
import { db } from "@/server/db";
import { sessions, events, tokenUsage, users, dailySummary } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { estimateCost } from "@/server/lib/constants";
import { apiKeyAuth } from "@/server/api/middleware/auth";

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const TokenUsageSchema = z.object({
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  cacheReadInputTokens: z.number().int().min(0).default(0),
  cacheCreationInputTokens: z.number().int().min(0).default(0),
});

const SessionSchema = z.object({
  sessionId: z.string().min(1),
  userId: z.string().min(1),
  projectPath: z.string().min(1),
  projectName: z.string().optional(),
  gitBranch: z.string().optional(),
  claudeVersion: z.string().optional(),
  startedAt: z.string().datetime({ offset: true }),
  endedAt: z.string().datetime({ offset: true }).optional(),
  durationMs: z.number().int().min(0).optional(),
  messageCount: z.number().int().min(0).default(0),
  toolCallCount: z.number().int().min(0).default(0),
  primaryModel: z.string().optional(),
  totalTokenUsage: TokenUsageSchema.optional(),
});

const EventSchema = z.object({
  sessionId: z.string().min(1),
  userId: z.string().min(1),
  eventType: z.string().min(1),
  role: z.string().optional(),
  toolName: z.string().optional(),
  skillName: z.string().optional(),
  subagentType: z.string().optional(),
  model: z.string().optional(),
  timestamp: z.string().datetime({ offset: true }),
});

const TokenUsageEventSchema = z.object({
  sessionId: z.string().min(1),
  userId: z.string().min(1),
  model: z.string().min(1),
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  cacheReadInputTokens: z.number().int().min(0).default(0),
  cacheCreationInputTokens: z.number().int().min(0).default(0),
  timestamp: z.string().datetime({ offset: true }),
});

const IngestSessionBody = z.object({
  session: SessionSchema,
  events: z.array(EventSchema).default([]),
  tokenUsageEvents: z.array(TokenUsageEventSchema).default([]),
});

const IngestEventsBody = z.object({
  events: z.array(EventSchema).min(1),
});

// ---------------------------------------------------------------------------
// Ensure user row exists (upsert with minimal data)
// ---------------------------------------------------------------------------

async function ensureUser(userId: string): Promise<void> {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(users).values({
      id: userId,
      displayName: userId,
    });
  }
}

// ---------------------------------------------------------------------------
// Daily summary upsert helper
// ---------------------------------------------------------------------------

async function upsertDailySummary(
  userId: string,
  date: string,
  delta: {
    sessionCount?: number;
    messageCount?: number;
    toolCallCount?: number;
    inputTokens?: number;
    outputTokens?: number;
    cacheReadTokens?: number;
    cacheCreationTokens?: number;
    costUsd?: number;
  }
): Promise<void> {
  // Attempt to read existing row
  const existing = await db
    .select()
    .from(dailySummary)
    .where(and(eq(dailySummary.userId, userId), eq(dailySummary.date, date)))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(dailySummary).values({
      userId,
      date,
      sessionCount: delta.sessionCount ?? 0,
      messageCount: delta.messageCount ?? 0,
      toolCallCount: delta.toolCallCount ?? 0,
      totalInputTokens: delta.inputTokens ?? 0,
      totalOutputTokens: delta.outputTokens ?? 0,
      totalCacheReadTokens: delta.cacheReadTokens ?? 0,
      totalCacheCreationTokens: delta.cacheCreationTokens ?? 0,
      estimatedCostUsd: delta.costUsd ?? 0,
    });
  } else {
    const row = existing[0];
    await db
      .update(dailySummary)
      .set({
        sessionCount: (row.sessionCount ?? 0) + (delta.sessionCount ?? 0),
        messageCount: (row.messageCount ?? 0) + (delta.messageCount ?? 0),
        toolCallCount: (row.toolCallCount ?? 0) + (delta.toolCallCount ?? 0),
        totalInputTokens:
          (row.totalInputTokens ?? 0) + (delta.inputTokens ?? 0),
        totalOutputTokens:
          (row.totalOutputTokens ?? 0) + (delta.outputTokens ?? 0),
        totalCacheReadTokens:
          (row.totalCacheReadTokens ?? 0) + (delta.cacheReadTokens ?? 0),
        totalCacheCreationTokens:
          (row.totalCacheCreationTokens ?? 0) +
          (delta.cacheCreationTokens ?? 0),
        estimatedCostUsd:
          (row.estimatedCostUsd ?? 0) + (delta.costUsd ?? 0),
      })
      .where(
        and(eq(dailySummary.userId, userId), eq(dailySummary.date, date))
      );
  }
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export const ingestRoute = new Hono();

// Apply API key authentication to all routes under /ingest
ingestRoute.use("*", apiKeyAuth);

// ---------------------------------------------------------------------------
// POST /session
// ---------------------------------------------------------------------------

ingestRoute.post("/session", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = IngestSessionBody.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.issues },
      400
    );
  }

  const { session, events: evts, tokenUsageEvents } = parsed.data;

  try {
    // Ensure user exists
    await ensureUser(session.userId);

    // Upsert session
    const existingSession = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.id, session.sessionId))
      .limit(1);

    if (existingSession.length === 0) {
      await db.insert(sessions).values({
        id: session.sessionId,
        userId: session.userId,
        projectPath: session.projectPath,
        projectName: session.projectName,
        gitBranch: session.gitBranch,
        claudeVersion: session.claudeVersion,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        durationMs: session.durationMs,
        messageCount: session.messageCount,
        toolCallCount: session.toolCallCount,
      });
    } else {
      // Update with latest data
      await db
        .update(sessions)
        .set({
          endedAt: session.endedAt,
          durationMs: session.durationMs,
          messageCount: session.messageCount,
          toolCallCount: session.toolCallCount,
          claudeVersion: session.claudeVersion,
          gitBranch: session.gitBranch,
        })
        .where(eq(sessions.id, session.sessionId));
    }

    // Insert events (skip duplicates by catching constraint errors)
    if (evts.length > 0) {
      await db.insert(events).values(
        evts.map((e) => ({
          sessionId: e.sessionId,
          userId: e.userId,
          eventType: e.eventType,
          role: e.role,
          toolName: e.toolName,
          skillName: e.skillName,
          subagentType: e.subagentType,
          model: e.model,
          timestamp: e.timestamp,
        }))
      );
    }

    // Insert token usage events
    if (tokenUsageEvents.length > 0) {
      await db.insert(tokenUsage).values(
        tokenUsageEvents.map((u) => ({
          sessionId: u.sessionId,
          userId: u.userId,
          model: u.model,
          inputTokens: u.inputTokens,
          outputTokens: u.outputTokens,
          cacheReadTokens: u.cacheReadInputTokens,
          cacheCreationTokens: u.cacheCreationInputTokens,
          estimatedCostUsd: estimateCost(
            u.model,
            u.inputTokens,
            u.outputTokens,
            u.cacheReadInputTokens,
            u.cacheCreationInputTokens
          ),
          timestamp: u.timestamp,
        }))
      );
    }

    // Update daily summary for session start date
    const date = session.startedAt.slice(0, 10);
    const totalUsage = session.totalTokenUsage;
    const totalCost = totalUsage
      ? estimateCost(
          session.primaryModel ?? "unknown",
          totalUsage.inputTokens,
          totalUsage.outputTokens,
          totalUsage.cacheReadInputTokens,
          totalUsage.cacheCreationInputTokens
        )
      : 0;

    await upsertDailySummary(session.userId, date, {
      sessionCount: existingSession.length === 0 ? 1 : 0,
      messageCount: session.messageCount,
      toolCallCount: session.toolCallCount,
      inputTokens: totalUsage?.inputTokens,
      outputTokens: totalUsage?.outputTokens,
      cacheReadTokens: totalUsage?.cacheReadInputTokens,
      cacheCreationTokens: totalUsage?.cacheCreationInputTokens,
      costUsd: totalCost,
    });

    return c.json({
      ok: true,
      sessionId: session.sessionId,
      eventsInserted: evts.length,
      tokenUsageEventsInserted: tokenUsageEvents.length,
    });
  } catch (err) {
    console.error("[ingest/session] Error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// ---------------------------------------------------------------------------
// POST /events
// ---------------------------------------------------------------------------

ingestRoute.post("/events", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = IngestEventsBody.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.issues },
      400
    );
  }

  const { events: evts } = parsed.data;

  try {
    // Ensure all referenced users exist
    const uniqueUserIds = [...new Set(evts.map((e) => e.userId))];
    for (const userId of uniqueUserIds) {
      await ensureUser(userId);
    }

    await db.insert(events).values(
      evts.map((e) => ({
        sessionId: e.sessionId,
        userId: e.userId,
        eventType: e.eventType,
        role: e.role,
        toolName: e.toolName,
        skillName: e.skillName,
        subagentType: e.subagentType,
        model: e.model,
        timestamp: e.timestamp,
      }))
    );

    return c.json({ ok: true, eventsInserted: evts.length });
  } catch (err) {
    console.error("[ingest/events] Error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});
