/**
 * index.ts
 *
 * Barrel export for all shared TypeScript types used across the
 * claude-dashboard application (frontend pages, API routes, and utilities).
 *
 * Import from "@/types" to access any type defined in this package.
 *
 * Example:
 *   import type { OverviewResponse, Period, DbUser } from "@/types";
 */

// Database entity types (derived from Drizzle schema)
export type {
  DbUser,
  DbUserSummary,
  DbSession,
  DbEvent,
  DbTokenUsage,
  DbDailySummary,
  DbAiInsight,
  InsightType,
  ToolCategory,
} from "./database";

// API request / response types (all Hono routes)
export type {
  // Common
  Period,
  RankingSortBy,
  Pagination,

  // Overview
  OverviewKpi,
  DailyActivityPoint,
  TopToolItem,
  OverviewModelItem,
  TopProjectItem,
  OverviewResponse,

  // Ranking
  RankingEntry,
  RankingResponse,

  // Users
  UserListItem,
  UsersListResponse,
  UserSessionHistoryItem,
  UserDailyTrendPoint,
  UserToolDistributionItem,
  UserTokenStatItem,
  UserDetail,
  UserDetailResponse,
  UserNotFoundResponse,

  // Sessions
  SessionListItem,
  SessionsListResponse,
  SessionDetail,
  SessionToolUsageItem,
  SessionTokenStatItem,
  SessionDetailResponse,
  SessionNotFoundResponse,

  // Tools
  ToolCategorySummaryItem,
  ToolCountItem,
  SkillCountItem,
  SubagentCountItem,
  ToolsUsageResponse,
  ToolTrendPoint,
  ToolsTrendResponse,

  // Models
  ModelUsageItem,
  ModelsUsageResponse,
  ModelCostTrendPoint,
  ModelsCostResponse,

  // Projects
  ProjectListItem,
  ProjectsListResponse,
  ProjectSessionItem,
  ProjectToolStatItem,
  ProjectCostStatItem,
  ProjectDetailResponse,

  // AI Insights
  AiInsightRecord,
  AiInsightsListResponse,
  AiInsightLatestResponse,
  AiInsightGenerateSuccessResponse,
  AiInsightGenerateErrorResponse,
  AiInsightGenerateResponse,

  // Ingest
  IngestTokenUsagePayload,
  IngestSessionPayload,
  IngestEventPayload,
  IngestTokenUsageEventPayload,
  IngestSessionRequest,
  IngestEventsRequest,
  IngestSessionResponse,
  IngestEventsResponse,

  // Errors
  ApiErrorResponse,
  ApiValidationErrorResponse,
} from "./api";

// i18n types
export type {
  Locale,
  TranslationKey,
  TranslationVars,
  TranslationVarsFor,
  TypedTranslateFn,
} from "./i18n";
