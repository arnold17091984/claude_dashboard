"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Area,
  AreaChart,
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
  MessageSquare,
  Wrench,
  DollarSign,
  Clock,
  FolderGit2,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface UserData {
  user: {
    id: string;
    displayName: string;
    email: string | null;
    team: string | null;
  };
  sessionHistory: Array<{
    id: string;
    projectName: string | null;
    startedAt: string;
    endedAt: string | null;
    durationMs: number | null;
    messageCount: number | null;
    toolCallCount: number | null;
  }>;
  dailyTrend: Array<{
    date: string;
    sessions: number | null;
    messages: number | null;
    toolCalls: number | null;
    cost: number | null;
  }>;
  toolDistribution: Array<{
    toolName: string | null;
    count: number;
  }>;
  tokenStats: Array<{
    model: string;
    inputTokens: string | null;
    outputTokens: string | null;
    cost: string | null;
  }>;
  period: string;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatDuration(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

function formatProjectName(name: string): string {
  const parts = name.split("-").filter(Boolean);
  const docsIdx = parts.indexOf("Documents");
  if (docsIdx >= 0 && docsIdx < parts.length - 1) {
    return parts.slice(docsIdx + 1).join("-");
  }
  return parts[parts.length - 1] || name;
}

function shortModelName(model: string): string {
  if (model.includes("opus")) return "Opus";
  if (model.includes("sonnet")) return "Sonnet";
  if (model.includes("haiku")) return "Haiku";
  return model.split("-").slice(0, 2).join("-");
}

function getInitials(name: string): string {
  return name.split(/\s+/).map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

export default function UserDetailPage() {
  const params = useParams();
  const userId = params.id as string;
  const [data, setData] = useState<UserData | null>(null);
  const [period, setPeriod] = useState("30d");
  const [loading, setLoading] = useState(true);
  const { t, dateLocale } = useI18n();

  const trendConfig = {
    sessions: { label: t("chart.sessions"), color: "var(--chart-1)" },
    toolCalls: { label: t("page.userDetail.toolUsageLabel"), color: "var(--chart-3)" },
  };

  const toolConfig = {
    count: { label: t("page.userDetail.usageCount"), color: "var(--chart-2)" },
  };

  useEffect(() => {
    setLoading(true);
    fetch(`/api/v1/users/${userId}?period=${period}`)
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userId, period]);

  if (loading) {
    return (
      <>
        <Header title={t("page.userDetail.title")} description={t("common.loading")} />
        <div className="dashboard-content">
          <Skeleton className="h-24 rounded-xl" />
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        </div>
      </>
    );
  }

  if (!data?.user) {
    return (
      <>
        <Header title={t("page.userDetail.title")} description={t("page.userDetail.notFound")} />
        <div className="flex-1 p-6">
          <p className="text-muted-foreground">{t("page.userDetail.notFoundDesc")}</p>
        </div>
      </>
    );
  }

  const totalCost = data.tokenStats.reduce((s, t) => s + Number(t.cost || 0), 0);
  const totalSessions = data.dailyTrend.reduce((s, d) => s + (d.sessions || 0), 0);
  const totalToolCalls = data.dailyTrend.reduce((s, d) => s + (d.toolCalls || 0), 0);

  const trendData = data.dailyTrend.map((d) => ({
    date: d.date.slice(5),
    sessions: d.sessions || 0,
    toolCalls: d.toolCalls || 0,
  }));

  const toolData = data.toolDistribution
    .filter((t) => t.toolName)
    .slice(0, 10)
    .map((t) => ({ name: t.toolName!, count: t.count }));

  return (
    <>
      <Header
        title={t("page.userDetail.title")}
        description={t("page.userDetail.usageOf", { name: data.user.displayName })}
      />
      <div className="dashboard-content">
        {/* User info + period selector */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="text-lg">
                {getInitials(data.user.displayName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-2xl font-bold">{data.user.displayName}</h2>
              {data.user.team && (
                <Badge variant="outline">{data.user.team}</Badge>
              )}
            </div>
          </div>
          <Tabs value={period} onValueChange={setPeriod}>
            <TabsList>
              <TabsTrigger value="7d">{t("common.period.7d")}</TabsTrigger>
              <TabsTrigger value="30d">{t("common.period.30d")}</TabsTrigger>
              <TabsTrigger value="90d">{t("common.period.90d")}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Summary cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{t("page.userDetail.sessions")}</p>
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
                  <p className="text-xs text-muted-foreground">{t("page.userDetail.toolUsage")}</p>
                  <p className="text-2xl font-bold">{formatNumber(totalToolCalls)}</p>
                </div>
                <Wrench className="h-8 w-8 text-muted-foreground opacity-40" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{t("page.userDetail.estimatedCost")}</p>
                  <p className="text-2xl font-bold">${totalCost.toFixed(2)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-muted-foreground opacity-40" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Trend + tool distribution */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t("page.userDetail.activityTrend")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={trendConfig} className="h-[250px] w-full">
                <AreaChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis fontSize={12} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="sessions"
                    stroke="var(--chart-1)"
                    fill="var(--chart-1)"
                    fillOpacity={0.3}
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="toolCalls"
                    stroke="var(--chart-3)"
                    fill="var(--chart-3)"
                    fillOpacity={0.1}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("page.userDetail.toolTop10")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={toolConfig} className="h-[250px] w-full">
                <BarChart data={toolData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" fontSize={12} />
                  <YAxis type="category" dataKey="name" width={100} fontSize={11} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="var(--chart-2)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        {/* Model cost + recent sessions */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t("page.userDetail.modelCost")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.tokenStats.map((stat) => {
                  const cost = Number(stat.cost || 0);
                  const pct = totalCost > 0 ? (cost / totalCost) * 100 : 0;
                  return (
                    <div key={stat.model} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {shortModelName(stat.model)}
                        </span>
                        <span className="text-sm font-mono text-emerald-600">
                          ${cost.toFixed(2)}
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                {t("page.userDetail.recentSessions")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[300px] overflow-y-auto">
                {data.sessionHistory.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">
                    {t("page.userDetail.noSessions")}
                  </p>
                ) : (
                  <div className="divide-y">
                    {data.sessionHistory.map((session) => (
                      <div
                        key={session.id}
                        className="flex items-center justify-between px-4 py-3 hover:bg-muted/30"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <FolderGit2 className="h-3 w-3 shrink-0 text-muted-foreground" />
                            <span className="truncate text-sm font-medium">
                              {session.projectName
                                ? formatProjectName(session.projectName)
                                : "unknown"}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {new Date(session.startedAt).toLocaleDateString(dateLocale, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            {session.durationMs
                              ? ` (${formatDuration(session.durationMs)})`
                              : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{session.messageCount || 0} msg</span>
                          <span>{session.toolCallCount || 0} tools</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
