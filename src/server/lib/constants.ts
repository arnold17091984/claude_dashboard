// Model pricing per 1M tokens (USD) - as of March 2026
export const MODEL_PRICING: Record<
  string,
  { input: number; output: number; cacheRead: number; cacheWrite: number }
> = {
  "claude-opus-4-6": {
    input: 15,
    output: 75,
    cacheRead: 1.5,
    cacheWrite: 18.75,
  },
  "claude-opus-4-5-20251101": {
    input: 15,
    output: 75,
    cacheRead: 1.5,
    cacheWrite: 18.75,
  },
  "claude-sonnet-4-6": {
    input: 3,
    output: 15,
    cacheRead: 0.3,
    cacheWrite: 3.75,
  },
  "claude-sonnet-4-5-20241022": {
    input: 3,
    output: 15,
    cacheRead: 0.3,
    cacheWrite: 3.75,
  },
  "claude-sonnet-4-5-20250929": {
    input: 3,
    output: 15,
    cacheRead: 0.3,
    cacheWrite: 3.75,
  },
  "claude-haiku-4-5-20251001": {
    input: 0.8,
    output: 4,
    cacheRead: 0.08,
    cacheWrite: 1,
  },
};

// Default pricing fallback for unknown models
export const DEFAULT_PRICING = {
  input: 3,
  output: 15,
  cacheRead: 0.3,
  cacheWrite: 3.75,
};

export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens: number = 0,
  cacheCreationTokens: number = 0
): number {
  const pricing = MODEL_PRICING[model] || DEFAULT_PRICING;
  return (
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output +
    (cacheReadTokens / 1_000_000) * pricing.cacheRead +
    (cacheCreationTokens / 1_000_000) * pricing.cacheWrite
  );
}

// Tool categories
export const TOOL_CATEGORIES = {
  skill: ["Skill"],
  subagent: ["Agent"],
  mcp: [] as string[], // MCP tools start with "mcp__"
  builtin: [
    "Bash",
    "Read",
    "Write",
    "Edit",
    "Glob",
    "Grep",
    "WebSearch",
    "WebFetch",
    "TodoWrite",
    "NotebookEdit",
    "AskUserQuestion",
    "Task",
    "TaskCreate",
    "TaskUpdate",
    "TaskOutput",
    "TaskStop",
    "TaskList",
    "TaskGet",
    "EnterPlanMode",
    "ExitPlanMode",
    "EnterWorktree",
    "SendMessage",
    "KillShell",
    "TeamCreate",
    "ToolSearch",
  ],
} as const;

export function categorizeTool(
  toolName: string
): "skill" | "subagent" | "mcp" | "builtin" | "other" {
  if ((TOOL_CATEGORIES.skill as readonly string[]).includes(toolName)) return "skill";
  if ((TOOL_CATEGORIES.subagent as readonly string[]).includes(toolName)) return "subagent";
  if (toolName.startsWith("mcp__")) return "mcp";
  if ((TOOL_CATEGORIES.builtin as readonly string[]).includes(toolName)) return "builtin";
  return "other";
}
