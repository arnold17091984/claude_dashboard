"use client";

import { memo, useMemo } from "react";
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
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import { TrendingUp } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface CostTrendChartProps {
  trend: Array<Record<string, number | string>>;
  models: string[];
}

const MODEL_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function shortModelName(model: string): string {
  if (model.includes("opus")) return "Opus";
  if (model.includes("sonnet")) return "Sonnet";
  if (model.includes("haiku")) return "Haiku";
  return model.split("-").slice(0, 2).join("-");
}

export const CostTrendChart = memo(function CostTrendChart({
  trend,
  models,
}: CostTrendChartProps) {
  const { t } = useI18n();

  const chartConfig = useMemo(
    () =>
      Object.fromEntries(
        models.map((model, idx) => [
          model,
          {
            label: shortModelName(model),
            color: MODEL_COLORS[idx % MODEL_COLORS.length],
          },
        ])
      ),
    [models]
  );

  const chartData = useMemo(
    () =>
      trend.map((row) => {
        const entry: Record<string, number | string> = {
          date: String(row.date).slice(5),
        };
        for (const model of models) {
          entry[model] = Number(row[model] || 0);
        }
        return entry;
      }),
    [trend, models]
  );

  if (chartData.length === 0) {
    return (
      <div className="chart-card">
        <div className="chart-card-header">
          <div className="chart-card-title flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            {t("chart.costTrend.title")}
          </div>
        </div>
        <div className="chart-card-body flex items-center justify-center py-12">
          <p className="text-small text-muted-foreground">{t("common.noData")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <div>
          <div className="chart-card-title flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            {t("chart.costTrend.titleFull")}
          </div>
          <div className="chart-card-description">{t("chart.costTrend.description")}</div>
        </div>
      </div>
      <div className="chart-card-body">
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="date" tickLine={false} axisLine={false} />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `$${Number(v).toFixed(2)}`}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            {models.map((model, idx) => (
              <Area
                key={model}
                type="monotone"
                dataKey={model}
                name={shortModelName(model)}
                stroke={MODEL_COLORS[idx % MODEL_COLORS.length]}
                fill={MODEL_COLORS[idx % MODEL_COLORS.length]}
                fillOpacity={0.25}
                strokeWidth={2}
                stackId="cost"
              />
            ))}
          </AreaChart>
        </ChartContainer>
      </div>
    </div>
  );
});
