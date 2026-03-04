"use client";

import { memo, useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Layers } from "lucide-react";
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

interface ToolCategoryChartProps {
  categorySummary: CategorySummary[];
  topTools: ToolEntry[];
}

const categoryColors: Record<string, string> = {
  builtin: "var(--chart-1)",
  skill: "var(--chart-2)",
  subagent: "var(--chart-3)",
  mcp: "var(--chart-4)",
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export const ToolCategoryChart = memo(function ToolCategoryChart({
  categorySummary,
  topTools,
}: ToolCategoryChartProps) {
  const { t } = useI18n();

  const chartConfig = useMemo(
    () => ({
      total: { label: t("chart.usageCount"), color: "var(--chart-1)" },
    }),
    [t]
  );

  const topToolConfig = useMemo(
    () => ({
      count: { label: t("chart.usageCount"), color: "var(--chart-2)" },
    }),
    [t]
  );

  const totalAll = useMemo(
    () => categorySummary.reduce((acc, c) => acc + c.total, 0),
    [categorySummary]
  );

  const topToolsData = useMemo(
    () =>
      topTools
        .filter((t) => t.toolName)
        .slice(0, 15)
        .map((t) => ({
          name: t.toolName!,
          count: t.count,
        })),
    [topTools]
  );

  return (
    <div className="space-y-4">
      {/* Category summary cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {categorySummary.map((cat) => (
          <div key={cat.category} className="kpi-card">
            <div
              className="kpi-icon"
              style={{
                background: `color-mix(in oklch, ${categoryColors[cat.category] || "var(--chart-5)"} 15%, var(--background))`,
                color: categoryColors[cat.category] || "var(--chart-5)",
              }}
            >
              <Layers className="h-4 w-4" />
            </div>
            <div className="kpi-value" data-slot="kpi-value">
              {formatNumber(cat.total)}
            </div>
            <div className="kpi-label">{cat.label}</div>
            <p className="text-small text-muted-foreground/70 mt-1">
              {totalAll > 0 ? ((cat.total / totalAll) * 100).toFixed(1) : "0"}%{" "}
              {t("common.ofTotal")}
            </p>
          </div>
        ))}
      </div>

      {/* Category proportion bar chart */}
      <div className="chart-card">
        <div className="chart-card-header">
          <div className="chart-card-title flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            {t("chart.toolCategory.categoryTitle")}
          </div>
        </div>
        <div className="chart-card-body">
          <ChartContainer config={chartConfig} className="h-[200px] w-full">
            <BarChart
              data={categorySummary}
              layout="vertical"
              margin={{ top: 0, right: 4, left: 0, bottom: 0 }}
            >
              <CartesianGrid horizontal={false} />
              <XAxis type="number" tickLine={false} axisLine={false} />
              <YAxis
                type="category"
                dataKey="label"
                width={120}
                tickLine={false}
                axisLine={false}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                {categorySummary.map((cat, idx) => (
                  <Cell
                    key={cat.category}
                    fill={categoryColors[cat.category] || `var(--chart-${idx + 1})`}
                  />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </div>
      </div>

      {/* Top tools bar chart */}
      <div className="chart-card">
        <div className="chart-card-header">
          <div className="chart-card-title">{t("chart.toolCategory.top15")}</div>
        </div>
        <div className="chart-card-body">
          <ChartContainer config={topToolConfig} className="h-[400px] w-full">
            <BarChart
              data={topToolsData}
              layout="vertical"
              margin={{ top: 0, right: 4, left: 0, bottom: 0 }}
            >
              <CartesianGrid horizontal={false} />
              <XAxis type="number" tickLine={false} axisLine={false} />
              <YAxis
                type="category"
                dataKey="name"
                width={130}
                tickLine={false}
                axisLine={false}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="var(--chart-2)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ChartContainer>
        </div>
      </div>
    </div>
  );
});
