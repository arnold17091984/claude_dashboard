/**
 * Tests for transcript-parser.ts
 *
 * Tests parseTranscriptString (synchronous, testable without filesystem)
 * and parseTranscriptFile (async, uses a real temp file).
 */
import { describe, it, expect } from "vitest";
import { parseTranscriptString } from "@/server/services/transcript-parser";
import type { ParsedTranscript } from "@/server/services/transcript-parser";

// -------------------------------------------------------------------
// Helpers for building JSONL fixture lines
// -------------------------------------------------------------------
function makeAssistantLine(opts: {
  timestamp?: string;
  model?: string;
  toolNames?: string[];
  skillName?: string;
  subagentType?: string;
  inputTokens?: number;
  outputTokens?: number;
  cacheRead?: number;
  cacheCreate?: number;
}) {
  const {
    timestamp = new Date().toISOString(),
    model = "claude-sonnet-4-6",
    toolNames = [],
    skillName,
    subagentType,
    inputTokens = 100,
    outputTokens = 50,
    cacheRead = 0,
    cacheCreate = 0,
  } = opts;

  const content = toolNames.map((name) => {
    const block: Record<string, unknown> = { type: "tool_use", name };
    if (name === "Skill" && skillName) {
      block.input = { skill: skillName };
    }
    if (name === "Agent" && subagentType) {
      block.input = { subagent_type: subagentType };
    }
    return block;
  });

  return JSON.stringify({
    timestamp,
    message: {
      role: "assistant",
      model,
      content,
      usage: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cache_read_input_tokens: cacheRead,
        cache_creation_input_tokens: cacheCreate,
      },
    },
  });
}

function makeUserLine(timestamp?: string) {
  return JSON.stringify({
    timestamp: timestamp ?? new Date().toISOString(),
    message: {
      role: "user",
      content: [{ type: "text", text: "Hello" }],
    },
  });
}

// -------------------------------------------------------------------
// parseTranscriptString
// -------------------------------------------------------------------
describe("parseTranscriptString", () => {
  it("returns empty entries for empty string", () => {
    const result = parseTranscriptString("", "session-1");
    expect(result.sessionId).toBe("session-1");
    expect(result.entries).toEqual([]);
  });

  it("skips blank lines", () => {
    const content = "\n  \n\n";
    const result = parseTranscriptString(content, "session-blank");
    expect(result.entries).toHaveLength(0);
  });

  it("skips invalid JSON lines and continues parsing", () => {
    const content = [
      "not-valid-json",
      makeUserLine(),
    ].join("\n");
    const result = parseTranscriptString(content, "session-invalid");
    expect(result.entries).toHaveLength(1);
  });

  it("parses a user message correctly", () => {
    const ts = "2026-01-15T10:00:00.000Z";
    const line = makeUserLine(ts);
    const result = parseTranscriptString(line, "session-user");
    expect(result.entries).toHaveLength(1);
    const entry = result.entries[0];
    expect(entry.role).toBe("user");
    expect(entry.timestamp).toBe(ts);
    expect(entry.toolNames).toEqual([]);
    expect(entry.hasMcpTool).toBe(false);
  });

  it("parses an assistant message with model and token usage", () => {
    const ts = "2026-01-15T10:01:00.000Z";
    const line = makeAssistantLine({
      timestamp: ts,
      model: "claude-sonnet-4-6",
      inputTokens: 500,
      outputTokens: 200,
      cacheRead: 100,
      cacheCreate: 50,
    });
    const result = parseTranscriptString(line, "session-assistant");
    const entry = result.entries[0];
    expect(entry.role).toBe("assistant");
    expect(entry.model).toBe("claude-sonnet-4-6");
    expect(entry.tokenUsage?.inputTokens).toBe(500);
    expect(entry.tokenUsage?.outputTokens).toBe(200);
    expect(entry.tokenUsage?.cacheReadInputTokens).toBe(100);
    expect(entry.tokenUsage?.cacheCreationInputTokens).toBe(50);
  });

  it("extracts tool names from assistant content blocks", () => {
    const line = makeAssistantLine({
      toolNames: ["Read", "Bash", "Write"],
    });
    const result = parseTranscriptString(line, "session-tools");
    const entry = result.entries[0];
    expect(entry.toolNames).toEqual(["Read", "Bash", "Write"]);
  });

  it("extracts skillName when Skill tool is present", () => {
    const line = makeAssistantLine({
      toolNames: ["Skill"],
      skillName: "code-review",
    });
    const result = parseTranscriptString(line, "session-skill");
    const entry = result.entries[0];
    expect(entry.toolNames).toContain("Skill");
    expect(entry.skillName).toBe("code-review");
  });

  it("extracts subagentType when Agent tool is present", () => {
    const line = makeAssistantLine({
      toolNames: ["Agent"],
      subagentType: "qa-expert",
    });
    const result = parseTranscriptString(line, "session-agent");
    const entry = result.entries[0];
    expect(entry.toolNames).toContain("Agent");
    expect(entry.subagentType).toBe("qa-expert");
  });

  it("sets hasMcpTool=true when an mcp__ tool is present", () => {
    const line = makeAssistantLine({
      toolNames: ["mcp__github__search"],
    });
    const result = parseTranscriptString(line, "session-mcp");
    expect(result.entries[0].hasMcpTool).toBe(true);
  });

  it("sets hasMcpTool=false when no mcp tool is present", () => {
    const line = makeAssistantLine({
      toolNames: ["Read", "Bash"],
    });
    const result = parseTranscriptString(line, "session-no-mcp");
    expect(result.entries[0].hasMcpTool).toBe(false);
  });

  it("parses multiple lines correctly", () => {
    const ts1 = "2026-01-15T10:00:00.000Z";
    const ts2 = "2026-01-15T10:01:00.000Z";
    const content = [
      makeUserLine(ts1),
      makeAssistantLine({ timestamp: ts2 }),
    ].join("\n");
    const result = parseTranscriptString(content, "session-multi");
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].role).toBe("user");
    expect(result.entries[1].role).toBe("assistant");
  });

  it("handles flat message format (no wrapper object)", () => {
    // Some transcript formats have the message directly without a 'message' key
    const flat = JSON.stringify({
      timestamp: "2026-01-15T10:00:00.000Z",
      role: "user",
      content: "Hello",
    });
    const result = parseTranscriptString(flat, "session-flat");
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].role).toBe("user");
  });

  it("uses current time as fallback when timestamp is missing", () => {
    const noTimestamp = JSON.stringify({
      message: { role: "user", content: "hi" },
    });
    const before = Date.now();
    const result = parseTranscriptString(noTimestamp, "session-no-ts");
    const after = Date.now();
    const entryTs = Date.parse(result.entries[0].timestamp);
    expect(entryTs).toBeGreaterThanOrEqual(before);
    expect(entryTs).toBeLessThanOrEqual(after);
  });

  it("does not extract token usage for user messages", () => {
    const line = makeUserLine();
    const result = parseTranscriptString(line, "session-user-tokens");
    expect(result.entries[0].tokenUsage).toBeUndefined();
  });

  it("preserves sessionId in all entries", () => {
    const content = [makeUserLine(), makeAssistantLine({})].join("\n");
    const result = parseTranscriptString(content, "my-session-id");
    result.entries.forEach((e) => {
      expect(e.sessionId).toBe("my-session-id");
    });
  });

  it("filePath is empty string for string parsing", () => {
    const result = parseTranscriptString(makeUserLine(), "s1");
    expect(result.filePath).toBe("");
  });
});

// -------------------------------------------------------------------
// parseTranscriptFile (async)
// -------------------------------------------------------------------
describe("parseTranscriptFile", () => {
  it("returns empty entries for non-existent file", async () => {
    const { parseTranscriptFile } = await import("@/server/services/transcript-parser");
    const result = await parseTranscriptFile("/nonexistent/path/session.jsonl");
    expect(result.entries).toEqual([]);
    expect(result.sessionId).toBe("session");
  });
});
