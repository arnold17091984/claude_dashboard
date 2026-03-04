/**
 * api.ts
 *
 * Shared TypeScript types for all Hono API responses and request bodies.
 * Every type in this file is derived directly from the route implementations
 * in src/server/api/routes/. Keep these in sync when routes change.
 *
 * Organisation:
 *   1. Common / shared building blocks
 *   2. Overview (/api/v1/overview)
 *   3. Ranking  (/api/v1/ranking)
 *   4. Users    (/api/v1/users, /api/v1/users/:id)
 *   5. Sessions (/api/v1/sessions, /api/v1/sessions/:id)
 *   6. Tools    (/api/v1/tools/usage, /api/v1/tools/trend)
 *   7. Models   (/api/v1/models/usage, /api/v1/models/cost)
 *   8. Projects (/api/v1/projects, /api/v1/projects/:name)
 *   9. AI Insights (/api/v1/insights, /api/v1/insights/latest,
 *                   /api/v1/insights/generate)
 *  10. Ingest  (/api/v1/ingest/session, /api/v1/ingest/events)
 *  11. Generic error envelope
 */

import type { InsightType } from "./database";

// ===========================================================================
// 1. Common / shared building blocks
// ===========================================================================

/** Query parameter: selectable time window. */
export type Period = "7d" | "30d" | "90d";

/** Query parameter: ranking sort dimension. */
export type RankingSortBy = "cost" | "sessions" | "toolCalls";

/** Pagination metadata returned alongside paginated lists. */
export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ===========================================================================
// 2. Overview  GET /api/v1/overview?period=7d
// ===========================================================================

/** KPI summary card values. */
export interface OverviewKpi {
  totalUsers: number;
  totalSessions: number;
  /** Sessions within the selected `period`. */
  recentSessions: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  /** Estimated cost in USD for the selected `period`. */
  totalCost: number;
}

/** One row in the daily activity chart. */
export interface DailyActivityPoint {
  date: string;
  /** Sum of sessionCount across all users for that date. */
  sessions: string | null;
  /** Sum of messageCount across all users for that date. */
  messages: string | null;
  /** Sum of toolCallCount across all users for that date. */
  toolCalls: string | null;
  /** Sum of estimatedCostUsd across all users for that date. */
  cost: string | null;
}

/** Tool usage entry in the top-tools list. */
export interface TopToolItem {
  toolName: string | null;
  count: number;
}

/** Model distribution entry in the overview. */
export interface OverviewModelItem {
  model: string;
  inputTokens: string | null;
  outputTokens: string | null;
  cost: string | null;
}

/** Project session count entry in the overview. */
export interface TopProjectItem {
  projectName: string | null;
  count: number;
}

/** Response body for GET /api/v1/overview. */
export interface OverviewResponse {
  kpi: OverviewKpi;
  dailyActivity: DailyActivityPoint[];
  topTools: TopToolItem[];
  topModels: OverviewModelItem[];
  topProjects: TopProjectItem[];
  period: Period;
}

// ===========================================================================
// 3. Ranking  GET /api/v1/ranking?period=7d&sortBy=cost
// ===========================================================================

/** A single user's ranked statistics. */
export interface RankingEntry {
  rank: number;
  userId: string;
  displayName: string;
  email: string | null;
  team: string | null;
  avatarUrl: string | null;
  sessions: number;
  messages: number;
  toolCalls: number;
  cost: number;
  activeMinutes: number;
  topTool: string | null;
}

/** Response body for GET /api/v1/ranking. */
export interface RankingResponse {
  ranking: RankingEntry[];
  period: Period;
  sortBy: RankingSortBy;
}

// ===========================================================================
// 4. Users  GET /api/v1/users  |  GET /api/v1/users/:id
// ===========================================================================

/** User list item returned by GET /api/v1/users. */
export interface UserListItem {
  id: string;
  displayName: string;
  email: string | null;
  team: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

/** Response body for GET /api/v1/users. */
export interface UsersListResponse {
  users: UserListItem[];
}

/** Compact session record in a user's recent session history. */
export interface UserSessionHistoryItem {
  id: string;
  projectName: string | null;
  projectPath: string;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  messageCount: number | null;
  toolCallCount: number | null;
}

/** One point in the user's daily activity trend. */
export interface UserDailyTrendPoint {
  date: string;
  sessions: number | null;
  messages: number | null;
  toolCalls: number | null;
  cost: number | null;
}

/** Tool distribution entry for a specific user. */
export interface UserToolDistributionItem {
  toolName: string | null;
  count: number;
}

/** Token / cost stats per model for a user. */
export interface UserTokenStatItem {
  model: string;
  inputTokens: string | null;
  outputTokens: string | null;
  cost: string | null;
}

/** Full user record as returned by Drizzle select on the users table. */
export interface UserDetail {
  id: string;
  displayName: string;
  email: string | null;
  team: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Response body for GET /api/v1/users/:id. */
export interface UserDetailResponse {
  user: UserDetail;
  sessionHistory: UserSessionHistoryItem[];
  dailyTrend: UserDailyTrendPoint[];
  toolDistribution: UserToolDistributionItem[];
  tokenStats: UserTokenStatItem[];
  period: Period;
}

/** Error response for GET /api/v1/users/:id when user is not found. */
export interface UserNotFoundResponse {
  error: "User not found";
}

// ===========================================================================
// 5. Sessions  GET /api/v1/sessions  |  GET /api/v1/sessions/:id
// ===========================================================================

/** Session list item returned by GET /api/v1/sessions (includes user name). */
export interface SessionListItem {
  id: string;
  userId: string;
  displayName: string | null;
  projectName: string | null;
  projectPath: string;
  gitBranch: string | null;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  messageCount: number | null;
  toolCallCount: number | null;
}

/** Response body for GET /api/v1/sessions. */
export interface SessionsListResponse {
  sessions: SessionListItem[];
  pagination: Pagination;
  period: Period;
}

/** Detailed session record returned by GET /api/v1/sessions/:id. */
export interface SessionDetail {
  id: string;
  userId: string;
  displayName: string | null;
  projectName: string | null;
  projectPath: string;
  gitBranch: string | null;
  claudeVersion: string | null;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  messageCount: number | null;
  toolCallCount: number | null;
}

/** Tool usage aggregated within a session. */
export interface SessionToolUsageItem {
  toolName: string | null;
  count: number;
}

/** Token / cost stats per model within a session. */
export interface SessionTokenStatItem {
  model: string;
  inputTokens: string | null;
  outputTokens: string | null;
  cost: string | null;
}

/** Response body for GET /api/v1/sessions/:id. */
export interface SessionDetailResponse {
  session: SessionDetail;
  toolUsage: SessionToolUsageItem[];
  tokenStats: SessionTokenStatItem[];
}

/** Error response for GET /api/v1/sessions/:id when session is not found. */
export interface SessionNotFoundResponse {
  error: "Session not found";
}

// ===========================================================================
// 6. Tools  GET /api/v1/tools/usage  |  GET /api/v1/tools/trend
// ===========================================================================

/** Category summary entry in the tools usage response. */
export interface ToolCategorySummaryItem {
  category: "builtin" | "skill" | "subagent" | "mcp";
  label: string;
  total: number;
}

/** Generic tool-name / count pair. */
export interface ToolCountItem {
  toolName: string | null;
  count: number;
}

/** Skill-name / count pair. */
export interface SkillCountItem {
  skillName: string | null;
  count: number;
}

/** Subagent-type / count pair. */
export interface SubagentCountItem {
  subagentType: string | null;
  count: number;
}

/** Response body for GET /api/v1/tools/usage. */
export interface ToolsUsageResponse {
  categorySummary: ToolCategorySummaryItem[];
  allTools: ToolCountItem[];
  skills: SkillCountItem[];
  subagents: SubagentCountItem[];
  builtins: ToolCountItem[];
  mcpTools: ToolCountItem[];
  period: Period;
}

/** One data point in the tools daily trend. */
export interface ToolTrendPoint {
  date: string;
  toolCalls: string | null;
  sessions: string | null;
}

/** Response body for GET /api/v1/tools/trend. */
export interface ToolsTrendResponse {
  trend: ToolTrendPoint[];
  period: Period;
}

// ===========================================================================
// 7. Models  GET /api/v1/models/usage  |  GET /api/v1/models/cost
// ===========================================================================

/** Aggregated usage statistics for one model. */
export interface ModelUsageItem {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  cost: number;
  requestCount: number;
  /** Percentage of total cost (0-100). */
  costShare: number;
}

/** Response body for GET /api/v1/models/usage. */
export interface ModelsUsageResponse {
  usage: ModelUsageItem[];
  totalCost: number;
  totalTokens: number;
  period: Period;
}

/**
 * One row in the cost trend pivot table.
 * The `date` and `total` fields are always present; additional keys are model
 * names mapped to their daily cost in USD.
 */
export type ModelCostTrendPoint = {
  date: string;
  total: number;
} & Record<string, number | string>;

/** Response body for GET /api/v1/models/cost. */
export interface ModelsCostResponse {
  trend: ModelCostTrendPoint[];
  /** Unique model names present in the trend data. */
  models: string[];
  period: Period;
}

// ===========================================================================
// 8. Projects  GET /api/v1/projects  |  GET /api/v1/projects/:name
// ===========================================================================

/** Aggregated project statistics. */
export interface ProjectListItem {
  projectName: string | null;
  sessionCount: number;
  totalMessages: number;
  totalToolCalls: number;
  totalDurationMs: number;
  lastUsed: string;
  userCount: number;
  cost: number;
}

/** Response body for GET /api/v1/projects. */
export interface ProjectsListResponse {
  projects: ProjectListItem[];
  period: Period;
}

/** Session record within a project detail view (includes user display name). */
export interface ProjectSessionItem {
  id: string;
  userId: string;
  displayName: string | null;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  messageCount: number | null;
  toolCallCount: number | null;
}

/** Tool usage aggregated for a project. */
export interface ProjectToolStatItem {
  toolName: string | null;
  count: number;
}

/** Token / cost stats per model for a project. */
export interface ProjectCostStatItem {
  model: string;
  inputTokens: string | null;
  outputTokens: string | null;
  cost: string | null;
}

/** Response body for GET /api/v1/projects/:name. */
export interface ProjectDetailResponse {
  projectName: string;
  sessions: ProjectSessionItem[];
  toolStats: ProjectToolStatItem[];
  costStats: ProjectCostStatItem[];
  period: Period;
}

// ===========================================================================
// 9. AI Insights
//    GET  /api/v1/insights
//    GET  /api/v1/insights/latest
//    POST /api/v1/insights/generate
// ===========================================================================

/** Full AI insight record as stored in the database. */
export interface AiInsightRecord {
  id: number;
  insightType: InsightType;
  targetUserId: string | null;
  content: string;
  metadata: string | null;
  generatedAt: string;
  expiresAt: string | null;
}

/** Response body for GET /api/v1/insights. */
export interface AiInsightsListResponse {
  insights: AiInsightRecord[];
}

/** Response body for GET /api/v1/insights/latest. */
export interface AiInsightLatestResponse {
  insight: AiInsightRecord | null;
}

/** Response body for POST /api/v1/insights/generate (success). */
export interface AiInsightGenerateSuccessResponse {
  success: true;
  content: string;
}

/** Response body for POST /api/v1/insights/generate (failure). */
export interface AiInsightGenerateErrorResponse {
  success: false;
  error: string;
}

export type AiInsightGenerateResponse =
  | AiInsightGenerateSuccessResponse
  | AiInsightGenerateErrorResponse;

// ===========================================================================
// 10. Ingest  POST /api/v1/ingest/session  |  POST /api/v1/ingest/events
// ===========================================================================

/** Token usage sub-object included in ingest session requests. */
export interface IngestTokenUsagePayload {
  inputTokens: number;
  outputTokens: number;
  /** Defaults to 0 if omitted. */
  cacheReadInputTokens?: number;
  /** Defaults to 0 if omitted. */
  cacheCreationInputTokens?: number;
}

/** Session payload sent to POST /api/v1/ingest/session. */
export interface IngestSessionPayload {
  sessionId: string;
  userId: string;
  projectPath: string;
  projectName?: string;
  gitBranch?: string;
  claudeVersion?: string;
  /** ISO-8601 datetime with offset. */
  startedAt: string;
  /** ISO-8601 datetime with offset. */
  endedAt?: string;
  durationMs?: number;
  messageCount?: number;
  toolCallCount?: number;
  primaryModel?: string;
  totalTokenUsage?: IngestTokenUsagePayload;
}

/** Single event payload for ingest endpoints. */
export interface IngestEventPayload {
  sessionId: string;
  userId: string;
  eventType: string;
  role?: string;
  toolName?: string;
  skillName?: string;
  subagentType?: string;
  model?: string;
  /** ISO-8601 datetime with offset. */
  timestamp: string;
}

/** Token usage event payload within an ingest session request. */
export interface IngestTokenUsageEventPayload {
  sessionId: string;
  userId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens?: number;
  cacheCreationInputTokens?: number;
  /** ISO-8601 datetime with offset. */
  timestamp: string;
}

/** Request body for POST /api/v1/ingest/session. */
export interface IngestSessionRequest {
  session: IngestSessionPayload;
  events?: IngestEventPayload[];
  tokenUsageEvents?: IngestTokenUsageEventPayload[];
}

/** Request body for POST /api/v1/ingest/events. */
export interface IngestEventsRequest {
  events: IngestEventPayload[];
}

/** Success response body for POST /api/v1/ingest/session. */
export interface IngestSessionResponse {
  ok: true;
  sessionId: string;
  eventsInserted: number;
  tokenUsageEventsInserted: number;
}

/** Success response body for POST /api/v1/ingest/events. */
export interface IngestEventsResponse {
  ok: true;
  eventsInserted: number;
}

// ===========================================================================
// 11. Generic error envelope
// ===========================================================================

/** Standard error envelope returned by all routes on failure. */
export interface ApiErrorResponse {
  error: string;
  details?: unknown;
}

/** Validation error response (400). */
export interface ApiValidationErrorResponse {
  error: "Validation failed";
  details: unknown[];
}
