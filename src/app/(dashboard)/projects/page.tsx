"use client";

import { Header } from "@/components/layout/header";
import { usePeriod } from "@/hooks/use-period";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  FolderGit2,
  Users,
  DollarSign,
  MessageSquare,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useProjects } from "@/hooks/use-api";

interface ProjectEntry {
  projectName: string | null;
  sessionCount: number;
  totalMessages: number;
  totalToolCalls: number;
  totalDurationMs: number;
  lastUsed: string;
  userCount: number;
  cost: number;
}

interface ProjectsData {
  projects: ProjectEntry[];
  period: string;
}

function formatProjectName(name: string | null): string {
  if (!name) return "unknown";
  const parts = name.split("-").filter(Boolean);
  const docsIdx = parts.indexOf("Documents");
  if (docsIdx >= 0 && docsIdx < parts.length - 1) {
    return parts.slice(docsIdx + 1).join("-");
  }
  return parts[parts.length - 1] || name;
}

function formatDuration(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export default function ProjectsPage() {
  const [period, setPeriod] = usePeriod("30d");
  const { t, dateLocale } = useI18n();

  const { data: rawData, isLoading, isValidating, mutate } = useProjects(period);
  const data = rawData as ProjectsData | undefined;

  const chartConfig = {
    sessionCount: { label: t("page.projects.sessionCount"), color: "var(--chart-1)" },
  };

  const totalCost = data?.projects.reduce((s, p) => s + p.cost, 0) || 0;
  const totalSessions = data?.projects.reduce((s, p) => s + p.sessionCount, 0) || 0;

  const chartData = (data?.projects || []).slice(0, 12).map((p) => ({
    name: formatProjectName(p.projectName),
    sessionCount: p.sessionCount,
  }));

  return (
    <>
      <Header
        title={t("page.projects.title")}
        description={t("page.projects.description")}
        onRefresh={() => mutate()}
        isRefreshing={isValidating}
      />
      <div className="dashboard-content">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-h2 text-foreground">{t("page.projects.heading")}</h2>
          <Tabs value={period} onValueChange={setPeriod}>
            <TabsList>
              <TabsTrigger value="7d">{t("common.period.7d")}</TabsTrigger>
              <TabsTrigger value="30d">{t("common.period.30d")}</TabsTrigger>
              <TabsTrigger value="90d">{t("common.period.90d")}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-80 rounded-xl" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid gap-3 sm:grid-cols-3">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">{t("page.projects.count")}</p>
                      <p className="text-2xl font-bold">
                        {data?.projects.length || 0}
                      </p>
                    </div>
                    <FolderGit2 className="h-8 w-8 text-muted-foreground opacity-40" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">{t("page.projects.totalSessions")}</p>
                      <p className="text-2xl font-bold">{totalSessions}</p>
                    </div>
                    <MessageSquare className="h-8 w-8 text-muted-foreground opacity-40" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">{t("page.projects.totalCost")}</p>
                      <p className="text-2xl font-bold">
                        ${totalCost.toFixed(2)}
                      </p>
                    </div>
                    <DollarSign className="h-8 w-8 text-muted-foreground opacity-40" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sessions bar chart */}
            <Card>
              <CardHeader>
                <CardTitle>{t("page.projects.chartTitle")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[350px] w-full">
                  <BarChart data={chartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" fontSize={12} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={150}
                      fontSize={11}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar
                      dataKey="sessionCount"
                      fill="var(--chart-1)"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Project table */}
            <Card>
              <CardHeader>
                <CardTitle>{t("page.projects.tableTitle")}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                        <th className="px-4 py-3 text-left font-medium">
                          {t("table.project")}
                        </th>
                        <th className="px-4 py-3 text-right font-medium">
                          {t("table.sessions")}
                        </th>
                        <th className="px-4 py-3 text-right font-medium">
                          {t("table.users")}
                        </th>
                        <th className="px-4 py-3 text-right font-medium">
                          {t("table.messages")}
                        </th>
                        <th className="px-4 py-3 text-right font-medium">
                          {t("table.toolUsage")}
                        </th>
                        <th className="px-4 py-3 text-right font-medium">
                          {t("table.workTime")}
                        </th>
                        <th className="px-4 py-3 text-right font-medium">{t("table.cost")}</th>
                        <th className="px-4 py-3 text-right font-medium">
                          {t("table.lastUsed")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data?.projects.map((project) => (
                        <tr
                          key={project.projectName || "unknown"}
                          className="border-b transition-colors hover:bg-muted/30 last:border-0"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <FolderGit2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                              <span className="text-sm font-medium">
                                {formatProjectName(project.projectName)}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-medium">
                            {project.sessionCount}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Users className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm">{project.userCount}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-sm">
                            {formatNumber(project.totalMessages)}
                          </td>
                          <td className="px-4 py-3 text-right text-sm">
                            {formatNumber(project.totalToolCalls)}
                          </td>
                          <td className="px-4 py-3 text-right text-sm">
                            {project.totalDurationMs > 0
                              ? formatDuration(project.totalDurationMs)
                              : "-"}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-mono text-emerald-600">
                            ${project.cost.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                            {new Date(project.lastUsed).toLocaleDateString(
                              dateLocale,
                              { month: "short", day: "numeric" }
                            )}
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
