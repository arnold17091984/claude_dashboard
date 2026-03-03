import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/server/db";
import { dailySummary, events, aiInsights, users } from "@/server/db/schema";
import { sql, desc, gte, count, sum } from "drizzle-orm";

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
