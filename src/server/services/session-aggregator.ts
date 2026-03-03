/**
 * session-aggregator.ts
 *
 * トランスクリプトの解析結果をセッション単位で集計する。
 * - セッション情報 (開始時刻, 終了時刻, duration, message数, tool呼出数)
 * - ツール使用イベントの集計
 * - トークン使用量の合計
 */
import { ParsedTranscript, TranscriptEntry } from "./transcript-parser";

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface AggregatedTokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
}

export interface ToolEvent {
  timestamp: string;
  toolName: string;
  skillName?: string;
  subagentType?: string;
  model?: string;
  role?: string;
}

export interface TokenUsageEvent {
  timestamp: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
}

export interface AggregatedSession {
  sessionId: string;
  /** ISO timestamp of the first entry */
  startedAt: string;
  /** ISO timestamp of the last entry */
  endedAt: string;
  /** Duration in milliseconds */
  durationMs: number;
  /** Total number of parsed transcript entries (≈ messages) */
  messageCount: number;
  /** Total number of tool_use calls across the session */
  toolCallCount: number;
  /** Flat list of tool events ordered by timestamp */
  toolEvents: ToolEvent[];
  /** Token usage events per assistant turn that reported usage */
  tokenUsageEvents: TokenUsageEvent[];
  /** Session-level token totals */
  totalTokenUsage: AggregatedTokenUsage;
  /** Primary model used (model with most output tokens) */
  primaryModel?: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function toMs(iso: string): number {
  const ms = Date.parse(iso);
  return isNaN(ms) ? 0 : ms;
}

function determinePrimaryModel(
  usageEvents: TokenUsageEvent[]
): string | undefined {
  if (usageEvents.length === 0) return undefined;

  const outputByModel: Record<string, number> = {};
  for (const u of usageEvents) {
    outputByModel[u.model] = (outputByModel[u.model] ?? 0) + u.outputTokens;
  }

  let best: string | undefined;
  let bestTokens = -1;
  for (const [model, tokens] of Object.entries(outputByModel)) {
    if (tokens > bestTokens) {
      bestTokens = tokens;
      best = model;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Aggregate a ParsedTranscript into session-level statistics.
 */
export function aggregateSession(
  transcript: ParsedTranscript
): AggregatedSession {
  const { sessionId, entries } = transcript;

  if (entries.length === 0) {
    const now = new Date().toISOString();
    return {
      sessionId,
      startedAt: now,
      endedAt: now,
      durationMs: 0,
      messageCount: 0,
      toolCallCount: 0,
      toolEvents: [],
      tokenUsageEvents: [],
      totalTokenUsage: {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadInputTokens: 0,
        cacheCreationInputTokens: 0,
      },
      primaryModel: undefined,
    };
  }

  // Sort entries by timestamp ascending
  const sorted = [...entries].sort(
    (a, b) => toMs(a.timestamp) - toMs(b.timestamp)
  );

  const startedAt = sorted[0].timestamp;
  const endedAt = sorted[sorted.length - 1].timestamp;
  const durationMs = Math.max(0, toMs(endedAt) - toMs(startedAt));

  const toolEvents: ToolEvent[] = [];
  const tokenUsageEvents: TokenUsageEvent[] = [];

  const totalTokenUsage: AggregatedTokenUsage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0,
  };

  let toolCallCount = 0;
  let messageCount = 0;

  for (const entry of sorted) {
    messageCount++;

    // Collect tool events
    for (const toolName of entry.toolNames) {
      toolCallCount++;
      const event: ToolEvent = {
        timestamp: entry.timestamp,
        toolName,
        model: entry.model,
        role: entry.role,
      };
      if (toolName === "Skill" && entry.skillName) {
        event.skillName = entry.skillName;
      }
      if (toolName === "Agent" && entry.subagentType) {
        event.subagentType = entry.subagentType;
      }
      toolEvents.push(event);
    }

    // Collect token usage (skip entries without a real model name)
    if (entry.tokenUsage && entry.model) {
      const u = entry.tokenUsage;
      const model = entry.model;

      tokenUsageEvents.push({
        timestamp: entry.timestamp,
        model,
        inputTokens: u.inputTokens,
        outputTokens: u.outputTokens,
        cacheReadInputTokens: u.cacheReadInputTokens,
        cacheCreationInputTokens: u.cacheCreationInputTokens,
      });

      totalTokenUsage.inputTokens += u.inputTokens;
      totalTokenUsage.outputTokens += u.outputTokens;
      totalTokenUsage.cacheReadInputTokens += u.cacheReadInputTokens;
      totalTokenUsage.cacheCreationInputTokens +=
        u.cacheCreationInputTokens;
    }
  }

  const primaryModel = determinePrimaryModel(tokenUsageEvents);

  return {
    sessionId,
    startedAt,
    endedAt,
    durationMs,
    messageCount,
    toolCallCount,
    toolEvents,
    tokenUsageEvents,
    totalTokenUsage,
    primaryModel,
  };
}

/**
 * Aggregate multiple transcripts into a list of sessions.
 */
export function aggregateSessions(
  transcripts: ParsedTranscript[]
): AggregatedSession[] {
  return transcripts.map(aggregateSession);
}
