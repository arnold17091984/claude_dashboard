"use client";

import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import { useI18n } from "@/lib/i18n";

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

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-yellow-400 text-xs font-bold text-yellow-900">
        1
      </span>
    );
  if (rank === 2)
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-300 text-xs font-bold text-gray-700">
        2
      </span>
    );
  if (rank === 3)
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-600 text-xs font-bold text-amber-100">
        3
      </span>
    );
  return (
    <span className="flex h-7 w-7 items-center justify-center text-sm font-medium text-muted-foreground">
      {rank}
    </span>
  );
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatCost(n: number): string {
  return `$${n.toFixed(3)}`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function UserRankingTable({ data }: { data: RankingEntry[] }) {
  const { t } = useI18n();

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">{t("common.noData")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          {t("page.ranking.tableTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                <th className="px-4 py-3 text-left font-medium">{t("table.rank")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("table.user")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("table.sessions")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("table.messages")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("table.toolUsage")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("table.cost")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("table.topTool")}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((entry) => (
                <tr
                  key={entry.userId}
                  className="border-b transition-colors hover:bg-muted/30 last:border-0"
                >
                  <td className="px-4 py-3">
                    <RankBadge rank={entry.rank} />
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/users/${entry.userId}`}
                      className="flex items-center gap-3 hover:underline"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {getInitials(entry.displayName)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium leading-none">
                          {entry.displayName}
                        </p>
                        {entry.team && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {entry.team}
                          </p>
                        )}
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-medium">
                      {formatNumber(entry.sessions)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-medium">
                      {formatNumber(entry.messages)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-medium">
                      {formatNumber(entry.toolCalls)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-mono font-medium text-emerald-600">
                      {formatCost(entry.cost)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {entry.topTool ? (
                      <Badge variant="secondary" className="text-xs">
                        {entry.topTool}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
