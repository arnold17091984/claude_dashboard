"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Cell, Pie, PieChart } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  ArrowLeft,
  Clock,
  FolderGit2,
  GitBranch,
  MessageSquare,
  Wrench,
  DollarSign,
  User,
  Cpu,
  Zap,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface SessionDetail {
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

interface ToolUsage {
  toolName: string | null;
  count: number;
}

interface TokenStat {
  model: string;
  inputTokens: string | null;
  outputTokens: string | null;
  cost: string | null;
}

interface SessionDetailData {
  session: SessionDetail;
  toolUsage: ToolUsage[];
  tokenStats: TokenStat[];
}

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

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
  return parts.at(-1) || name;
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

function MetaRow({
  icon,
  label,
  value,
}: Readonly<{
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}>) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>
      <span className="w-28 shrink-0 text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

export default function SessionDetailPage() {
  const params = useParams();
  const sessionId = params.id as string;
  const [data, setData] = useState<SessionDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const { t, dateLocale } = useI18n();

  useEffect(() => {
    setLoading(true);
    fetch(`/api/v1/sessions/${sessionId}`)
      .then((r) => {
        if (r.status === 404) {
          setNotFound(true);
          return null;
        }
        return r.json();
      })
      .then((d) => {
        if (d) setData(d);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return (
      <>
        <Header title={t("page.sessionDetail.title")} description={t("common.loading")} />
        <div className="dashboard-content">
          <Skeleton className="h-10 w-40 rounded-lg" />
          <Skeleton className="h-48 rounded-xl" />
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-72 rounded-xl" />
            <Skeleton className="h-72 rounded-xl" />
          </div>
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </>
    );
  }

  if (notFound || !data?.session) {
    return (
      <>
        <Header
          title={t("page.sessionDetail.title")}
          description={t("page.sessionDetail.notFound")}
        />
        <div className="dashboard-content">
          <Link href="/sessions">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("page.sessionDetail.backToSessions")}
            </Button>
          </Link>
          <p className="text-muted-foreground">{t("page.sessionDetail.notFoundDesc")}</p>
        </div>
      </>
    );
  }

  const { session, toolUsage, tokenStats } = data;

  const totalCost = tokenStats.reduce((sum, s) => sum + Number(s.cost || 0), 0);
  const totalInputTokens = tokenStats.reduce((sum, s) => sum + Number(s.inputTokens || 0), 0);
  const totalOutputTokens = tokenStats.reduce((sum, s) => sum + Number(s.outputTokens || 0), 0);

  const pieData = tokenStats
    .filter((s) => s.model)
    .map((s) => ({
      name: shortModelName(s.model),
      cost: Number(s.cost || 0),
    }))
    .filter((d) => d.cost > 0);

  const pieConfig = Object.fromEntries(
    pieData.map((d, i) => [
      d.name,
      { label: d.name, color: CHART_COLORS[i % CHART_COLORS.length] },
    ])
  );

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString(dateLocale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  return (
    <>
      <Header
        title={t("page.sessionDetail.title")}
        description={
          session.projectName
            ? formatProjectName(session.projectName)
            : session.id
        }
      />
      <div className="dashboard-content">
        {/* Back button */}
        <Link href="/sessions">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("page.sessionDetail.backToSessions")}
          </Button>
        </Link>

        {/* KPI summary row */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="kpi-card">
            <div className="kpi-icon"><Clock className="h-4 w-4" /></div>
            <div className="kpi-value">
              {session.durationMs ? formatDuration(session.durationMs) : "—"}
            </div>
            <div className="kpi-label">{t("page.sessionDetail.duration")}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon"><MessageSquare className="h-4 w-4" /></div>
            <div className="kpi-value">{session.messageCount ?? 0}</div>
            <div className="kpi-label">{t("page.sessionDetail.messages")}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon"><Wrench className="h-4 w-4" /></div>
            <div className="kpi-value">{session.toolCallCount ?? 0}</div>
            <div className="kpi-label">{t("page.sessionDetail.toolCalls")}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon"><DollarSign className="h-4 w-4" /></div>
            <div className="kpi-value">${totalCost.toFixed(4)}</div>
            <div className="kpi-label">{t("page.sessionDetail.totalCost")}</div>
          </div>
        </div>

        {/* Session metadata */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderGit2 className="h-5 w-5" />
              {t("page.sessionDetail.metadata")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              <MetaRow
                icon={<FolderGit2 className="h-4 w-4" />}
                label={t("page.sessionDetail.project")}
                value={
                  session.projectName
                    ? formatProjectName(session.projectName)
                    : <span className="text-muted-foreground">{t("page.sessionDetail.unknown")}</span>
                }
              />
              {session.gitBranch && (
                <MetaRow
                  icon={<GitBranch className="h-4 w-4" />}
                  label={t("page.sessionDetail.branch")}
                  value={
                    <Badge variant="outline" className="text-xs font-mono">
                      {session.gitBranch}
                    </Badge>
                  }
                />
              )}
              {session.displayName && (
                <MetaRow
                  icon={<User className="h-4 w-4" />}
                  label={t("page.sessionDetail.user")}
                  value={
                    <Link
                      href={`/users/${session.userId}`}
                      className="hover:underline text-primary"
                    >
                      {session.displayName}
                    </Link>
                  }
                />
              )}
              {session.claudeVersion && (
                <MetaRow
                  icon={<Cpu className="h-4 w-4" />}
                  label={t("page.sessionDetail.model")}
                  value={
                    <span className="font-mono text-xs">
                      {session.claudeVersion}
                    </span>
                  }
                />
              )}
              <MetaRow
                icon={<Clock className="h-4 w-4" />}
                label={t("page.sessionDetail.started")}
                value={formatDate(session.startedAt)}
              />
              {session.endedAt && (
                <MetaRow
                  icon={<Clock className="h-4 w-4" />}
                  label={t("page.sessionDetail.ended")}
                  value={formatDate(session.endedAt)}
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Token usage + Cost breakdown */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Token usage by model table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                {t("page.sessionDetail.tokenUsage")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {tokenStats.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">
                  {t("common.noData")}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                        <th className="px-4 py-3 text-left font-medium">
                          {t("table.model")}
                        </th>
                        <th className="px-4 py-3 text-right font-medium">
                          {t("page.sessionDetail.inputTokens")}
                        </th>
                        <th className="px-4 py-3 text-right font-medium">
                          {t("page.sessionDetail.outputTokens")}
                        </th>
                        <th className="px-4 py-3 text-right font-medium">
                          {t("table.cost")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {tokenStats.map((stat) => (
                        <tr
                          key={stat.model}
                          className="border-b transition-colors hover:bg-muted/30 last:border-0"
                        >
                          <td className="px-4 py-3">
                            <div>
                              <p className="text-sm font-medium">
                                {shortModelName(stat.model)}
                              </p>
                              <p className="text-xs text-muted-foreground font-mono">
                                {stat.model}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-sm">
                            {formatNumber(Number(stat.inputTokens || 0))}
                          </td>
                          <td className="px-4 py-3 text-right text-sm">
                            {formatNumber(Number(stat.outputTokens || 0))}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-mono text-emerald-600">
                            ${Number(stat.cost || 0).toFixed(4)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t bg-muted/30 text-sm font-medium">
                        <td className="px-4 py-2">Total</td>
                        <td className="px-4 py-2 text-right">
                          {formatNumber(totalInputTokens)}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {formatNumber(totalOutputTokens)}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-emerald-600">
                          ${totalCost.toFixed(4)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cost breakdown pie chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                {t("page.sessionDetail.costByModel")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              {pieData.length === 0 ? (
                <p className="py-8 text-sm text-muted-foreground">
                  {t("common.noData")}
                </p>
              ) : (
                <ChartContainer config={pieConfig} className="h-[260px] w-full">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Pie
                      data={pieData}
                      dataKey="cost"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      innerRadius={40}
                      paddingAngle={2}
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {pieData.map((entry, index) => (
                        <Cell
                          key={entry.name}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                          strokeWidth={0}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tool usage list */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              {t("page.sessionDetail.toolUsage")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {toolUsage.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">
                {t("page.sessionDetail.noTools")}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                      <th className="px-4 py-3 text-left font-medium">
                        {t("page.sessionDetail.tool")}
                      </th>
                      <th className="px-4 py-3 text-right font-medium">
                        {t("page.sessionDetail.count")}
                      </th>
                      <th className="px-4 py-3 text-right font-medium">
                        {t("common.ofTotal")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const total = toolUsage.reduce((s, tool) => s + tool.count, 0);
                      return toolUsage.map((tool) => {
                        const pct = total > 0 ? (tool.count / total) * 100 : 0;
                        return (
                          <tr
                            key={tool.toolName ?? "unknown"}
                            className="border-b transition-colors hover:bg-muted/30 last:border-0"
                          >
                            <td className="px-4 py-3 text-sm font-mono">
                              {tool.toolName ?? "—"}
                            </td>
                            <td className="px-4 py-3 text-right text-sm font-medium">
                              {tool.count.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="progress-bar-track w-16">
                                  <div
                                    className="progress-bar-fill"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="w-10 text-right text-xs text-muted-foreground">
                                  {pct.toFixed(1)}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
