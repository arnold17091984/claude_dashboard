"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles,
  RefreshCw,
  Clock,
  TrendingUp,
  AlertCircle,
  Loader2,
  Calendar,
  DollarSign,
  User,
  KeyRound,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useInsights } from "@/hooks/use-api";

interface Insight {
  id: number;
  insightType: string;
  targetUserId: string | null;
  content: string;
  generatedAt: string;
  metadata: string | null;
}

const INSIGHT_TYPES = [
  "weekly_summary",
  "daily_summary",
  "cost_optimization",
  "productivity_trend",
] as const;

type InsightTypeFilter = "all" | (typeof INSIGHT_TYPES)[number];

function insightIcon(type: string) {
  switch (type) {
    case "weekly_summary":
      return TrendingUp;
    case "daily_summary":
      return Calendar;
    case "cost_optimization":
      return DollarSign;
    case "productivity_trend":
      return TrendingUp;
    case "user_recommendation":
      return User;
    case "anomaly":
      return AlertCircle;
    default:
      return Sparkles;
  }
}

function formatDate(iso: string, dateLocale: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(dateLocale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ApiKeyBanner({ t }: Readonly<{ t: (key: string) => string }>) {
  return (
    <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
      <CardContent className="flex items-start gap-3 py-4">
        <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div>
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            {t("page.insights.apiKeySetup")}
          </p>
          <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
            {t("page.insights.apiKeySetupDesc")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function InsightsPage() {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupRequired, setSetupRequired] = useState(false);
  const [activeFilter, setActiveFilter] = useState<InsightTypeFilter>("all");
  const [generateType, setGenerateType] = useState<(typeof INSIGHT_TYPES)[number]>("weekly_summary");

  // User insight state
  const [userIdInput, setUserIdInput] = useState("");
  const [generatingUser, setGeneratingUser] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);

  const { t, dateLocale } = useI18n();

  const swrFilter = activeFilter === "all" ? undefined : activeFilter;
  const { data: rawData, isLoading: loading, isValidating, mutate } = useInsights(swrFilter);
  const insights: Insight[] = (rawData as { insights?: Insight[] } | undefined)?.insights || [];

  const insightLabel = (type: string): string => {
    switch (type) {
      case "weekly_summary":
        return t("insight.weeklySummary");
      case "daily_summary":
        return t("insight.dailySummary");
      case "cost_optimization":
        return t("insight.costOptimization");
      case "productivity_trend":
        return t("insight.productivityTrend");
      case "user_recommendation":
        return t("insight.userRecommendation");
      case "anomaly":
        return t("insight.anomaly");
      case "user_insight":
        return t("insight.userInsight");
      default:
        return t("insight.default");
    }
  };

  const handleFilterChange = (filter: InsightTypeFilter) => {
    setActiveFilter(filter);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setSetupRequired(false);
    try {
      const res = await fetch(
        `/api/v1/ai-insights/generate?type=${generateType}`,
        { method: "POST" }
      );
      const data = await res.json();
      if (data.success) {
        mutate();
      } else {
        setError(data.error || t("page.insights.generationFailed"));
        if (data.setupRequired) setSetupRequired(true);
      }
    } catch {
      setError(t("common.networkError"));
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateUserInsight = async () => {
    const userId = userIdInput.trim();
    if (!userId) return;
    setGeneratingUser(true);
    setUserError(null);
    setSetupRequired(false);
    try {
      const res = await fetch(
        `/api/v1/ai-insights/generate/user/${encodeURIComponent(userId)}`,
        { method: "POST" }
      );
      const data = await res.json();
      if (data.success) {
        setActiveFilter("all");
        mutate();
        setUserIdInput("");
      } else {
        setUserError(data.error || t("page.insights.generationFailed"));
        if (data.setupRequired) setSetupRequired(true);
      }
    } catch {
      setUserError(t("common.networkError"));
    } finally {
      setGeneratingUser(false);
    }
  };

  const typeFilterLabels: Record<InsightTypeFilter, string> = {
    all: t("page.insights.filterAll"),
    weekly_summary: t("insight.weeklySummary"),
    daily_summary: t("insight.dailySummary"),
    cost_optimization: t("insight.costOptimization"),
    productivity_trend: t("insight.productivityTrend"),
  };

  const generateTypeLabels: Record<(typeof INSIGHT_TYPES)[number], string> = {
    weekly_summary: t("insight.weeklySummary"),
    daily_summary: t("insight.dailySummary"),
    cost_optimization: t("insight.costOptimization"),
    productivity_trend: t("insight.productivityTrend"),
  };

  const renderInsightsList = () => {
    if (loading) {
      return (
        <div className="space-y-4">
          {["sk-1", "sk-2", "sk-3"].map((key) => (
            <Skeleton key={key} className="h-48 rounded-xl" />
          ))}
        </div>
      );
    }

    if (insights.length === 0) {
      return (
        <Card className="border-dashed border-2 border-muted bg-muted/20">
          <CardContent className="flex flex-col items-center justify-center gap-4 py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold">
                {t("page.insights.empty")}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("page.insights.emptyHint")}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("page.insights.apiKeyNote")}
              </p>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {insights.map((insight) => {
          const Icon = insightIcon(insight.insightType);
          return (
            <Card key={insight.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="secondary" className="text-xs">
                          {insightLabel(insight.insightType)}
                        </Badge>
                        {insight.targetUserId && (
                          <Badge variant="outline" className="text-xs">
                            <User className="mr-1 h-3 w-3" />
                            {insight.targetUserId}
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="mt-1 text-base">
                        {t("page.insights.reportTitle")}
                      </CardTitle>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatDate(insight.generatedAt, dateLocale)}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none text-sm text-foreground whitespace-pre-wrap">
                  {insight.content}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <Header
        title={t("page.insights.title")}
        description={t("page.insights.description")}
        onRefresh={() => mutate()}
        isRefreshing={isValidating}
      />
      <div className="dashboard-content">
        {/* Header row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-h2 text-foreground">{t("page.insights.heading")}</h2>
          <div className="flex items-center gap-2">
            <select
              value={generateType}
              onChange={(e) =>
                setGenerateType(e.target.value as (typeof INSIGHT_TYPES)[number])
              }
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {INSIGHT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {generateTypeLabels[type]}
                </option>
              ))}
            </select>
            <Button
              onClick={handleGenerate}
              disabled={generating}
              size="sm"
              className="gap-2"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {generating
                ? t("page.insights.generating")
                : t("page.insights.generate")}
            </Button>
          </div>
        </div>

        {/* API key setup banner */}
        {setupRequired && <ApiKeyBanner t={t} />}

        {/* Generation error */}
        {error && !setupRequired && (
          <Card className="border-destructive bg-destructive/5">
            <CardContent className="flex items-center gap-3 py-3">
              <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
              <div>
                <p className="text-sm font-medium text-destructive">
                  {t("page.insights.error")}
                </p>
                <p className="text-xs text-muted-foreground">{error}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("page.insights.apiKeyHint")}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* User insight section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4 text-primary" />
              {t("page.insights.userInsightTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                value={userIdInput}
                onChange={(e) => setUserIdInput(e.target.value)}
                placeholder={t("page.insights.userIdPlaceholder")}
                className="max-w-xs"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleGenerateUserInsight();
                }}
              />
              <Button
                onClick={handleGenerateUserInsight}
                disabled={generatingUser || !userIdInput.trim()}
                size="sm"
                variant="outline"
                className="gap-2"
              >
                {generatingUser ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {t("page.insights.generateUserInsight")}
              </Button>
            </div>
            {userError && (
              <p className="mt-2 text-xs text-destructive">{userError}</p>
            )}
          </CardContent>
        </Card>

        {/* Type filter tabs */}
        <div className="flex flex-wrap gap-2">
          {(["all", ...INSIGHT_TYPES] as InsightTypeFilter[]).map((filter) => (
            <Button
              key={filter}
              variant={activeFilter === filter ? "default" : "outline"}
              size="sm"
              onClick={() => handleFilterChange(filter)}
              className="h-8 text-xs"
            >
              {typeFilterLabels[filter]}
            </Button>
          ))}
        </div>

        {/* Insights list */}
        {renderInsightsList()}
      </div>
    </>
  );
}
