"use client";

import { useEffect, useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { ModelCostChart } from "@/components/dashboard/model-cost-chart";
import { CostTrendChart } from "@/components/dashboard/cost-trend-chart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, Zap, TrendingDown, BarChart3 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface ModelUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  cost: number;
  requestCount: number;
  costShare: number;
}

interface ModelUsageData {
  usage: ModelUsage[];
  totalCost: number;
  totalTokens: number;
  period: string;
}

interface ModelCostData {
  trend: Array<Record<string, number | string>>;
  models: string[];
  period: string;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function shortModelName(model: string): string {
  if (model.includes("opus")) return "Opus";
  if (model.includes("sonnet")) return "Sonnet";
  if (model.includes("haiku")) return "Haiku";
  return model.split("-").slice(0, 2).join("-");
}

function CostEfficiencyBadge({
  costPerKToken,
  highLabel,
  mediumLabel,
  lowLabel,
}: {
  costPerKToken: number;
  highLabel: string;
  mediumLabel: string;
  lowLabel: string;
}) {
  if (costPerKToken < 0.001)
    return <Badge className="bg-green-100 text-green-800">{highLabel}</Badge>;
  if (costPerKToken < 0.01)
    return <Badge className="bg-yellow-100 text-yellow-800">{mediumLabel}</Badge>;
  return <Badge className="bg-red-100 text-red-800">{lowLabel}</Badge>;
}

export default function ModelsPage() {
  const [usageData, setUsageData] = useState<ModelUsageData | null>(null);
  const [costData, setCostData] = useState<ModelCostData | null>(null);
  const [period, setPeriod] = useState("30d");
  const [loading, setLoading] = useState(true);
  const { t } = useI18n();

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/v1/models/usage?period=${period}`).then((r) => r.json()),
      fetch(`/api/v1/models/cost?period=${period}`).then((r) => r.json()),
    ])
      .then(([usage, cost]) => {
        setUsageData(usage);
        setCostData(cost);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [period]);

  const pieData = useMemo(
    () =>
      usageData?.usage.map((u) => ({
        model: u.model,
        inputTokens: u.inputTokens,
        outputTokens: u.outputTokens,
        cost: u.cost,
      })) || [],
    [usageData?.usage]
  );

  return (
    <>
      <Header
        title={t("page.models.title")}
        description={t("page.models.description")}
      />
      <div className="dashboard-content">
        <div className="flex items-center justify-between">
          <h2 className="text-h2 text-foreground">{t("page.models.heading")}</h2>
          <Tabs value={period} onValueChange={setPeriod}>
            <TabsList>
              <TabsTrigger value="7d">{t("common.period.7d")}</TabsTrigger>
              <TabsTrigger value="30d">{t("common.period.30d")}</TabsTrigger>
              <TabsTrigger value="90d">{t("common.period.90d")}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {loading ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-80 rounded-xl" />
              <Skeleton className="h-80 rounded-xl" />
            </div>
            <Skeleton className="h-72 rounded-xl" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="kpi-card">
                <div className="kpi-icon"><DollarSign className="h-4 w-4" /></div>
                <div className="kpi-value" data-slot="kpi-value">
                  ${(usageData?.totalCost || 0).toFixed(3)}
                </div>
                <div className="kpi-label">{t("page.models.totalCost")}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-icon"><Zap className="h-4 w-4" /></div>
                <div className="kpi-value" data-slot="kpi-value">
                  {formatNumber(usageData?.totalTokens || 0)}
                </div>
                <div className="kpi-label">{t("page.models.totalTokens")}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-icon"><BarChart3 className="h-4 w-4" /></div>
                <div className="kpi-value" data-slot="kpi-value">
                  {usageData?.usage.length || 0}
                </div>
                <div className="kpi-label">{t("page.models.modelCount")}</div>
              </div>
            </div>

            {/* Pie chart + cost efficiency table */}
            <div className="grid gap-4 md:grid-cols-2">
              <ModelCostChart key={`pie-${period}`} data={pieData} />

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingDown className="h-5 w-5" />
                    {t("page.models.costEfficiency")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {usageData?.usage.map((u) => {
                      const totalTokens = u.inputTokens + u.outputTokens;
                      const costPerKToken =
                        totalTokens > 0 ? (u.cost / totalTokens) * 1000 : 0;
                      return (
                        <div
                          key={u.model}
                          className="flex items-center justify-between rounded-md border px-3 py-2"
                        >
                          <div>
                            <p className="text-sm font-medium">
                              {shortModelName(u.model)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatNumber(totalTokens)} tokens
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-right">
                              <p className="text-sm font-mono font-medium text-emerald-600">
                                ${u.cost.toFixed(4)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {u.costShare.toFixed(1)}%
                              </p>
                            </div>
                            <CostEfficiencyBadge
                              costPerKToken={costPerKToken}
                              highLabel={t("page.models.highEfficiency")}
                              mediumLabel={t("page.models.mediumEfficiency")}
                              lowLabel={t("page.models.lowEfficiency")}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Daily cost trend */}
            <CostTrendChart
              key={`trend-${period}`}
              trend={costData?.trend || []}
              models={costData?.models || []}
            />

            {/* Model detail table */}
            <Card>
              <CardHeader>
                <CardTitle>{t("page.models.tableTitle")}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                        <th className="px-4 py-3 text-left font-medium">{t("table.model")}</th>
                        <th className="px-4 py-3 text-right font-medium">{t("table.requests")}</th>
                        <th className="px-4 py-3 text-right font-medium">{t("table.inputTokens")}</th>
                        <th className="px-4 py-3 text-right font-medium">{t("table.outputTokens")}</th>
                        <th className="px-4 py-3 text-right font-medium">{t("table.cacheRead")}</th>
                        <th className="px-4 py-3 text-right font-medium">{t("table.cost")}</th>
                        <th className="px-4 py-3 text-right font-medium">{t("table.share")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usageData?.usage.map((u) => (
                        <tr
                          key={u.model}
                          className="border-b transition-colors hover:bg-muted/30 last:border-0"
                        >
                          <td className="px-4 py-3">
                            <div>
                              <p className="text-sm font-medium">{shortModelName(u.model)}</p>
                              <p className="text-xs text-muted-foreground">{u.model}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-sm">
                            {u.requestCount.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right text-sm">
                            {formatNumber(u.inputTokens)}
                          </td>
                          <td className="px-4 py-3 text-right text-sm">
                            {formatNumber(u.outputTokens)}
                          </td>
                          <td className="px-4 py-3 text-right text-sm">
                            {formatNumber(u.cacheReadTokens)}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-mono text-emerald-600">
                            ${u.cost.toFixed(4)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="progress-bar-track w-16">
                                <div
                                  className="progress-bar-fill"
                                  style={{ width: `${u.costShare}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {u.costShare.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
