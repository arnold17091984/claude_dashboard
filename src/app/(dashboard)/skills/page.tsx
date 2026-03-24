"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { usePeriod } from "@/hooks/use-period";
import { useApi } from "@/hooks/use-api";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Wrench,
  Bot,
  Terminal,
  Package,
  ChevronDown,
  ChevronRight,
  BookOpen,
} from "lucide-react";

// ---- Types ----------------------------------------------------------------

interface SkillSummaryEntry {
  skillName: string;
  userCount: number;
  totalCalls: number;
}

interface SubagentSummaryEntry {
  subagentType: string;
  userCount: number;
  totalCalls: number;
}

interface UserProficiencyEntry {
  userId: string;
  displayName: string;
  distinctSkills: number;
  distinctSubagents: number;
  distinctTools: number;
  totalCalls: number;
}

interface SkillsSummaryData {
  period: string;
  skills: SkillSummaryEntry[];
  subagents: SubagentSummaryEntry[];
  userProficiency: UserProficiencyEntry[];
}

interface InventoryUser {
  userId: string;
  displayName: string;
  commands: number;
  skills: number;
  agents: number;
  plugins?: number;
  total: number;
}

interface InventoryData {
  users: InventoryUser[];
}

interface InventoryItem {
  name: string;
  type: "command" | "agent" | "skill" | "plugin";
}

interface InventoryDetailData {
  userId: string;
  items: InventoryItem[];
  total: number;
}

// ---- Stat card ------------------------------------------------------------

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
}) {
  return (
    <div className="kpi-card">
      <div className="flex items-center justify-between">
        <div className="kpi-icon">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="kpi-value" data-slot="kpi-value">
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
      <div className="kpi-label">{label}</div>
    </div>
  );
}

// ---- Usage tab ------------------------------------------------------------

function UsageTab({ data }: { data: SkillsSummaryData | undefined }) {
  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Skills usage */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            スキル利用状況
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.skills.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              スキルデータがありません
            </p>
          ) : (
            <div className="space-y-1">
              {/* Header row */}
              <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 pb-1 text-xs font-medium text-muted-foreground">
                <span>スキル名</span>
                <span className="text-right w-20">利用ユーザー数</span>
                <span className="text-right w-24">合計呼び出し</span>
              </div>
              {data.skills.map((skill) => (
                <div
                  key={skill.skillName}
                  className="grid grid-cols-[1fr_auto_auto] gap-2 items-center rounded-md border px-3 py-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Wrench className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium truncate">
                      {skill.skillName}
                    </span>
                  </div>
                  <Badge variant="outline" className="w-20 justify-center">
                    {skill.userCount.toLocaleString()}
                  </Badge>
                  <Badge variant="secondary" className="w-24 justify-center">
                    {skill.totalCalls.toLocaleString()}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Subagents usage */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            サブエージェント利用状況
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.subagents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              サブエージェントデータがありません
            </p>
          ) : (
            <div className="space-y-1">
              {/* Header row */}
              <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 pb-1 text-xs font-medium text-muted-foreground">
                <span>エージェント名</span>
                <span className="text-right w-20">利用ユーザー数</span>
                <span className="text-right w-24">合計呼び出し</span>
              </div>
              {data.subagents.map((agent) => (
                <div
                  key={agent.subagentType}
                  className="grid grid-cols-[1fr_auto_auto] gap-2 items-center rounded-md border px-3 py-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Bot className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium truncate">
                      {agent.subagentType}
                    </span>
                  </div>
                  <Badge variant="outline" className="w-20 justify-center">
                    {agent.userCount.toLocaleString()}
                  </Badge>
                  <Badge variant="secondary" className="w-24 justify-center">
                    {agent.totalCalls.toLocaleString()}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---- Inventory row (expandable) -------------------------------------------

function InventoryRow({ user }: { user: InventoryUser }) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<InventoryDetailData | null>(null);
  const [loading, setLoading] = useState(false);

  const handleExpand = async () => {
    if (!expanded && !detail) {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/v1/skills/inventory?userId=${encodeURIComponent(user.userId)}`
        );
        if (res.ok) {
          const json = await res.json();
          setDetail(json as InventoryDetailData);
        }
      } finally {
        setLoading(false);
      }
    }
    setExpanded((v) => !v);
  };

  const typeLabel: Record<string, string> = {
    command: "コマンド",
    agent: "エージェント",
    skill: "スキル",
    plugin: "プラグイン",
  };

  const typeVariant: Record<
    string,
    "default" | "secondary" | "outline" | "destructive"
  > = {
    command: "outline",
    agent: "secondary",
    skill: "default",
    plugin: "destructive",
  };

  return (
    <div>
      <div
        className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-2 items-center rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={handleExpand}
      >
        <div className="flex items-center gap-2 min-w-0">
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          )}
          <span className="text-sm font-medium truncate">{user.displayName}</span>
        </div>
        <span className="text-sm text-right w-16 tabular-nums">
          {user.commands.toLocaleString()}
        </span>
        <span className="text-sm text-right w-20 tabular-nums">
          {user.agents.toLocaleString()}
        </span>
        <span className="text-sm text-right w-16 tabular-nums">
          {user.skills.toLocaleString()}
        </span>
        <span className="text-sm text-right w-20 tabular-nums">
          {(user.plugins ?? 0).toLocaleString()}
        </span>
        <Badge variant="secondary" className="w-16 justify-center">
          {user.total.toLocaleString()}
        </Badge>
      </div>

      {expanded && (
        <div className="mx-1 mb-1 rounded-b-md border border-t-0 bg-muted/30 px-4 py-3">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : detail ? (
            <div className="flex flex-wrap gap-2">
              {detail.items.map((item, idx) => (
                <Badge
                  key={`${item.type}-${item.name}-${idx}`}
                  variant={typeVariant[item.type] ?? "outline"}
                  className="text-xs"
                >
                  {typeLabel[item.type] ?? item.type}: {item.name}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              詳細データがありません
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Inventory tab --------------------------------------------------------

function InventoryTab({ data }: { data: InventoryData | undefined }) {
  if (!data) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          インストール済みインベントリ
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.users.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            インベントリデータがありません
          </p>
        ) : (
          <div className="space-y-1">
            {/* Header row */}
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-2 px-3 pb-1 text-xs font-medium text-muted-foreground">
              <span>ユーザー</span>
              <span className="text-right w-16">コマンド</span>
              <span className="text-right w-20">エージェント</span>
              <span className="text-right w-16">スキル</span>
              <span className="text-right w-20">プラグイン</span>
              <span className="text-right w-16">合計</span>
            </div>
            {data.users.map((user) => (
              <InventoryRow key={user.userId} user={user} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---- User proficiency section ---------------------------------------------

function UserProficiencySection({
  data,
}: {
  data: UserProficiencyEntry[] | undefined;
}) {
  if (!data || data.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          ユーザー別スキル習熟度
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {/* Header row */}
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 px-3 pb-1 text-xs font-medium text-muted-foreground">
            <span>ユーザー</span>
            <span className="text-right w-28">スキル種類数</span>
            <span className="text-right w-32">エージェント種類数</span>
            <span className="text-right w-28">ツール種類数</span>
            <span className="text-right w-24">合計呼び出し</span>
          </div>
          {data.map((user) => (
            <div
              key={user.userId}
              className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-center rounded-md border px-3 py-2"
            >
              <span className="text-sm font-medium truncate">
                {user.displayName}
              </span>
              <div className="flex items-center justify-end gap-1.5 w-28">
                <div
                  className="h-1.5 rounded-full bg-[var(--chart-1)]"
                  style={{
                    width: `${Math.min(user.distinctSkills * 4, 56)}px`,
                  }}
                />
                <span className="text-sm tabular-nums">{user.distinctSkills}</span>
              </div>
              <div className="flex items-center justify-end gap-1.5 w-32">
                <div
                  className="h-1.5 rounded-full bg-[var(--chart-2)]"
                  style={{
                    width: `${Math.min(user.distinctSubagents * 8, 56)}px`,
                  }}
                />
                <span className="text-sm tabular-nums">
                  {user.distinctSubagents}
                </span>
              </div>
              <div className="flex items-center justify-end gap-1.5 w-28">
                <div
                  className="h-1.5 rounded-full bg-[var(--chart-3)]"
                  style={{
                    width: `${Math.min(user.distinctTools * 3, 56)}px`,
                  }}
                />
                <span className="text-sm tabular-nums">{user.distinctTools}</span>
              </div>
              <Badge variant="secondary" className="w-24 justify-center">
                {user.totalCalls.toLocaleString()}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---- Page -----------------------------------------------------------------

export default function SkillsPage() {
  const [period, setPeriod] = usePeriod("30d");
  const [activeTab, setActiveTab] = useState<"usage" | "inventory">("usage");

  const {
    data: rawSummary,
    isLoading: isSummaryLoading,
    isValidating: isSummaryValidating,
    mutate: mutateSummary,
  } = useApi<SkillsSummaryData>(`/api/v1/skills/summary?period=${period}`);

  const {
    data: rawInventory,
    isLoading: isInventoryLoading,
    isValidating: isInventoryValidating,
    mutate: mutateInventory,
  } = useApi<InventoryData>("/api/v1/skills/inventory");

  const summaryData = rawSummary as SkillsSummaryData | undefined;
  const inventoryData = rawInventory as InventoryData | undefined;

  const isLoading = isSummaryLoading || isInventoryLoading;
  const isValidating = isSummaryValidating || isInventoryValidating;

  const handleRefresh = () => {
    mutateSummary();
    mutateInventory();
  };

  // Compute summary card values
  const totalSkills = summaryData?.skills.length ?? 0;
  const totalSubagents = summaryData?.subagents.length ?? 0;
  const totalCommands =
    inventoryData?.users.reduce((acc, u) => acc + u.commands, 0) ?? 0;
  const maxDistinctTools =
    summaryData?.userProficiency.reduce(
      (acc, u) => Math.max(acc, u.distinctTools),
      0
    ) ?? 0;

  return (
    <>
      <Header
        title="スキル & エージェント"
        description="メンバーのスキル・エージェント・コマンド保有状況"
        onRefresh={handleRefresh}
        isRefreshing={isValidating}
      />
      <div className="dashboard-content">
        {/* Page heading + period selector */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-h2 text-foreground">スキル & エージェント</h2>
          <Tabs value={period} onValueChange={setPeriod}>
            <TabsList>
              <TabsTrigger value="7d">7日</TabsTrigger>
              <TabsTrigger value="30d">30日</TabsTrigger>
              <TabsTrigger value="90d">90日</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-10 rounded-lg w-64" />
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid gap-3 sm:grid-cols-4">
              <StatCard
                label={`ユニークスキル数 (${period})`}
                value={totalSkills}
                icon={Wrench}
              />
              <StatCard
                label={`ユニークエージェント数 (${period})`}
                value={totalSubagents}
                icon={Bot}
              />
              <StatCard
                label="総コマンド数 (全期間)"
                value={totalCommands}
                icon={Terminal}
              />
              <StatCard
                label={`最大ツール種類数 (${period})`}
                value={maxDistinctTools}
                icon={Package}
              />
            </div>

            {/* Tab switcher */}
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as "usage" | "inventory")}
            >
              <TabsList>
                <TabsTrigger value="usage">利用状況</TabsTrigger>
                <TabsTrigger value="inventory">インベントリ</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Tab content */}
            {activeTab === "usage" ? (
              <UsageTab data={summaryData} />
            ) : (
              <InventoryTab data={inventoryData} />
            )}

            {/* User proficiency — always visible */}
            <UserProficiencySection data={summaryData?.userProficiency} />
          </div>
        )}
      </div>
    </>
  );
}
