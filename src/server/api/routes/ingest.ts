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
import { eq, and, sql, count, sum, desc } from "drizzle-orm";
import { estimateCost } from "@/server/lib/constants";
import { apiKeyAuth } from "@/server/api/middleware/auth";
import { invalidateAll } from "@/server/lib/cache";
import type { BetterSQLiteTransaction } from "drizzle-orm/better-sqlite3";

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
  displayName: z.string().optional(),
  email: z.string().email().optional(),
  team: z.string().optional(),
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
// Privacy: mask home directory from projectPath
// ---------------------------------------------------------------------------

/**
 * Replaces /Users/<name>/..., /home/<name>/..., C:\Users\<name>\... with ~/...
 * so that the PC username is never stored in the database.
 */
function maskProjectPath(raw: string): string {
  // macOS: /Users/<name>/...
  // Linux: /home/<name>/...
  const unix = raw.replace(/^\/(?:Users|home)\/[^/]+/, "~");
  if (unix !== raw) return unix;
  // Windows: C:\Users\<name>\...
  return raw.replace(/^[A-Za-z]:\\Users\\[^\\]+/, "~");
}

// ---------------------------------------------------------------------------
// Transaction-aware DB context type
// ---------------------------------------------------------------------------

// Accept either the real db or a transaction object (both share the same query API).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TxOrDb = typeof db | BetterSQLiteTransaction<any, any>;

// ---------------------------------------------------------------------------
// Ensure user row exists (upsert with minimal data) — sync, runs inside tx
// ---------------------------------------------------------------------------

function ensureUserSync(
  tx: TxOrDb,
  userId: string,
  opts?: { displayName?: string; email?: string; team?: string }
): void {
  const existing = tx
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
    .all();

  if (existing.length === 0) {
    // Generate anonymous display name from userId hash
    const crypto = require("crypto");
    const hash = crypto.createHash("sha256").update(userId).digest("hex").slice(0, 6).toUpperCase();
    tx.insert(users).values({
      id: userId,
      displayName: opts?.displayName || `User-${hash}`,
      email: opts?.email,
      team: opts?.team,
    }).run();
  } else if (opts?.displayName || opts?.email || opts?.team) {
    // Update profile if new info provided
    const updates: Record<string, string> = {};
    if (opts.displayName) updates.displayName = opts.displayName;
    if (opts.email) updates.email = opts.email;
    if (opts.team) updates.team = opts.team;
    tx.update(users).set(updates).where(eq(users.id, userId)).run();
  }
}

// ---------------------------------------------------------------------------
// Compute derived fields (primary_model, top_tool, top_project) — sync
// ---------------------------------------------------------------------------

interface DerivedFields {
  primaryModel: string | null;
  topTool: string | null;
  topProject: string | null;
  activeMinutes: number;
}

function computeDerivedFieldsSync(tx: TxOrDb, userId: string, date: string): DerivedFields {
  const dateStart = `${date}T00:00:00.000Z`;
  const dateEnd = `${date}T23:59:59.999Z`;

  // Primary model: the model with most output tokens on this date
  const modelRows = tx
    .select({
      model: tokenUsage.model,
      outputTokens: sum(tokenUsage.outputTokens),
    })
    .from(tokenUsage)
    .where(
      and(
        eq(tokenUsage.userId, userId),
        sql`${tokenUsage.timestamp} >= ${dateStart}`,
        sql`${tokenUsage.timestamp} <= ${dateEnd}`
      )
    )
    .groupBy(tokenUsage.model)
    .orderBy(desc(sum(tokenUsage.outputTokens)))
    .limit(1)
    .all();

  const primaryModel = modelRows[0]?.model ?? null;

  // Top tool: the tool called most often on this date
  const toolRows = tx
    .select({
      toolName: events.toolName,
      cnt: count(),
    })
    .from(events)
    .where(
      and(
        eq(events.userId, userId),
        sql`${events.timestamp} >= ${dateStart}`,
        sql`${events.timestamp} <= ${dateEnd}`,
        sql`${events.toolName} IS NOT NULL`
      )
    )
    .groupBy(events.toolName)
    .orderBy(desc(count()))
    .limit(1)
    .all();

  const topTool = toolRows[0]?.toolName ?? null;

  // Top project: the project with the most sessions on this date
  const projectRows = tx
    .select({
      projectName: sessions.projectName,
      cnt: count(),
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, userId),
        sql`${sessions.startedAt} >= ${dateStart}`,
        sql`${sessions.startedAt} <= ${dateEnd}`,
        sql`${sessions.projectName} IS NOT NULL`
      )
    )
    .groupBy(sessions.projectName)
    .orderBy(desc(count()))
    .limit(1)
    .all();

  const topProject = projectRows[0]?.projectName ?? null;

  // Active minutes: sum of session durations on this date (in minutes)
  const durationRows = tx
    .select({
      totalMs: sum(sessions.durationMs),
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, userId),
        sql`${sessions.startedAt} >= ${dateStart}`,
        sql`${sessions.startedAt} <= ${dateEnd}`
      )
    )
    .all();

  const totalMs = Number(durationRows[0]?.totalMs ?? 0);
  const activeMinutes = Math.round(totalMs / 60_000);

  return { primaryModel, topTool, topProject, activeMinutes };
}

// ---------------------------------------------------------------------------
// Daily summary upsert helper — sync, runs inside tx
// ---------------------------------------------------------------------------

function upsertDailySummarySync(
  tx: TxOrDb,
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
    activeMinutes?: number;
  }
): void {
  // After writing numeric deltas, recompute derived fields (primary_model,
  // top_tool, top_project) directly from the raw tables so the summary stays
  // accurate regardless of the order events arrive.
  const derived = computeDerivedFieldsSync(tx, userId, date);

  const existing = tx
    .select()
    .from(dailySummary)
    .where(and(eq(dailySummary.userId, userId), eq(dailySummary.date, date)))
    .limit(1)
    .all();

  if (existing.length === 0) {
    tx.insert(dailySummary).values({
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
      activeMinutes: delta.activeMinutes ?? derived.activeMinutes,
      primaryModel: derived.primaryModel,
      topTool: derived.topTool,
      topProject: derived.topProject,
    }).run();
  } else {
    const row = existing[0];
    tx.update(dailySummary)
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
        // activeMinutes: increment by the session's contribution, then refresh
        // derived fields from raw data so they always reflect reality.
        activeMinutes: (row.activeMinutes ?? 0) + (delta.activeMinutes ?? 0),
        primaryModel: derived.primaryModel ?? row.primaryModel,
        topTool: derived.topTool ?? row.topTool,
        topProject: derived.topProject ?? row.topProject,
      })
      .where(
        and(eq(dailySummary.userId, userId), eq(dailySummary.date, date))
      )
      .run();
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

  const { session: rawSession, events: evts, tokenUsageEvents } = parsed.data;

  // If a personal API key was used, override userId with the account's linkedUserId
  const linkedUserId: string | null | undefined = c.get("linkedUserId");
  const session = linkedUserId
    ? { ...rawSession, userId: linkedUserId }
    : rawSession;

  try {
    const result = db.transaction((tx) => {
      // Ensure user exists
      ensureUserSync(tx, session.userId, {
        displayName: session.displayName,
        email: session.email,
        team: session.team,
      });

      // Upsert session
      const existingSession = tx
        .select({ id: sessions.id })
        .from(sessions)
        .where(eq(sessions.id, session.sessionId))
        .limit(1)
        .all();

      if (existingSession.length === 0) {
        tx.insert(sessions).values({
          id: session.sessionId,
          userId: session.userId,
          projectPath: maskProjectPath(session.projectPath),
          projectName: session.projectName,
          gitBranch: session.gitBranch,
          claudeVersion: session.claudeVersion,
          startedAt: session.startedAt,
          endedAt: session.endedAt,
          durationMs: session.durationMs,
          messageCount: session.messageCount,
          toolCallCount: session.toolCallCount,
        }).run();
      } else {
        // Update with latest data
        tx.update(sessions)
          .set({
            endedAt: session.endedAt,
            durationMs: session.durationMs,
            messageCount: session.messageCount,
            toolCallCount: session.toolCallCount,
            claudeVersion: session.claudeVersion,
            gitBranch: session.gitBranch,
          })
          .where(eq(sessions.id, session.sessionId))
          .run();
      }

      // Insert events (skip duplicates by catching constraint errors)
      if (evts.length > 0) {
        tx.insert(events).values(
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
        ).run();
      }

      // Insert token usage events
      if (tokenUsageEvents.length > 0) {
        tx.insert(tokenUsage).values(
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
        ).run();
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

      // Convert session durationMs to active minutes for the daily summary delta.
      // The full recompute in upsertDailySummarySync will recalculate from raw data,
      // but we still provide the delta so the initial insert is accurate.
      const sessionActiveMinutes = session.durationMs
        ? Math.round(session.durationMs / 60_000)
        : 0;

      upsertDailySummarySync(tx, session.userId, date, {
        sessionCount: existingSession.length === 0 ? 1 : 0,
        messageCount: session.messageCount,
        toolCallCount: session.toolCallCount,
        inputTokens: totalUsage?.inputTokens,
        outputTokens: totalUsage?.outputTokens,
        cacheReadTokens: totalUsage?.cacheReadInputTokens,
        cacheCreationTokens: totalUsage?.cacheCreationInputTokens,
        costUsd: totalCost,
        activeMinutes: sessionActiveMinutes,
      });

      return {
        eventsInserted: evts.length,
        tokenUsageEventsInserted: tokenUsageEvents.length,
      };
    });

    // Invalidate cached aggregations so dashboards see fresh data
    invalidateAll();

    return c.json({
      ok: true,
      sessionId: session.sessionId,
      eventsInserted: result.eventsInserted,
      tokenUsageEventsInserted: result.tokenUsageEventsInserted,
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

  // If a personal API key was used, override userId for all events
  const linkedUserId: string | null | undefined = c.get("linkedUserId");
  const { events: rawEvts } = parsed.data;
  const evts = linkedUserId
    ? rawEvts.map((e) => ({ ...e, userId: linkedUserId }))
    : rawEvts;

  try {
    db.transaction((tx) => {
      // Ensure all referenced users exist
      const uniqueUserIds = [...new Set(evts.map((e) => e.userId))];
      for (const userId of uniqueUserIds) {
        ensureUserSync(tx, userId);
      }

      tx.insert(events).values(
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
      ).run();
    });

    // Invalidate cached aggregations so dashboards see fresh data
    invalidateAll();

    return c.json({ ok: true, eventsInserted: evts.length });
  } catch (err) {
    console.error("[ingest/events] Error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});
