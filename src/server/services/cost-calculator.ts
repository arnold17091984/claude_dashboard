/**
 * cost-calculator.ts
 *
 * トークン使用量からコストを推定する。
 * constants.ts の estimateCost 関数を使用する。
 */
import { estimateCost } from "@/server/lib/constants";
import {
  AggregatedSession,
  TokenUsageEvent,
} from "./session-aggregator";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CostBreakdown {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  estimatedCostUsd: number;
}

export interface SessionCostResult {
  sessionId: string;
  /** Total estimated cost in USD for the entire session */
  totalCostUsd: number;
  /** Per-model cost breakdown */
  byModel: CostBreakdown[];
  /** Per-turn cost (maps to tokenUsageEvents by index) */
  perTurn: number[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Aggregate token usage events by model, then calculate cost per model.
 */
function buildBreakdownByModel(
  usageEvents: TokenUsageEvent[]
): CostBreakdown[] {
  const byModel: Record<string, Omit<CostBreakdown, "estimatedCostUsd">> = {};

  for (const event of usageEvents) {
    if (!byModel[event.model]) {
      byModel[event.model] = {
        model: event.model,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadInputTokens: 0,
        cacheCreationInputTokens: 0,
      };
    }
    const entry = byModel[event.model];
    entry.inputTokens += event.inputTokens;
    entry.outputTokens += event.outputTokens;
    entry.cacheReadInputTokens += event.cacheReadInputTokens;
    entry.cacheCreationInputTokens += event.cacheCreationInputTokens;
  }

  return Object.values(byModel).map((entry) => ({
    ...entry,
    estimatedCostUsd: estimateCost(
      entry.model,
      entry.inputTokens,
      entry.outputTokens,
      entry.cacheReadInputTokens,
      entry.cacheCreationInputTokens
    ),
  }));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Calculate the cost for a single session based on its aggregated data.
 */
export function calculateSessionCost(
  session: AggregatedSession
): SessionCostResult {
  const byModel = buildBreakdownByModel(session.tokenUsageEvents);

  const totalCostUsd = byModel.reduce(
    (sum, b) => sum + b.estimatedCostUsd,
    0
  );

  const perTurn = session.tokenUsageEvents.map((event) =>
    estimateCost(
      event.model,
      event.inputTokens,
      event.outputTokens,
      event.cacheReadInputTokens,
      event.cacheCreationInputTokens
    )
  );

  return {
    sessionId: session.sessionId,
    totalCostUsd,
    byModel,
    perTurn,
  };
}

/**
 * Calculate the cost for a single token usage event.
 */
export function calculateEventCost(event: TokenUsageEvent): number {
  return estimateCost(
    event.model,
    event.inputTokens,
    event.outputTokens,
    event.cacheReadInputTokens,
    event.cacheCreationInputTokens
  );
}
