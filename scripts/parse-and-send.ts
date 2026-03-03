/**
 * parse-and-send.ts
 *
 * collect-on-session-end.sh から npx tsx で呼び出されるヘルパー。
 * 単一トランスクリプトファイルを解析してダッシュボード API に送信する。
 *
 * 使い方:
 *   npx tsx scripts/parse-and-send.ts \
 *     --session-id <id> \
 *     --transcript-path <path> \
 *     --user-id <userId> \
 *     --cwd <cwd> \
 *     --dashboard-url <url> \
 *     --api-key <key>
 */
import path from "path";
import { parseTranscriptFile } from "../src/server/services/transcript-parser";
import { aggregateSession } from "../src/server/services/session-aggregator";
import { calculateSessionCost } from "../src/server/services/cost-calculator";

// ---------------------------------------------------------------------------
// CLI 引数のパース
// ---------------------------------------------------------------------------
function parseArgs(): Record<string, string> {
  const args: Record<string, string> = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, "");
    const value = argv[i + 1];
    if (key && value !== undefined) {
      args[key] = value;
    }
  }
  return args;
}

// ---------------------------------------------------------------------------
// HTTP POST ヘルパー (fetch / node:http)
// ---------------------------------------------------------------------------
async function postJson(
  url: string,
  body: unknown,
  apiKey: string
): Promise<{ ok: boolean; status: number; body: string }> {
  const payload = JSON.stringify(body);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { "X-API-Key": apiKey } : {}),
    },
    body: payload,
    signal: AbortSignal.timeout(15_000),
  });

  const responseBody = await response.text();
  return { ok: response.ok, status: response.status, body: responseBody };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  const args = parseArgs();

  const sessionId = args["session-id"];
  const transcriptPath = args["transcript-path"];
  const userId = args["user-id"] ?? process.env.USER ?? "local-user";
  const cwd = args["cwd"] ?? "";
  const dashboardUrl =
    args["dashboard-url"] ??
    process.env.DASHBOARD_URL ??
    "http://localhost:3000";
  const apiKey = args["api-key"] ?? process.env.DASHBOARD_API_KEY ?? "";

  if (!sessionId || !transcriptPath) {
    console.error("ERROR: --session-id と --transcript-path は必須です");
    process.exit(1);
  }

  // 1. トランスクリプトを解析
  const transcript = await parseTranscriptFile(transcriptPath);

  // session_id が環境から来た値と一致しない場合はオーバーライド
  if (transcript.sessionId !== sessionId) {
    // ファイル名から取得したセッションIDを優先するが、引数を記録しておく
    // (どちらを使うかはプロジェクトの方針による。ここでは引数を使用)
    transcript.entries.forEach((e) => {
      e.sessionId = sessionId;
    });
  }

  // 2. セッションを集計
  const aggregated = aggregateSession({
    ...transcript,
    sessionId,
  });

  // 3. コストを計算
  const costResult = calculateSessionCost(aggregated);

  // 4. プロジェクト名を cwd から取得
  const projectName = path.basename(cwd || "unknown");

  // 5. API ペイロードを構築
  const apiPayload = {
    session: {
      sessionId,
      userId,
      projectPath: cwd || "unknown",
      projectName,
      startedAt: aggregated.startedAt,
      endedAt: aggregated.endedAt,
      durationMs: aggregated.durationMs,
      messageCount: aggregated.messageCount,
      toolCallCount: aggregated.toolCallCount,
      primaryModel: aggregated.primaryModel,
      totalTokenUsage: aggregated.totalTokenUsage
        ? {
            inputTokens: aggregated.totalTokenUsage.inputTokens,
            outputTokens: aggregated.totalTokenUsage.outputTokens,
            cacheReadInputTokens:
              aggregated.totalTokenUsage.cacheReadInputTokens,
            cacheCreationInputTokens:
              aggregated.totalTokenUsage.cacheCreationInputTokens,
          }
        : undefined,
    },
    events: aggregated.toolEvents.map((e) => ({
      sessionId,
      userId,
      eventType: "tool_use",
      role: e.role ?? "assistant",
      toolName: e.toolName,
      skillName: e.skillName,
      subagentType: e.subagentType,
      model: e.model,
      timestamp: e.timestamp,
    })),
    tokenUsageEvents: aggregated.tokenUsageEvents.map((u) => ({
      sessionId,
      userId,
      model: u.model,
      inputTokens: u.inputTokens,
      outputTokens: u.outputTokens,
      cacheReadInputTokens: u.cacheReadInputTokens,
      cacheCreationInputTokens: u.cacheCreationInputTokens,
      timestamp: u.timestamp,
    })),
  };

  // 6. ダッシュボード API に送信
  const endpoint = `${dashboardUrl}/api/v1/ingest/session`;
  const result = await postJson(endpoint, apiPayload, apiKey);

  if (result.ok) {
    console.log(
      `OK: session=${sessionId}, events=${apiPayload.events.length}, cost=$${costResult.totalCostUsd.toFixed(4)}`
    );
  } else {
    console.error(
      `ERROR: HTTP ${result.status}: ${result.body.slice(0, 200)}`
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("FATAL:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
