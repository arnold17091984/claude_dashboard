"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/header";
import { ToolCategoryChart } from "@/components/dashboard/tool-category-chart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Wrench, Bot, Code2, Cpu } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface CategorySummary {
  category: string;
  label: string;
  total: number;
}

interface ToolEntry {
  toolName: string | null;
  count: number;
}

interface SkillEntry {
  skillName: string | null;
  count: number;
}

interface SubagentEntry {
  subagentType: string | null;
  count: number;
}

interface TrendEntry {
  date: string;
  toolCalls: number | null;
  sessions: number | null;
}

interface McpToolEntry {
  toolName: string | null;
  count: number;
}

interface ToolsData {
  categorySummary: CategorySummary[];
  allTools: ToolEntry[];
  skills: SkillEntry[];
  subagents: SubagentEntry[];
  builtins: ToolEntry[];
  mcpTools?: McpToolEntry[];
  period: string;
}

interface TrendData {
  trend: TrendEntry[];
  period: string;
}

export default function ToolsPage() {
  const [toolsData, setToolsData] = useState<ToolsData | null>(null);
  const [trendData, setTrendData] = useState<TrendData | null>(null);
  const [period, setPeriod] = useState("30d");
  const [loading, setLoading] = useState(true);
  const { t } = useI18n();

  const trendChartConfig = {
    toolCalls: { label: t("chart.toolCalls"), color: "var(--chart-1)" },
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/v1/tools/usage?period=${period}`).then((r) => r.json()),
      fetch(`/api/v1/tools/trend?period=${period}`).then((r) => r.json()),
    ])
      .then(([tools, trend]) => {
        setToolsData(tools);
        setTrendData(trend);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [period]);

  const trendChartData =
    trendData?.trend.map((r) => ({
      date: r.date.slice(5),
      toolCalls: Number(r.toolCalls || 0),
    })) || [];

  return (
    <>
      <Header
        title={t("page.tools.title")}
        description={t("page.tools.description")}
      />
      <div className="dashboard-content">
        <div className="flex items-center justify-between">
          <h2 className="text-h2 text-foreground">{t("page.tools.heading")}</h2>
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
            <div className="grid gap-3 sm:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Category charts */}
            <ToolCategoryChart
              categorySummary={toolsData?.categorySummary || []}
              topTools={toolsData?.allTools || []}
            />

            {/* Tool usage trend */}
            <div className="chart-card">
              <div className="chart-card-header">
                <div className="chart-card-title">{t("page.tools.trendTitle")}</div>
              </div>
              <div className="chart-card-body">
                <ChartContainer config={trendChartConfig} className="h-[250px] w-full">
                  <AreaChart data={trendChartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="toolcalls-trend-gradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area
                      type="monotone"
                      dataKey="toolCalls"
                      stroke="var(--chart-1)"
                      fill="url(#toolcalls-trend-gradient)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ChartContainer>
              </div>
            </div>

            {/* Skills & subagents */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Code2 className="h-5 w-5" />
                    {t("page.tools.skills")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {toolsData?.skills.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("page.tools.noSkillData")}</p>
                  ) : (
                    <div className="space-y-2">
                      {toolsData?.skills
                        .filter((s) => s.skillName)
                        .map((skill) => (
                          <div
                            key={skill.skillName}
                            className="flex items-center justify-between rounded-md border px-3 py-2"
                          >
                            <div className="flex items-center gap-2">
                              <Wrench className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm font-medium">
                                {skill.skillName}
                              </span>
                            </div>
                            <Badge variant="secondary">{skill.count.toLocaleString()}</Badge>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="h-5 w-5" />
                    {t("page.tools.subagents")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {toolsData?.subagents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t("page.tools.noSubagentData")}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {toolsData?.subagents
                        .filter((s) => s.subagentType)
                        .map((subagent) => (
                          <div
                            key={subagent.subagentType}
                            className="flex items-center justify-between rounded-md border px-3 py-2"
                          >
                            <div className="flex items-center gap-2">
                              <Cpu className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm font-medium">
                                {subagent.subagentType}
                              </span>
                            </div>
                            <Badge variant="secondary">
                              {subagent.count.toLocaleString()}
                            </Badge>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* MCP tools */}
            {toolsData?.mcpTools && toolsData.mcpTools.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Cpu className="h-5 w-5" />
                    {t("page.tools.mcpTools")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {toolsData.mcpTools
                      .filter((t) => t.toolName)
                      .map((tool) => {
                        const parts = tool.toolName!.replace("mcp__", "").split("__");
                        const server = parts[0] || "";
                        const method = parts.slice(1).join("__") || "";
                        return (
                          <div
                            key={tool.toolName}
                            className="flex items-center justify-between rounded-md border px-3 py-2"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">
                                {method || tool.toolName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {server}
                              </p>
                            </div>
                            <Badge variant="secondary" className="ml-2 shrink-0">
                              {tool.count.toLocaleString()}
                            </Badge>
                          </div>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </>
  );
}
