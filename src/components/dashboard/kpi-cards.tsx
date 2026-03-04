"use client";

import { Users, MessageSquare, Zap, DollarSign, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Sparkline } from "@/components/ui/sparkline";

interface KPIData {
  totalUsers: number;
  totalSessions: number;
  recentSessions: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens?: number;
  totalCost: number;
  /** Optional: daily activity series used to build sparklines & trends */
  dailyActivity?: Array<{
    sessions: number | null;
    toolCalls: number | null;
    cost: number | null;
  }>;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatCost(n: number): string {
  return `$${n.toFixed(2)}`;
}

/** Compute percent change between the first half and second half of an array. */
function computeTrend(values: number[]): number | null {
  if (values.length < 4) return null;
  const mid = Math.floor(values.length / 2);
  const prev = values.slice(0, mid).reduce((a, b) => a + b, 0);
  const curr = values.slice(mid).reduce((a, b) => a + b, 0);
  if (prev === 0) return curr > 0 ? 100 : null;
  return ((curr - prev) / prev) * 100;
}

interface TrendBadgeProps {
  pct: number | null;
}

function TrendBadge({ pct }: Readonly<TrendBadgeProps>) {
  const { t } = useI18n();

  if (pct === null) {
    return <Minus className="h-3.5 w-3.5 text-muted-foreground/40" />;
  }

  const abs = Math.abs(pct).toFixed(1);

  if (pct > 0) {
    return (
      <span className="kpi-delta kpi-delta--positive flex items-center gap-0.5">
        <TrendingUp className="h-3 w-3" />
        {t("kpi.trend.up", { pct: abs })}
      </span>
    );
  }

  if (pct < 0) {
    return (
      <span className="kpi-delta kpi-delta--negative flex items-center gap-0.5">
        <TrendingDown className="h-3 w-3" />
        {t("kpi.trend.down", { pct: abs })}
      </span>
    );
  }

  return (
    <span className="kpi-delta kpi-delta--neutral flex items-center gap-0.5">
      <Minus className="h-3 w-3" />
      {t("kpi.trend.neutral")}
    </span>
  );
}

export function KPICards({ data }: Readonly<{ data: KPIData }>) {
  const { t } = useI18n();

  const tokenDescription = data.totalCacheReadTokens
    ? `${t("kpi.cacheInputOutput")} ${formatNumber(data.totalInputTokens + data.totalOutputTokens)} / ${t("kpi.cache")} ${formatNumber(data.totalCacheReadTokens)}`
    : `${t("kpi.input")} ${formatNumber(data.totalInputTokens)} / ${t("kpi.output")} ${formatNumber(data.totalOutputTokens)}`;

  // Build sparkline series from daily activity
  const sessionSeries = (data.dailyActivity ?? []).map((d) => Number(d.sessions ?? 0));
  const costSeries = (data.dailyActivity ?? []).map((d) => Number(d.cost ?? 0));

  const sessionTrend = computeTrend(sessionSeries);
  const costTrend = computeTrend(costSeries);

  const cards = [
    {
      titleKey: "kpi.activeUsers",
      value: data.totalUsers.toString(),
      description: t("kpi.registeredUsers"),
      icon: Users,
      accentHue: "285",
      sparkData: null as number[] | null,
      trend: null as number | null,
    },
    {
      titleKey: "kpi.sessions",
      value: formatNumber(data.recentSessions),
      description: `${t("kpi.allPeriod")} ${formatNumber(data.totalSessions)}`,
      icon: MessageSquare,
      accentHue: "182",
      sparkData: sessionSeries.length >= 2 ? sessionSeries : null,
      trend: sessionTrend,
    },
    {
      titleKey: "kpi.tokens",
      value: formatNumber(data.totalInputTokens + data.totalOutputTokens),
      description: tokenDescription,
      icon: Zap,
      accentHue: "60",
      sparkData: null as number[] | null,
      trend: null as number | null,
    },
    {
      titleKey: "kpi.estimatedCost",
      value: formatCost(data.totalCost),
      description: t("kpi.periodTotal"),
      icon: DollarSign,
      accentHue: "155",
      sparkData: costSeries.length >= 2 ? costSeries : null,
      trend: costTrend,
    },
  ];

  return (
    <div className="kpi-grid">
      {cards.map((card) => (
        <div key={card.titleKey} className="kpi-card kpi-value-animate">
          <div className="flex items-start justify-between gap-2">
            <div className="kpi-icon">
              <card.icon className="h-4 w-4" />
            </div>
            {/* Sparkline — only rendered when series data is available */}
            {card.sparkData && (
              <div className="w-20 shrink-0 opacity-70">
                <Sparkline
                  data={card.sparkData}
                  color={`oklch(0.550 0.160 ${card.accentHue})`}
                  height={36}
                />
              </div>
            )}
          </div>
          <div className="kpi-value" data-slot="kpi-value">
            {card.value}
          </div>
          <div className="kpi-label">{t(card.titleKey)}</div>
          <p className="text-small text-muted-foreground/70 mt-1 truncate">
            {card.description}
          </p>
          {/* Trend badge */}
          <div className="mt-2">
            <TrendBadge pct={card.trend} />
          </div>
        </div>
      ))}
    </div>
  );
}
