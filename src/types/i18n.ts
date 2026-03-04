/**
 * i18n.ts
 *
 * Type-safe translation key types for the dashboard i18n system.
 *
 * `TranslationKey` is a union of every literal string that appears as a key
 * in the translation maps defined in src/lib/i18n/translations.ts. This lets
 * the TypeScript compiler catch typos in `t("key")` call-sites at build time.
 *
 * The `Locale` type is re-exported here for convenience so that consumers only
 * need to import from "@/types".
 */

// ---------------------------------------------------------------------------
// Re-export core locale type
// ---------------------------------------------------------------------------

export type { Locale } from "@/lib/i18n/translations";

// ---------------------------------------------------------------------------
// Translation key union
// ---------------------------------------------------------------------------

/**
 * All valid i18n translation keys used by the application.
 * Add new keys here whenever src/lib/i18n/translations.ts is extended.
 */
export type TranslationKey =
  // Navigation
  | "nav.groupLabel"
  | "nav.overview"
  | "nav.ranking"
  | "nav.users"
  | "nav.sessions"
  | "nav.projects"
  | "nav.tools"
  | "nav.models"
  | "nav.insights"

  // Common
  | "common.period"
  | "common.sort"
  | "common.cost"
  | "common.sessions"
  | "common.users"
  | "common.tools"
  | "common.toolUsage"
  | "common.messages"
  | "common.noData"
  | "common.loading"
  | "common.prev"
  | "common.next"
  | "common.networkError"
  | "common.period.7d"
  | "common.period.30d"
  | "common.period.90d"
  | "common.ofTotal"

  // KPI cards
  | "kpi.activeUsers"
  | "kpi.sessions"
  | "kpi.registeredUsers"
  | "kpi.allPeriod"
  | "kpi.tokens"
  | "kpi.cacheInputOutput"
  | "kpi.cache"
  | "kpi.input"
  | "kpi.output"
  | "kpi.estimatedCost"
  | "kpi.periodTotal"

  // Charts
  | "chart.activity.title"
  | "chart.activity.description"
  | "chart.sessions"
  | "chart.toolCalls"
  | "chart.usageCount"
  | "chart.toolUsage.title"
  | "chart.toolUsage.description"
  | "chart.modelCost.title"
  | "chart.modelCost.description"
  | "chart.costTrend.title"
  | "chart.costTrend.titleFull"
  | "chart.costTrend.description"
  | "chart.toolCategory.categoryTitle"
  | "chart.toolCategory.top15"

  // Tables
  | "table.rank"
  | "table.user"
  | "table.sessions"
  | "table.messages"
  | "table.toolUsage"
  | "table.cost"
  | "table.topTool"
  | "table.project"
  | "table.users"
  | "table.workTime"
  | "table.lastUsed"
  | "table.model"
  | "table.requests"
  | "table.inputTokens"
  | "table.outputTokens"
  | "table.cacheRead"
  | "table.share"

  // Page: Overview
  | "page.overview.title"
  | "page.overview.description"
  | "page.overview.heading"
  | "page.overview.projectSessions"
  | "page.overview.projectsDescription"
  | "page.overview.noData"
  | "page.overview.noDataHint"

  // Page: Ranking
  | "page.ranking.title"
  | "page.ranking.description"
  | "page.ranking.heading"
  | "page.ranking.tableTitle"
  | "page.ranking.participants"
  | "page.ranking.totalSessions"
  | "page.ranking.totalCost"

  // Page: Users
  | "page.users.title"
  | "page.users.description"
  | "page.users.heading"
  | "page.users.count"
  | "page.users.noUsers"
  | "page.users.topTool"

  // Page: Sessions
  | "page.sessions.title"
  | "page.sessions.description"
  | "page.sessions.heading"
  | "page.sessions.count"
  | "page.sessions.noSessions"
  | "page.sessions.pagination"

  // Page: Projects
  | "page.projects.title"
  | "page.projects.description"
  | "page.projects.heading"
  | "page.projects.count"
  | "page.projects.totalSessions"
  | "page.projects.totalCost"
  | "page.projects.chartTitle"
  | "page.projects.tableTitle"
  | "page.projects.sessionCount"

  // Page: Tools
  | "page.tools.title"
  | "page.tools.description"
  | "page.tools.heading"
  | "page.tools.trendTitle"
  | "page.tools.skills"
  | "page.tools.subagents"
  | "page.tools.mcpTools"
  | "page.tools.noSkillData"
  | "page.tools.noSubagentData"

  // Page: Models
  | "page.models.title"
  | "page.models.description"
  | "page.models.heading"
  | "page.models.totalCost"
  | "page.models.totalTokens"
  | "page.models.modelCount"
  | "page.models.costEfficiency"
  | "page.models.highEfficiency"
  | "page.models.mediumEfficiency"
  | "page.models.lowEfficiency"
  | "page.models.tableTitle"

  // Page: Insights
  | "page.insights.title"
  | "page.insights.description"
  | "page.insights.heading"
  | "page.insights.generate"
  | "page.insights.generating"
  | "page.insights.error"
  | "page.insights.generationFailed"
  | "page.insights.apiKeyHint"
  | "page.insights.empty"
  | "page.insights.emptyHint"
  | "page.insights.apiKeyNote"
  | "page.insights.reportTitle"

  // Insight types
  | "insight.weeklySummary"
  | "insight.costOptimization"
  | "insight.anomaly"
  | "insight.userInsight"
  | "insight.default"

  // Page: User Detail
  | "page.userDetail.title"
  | "page.userDetail.notFound"
  | "page.userDetail.notFoundDesc"
  | "page.userDetail.usageOf"
  | "page.userDetail.sessions"
  | "page.userDetail.toolUsage"
  | "page.userDetail.estimatedCost"
  | "page.userDetail.activityTrend"
  | "page.userDetail.toolTop10"
  | "page.userDetail.modelCost"
  | "page.userDetail.recentSessions"
  | "page.userDetail.noSessions"
  | "page.userDetail.toolUsageLabel"
  | "page.userDetail.usageCount";

// ---------------------------------------------------------------------------
// Interpolation variable maps for keys that accept `{placeholder}` tokens
// ---------------------------------------------------------------------------

/**
 * Maps each translation key that uses `{placeholder}` interpolation to the
 * required variables object. Keys without interpolation are not listed here —
 * they accept no variables.
 */
export interface TranslationVars {
  "page.users.count": { count: number | string };
  "page.sessions.count": { count: number | string };
  "page.sessions.pagination": { page: number | string; total: number | string };
  "page.userDetail.usageOf": { name: string };
}

/**
 * Type-safe overload helper: given a `TranslationKey`, returns the required
 * variables type if the key has interpolation, or `undefined` if it does not.
 *
 * Usage (conceptual — the actual `t()` function accepts `string` today):
 *
 *   function t<K extends TranslationKey>(
 *     key: K,
 *     vars?: K extends keyof TranslationVars ? TranslationVars[K] : never,
 *   ): string;
 */
export type TranslationVarsFor<K extends TranslationKey> =
  K extends keyof TranslationVars ? TranslationVars[K] : never;

// ---------------------------------------------------------------------------
// Typed `t` function signature (for documentation / future adoption)
// ---------------------------------------------------------------------------

/**
 * Strictly-typed version of the `t(key, vars?)` translation function
 * signature. Components may cast the existing `useI18n().t` to this type
 * to get compile-time key checking:
 *
 *   const { t } = useI18n();
 *   const typedT = t as TypedTranslateFn;
 *   typedT("nav.overview"); // OK
 *   typedT("nav.typo");     // TypeScript error
 */
export type TypedTranslateFn = <K extends TranslationKey>(
  key: K,
  vars?: K extends keyof TranslationVars
    ? TranslationVars[K]
    : Record<string, string | number>,
) => string;
