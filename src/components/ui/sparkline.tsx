"use client";

import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";

interface SparklineProps {
  data: number[];
  color?: string;
  /** Height in pixels */
  height?: number;
}

/**
 * A minimal sparkline that renders a tiny line chart with no axes.
 * Used inside KPI cards to show recent trend at a glance.
 */
export function Sparkline({ data, color = "var(--chart-1)", height = 40 }: Readonly<SparklineProps>) {
  if (data.length < 2) return null;

  const chartData = data.map((v, i) => ({ i, v }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
        <Tooltip
          content={() => null}
          cursor={false}
        />
        <Line
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
          activeDot={{ r: 2, fill: color, strokeWidth: 0 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
