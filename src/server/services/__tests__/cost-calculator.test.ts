/**
 * Tests for cost-calculator.ts
 */
import { describe, it, expect } from "vitest";
import {
  calculateSessionCost,
  calculateEventCost,
} from "@/server/services/cost-calculator";
import type { AggregatedSession } from "@/server/services/session-aggregator";
import type { TokenUsageEvent } from "@/server/services/session-aggregator";

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------
function makeUsageEvent(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheReadInputTokens = 0,
  cacheCreationInputTokens = 0
): TokenUsageEvent {
  return {
    timestamp: new Date().toISOString(),
    model,
    inputTokens,
    outputTokens,
    cacheReadInputTokens,
    cacheCreationInputTokens,
  };
}

function makeSession(
  tokenUsageEvents: TokenUsageEvent[],
  sessionId = "test-session"
): AggregatedSession {
  return {
    sessionId,
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    durationMs: 60000,
    messageCount: tokenUsageEvents.length,
    toolCallCount: 0,
    toolEvents: [],
    tokenUsageEvents,
    totalTokenUsage: tokenUsageEvents.reduce(
      (acc, e) => ({
        inputTokens: acc.inputTokens + e.inputTokens,
        outputTokens: acc.outputTokens + e.outputTokens,
        cacheReadInputTokens: acc.cacheReadInputTokens + e.cacheReadInputTokens,
        cacheCreationInputTokens:
          acc.cacheCreationInputTokens + e.cacheCreationInputTokens,
      }),
      {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadInputTokens: 0,
        cacheCreationInputTokens: 0,
      }
    ),
    primaryModel: tokenUsageEvents[0]?.model,
  };
}

// -------------------------------------------------------------------
// calculateEventCost
// -------------------------------------------------------------------
describe("calculateEventCost", () => {
  it("returns 0 for zero tokens", () => {
    const event = makeUsageEvent("claude-sonnet-4-6", 0, 0);
    expect(calculateEventCost(event)).toBe(0);
  });

  it("calculates cost correctly for claude-sonnet-4-6 (input $3/M, output $15/M)", () => {
    // 1M input tokens = $3, 1M output tokens = $15
    const event = makeUsageEvent("claude-sonnet-4-6", 1_000_000, 1_000_000);
    const cost = calculateEventCost(event);
    expect(cost).toBeCloseTo(18, 6); // $3 + $15
  });

  it("calculates cost correctly for claude-opus-4-6 (input $15/M, output $75/M)", () => {
    const event = makeUsageEvent("claude-opus-4-6", 1_000_000, 1_000_000);
    const cost = calculateEventCost(event);
    expect(cost).toBeCloseTo(90, 6); // $15 + $75
  });

  it("applies cache read pricing (sonnet: $0.3/M)", () => {
    const event = makeUsageEvent("claude-sonnet-4-6", 0, 0, 1_000_000, 0);
    const cost = calculateEventCost(event);
    expect(cost).toBeCloseTo(0.3, 6);
  });

  it("applies cache creation pricing (sonnet: $3.75/M)", () => {
    const event = makeUsageEvent("claude-sonnet-4-6", 0, 0, 0, 1_000_000);
    const cost = calculateEventCost(event);
    expect(cost).toBeCloseTo(3.75, 6);
  });

  it("uses default pricing for unknown models", () => {
    // Default = sonnet pricing: input $3/M, output $15/M
    const event = makeUsageEvent("unknown-model", 1_000_000, 1_000_000);
    const cost = calculateEventCost(event);
    expect(cost).toBeCloseTo(18, 6);
  });

  it("calculates combined input + output + cache costs", () => {
    // 100k input @$3/M = $0.30
    // 50k output @$15/M = $0.75
    // 20k cache read @$0.3/M = $0.006
    // 10k cache create @$3.75/M = $0.0375
    const event = makeUsageEvent("claude-sonnet-4-6", 100_000, 50_000, 20_000, 10_000);
    const cost = calculateEventCost(event);
    const expected = 0.30 + 0.75 + 0.006 + 0.0375;
    expect(cost).toBeCloseTo(expected, 5);
  });

  it("returns a number (not NaN)", () => {
    const event = makeUsageEvent("claude-haiku-4-5-20251001", 500, 200);
    expect(typeof calculateEventCost(event)).toBe("number");
    expect(isNaN(calculateEventCost(event))).toBe(false);
  });
});

// -------------------------------------------------------------------
// calculateSessionCost
// -------------------------------------------------------------------
describe("calculateSessionCost", () => {
  it("returns 0 totalCostUsd for session with no token usage", () => {
    const session = makeSession([]);
    const result = calculateSessionCost(session);
    expect(result.totalCostUsd).toBe(0);
    expect(result.byModel).toEqual([]);
    expect(result.perTurn).toEqual([]);
  });

  it("preserves sessionId in result", () => {
    const session = makeSession([], "my-special-session");
    const result = calculateSessionCost(session);
    expect(result.sessionId).toBe("my-special-session");
  });

  it("calculates totalCostUsd as sum of per-model costs", () => {
    const events = [
      makeUsageEvent("claude-sonnet-4-6", 1_000_000, 1_000_000), // $18
    ];
    const session = makeSession(events);
    const result = calculateSessionCost(session);
    expect(result.totalCostUsd).toBeCloseTo(18, 4);
  });

  it("aggregates multiple events for the same model", () => {
    const events = [
      makeUsageEvent("claude-sonnet-4-6", 500_000, 500_000), // $9
      makeUsageEvent("claude-sonnet-4-6", 500_000, 500_000), // $9
    ];
    const session = makeSession(events);
    const result = calculateSessionCost(session);
    expect(result.byModel).toHaveLength(1); // aggregated into one
    expect(result.byModel[0].model).toBe("claude-sonnet-4-6");
    expect(result.byModel[0].inputTokens).toBe(1_000_000);
    expect(result.byModel[0].outputTokens).toBe(1_000_000);
    expect(result.byModel[0].estimatedCostUsd).toBeCloseTo(18, 4);
  });

  it("handles multiple models separately in byModel", () => {
    const events = [
      makeUsageEvent("claude-sonnet-4-6", 1_000_000, 0),
      makeUsageEvent("claude-opus-4-6", 1_000_000, 0),
    ];
    const session = makeSession(events);
    const result = calculateSessionCost(session);
    expect(result.byModel).toHaveLength(2);
    const models = result.byModel.map((b) => b.model);
    expect(models).toContain("claude-sonnet-4-6");
    expect(models).toContain("claude-opus-4-6");
  });

  it("perTurn has one entry per token usage event", () => {
    const events = [
      makeUsageEvent("claude-sonnet-4-6", 1000, 500),
      makeUsageEvent("claude-sonnet-4-6", 2000, 1000),
      makeUsageEvent("claude-opus-4-6", 500, 200),
    ];
    const session = makeSession(events);
    const result = calculateSessionCost(session);
    expect(result.perTurn).toHaveLength(3);
    result.perTurn.forEach((cost) => {
      expect(typeof cost).toBe("number");
      expect(cost).toBeGreaterThanOrEqual(0);
    });
  });

  it("totalCostUsd equals sum of perTurn costs (single model)", () => {
    const events = [
      makeUsageEvent("claude-sonnet-4-6", 100_000, 50_000),
      makeUsageEvent("claude-sonnet-4-6", 200_000, 100_000),
    ];
    const session = makeSession(events);
    const result = calculateSessionCost(session);
    const perTurnSum = result.perTurn.reduce((a, b) => a + b, 0);
    expect(result.totalCostUsd).toBeCloseTo(perTurnSum, 8);
  });

  it("byModel estimatedCostUsd is non-negative", () => {
    const events = [makeUsageEvent("claude-sonnet-4-6", 1000, 500)];
    const session = makeSession(events);
    const result = calculateSessionCost(session);
    result.byModel.forEach((b) => {
      expect(b.estimatedCostUsd).toBeGreaterThanOrEqual(0);
    });
  });
});
