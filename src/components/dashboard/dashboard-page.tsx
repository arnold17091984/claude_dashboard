"use client";

import { useEffect, useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { KPICards } from "./kpi-cards";
import { ActivityChart } from "./activity-chart";
import { ToolUsageChart } from "./tool-usage-chart";
import { ModelCostChart } from "./model-cost-chart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { FolderGit2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface OverviewData {
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
}

function formatProjectName(name: string): string {
  const parts = name.split("-").filter(Boolean);
  if (parts.length >= 3) {
    const docsIdx = parts.indexOf("Documents");
    if (docsIdx >= 0 && docsIdx < parts.length - 1) {
      return parts.slice(docsIdx + 1).join("-");
    }
  }
  return parts[parts.length - 1] || name;
}

export function DashboardPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [period, setPeriod] = useState("7d");
  const [loading, setLoading] = useState(true);
  const { t } = useI18n();

  useEffect(() => {
    setLoading(true);
    fetch(`/api/v1/overview?period=${period}`)
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [period]);

  // Derive filtered project list once per render (avoids repeated inline filter)
  const filteredProjects = useMemo(
    () => data?.topProjects?.filter((p) => p.projectName) ?? [],
    [data?.topProjects]
  );

  // Pre-compute max count for progress bar scaling
  const maxProjectCount = useMemo(
    () => filteredProjects[0]?.count || 1,
    [filteredProjects]
  );

  return (
    <>
      <Header title={t("page.overview.title")} description={t("page.overview.description")} />
      <div className="dashboard-content">
        {/* Section header with period tabs */}
        <div className="dashboard-section-header">
          <h2 className="text-h2 text-foreground">{t("page.overview.heading")}</h2>
          <Tabs value={period} onValueChange={setPeriod}>
            <TabsList>
              <TabsTrigger value="7d">{t("common.period.7d")}</TabsTrigger>
              <TabsTrigger value="30d">{t("common.period.30d")}</TabsTrigger>
              <TabsTrigger value="90d">{t("common.period.90d")}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* KPI cards skeleton */}
        {loading ? (
          <div className="kpi-grid">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="kpi-card h-36 skeleton" />
            ))}
          </div>
        ) : data ? (
          <>
            <KPICards data={data.kpi} />

            {/* Charts row 1 */}
            <div className="chart-grid-2">
              <div className="chart-enter">
                <ActivityChart key={`activity-${period}`} data={data.dailyActivity} />
              </div>
              <div className="chart-enter">
                <ToolUsageChart key={`tools-${period}`} data={data.topTools} />
              </div>
            </div>

            {/* Charts row 2 */}
            <div className="chart-grid-2">
              <div className="chart-enter">
                <ModelCostChart key={`models-${period}`} data={data.topModels} />
              </div>

              {filteredProjects.length > 0 && (
                <div className="chart-card chart-enter">
                  <div className="chart-card-header">
                    <div>
                      <div className="chart-card-title flex items-center gap-2">
                        <FolderGit2 className="h-4 w-4 text-muted-foreground" />
                        {t("page.overview.projectSessions")}
                      </div>
                      <div className="chart-card-description">
                        {t("page.overview.projectsDescription")}
                      </div>
                    </div>
                  </div>
                  <div className="chart-card-body">
                    <div className="space-y-3">
                      {filteredProjects.map((project) => {
                        const name = formatProjectName(project.projectName!);
                        const pct = (project.count / maxProjectCount) * 100;
                        return (
                          <div key={project.projectName} className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-body font-medium truncate max-w-[200px]">
                                {name}
                              </span>
                              <Badge variant="secondary" className="shrink-0">
                                {project.count}
                              </Badge>
                            </div>
                            <div className="progress-bar-track">
                              <div
                                className="progress-bar-fill"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center gap-4 py-20">
            <p className="text-h3 text-muted-foreground">
              {t("page.overview.noData")}
            </p>
            <p className="text-small text-muted-foreground/70">
              {t("page.overview.noDataHint")}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
