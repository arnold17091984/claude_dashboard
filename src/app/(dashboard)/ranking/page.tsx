"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { usePeriod } from "@/hooks/use-period";
import { UserRankingTable } from "@/components/dashboard/user-ranking-table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Users, Wrench, DollarSign } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useRanking } from "@/hooks/use-api";

interface RankingEntry {
  rank: number;
  userId: string;
  displayName: string;
  email: string | null;
  team: string | null;
  avatarUrl: string | null;
  sessions: number;
  messages: number;
  toolCalls: number;
  cost: number;
  activeMinutes: number;
  topTool: string | null;
}

interface RankingData {
  ranking: RankingEntry[];
  period: string;
  sortBy: string;
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
}) {
  return (
    <div className="kpi-card">
      <div className="flex items-center justify-between">
        <div className="kpi-icon">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="kpi-value" data-slot="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
    </div>
  );
}

export default function RankingPage() {
  const [period, setPeriod] = usePeriod("30d");
  const [sortBy, setSortBy] = useState("cost");
  const { t } = useI18n();

  const { data, isLoading, isValidating, mutate } = useRanking(period, sortBy);

  const totalCost = (data as RankingData | undefined)?.ranking.reduce((acc, r) => acc + r.cost, 0) || 0;
  const totalSessions = (data as RankingData | undefined)?.ranking.reduce((acc, r) => acc + r.sessions, 0) || 0;

  return (
    <>
      <Header
        title={t("page.ranking.title")}
        description={t("page.ranking.description")}
        onRefresh={() => mutate()}
        isRefreshing={isValidating}
      />
      <div className="dashboard-content">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-h2 text-foreground">{t("page.ranking.heading")}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={period} onValueChange={setPeriod}>
              <TabsList>
                <TabsTrigger value="7d">{t("common.period.7d")}</TabsTrigger>
                <TabsTrigger value="30d">{t("common.period.30d")}</TabsTrigger>
                <TabsTrigger value="90d">{t("common.period.90d")}</TabsTrigger>
              </TabsList>
            </Tabs>
            <Tabs value={sortBy} onValueChange={setSortBy}>
              <TabsList>
                <TabsTrigger value="cost">{t("common.cost")}</TabsTrigger>
                <TabsTrigger value="sessions">{t("common.sessions")}</TabsTrigger>
                <TabsTrigger value="toolCalls">{t("common.toolUsage")}</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-64 rounded-xl" />
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard
                label={t("page.ranking.participants")}
                value={((data as RankingData | undefined)?.ranking.length || 0).toString()}
                icon={Users}
              />
              <StatCard
                label={t("page.ranking.totalSessions")}
                value={totalSessions.toLocaleString()}
                icon={Trophy}
              />
              <StatCard
                label={t("page.ranking.totalCost")}
                value={`$${totalCost.toFixed(3)}`}
                icon={DollarSign}
              />
            </div>

            <UserRankingTable data={(data as RankingData | undefined)?.ranking || []} />
          </>
        )}
      </div>
    </>
  );
}
