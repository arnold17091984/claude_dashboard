/**
 * transcript-parser.ts
 *
 * Claude Code のトランスクリプト (.jsonl) を解析するコアロジック。
 * プライバシー保護: プロンプト内容、コード内容、ファイルパスは一切抽出しない。
 */
import fs from "fs";
import readline from "readline";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContentBlock {
  type: string;
  name?: string;
  input?: {
    skill?: string;
    subagent_type?: string;
    [key: string]: unknown;
  };
}

export interface TokenUsageRaw {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

export interface TranscriptMessage {
  type?: string;
  role?: string;
  model?: string;
  usage?: TokenUsageRaw;
  content?: ContentBlock[] | string;
}

export interface TranscriptEntry {
  /** Unique identifier for the session (filename without extension) */
  sessionId: string;
  /** ISO timestamp of the entry */
  timestamp: string;
  /** Model used (assistant messages only) */
  model?: string;
  /** Role: "user" | "assistant" | "system" */
  role?: string;
  /** List of tool names called in this message */
  toolNames: string[];
  /** skill_name when the Skill tool is invoked */
  skillName?: string;
  /** subagent_type when the Agent tool is invoked */
  subagentType?: string;
  /** Whether any MCP tool was used in this message */
  hasMcpTool: boolean;
  /** Token usage for this message (only present on assistant turns) */
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens: number;
    cacheCreationInputTokens: number;
  };
}

export interface ParsedTranscript {
  sessionId: string;
  filePath: string;
  entries: TranscriptEntry[];
}

// ---------------------------------------------------------------------------
// Helper: extract tool information from content blocks
// ---------------------------------------------------------------------------

function extractToolInfo(content: ContentBlock[]): {
  toolNames: string[];
  skillName?: string;
  subagentType?: string;
  hasMcpTool: boolean;
} {
  const toolNames: string[] = [];
  let skillName: string | undefined;
  let subagentType: string | undefined;
  let hasMcpTool = false;

  for (const block of content) {
    if (block.type !== "tool_use") continue;

    const name = block.name ?? "";
    toolNames.push(name);

    if (name === "Skill" && block.input?.skill) {
      skillName = String(block.input.skill);
    }

    if (name === "Agent" && block.input?.subagent_type) {
      subagentType = String(block.input.subagent_type);
    }

    if (name.startsWith("mcp__")) {
      hasMcpTool = true;
    }
  }

  return { toolNames, skillName, subagentType, hasMcpTool };
}

// ---------------------------------------------------------------------------
// Parse a single JSONL line
// ---------------------------------------------------------------------------

function parseLine(
  line: string,
  sessionId: string
): TranscriptEntry | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    return null;
  }

  // Claude Code transcript entries have a "message" wrapper in some formats,
  // and sometimes the entry itself IS the message.
  // Handle both { message: {...}, timestamp, ... } and flat message objects.
  const timestamp: string =
    typeof raw["timestamp"] === "string"
      ? raw["timestamp"]
      : new Date().toISOString();

  const message: TranscriptMessage =
    raw["message"] != null &&
    typeof raw["message"] === "object"
      ? (raw["message"] as TranscriptMessage)
      : (raw as TranscriptMessage);

  const role = typeof message.role === "string" ? message.role : undefined;
  const model =
    typeof message.model === "string" ? message.model : undefined;

  // Content can be an array of blocks or a plain string.
  // We only care about array format for tool extraction.
  const contentBlocks: ContentBlock[] =
    Array.isArray(message.content)
      ? (message.content as ContentBlock[])
      : [];

  const { toolNames, skillName, subagentType, hasMcpTool } =
    extractToolInfo(contentBlocks);

  // Token usage is only present on assistant turns
  let tokenUsage: TranscriptEntry["tokenUsage"];
  if (message.usage) {
    const u = message.usage;
    tokenUsage = {
      inputTokens: u.input_tokens ?? 0,
      outputTokens: u.output_tokens ?? 0,
      cacheReadInputTokens: u.cache_read_input_tokens ?? 0,
      cacheCreationInputTokens: u.cache_creation_input_tokens ?? 0,
    };
  }

  return {
    sessionId,
    timestamp,
    model,
    role,
    toolNames,
    skillName,
    subagentType,
    hasMcpTool,
    tokenUsage,
  };
}

// ---------------------------------------------------------------------------
// Public API: parse a single transcript file
// ---------------------------------------------------------------------------

/**
 * Parse a Claude Code transcript (.jsonl) file line-by-line.
 *
 * @param filePath Absolute path to the .jsonl file
 * @returns ParsedTranscript containing all valid entries
 */
export async function parseTranscriptFile(
  filePath: string
): Promise<ParsedTranscript> {
  // Derive sessionId from filename without extension
  const sessionId = filePath
    .split("/")
    .pop()!
    .replace(/\.jsonl$/, "");

  const entries: TranscriptEntry[] = [];

  if (!fs.existsSync(filePath)) {
    return { sessionId, filePath, entries };
  }

  const fileStream = fs.createReadStream(filePath, { encoding: "utf-8" });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const entry = parseLine(line, sessionId);
    if (entry) {
      entries.push(entry);
    }
  }

  return { sessionId, filePath, entries };
}

/**
 * Parse a transcript from a raw string (used in tests and streaming contexts).
 *
 * @param content JSONL content as a string
 * @param sessionId Session identifier
 */
export function parseTranscriptString(
  content: string,
  sessionId: string
): ParsedTranscript {
  const entries: TranscriptEntry[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    const entry = parseLine(line, sessionId);
    if (entry) {
      entries.push(entry);
    }
  }

  return { sessionId, filePath: "", entries };
}
