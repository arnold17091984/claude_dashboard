"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Clock,
  FolderGit2,
  MessageSquare,
  Wrench,
  ChevronLeft,
  ChevronRight,
  User,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface Session {
  id: string;
  userId: string;
  displayName: string | null;
  projectName: string | null;
  projectPath: string;
  gitBranch: string | null;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  messageCount: number | null;
  toolCallCount: number | null;
}

interface SessionsData {
  sessions: Session[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  period: string;
}

function formatDuration(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

function formatProjectName(name: string): string {
  const parts = name.split("-").filter(Boolean);
  const docsIdx = parts.indexOf("Documents");
  if (docsIdx >= 0 && docsIdx < parts.length - 1) {
    return parts.slice(docsIdx + 1).join("-");
  }
  return parts[parts.length - 1] || name;
}

function formatDate(dateStr: string, dateLocale: string): string {
  return new Date(dateStr).toLocaleDateString(dateLocale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SessionsPage() {
  const [data, setData] = useState<SessionsData | null>(null);
  const [period, setPeriod] = useState("30d");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const { t, dateLocale } = useI18n();

  const fetchData = useCallback(() => {
    setLoading(true);
    fetch(`/api/v1/sessions?period=${period}&page=${page}&limit=20`)
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [period, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset to page 1 when period changes
  useEffect(() => {
    setPage(1);
  }, [period]);

  const pagination = data?.pagination;

  return (
    <>
      <Header
        title={t("page.sessions.title")}
        description={t("page.sessions.description")}
        onRefresh={fetchData}
        isRefreshing={loading}
      />
      <div className="dashboard-content">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-h2 text-foreground">{t("page.sessions.heading")}</h2>
            {pagination && (
              <p className="mt-1 text-sm text-muted-foreground">
                {t("page.sessions.count", { count: pagination.total.toLocaleString() })}
              </p>
            )}
          </div>
          <Tabs value={period} onValueChange={setPeriod}>
            <TabsList>
              <TabsTrigger value="7d">{t("common.period.7d")}</TabsTrigger>
              <TabsTrigger value="30d">{t("common.period.30d")}</TabsTrigger>
              <TabsTrigger value="90d">{t("common.period.90d")}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : (
          <>
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {data?.sessions.length === 0 ? (
                    <EmptyState
                      icon={Clock}
                      title={t("page.sessions.noSessions")}
                      description={t("empty.hint")}
                    />
                  ) : (
                    data?.sessions.map((session) => (
                      <div
                        key={session.id}
                        className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/30"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <FolderGit2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="truncate text-sm font-medium">
                              {session.projectName
                                ? formatProjectName(session.projectName)
                                : "unknown"}
                            </span>
                            {session.gitBranch && (
                              <Badge variant="outline" className="text-xs shrink-0">
                                {session.gitBranch}
                              </Badge>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDate(session.startedAt, dateLocale)}
                            </span>
                            {session.durationMs && (
                              <span>{formatDuration(session.durationMs)}</span>
                            )}
                            {session.displayName && (
                              <Link
                                href={`/users/${session.userId}`}
                                className="flex items-center gap-1 hover:underline"
                              >
                                <User className="h-3 w-3" />
                                {session.displayName}
                              </Link>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <MessageSquare className="h-3.5 w-3.5" />
                            <span>{session.messageCount || 0}</span>
                          </div>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Wrench className="h-3.5 w-3.5" />
                            <span>{session.toolCallCount || 0}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  {t("common.prev")}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {t("page.sessions.pagination", {
                    page: pagination.page,
                    total: pagination.totalPages,
                  })}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {t("common.next")}
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
