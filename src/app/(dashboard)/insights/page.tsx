"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles,
  RefreshCw,
  Clock,
  Lightbulb,
  TrendingUp,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface Insight {
  id: number;
  insightType: string;
  content: string;
  generatedAt: string;
  metadata: string | null;
}

function insightIcon(type: string) {
  switch (type) {
    case "weekly_summary":
      return TrendingUp;
    case "cost_optimization":
      return Lightbulb;
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

export default function InsightsPage() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t, dateLocale } = useI18n();

  const insightLabel = (type: string): string => {
    switch (type) {
      case "weekly_summary":
        return t("insight.weeklySummary");
      case "cost_optimization":
        return t("insight.costOptimization");
      case "anomaly":
        return t("insight.anomaly");
      case "user_insight":
        return t("insight.userInsight");
      default:
        return t("insight.default");
    }
  };

  const fetchInsights = () => {
    setLoading(true);
    fetch("/api/v1/ai-insights?limit=20")
      .then((r) => r.json())
      .then((data) => setInsights(data.insights || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchInsights();
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/ai-insights/generate", {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        fetchInsights();
      } else {
        setError(data.error || t("page.insights.generationFailed"));
      }
    } catch {
      setError(t("common.networkError"));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <Header
        title={t("page.insights.title")}
        description={t("page.insights.description")}
        onRefresh={fetchInsights}
        isRefreshing={loading}
      />
      <div className="dashboard-content">
        <div className="flex items-center justify-between">
          <h2 className="text-h2 text-foreground">{t("page.insights.heading")}</h2>
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
            {generating ? t("page.insights.generating") : t("page.insights.generate")}
          </Button>
        </div>

        {error && (
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

        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        ) : insights.length === 0 ? (
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
        ) : (
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
                          <Badge variant="secondary" className="text-xs">
                            {insightLabel(insight.insightType)}
                          </Badge>
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
        )}
      </div>
    </>
  );
}
