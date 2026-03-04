import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/server/db";
import { dailySummary, events, aiInsights, users } from "@/server/db/schema";
import { sql, desc, gte, count, sum, eq, and } from "drizzle-orm";

const getClient = () => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  return new Anthropic({ apiKey });
};

interface InsightContext {
  period: string;
  totalUsers: number;
  totalSessions: number;
  totalToolCalls: number;
  totalCost: number;
  topTools: Array<{ toolName: string | null; count: number }>;
  dailyTrend: Array<{
    date: string;
    sessions: number | string | null;
    toolCalls: number | string | null;
  }>;
  userStats: Array<{
    userId: string;
    sessions: number | string | null;
    toolCalls: number | string | null;
    cost: number | string | null;
  }>;
}

async function gatherInsightContext(daysBack: number): Promise<InsightContext> {
  const since = new Date(
    Date.now() - daysBack * 24 * 60 * 60 * 1000
  ).toISOString();
  const sinceDate = since.slice(0, 10);

  const [userCount, sessionStats, topTools, dailyTrend, userStats] =
    await Promise.all([
      db.select({ count: count() }).from(users),

      db
        .select({
          sessions: count(),
          toolCalls: sum(dailySummary.toolCallCount),
          cost: sum(dailySummary.estimatedCostUsd),
        })
        .from(dailySummary)
        .where(gte(dailySummary.date, sinceDate)),

      db
        .select({ toolName: events.toolName, count: count() })
        .from(events)
        .where(gte(events.timestamp, since))
        .groupBy(events.toolName)
        .orderBy(desc(count()))
        .limit(15),

      db
        .select({
          date: dailySummary.date,
          sessions: sum(dailySummary.sessionCount),
          toolCalls: sum(dailySummary.toolCallCount),
        })
        .from(dailySummary)
        .where(gte(dailySummary.date, sinceDate))
        .groupBy(dailySummary.date)
        .orderBy(dailySummary.date),

      db
        .select({
          userId: dailySummary.userId,
          sessions: sum(dailySummary.sessionCount),
          toolCalls: sum(dailySummary.toolCallCount),
          cost: sum(dailySummary.estimatedCostUsd),
        })
        .from(dailySummary)
        .where(gte(dailySummary.date, sinceDate))
        .groupBy(dailySummary.userId)
        .orderBy(desc(sum(dailySummary.sessionCount))),
    ]);

  return {
    period: `${daysBack}d`,
    totalUsers: userCount[0]?.count || 0,
    totalSessions: Number(sessionStats[0]?.sessions || 0),
    totalToolCalls: Number(sessionStats[0]?.toolCalls || 0),
    totalCost: Number(sessionStats[0]?.cost || 0),
    topTools,
    dailyTrend,
    userStats,
  };
}

export async function generateWeeklyInsight(): Promise<string> {
  const context = await gatherInsightContext(7);
  const client = getClient();

  const prompt = `あなたはClaude Code利用状況アナリストです。以下のデータを分析し、チームのClaude Code活用状況についてのインサイトレポートを日本語で生成してください。

## データ（過去7日間）
- ユーザー数: ${context.totalUsers}
- セッション数: ${context.totalSessions}
- ツール呼び出し数: ${context.totalToolCalls}
- 推定コスト: $${context.totalCost.toFixed(2)}

## ツール使用ランキング
${context.topTools.map((t, i) => `${i + 1}. ${t.toolName}: ${t.count}回`).join("\n")}

## 日別推移
${context.dailyTrend.map((d) => `${d.date}: セッション${d.sessions}, ツール${d.toolCalls}`).join("\n")}

## ユーザー別統計
${context.userStats.map((u) => `${u.userId}: セッション${u.sessions}, ツール${u.toolCalls}, コスト$${Number(u.cost || 0).toFixed(2)}`).join("\n")}

以下の形式でMarkdownレポートを生成してください:
1. **今週のハイライト** (3-5行のサマリー)
2. **注目ポイント** (具体的な数字を含む2-3個のインサイト)
3. **改善提案** (具体的なアクション2-3個)

短く、アクショナブルに、具体的な数字を含めてください。`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const content =
    response.content[0].type === "text" ? response.content[0].text : "";

  // Save to DB
  await db.insert(aiInsights).values({
    insightType: "weekly_summary",
    content,
    metadata: JSON.stringify({
      period: context.period,
      totalSessions: context.totalSessions,
      totalCost: context.totalCost,
    }),
    generatedAt: new Date().toISOString(),
    expiresAt: new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    ).toISOString(),
  });

  return content;
}

export async function generateUserInsight(userId: string): Promise<string> {
  const context = await gatherInsightContext(7);
  const userStat = context.userStats.find((u) => u.userId === userId);
  if (!userStat) return "このユーザーのデータが見つかりません。";

  const client = getClient();

  const prompt = `Claude Code利用状況を分析して、個人向けの短いアドバイスを日本語で3行以内で生成してください。

ユーザー: ${userId}
セッション数: ${userStat.sessions} (チーム平均: ${(context.totalSessions / Math.max(context.totalUsers, 1)).toFixed(1)})
ツール使用数: ${userStat.toolCalls} (チーム平均: ${(context.totalToolCalls / Math.max(context.totalUsers, 1)).toFixed(1)})
コスト: $${Number(userStat.cost || 0).toFixed(2)}

チームのトップツール: ${context.topTools.slice(0, 5).map((t) => t.toolName).join(", ")}`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    messages: [{ role: "user", content: prompt }],
  });

  const content =
    response.content[0].type === "text" ? response.content[0].text : "";

  await db.insert(aiInsights).values({
    insightType: "user_recommendation",
    targetUserId: userId,
    content,
    generatedAt: new Date().toISOString(),
    expiresAt: new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    ).toISOString(),
  });

  return content;
}

export async function generateDailySummary(): Promise<string> {
  const context = await gatherInsightContext(1);
  const client = getClient();

  const todayData = context.dailyTrend[context.dailyTrend.length - 1];

  const prompt = `Claude Code本日の利用状況を分析して、デイリーサマリーを日本語で生成してください。

## 本日のデータ
- セッション数: ${todayData?.sessions ?? 0}
- ツール呼び出し数: ${todayData?.toolCalls ?? 0}
- 推定コスト: $${context.totalCost.toFixed(2)}
- アクティブユーザー数: ${context.userStats.length}

## 使用ツール Top5
${context.topTools.slice(0, 5).map((t, i) => `${i + 1}. ${t.toolName}: ${t.count}回`).join("\n")}

以下の形式でMarkdownレポートを生成してください:
1. **本日のサマリー** (2-3行)
2. **特記事項** (目立った点があれば1-2個)

簡潔に、数字を含めてください。`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });

  const content =
    response.content[0].type === "text" ? response.content[0].text : "";

  await db.insert(aiInsights).values({
    insightType: "daily_summary",
    content,
    metadata: JSON.stringify({
      period: "1d",
      totalSessions: context.totalSessions,
      totalCost: context.totalCost,
      activeUsers: context.userStats.length,
    }),
    generatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });

  return content;
}

export async function generateCostOptimization(): Promise<string> {
  const context = await gatherInsightContext(30);
  const client = getClient();

  // Calculate per-user cost metrics
  const perUserCosts = context.userStats.map((u) => ({
    userId: u.userId,
    cost: Number(u.cost || 0),
    sessions: Number(u.sessions || 0),
    costPerSession:
      Number(u.sessions || 0) > 0
        ? Number(u.cost || 0) / Number(u.sessions || 0)
        : 0,
  }));
  perUserCosts.sort((a, b) => b.cost - a.cost);

  const prompt = `Claude Code過去30日間のコストデータを分析して、コスト最適化の提案を日本語で生成してください。

## コスト概要（過去30日間）
- 総コスト: $${context.totalCost.toFixed(2)}
- セッション数: ${context.totalSessions}
- セッション単価: $${context.totalSessions > 0 ? (context.totalCost / context.totalSessions).toFixed(4) : "0"}
- アクティブユーザー数: ${context.totalUsers}
- ユーザー単価: $${context.totalUsers > 0 ? (context.totalCost / context.totalUsers).toFixed(2) : "0"}

## ユーザー別コスト Top5
${perUserCosts.slice(0, 5).map((u, i) => `${i + 1}. ${u.userId}: $${u.cost.toFixed(2)} (${u.sessions}セッション, セッション単価$${u.costPerSession.toFixed(4)})`).join("\n")}

## 高頻度ツール Top10
${context.topTools.slice(0, 10).map((t, i) => `${i + 1}. ${t.toolName}: ${t.count}回`).join("\n")}

以下の形式でMarkdownレポートを生成してください:
1. **コスト分析サマリー** (現状評価 2-3行)
2. **最適化ポイント** (具体的な削減提案 3-4個、削減効果の推定を含む)
3. **推奨アクション** (即実行可能なアクション 2-3個)

具体的な数字と根拠を含めてください。`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const content =
    response.content[0].type === "text" ? response.content[0].text : "";

  await db.insert(aiInsights).values({
    insightType: "cost_optimization",
    content,
    metadata: JSON.stringify({
      period: "30d",
      totalCost: context.totalCost,
      totalSessions: context.totalSessions,
      costPerSession:
        context.totalSessions > 0
          ? context.totalCost / context.totalSessions
          : 0,
    }),
    generatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });

  return content;
}

export async function generateProductivityTrend(): Promise<string> {
  const [context7d, context30d] = await Promise.all([
    gatherInsightContext(7),
    gatherInsightContext(30),
  ]);
  const client = getClient();

  // Compute week-over-week trend from 30d data
  const recentDays = context30d.dailyTrend.slice(-7);
  const prevDays = context30d.dailyTrend.slice(-14, -7);

  const recentSessions = recentDays.reduce(
    (sum, d) => sum + Number(d.sessions || 0),
    0
  );
  const prevSessions = prevDays.reduce(
    (sum, d) => sum + Number(d.sessions || 0),
    0
  );
  const sessionTrend =
    prevSessions > 0
      ? (((recentSessions - prevSessions) / prevSessions) * 100).toFixed(1)
      : "N/A";

  const recentTools = recentDays.reduce(
    (sum, d) => sum + Number(d.toolCalls || 0),
    0
  );
  const prevTools = prevDays.reduce(
    (sum, d) => sum + Number(d.toolCalls || 0),
    0
  );
  const toolTrend =
    prevTools > 0
      ? (((recentTools - prevTools) / prevTools) * 100).toFixed(1)
      : "N/A";

  const prompt = `Claude Code利用の生産性トレンドを分析して、インサイトレポートを日本語で生成してください。

## 直近7日間
- セッション数: ${context7d.totalSessions}
- ツール呼び出し数: ${context7d.totalToolCalls}
- 推定コスト: $${context7d.totalCost.toFixed(2)}
- アクティブユーザー: ${context7d.userStats.length}人

## 前週比（直近7日 vs その前の7日）
- セッション変化: ${sessionTrend}%
- ツール使用変化: ${toolTrend}%

## 30日間の日別推移
${context30d.dailyTrend.map((d) => `${d.date}: セッション${d.sessions}, ツール${d.toolCalls}`).join("\n")}

## ユーザー別生産性 Top5（セッション数）
${context7d.userStats.slice(0, 5).map((u, i) => `${i + 1}. ${u.userId}: セッション${u.sessions}, ツール${u.toolCalls}`).join("\n")}

以下の形式でMarkdownレポートを生成してください:
1. **トレンドサマリー** (直近の傾向 2-3行)
2. **生産性インサイト** (パターンや特徴 2-3個)
3. **次週の予測と提案** (トレンドに基づく提案 2個)

データに基づいた具体的な洞察を含めてください。`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const content =
    response.content[0].type === "text" ? response.content[0].text : "";

  await db.insert(aiInsights).values({
    insightType: "productivity_trend",
    content,
    metadata: JSON.stringify({
      period7d: {
        sessions: context7d.totalSessions,
        toolCalls: context7d.totalToolCalls,
        cost: context7d.totalCost,
      },
      sessionTrend,
      toolTrend,
    }),
    generatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });

  return content;
}

export async function comparePeriods(
  period1Days: number,
  period2Days: number
): Promise<{
  period1: { label: string; sessions: number; cost: number; toolCalls: number };
  period2: { label: string; sessions: number; cost: number; toolCalls: number };
  diff: { sessions: number; cost: number; toolCalls: number };
}> {
  const now = Date.now();

  const since1 = new Date(now - period1Days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const since2 = new Date(now - period2Days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const [stats1, stats2] = await Promise.all([
    db
      .select({
        sessions: sum(dailySummary.sessionCount),
        toolCalls: sum(dailySummary.toolCallCount),
        cost: sum(dailySummary.estimatedCostUsd),
      })
      .from(dailySummary)
      .where(gte(dailySummary.date, since1)),

    db
      .select({
        sessions: sum(dailySummary.sessionCount),
        toolCalls: sum(dailySummary.toolCallCount),
        cost: sum(dailySummary.estimatedCostUsd),
      })
      .from(dailySummary)
      .where(gte(dailySummary.date, since2)),
  ]);

  const p1 = {
    label: `${period1Days}d`,
    sessions: Number(stats1[0]?.sessions || 0),
    cost: Number(stats1[0]?.cost || 0),
    toolCalls: Number(stats1[0]?.toolCalls || 0),
  };

  const p2 = {
    label: `${period2Days}d`,
    sessions: Number(stats2[0]?.sessions || 0),
    cost: Number(stats2[0]?.cost || 0),
    toolCalls: Number(stats2[0]?.toolCalls || 0),
  };

  return {
    period1: p1,
    period2: p2,
    diff: {
      sessions: p2.sessions - p1.sessions,
      cost: p2.cost - p1.cost,
      toolCalls: p2.toolCalls - p1.toolCalls,
    },
  };
}
