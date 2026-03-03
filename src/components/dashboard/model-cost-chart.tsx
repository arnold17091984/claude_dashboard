"use client";

import { Cell, Pie, PieChart, Legend } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useI18n } from "@/lib/i18n";

interface ModelUsage {
  model: string | null;
  inputTokens: number | string | null;
  outputTokens: number | string | null;
  cost: number | string | null;
}

const COLORS = [
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

export function ModelCostChart({ data }: { data: ModelUsage[] }) {
  const { t } = useI18n();

  const chartData = data
    .filter((d) => d.model)
    .map((d) => ({
      name: shortModelName(d.model!),
      cost: Number(d.cost || 0),
      tokens: Number(d.inputTokens || 0) + Number(d.outputTokens || 0),
    }));

  const chartConfig = Object.fromEntries(
    chartData.map((d, i) => [
      d.name,
      { label: d.name, color: COLORS[i % COLORS.length] },
    ])
  );

  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <div>
          <div className="chart-card-title">{t("chart.modelCost.title")}</div>
          <div className="chart-card-description">{t("chart.modelCost.description")}</div>
        </div>
      </div>
      <div className="chart-card-body flex items-center justify-center">
        <ChartContainer config={chartConfig} className="h-[280px] w-full">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent />} />
            <Pie
              data={chartData}
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
              {chartData.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                  strokeWidth={0}
                />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
      </div>
    </div>
  );
}
