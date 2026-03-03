"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, MessageSquare, DollarSign, Wrench } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface UserEntry {
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
  ranking: UserEntry[];
  period: string;
  sortBy: string;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export default function UsersPage() {
  const [data, setData] = useState<RankingData | null>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useI18n();

  useEffect(() => {
    fetch("/api/v1/ranking?period=90d&sortBy=cost")
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Header
        title={t("page.users.title")}
        description={t("page.users.description")}
      />
      <div className="dashboard-content">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-h2 text-foreground">{t("page.users.heading")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("page.users.count", { count: data?.ranking.length || 0 })}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : data?.ranking.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">{t("page.users.noUsers")}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data?.ranking.map((user) => (
              <Link key={user.userId} href={`/users/${user.userId}`}>
                <Card className="transition-colors hover:bg-muted/30">
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="text-sm">
                          {getInitials(user.displayName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {user.displayName}
                        </p>
                        {user.team && (
                          <Badge variant="outline" className="mt-0.5 text-xs">
                            {user.team}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                      <div>
                        <div className="flex items-center justify-center gap-1">
                          <MessageSquare className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {user.sessions}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          {t("common.sessions")}
                        </p>
                      </div>
                      <div>
                        <div className="flex items-center justify-center gap-1">
                          <Wrench className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {formatNumber(user.toolCalls)}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          {t("common.tools")}
                        </p>
                      </div>
                      <div>
                        <div className="flex items-center justify-center gap-1">
                          <DollarSign className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm font-mono font-medium text-emerald-600">
                            ${user.cost.toFixed(0)}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          {t("common.cost")}
                        </p>
                      </div>
                    </div>
                    {user.topTool && (
                      <div className="mt-3 flex items-center gap-1">
                        <span className="text-[10px] text-muted-foreground">
                          {t("page.users.topTool")}
                        </span>
                        <Badge variant="secondary" className="text-[10px]">
                          {user.topTool}
                        </Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
