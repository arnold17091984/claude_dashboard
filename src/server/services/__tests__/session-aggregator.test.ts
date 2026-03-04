/**
 * Tests for session-aggregator.ts
 */
import { describe, it, expect } from "vitest";
import {
  aggregateSession,
  aggregateSessions,
} from "@/server/services/session-aggregator";
import type { ParsedTranscript, TranscriptEntry } from "@/server/services/transcript-parser";

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------
function makeEntry(opts: Partial<TranscriptEntry> = {}): TranscriptEntry {
  return {
    sessionId: "test-session",
    timestamp: new Date().toISOString(),
    toolNames: [],
    hasMcpTool: false,
    ...opts,
  };
}

function makeTranscript(
  entries: TranscriptEntry[],
  sessionId = "test-session"
): ParsedTranscript {
  return { sessionId, filePath: "/path/to/session.jsonl", entries };
}

// -------------------------------------------------------------------
// aggregateSession
// -------------------------------------------------------------------
describe("aggregateSession", () => {
  describe("empty transcript", () => {
    it("returns sensible defaults for empty entries", () => {
      const transcript = makeTranscript([]);
      const result = aggregateSession(transcript);
      expect(result.sessionId).toBe("test-session");
      expect(result.messageCount).toBe(0);
      expect(result.toolCallCount).toBe(0);
      expect(result.toolEvents).toEqual([]);
      expect(result.tokenUsageEvents).toEqual([]);
      expect(result.durationMs).toBe(0);
      expect(result.primaryModel).toBeUndefined();
    });

    it("totalTokenUsage is all zeros for empty entries", () => {
      const result = aggregateSession(makeTranscript([]));
      expect(result.totalTokenUsage.inputTokens).toBe(0);
      expect(result.totalTokenUsage.outputTokens).toBe(0);
      expect(result.totalTokenUsage.cacheReadInputTokens).toBe(0);
      expect(result.totalTokenUsage.cacheCreationInputTokens).toBe(0);
    });
  });

  describe("single entry", () => {
    it("messageCount is 1 for a single entry", () => {
      const result = aggregateSession(makeTranscript([makeEntry()]));
      expect(result.messageCount).toBe(1);
    });

    it("durationMs is 0 for a single entry (start === end)", () => {
      const ts = "2026-01-15T10:00:00.000Z";
      const result = aggregateSession(makeTranscript([makeEntry({ timestamp: ts })]));
      expect(result.durationMs).toBe(0);
    });
  });

  describe("timestamps and duration", () => {
    it("calculates durationMs between first and last entry", () => {
      const entries = [
        makeEntry({ timestamp: "2026-01-15T10:00:00.000Z" }),
        makeEntry({ timestamp: "2026-01-15T10:05:00.000Z" }),
      ];
      const result = aggregateSession(makeTranscript(entries));
      expect(result.durationMs).toBe(5 * 60 * 1000); // 5 minutes
    });

    it("sets startedAt to earliest timestamp", () => {
      const entries = [
        makeEntry({ timestamp: "2026-01-15T10:05:00.000Z" }),
        makeEntry({ timestamp: "2026-01-15T10:00:00.000Z" }), // earlier
      ];
      const result = aggregateSession(makeTranscript(entries));
      expect(result.startedAt).toBe("2026-01-15T10:00:00.000Z");
    });

    it("sets endedAt to latest timestamp", () => {
      const entries = [
        makeEntry({ timestamp: "2026-01-15T10:00:00.000Z" }),
        makeEntry({ timestamp: "2026-01-15T10:10:00.000Z" }), // latest
      ];
      const result = aggregateSession(makeTranscript(entries));
      expect(result.endedAt).toBe("2026-01-15T10:10:00.000Z");
    });
  });

  describe("tool event aggregation", () => {
    it("counts toolCallCount correctly", () => {
      const entries = [
        makeEntry({ toolNames: ["Read", "Bash"] }), // 2 calls
        makeEntry({ toolNames: ["Write"] }),         // 1 call
        makeEntry({ toolNames: [] }),                // 0 calls
      ];
      const result = aggregateSession(makeTranscript(entries));
      expect(result.toolCallCount).toBe(3);
    });

    it("builds toolEvents list with correct fields", () => {
      const ts = "2026-01-15T10:00:00.000Z";
      const entries = [
        makeEntry({
          timestamp: ts,
          toolNames: ["Read"],
          model: "claude-sonnet-4-6",
          role: "assistant",
        }),
      ];
      const result = aggregateSession(makeTranscript(entries));
      expect(result.toolEvents).toHaveLength(1);
      expect(result.toolEvents[0].toolName).toBe("Read");
      expect(result.toolEvents[0].timestamp).toBe(ts);
      expect(result.toolEvents[0].model).toBe("claude-sonnet-4-6");
    });

    it("attaches skillName to Skill tool events", () => {
      const entries = [
        makeEntry({
          toolNames: ["Skill"],
          skillName: "code-review",
        }),
      ];
      const result = aggregateSession(makeTranscript(entries));
      expect(result.toolEvents[0].skillName).toBe("code-review");
    });

    it("attaches subagentType to Agent tool events", () => {
      const entries = [
        makeEntry({
          toolNames: ["Agent"],
          subagentType: "qa-expert",
        }),
      ];
      const result = aggregateSession(makeTranscript(entries));
      expect(result.toolEvents[0].subagentType).toBe("qa-expert");
    });

    it("does NOT attach skillName to non-Skill tools", () => {
      const entries = [
        makeEntry({
          toolNames: ["Read"],
          skillName: "some-skill", // should be ignored
        }),
      ];
      const result = aggregateSession(makeTranscript(entries));
      expect(result.toolEvents[0].skillName).toBeUndefined();
    });
  });

  describe("token usage aggregation", () => {
    it("collects tokenUsageEvents for entries with usage and model", () => {
      const entries = [
        makeEntry({
          model: "claude-sonnet-4-6",
          tokenUsage: {
            inputTokens: 1000,
            outputTokens: 500,
            cacheReadInputTokens: 100,
            cacheCreationInputTokens: 50,
          },
        }),
      ];
      const result = aggregateSession(makeTranscript(entries));
      expect(result.tokenUsageEvents).toHaveLength(1);
      const event = result.tokenUsageEvents[0];
      expect(event.model).toBe("claude-sonnet-4-6");
      expect(event.inputTokens).toBe(1000);
      expect(event.outputTokens).toBe(500);
    });

    it("skips entries without tokenUsage", () => {
      const entries = [
        makeEntry({ role: "user" }),    // no tokenUsage
        makeEntry({ model: "claude-sonnet-4-6", tokenUsage: { inputTokens: 100, outputTokens: 50, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 } }),
      ];
      const result = aggregateSession(makeTranscript(entries));
      expect(result.tokenUsageEvents).toHaveLength(1);
    });

    it("skips entries without model even if tokenUsage is set", () => {
      const entries = [
        makeEntry({
          tokenUsage: { inputTokens: 100, outputTokens: 50, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 },
          // no model field
        }),
      ];
      const result = aggregateSession(makeTranscript(entries));
      expect(result.tokenUsageEvents).toHaveLength(0);
    });

    it("accumulates totalTokenUsage across all entries", () => {
      const entries = [
        makeEntry({
          model: "claude-sonnet-4-6",
          tokenUsage: { inputTokens: 1000, outputTokens: 500, cacheReadInputTokens: 100, cacheCreationInputTokens: 50 },
        }),
        makeEntry({
          model: "claude-sonnet-4-6",
          tokenUsage: { inputTokens: 2000, outputTokens: 1000, cacheReadInputTokens: 200, cacheCreationInputTokens: 100 },
        }),
      ];
      const result = aggregateSession(makeTranscript(entries));
      expect(result.totalTokenUsage.inputTokens).toBe(3000);
      expect(result.totalTokenUsage.outputTokens).toBe(1500);
      expect(result.totalTokenUsage.cacheReadInputTokens).toBe(300);
      expect(result.totalTokenUsage.cacheCreationInputTokens).toBe(150);
    });
  });

  describe("primaryModel determination", () => {
    it("picks model with most output tokens as primaryModel", () => {
      const entries = [
        makeEntry({
          model: "claude-sonnet-4-6",
          tokenUsage: { inputTokens: 1000, outputTokens: 200, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 },
        }),
        makeEntry({
          model: "claude-opus-4-6",
          tokenUsage: { inputTokens: 1000, outputTokens: 800, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 },
        }),
      ];
      const result = aggregateSession(makeTranscript(entries));
      expect(result.primaryModel).toBe("claude-opus-4-6");
    });

    it("primaryModel is undefined when no token usage events", () => {
      const result = aggregateSession(makeTranscript([makeEntry()]));
      expect(result.primaryModel).toBeUndefined();
    });
  });

  describe("sessionId preservation", () => {
    it("preserves the sessionId from the transcript", () => {
      const result = aggregateSession(makeTranscript([], "custom-id"));
      expect(result.sessionId).toBe("custom-id");
    });
  });
});

// -------------------------------------------------------------------
// aggregateSessions
// -------------------------------------------------------------------
describe("aggregateSessions", () => {
  it("returns empty array for empty input", () => {
    const result = aggregateSessions([]);
    expect(result).toEqual([]);
  });

  it("aggregates each transcript independently", () => {
    const transcripts = [
      makeTranscript([makeEntry()], "session-a"),
      makeTranscript([makeEntry(), makeEntry()], "session-b"),
    ];
    const results = aggregateSessions(transcripts);
    expect(results).toHaveLength(2);
    expect(results[0].sessionId).toBe("session-a");
    expect(results[0].messageCount).toBe(1);
    expect(results[1].sessionId).toBe("session-b");
    expect(results[1].messageCount).toBe(2);
  });
});
