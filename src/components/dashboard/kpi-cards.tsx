"use client";

import { Users, MessageSquare, Zap, DollarSign, TrendingUp } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface KPIData {
  totalUsers: number;
  totalSessions: number;
  recentSessions: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens?: number;
  totalCost: number;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatCost(n: number): string {
  return `$${n.toFixed(2)}`;
}

export function KPICards({ data }: { data: KPIData }) {
  const { t } = useI18n();

  const tokenDescription = data.totalCacheReadTokens
    ? `${t("kpi.cacheInputOutput")} ${formatNumber(data.totalInputTokens + data.totalOutputTokens)} / ${t("kpi.cache")} ${formatNumber(data.totalCacheReadTokens)}`
    : `${t("kpi.input")} ${formatNumber(data.totalInputTokens)} / ${t("kpi.output")} ${formatNumber(data.totalOutputTokens)}`;

  const cards = [
    {
      titleKey: "kpi.activeUsers",
      value: data.totalUsers.toString(),
      description: t("kpi.registeredUsers"),
      icon: Users,
      accentHue: "285",
    },
    {
      titleKey: "kpi.sessions",
      value: formatNumber(data.recentSessions),
      description: `${t("kpi.allPeriod")} ${formatNumber(data.totalSessions)}`,
      icon: MessageSquare,
      accentHue: "182",
    },
    {
      titleKey: "kpi.tokens",
      value: formatNumber(data.totalInputTokens + data.totalOutputTokens),
      description: tokenDescription,
      icon: Zap,
      accentHue: "60",
    },
    {
      titleKey: "kpi.estimatedCost",
      value: formatCost(data.totalCost),
      description: t("kpi.periodTotal"),
      icon: DollarSign,
      accentHue: "155",
    },
  ];

  return (
    <div className="kpi-grid">
      {cards.map((card) => (
        <div key={card.titleKey} className="kpi-card kpi-value-animate">
          <div className="flex items-center justify-between">
            <div className="kpi-icon">
              <card.icon className="h-4 w-4" />
            </div>
            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground/40" />
          </div>
          <div className="kpi-value" data-slot="kpi-value">
            {card.value}
          </div>
          <div className="kpi-label">{t(card.titleKey)}</div>
          <p className="text-small text-muted-foreground/70 mt-1 truncate">
            {card.description}
          </p>
        </div>
      ))}
    </div>
  );
}
