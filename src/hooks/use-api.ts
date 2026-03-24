"use client";

import useSWR, { type SWRConfiguration } from "swr";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = new Error("API request failed");
    (error as Error & { status: number }).status = res.status;
    throw error;
  }
  return res.json();
};

// Default SWR config for dashboard data
const defaultConfig: SWRConfiguration = {
  revalidateOnFocus: false,       // Don't refetch when tab gets focus
  revalidateOnReconnect: true,    // Refetch when network reconnects
  dedupingInterval: 10_000,       // Deduplicate requests within 10s
  errorRetryCount: 2,             // Retry failed requests twice
  keepPreviousData: true,         // Show stale data while revalidating (no flash)
};

/**
 * Generic API hook with SWR caching.
 * Deduplicates requests, caches results, and revalidates in background.
 */
export function useApi<T>(
  url: string | null,
  config?: SWRConfiguration
) {
  return useSWR<T>(url, fetcher, { ...defaultConfig, ...config });
}

/**
 * API hook for overview dashboard data.
 * Cached per period. Stale-while-revalidate pattern.
 */
export function useOverview(period: string) {
  return useApi<{
    kpi: {
      totalUsers: number;
      totalSessions: number;
      recentSessions: number;
      totalInputTokens: number;
      totalOutputTokens: number;
      totalCacheReadTokens: number;
      totalCost: number;
    };
    dailyActivity: Array<{
      date: string;
      sessions: number | null;
      messages: number | null;
      toolCalls: number | null;
      cost: number | null;
    }>;
    topTools: Array<{ toolName: string | null; count: number }>;
    topModels: Array<{
      model: string | null;
      inputTokens: number | string | null;
      outputTokens: number | string | null;
      cost: number | string | null;
    }>;
    topProjects?: Array<{ projectName: string | null; count: number }>;
    period: string;
  }>(`/api/v1/overview?period=${period}`);
}

/**
 * API hook for ranking data.
 */
export function useRanking(period: string, sortBy: string) {
  return useApi(`/api/v1/ranking?period=${period}&sortBy=${sortBy}`);
}

/**
 * API hook for users list.
 */
export function useUsers() {
  return useApi(`/api/v1/users`);
}

/**
 * API hook for user detail.
 */
export function useUserDetail(userId: string | null, period: string) {
  return useApi(userId ? `/api/v1/users/${userId}?period=${period}` : null);
}

/**
 * API hook for sessions list (paginated).
 */
export function useSessions(period: string, page: number, limit = 20, date?: string) {
  const dateParam = date ? `&date=${date}` : "";
  return useApi(`/api/v1/sessions?period=${period}&page=${page}&limit=${limit}${dateParam}`);
}

/**
 * API hook for session detail.
 */
export function useSessionDetail(sessionId: string | null) {
  return useApi(sessionId ? `/api/v1/sessions/${sessionId}` : null);
}

/**
 * API hook for tools data (usage + trend in parallel via SWR).
 */
export function useToolsUsage(period: string) {
  return useApi(`/api/v1/tools/usage?period=${period}`);
}

export function useToolsTrend(period: string) {
  return useApi(`/api/v1/tools/trend?period=${period}`);
}

/**
 * API hook for models data (usage + cost in parallel via SWR).
 */
export function useModelsUsage(period: string) {
  return useApi(`/api/v1/models/usage?period=${period}`);
}

export function useModelsCost(period: string) {
  return useApi(`/api/v1/models/cost?period=${period}`);
}

/**
 * API hook for projects.
 */
export function useProjects(period: string) {
  return useApi(`/api/v1/projects?period=${period}`);
}

/**
 * API hook for AI insights.
 */
export function useInsights(filter?: string) {
  const params = new URLSearchParams({ limit: "20" });
  if (filter) params.set("type", filter);
  return useApi(`/api/v1/ai-insights?${params.toString()}`);
}
