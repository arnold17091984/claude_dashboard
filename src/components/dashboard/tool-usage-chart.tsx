"use client";

import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Cell } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useI18n } from "@/lib/i18n";

interface ToolUsage {
  toolName: string | null;
  count: number;
}

const BAR_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

export function ToolUsageChart({ data }: { data: ToolUsage[] }) {
  const { t } = useI18n();

  const chartConfig = {
    count: { label: t("chart.usageCount"), color: "var(--chart-1)" },
  };

  const chartData = data
    .filter((d) => d.toolName)
    .map((d) => ({
      name: d.toolName!,
      count: d.count,
    }));

  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <div>
          <div className="chart-card-title">{t("chart.toolUsage.title")}</div>
          <div className="chart-card-description">{t("chart.toolUsage.description")}</div>
        </div>
      </div>
      <div className="chart-card-body">
        <ChartContainer config={chartConfig} className="h-[280px] w-full">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 4, left: 0, bottom: 0 }}
          >
            <CartesianGrid horizontal={false} />
            <XAxis type="number" tickLine={false} axisLine={false} />
            <YAxis
              type="category"
              dataKey="name"
              width={100}
              tickLine={false}
              axisLine={false}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {chartData.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={BAR_COLORS[index % BAR_COLORS.length]}
                  fillOpacity={1 - index * 0.07}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </div>
    </div>
  );
}
