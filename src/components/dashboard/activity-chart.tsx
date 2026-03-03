"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useI18n } from "@/lib/i18n";

interface DailyActivity {
  date: string;
  sessions: number | null;
  messages: number | null;
  toolCalls: number | null;
  cost: number | null;
}

export function ActivityChart({ data }: { data: DailyActivity[] }) {
  const { t } = useI18n();

  const chartConfig = {
    sessions: { label: t("chart.sessions"), color: "var(--chart-1)" },
    toolCalls: { label: t("chart.toolCalls"), color: "var(--chart-3)" },
  };

  const chartData = data.map((d) => ({
    date: d.date,
    sessions: Number(d.sessions || 0),
    toolCalls: Number(d.toolCalls || 0),
  }));

  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <div>
          <div className="chart-card-title">{t("chart.activity.title")}</div>
          <div className="chart-card-description">{t("chart.activity.description")}</div>
        </div>
      </div>
      <div className="chart-card-body">
        <ChartContainer config={chartConfig} className="h-[280px] w-full">
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="sessions-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="toolcalls-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--chart-3)" stopOpacity={0.2} />
                <stop offset="95%" stopColor="var(--chart-3)" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(v) => v.slice(5)}
              tickLine={false}
              axisLine={false}
            />
            <YAxis tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area
              type="monotone"
              dataKey="sessions"
              stroke="var(--chart-1)"
              fill="url(#sessions-gradient)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="toolCalls"
              stroke="var(--chart-3)"
              fill="url(#toolcalls-gradient)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </div>
    </div>
  );
}
