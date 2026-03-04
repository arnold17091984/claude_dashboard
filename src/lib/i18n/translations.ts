export type Locale = "ja" | "en" | "ko";

type TranslationMap = Record<string, string>;

const ja: TranslationMap = {
  // Navigation
  "nav.groupLabel": "ダッシュボード",
  "nav.overview": "概要",
  "nav.ranking": "ランキング",
  "nav.users": "ユーザー",
  "nav.sessions": "セッション",
  "nav.projects": "プロジェクト",
  "nav.tools": "ツール分析",
  "nav.models": "モデル / コスト",
  "nav.insights": "AIインサイト",

  // Common
  "common.period": "期間",
  "common.sort": "ソート",
  "common.cost": "コスト",
  "common.sessions": "セッション",
  "common.users": "ユーザー",
  "common.tools": "ツール",
  "common.toolUsage": "ツール使用",
  "common.messages": "メッセージ",
  "common.noData": "データがありません",
  "common.loading": "読み込み中...",
  "common.prev": "前へ",
  "common.next": "次へ",
  "common.networkError": "ネットワークエラー",
  "common.period.7d": "7日間",
  "common.period.30d": "30日間",
  "common.period.90d": "90日間",
  "common.ofTotal": "全体に占める割合",

  // KPI cards
  "kpi.activeUsers": "アクティブユーザー",
  "kpi.sessions": "セッション数",
  "kpi.registeredUsers": "登録済みユーザー数",
  "kpi.allPeriod": "全期間:",
  "kpi.tokens": "トークン使用量",
  "kpi.cacheInputOutput": "入出力:",
  "kpi.cache": "キャッシュ:",
  "kpi.input": "入力:",
  "kpi.output": "出力:",
  "kpi.estimatedCost": "推定コスト",
  "kpi.periodTotal": "選択期間の合計",

  // Charts
  "chart.activity.title": "アクティビティ推移",
  "chart.activity.description": "日次セッション・ツール呼び出し数",
  "chart.sessions": "セッション",
  "chart.toolCalls": "ツール呼び出し",
  "chart.usageCount": "使用回数",
  "chart.toolUsage.title": "ツール使用頻度 Top 10",
  "chart.toolUsage.description": "呼び出し回数ランキング",
  "chart.modelCost.title": "モデル別コスト分布",
  "chart.modelCost.description": "選択期間のモデル使用コスト",
  "chart.costTrend.title": "日別コスト推移",
  "chart.costTrend.titleFull": "日別コスト推移 (モデル別)",
  "chart.costTrend.description": "モデルごとの積み上げコスト",
  "chart.toolCategory.categoryTitle": "カテゴリ別使用割合",
  "chart.toolCategory.top15": "ツール使用頻度 Top 15",

  // Tables
  "table.rank": "順位",
  "table.user": "ユーザー",
  "table.sessions": "セッション",
  "table.messages": "メッセージ",
  "table.toolUsage": "ツール使用",
  "table.cost": "コスト",
  "table.topTool": "よく使うツール",
  "table.project": "プロジェクト",
  "table.users": "ユーザー",
  "table.workTime": "作業時間",
  "table.lastUsed": "最終利用",
  "table.model": "モデル",
  "table.requests": "リクエスト数",
  "table.inputTokens": "入力トークン",
  "table.outputTokens": "出力トークン",
  "table.cacheRead": "キャッシュ読み込み",
  "table.share": "シェア",

  // Page: Overview
  "page.overview.title": "概要",
  "page.overview.description": "Claude Code 利用状況の全体サマリー",
  "page.overview.heading": "ダッシュボード",
  "page.overview.projectSessions": "プロジェクト別セッション数",
  "page.overview.projectsDescription": "上位プロジェクトの利用状況",
  "page.overview.noData": "データがまだありません",
  "page.overview.noDataHint": "シードデータをインポートするか、hooksを設定してください",

  // Page: Ranking
  "page.ranking.title": "ランキング",
  "page.ranking.description": "ユーザー別のClaude Code利用状況ランキング",
  "page.ranking.heading": "ユーザーランキング",
  "page.ranking.tableTitle": "ユーザーランキング",
  "page.ranking.participants": "参加ユーザー数",
  "page.ranking.totalSessions": "合計セッション",
  "page.ranking.totalCost": "合計コスト",

  // Page: Users
  "page.users.title": "ユーザー一覧",
  "page.users.description": "Claude Codeを利用しているユーザー",
  "page.users.heading": "ユーザー一覧",
  "page.users.count": "全 {count} ユーザー (過去90日間)",
  "page.users.noUsers": "ユーザーがいません",
  "page.users.topTool": "よく使うツール:",

  // Page: Sessions
  "page.sessions.title": "セッション一覧",
  "page.sessions.description": "Claude Codeの全セッション履歴",
  "page.sessions.heading": "セッション一覧",
  "page.sessions.count": "全 {count} セッション",
  "page.sessions.noSessions": "セッションがありません",
  "page.sessions.pagination": "{page} / {total} ページ",

  // Page: Projects
  "page.projects.title": "プロジェクト分析",
  "page.projects.description": "プロジェクト別のClaude Code利用状況",
  "page.projects.heading": "プロジェクト分析",
  "page.projects.count": "プロジェクト数",
  "page.projects.totalSessions": "合計セッション",
  "page.projects.totalCost": "合計コスト",
  "page.projects.chartTitle": "プロジェクト別セッション数 Top 12",
  "page.projects.tableTitle": "プロジェクト詳細",
  "page.projects.sessionCount": "セッション数",

  // Page: Tools
  "page.tools.title": "ツール分析",
  "page.tools.description": "ツール使用状況の詳細分析",
  "page.tools.heading": "ツール分析",
  "page.tools.trendTitle": "ツール使用推移 (日別)",
  "page.tools.skills": "スキル一覧",
  "page.tools.subagents": "サブエージェント一覧",
  "page.tools.mcpTools": "MCPツール一覧",
  "page.tools.noSkillData": "スキルデータがありません",
  "page.tools.noSubagentData": "サブエージェントデータがありません",

  // Page: Models
  "page.models.title": "モデル / コスト",
  "page.models.description": "AIモデルの利用状況とコスト分析",
  "page.models.heading": "モデル / コスト分析",
  "page.models.totalCost": "合計コスト",
  "page.models.totalTokens": "総トークン数",
  "page.models.modelCount": "使用モデル数",
  "page.models.costEfficiency": "コスト効率指標",
  "page.models.highEfficiency": "高効率",
  "page.models.mediumEfficiency": "中効率",
  "page.models.lowEfficiency": "低効率",
  "page.models.tableTitle": "モデル別詳細統計",

  // Page: Insights
  "page.insights.title": "AIインサイト",
  "page.insights.description": "AI分析による利用状況インサイト",
  "page.insights.heading": "AIインサイト",
  "page.insights.generate": "新規インサイトを生成",
  "page.insights.generating": "生成中...",
  "page.insights.error": "インサイト生成エラー",
  "page.insights.generationFailed": "生成に失敗しました",
  "page.insights.apiKeyHint":
    "ANTHROPIC_API_KEY が .env.local に設定されていることを確認してください",
  "page.insights.empty": "インサイトはまだありません",
  "page.insights.emptyHint":
    "上の「新規インサイトを生成」ボタンを押して、AI分析を開始してください。",
  "page.insights.apiKeyNote": "※ ANTHROPIC_API_KEY の設定が必要です",
  "page.insights.reportTitle": "AI分析レポート",

  // Insight types
  "insight.weeklySummary": "週次サマリー",
  "insight.costOptimization": "コスト最適化",
  "insight.anomaly": "異常検知",
  "insight.userInsight": "ユーザー分析",
  "insight.default": "インサイト",

  // Page: User Detail
  "page.userDetail.title": "ユーザー詳細",
  "page.userDetail.notFound": "ユーザーが見つかりません",
  "page.userDetail.notFoundDesc": "該当するユーザーがいません。",
  "page.userDetail.usageOf": "{name} の利用状況",
  "page.userDetail.sessions": "セッション数",
  "page.userDetail.toolUsage": "ツール使用回数",
  "page.userDetail.estimatedCost": "推定コスト",
  "page.userDetail.activityTrend": "アクティビティ推移",
  "page.userDetail.toolTop10": "ツール使用 Top 10",
  "page.userDetail.modelCost": "モデル別コスト",
  "page.userDetail.recentSessions": "最近のセッション",
  "page.userDetail.noSessions": "セッションがありません",
  "page.userDetail.toolUsageLabel": "ツール使用",
  "page.userDetail.usageCount": "使用回数",

  // Header / Refresh
  "header.refresh": "更新",
  "header.autoRefresh": "自動更新",
  "header.lastUpdated": "最終更新: {time}",
  "header.refreshing": "更新中...",

  // Breadcrumbs
  "breadcrumb.home": "ホーム",

  // Empty states
  "empty.title": "データがありません",
  "empty.description": "表示するデータがまだありません。",
  "empty.hint": "データが取り込まれると、ここに表示されます。",

  // KPI trends
  "kpi.trend.up": "前期比 +{pct}%",
  "kpi.trend.down": "前期比 -{pct}%",
  "kpi.trend.neutral": "前期比 変化なし",
  "kpi.vsLastPeriod": "前期比",
};

const en: TranslationMap = {
  // Navigation
  "nav.groupLabel": "Dashboard",
  "nav.overview": "Overview",
  "nav.ranking": "Ranking",
  "nav.users": "Users",
  "nav.sessions": "Sessions",
  "nav.projects": "Projects",
  "nav.tools": "Tool Analysis",
  "nav.models": "Models / Cost",
  "nav.insights": "AI Insights",

  // Common
  "common.period": "Period",
  "common.sort": "Sort",
  "common.cost": "Cost",
  "common.sessions": "Sessions",
  "common.users": "Users",
  "common.tools": "Tools",
  "common.toolUsage": "Tool Usage",
  "common.messages": "Messages",
  "common.noData": "No data",
  "common.loading": "Loading...",
  "common.prev": "Prev",
  "common.next": "Next",
  "common.networkError": "Network error",
  "common.period.7d": "7 Days",
  "common.period.30d": "30 Days",
  "common.period.90d": "90 Days",
  "common.ofTotal": "of total",

  // KPI cards
  "kpi.activeUsers": "Active Users",
  "kpi.sessions": "Sessions",
  "kpi.registeredUsers": "Registered users",
  "kpi.allPeriod": "All time:",
  "kpi.tokens": "Token Usage",
  "kpi.cacheInputOutput": "I/O:",
  "kpi.cache": "Cache:",
  "kpi.input": "Input:",
  "kpi.output": "Output:",
  "kpi.estimatedCost": "Estimated Cost",
  "kpi.periodTotal": "Selected period total",

  // Charts
  "chart.activity.title": "Activity Trend",
  "chart.activity.description": "Daily sessions & tool calls",
  "chart.sessions": "Sessions",
  "chart.toolCalls": "Tool Calls",
  "chart.usageCount": "Usage Count",
  "chart.toolUsage.title": "Tool Usage Top 10",
  "chart.toolUsage.description": "Call count ranking",
  "chart.modelCost.title": "Cost by Model",
  "chart.modelCost.description": "Model usage cost for selected period",
  "chart.costTrend.title": "Daily Cost Trend",
  "chart.costTrend.titleFull": "Daily Cost Trend (by Model)",
  "chart.costTrend.description": "Stacked cost by model",
  "chart.toolCategory.categoryTitle": "Usage by Category",
  "chart.toolCategory.top15": "Tool Usage Top 15",

  // Tables
  "table.rank": "Rank",
  "table.user": "User",
  "table.sessions": "Sessions",
  "table.messages": "Messages",
  "table.toolUsage": "Tool Usage",
  "table.cost": "Cost",
  "table.topTool": "Top Tool",
  "table.project": "Project",
  "table.users": "Users",
  "table.workTime": "Work Time",
  "table.lastUsed": "Last Used",
  "table.model": "Model",
  "table.requests": "Requests",
  "table.inputTokens": "Input Tokens",
  "table.outputTokens": "Output Tokens",
  "table.cacheRead": "Cache Read",
  "table.share": "Share",

  // Page: Overview
  "page.overview.title": "Overview",
  "page.overview.description": "Overall Claude Code usage summary",
  "page.overview.heading": "Dashboard",
  "page.overview.projectSessions": "Sessions by Project",
  "page.overview.projectsDescription": "Top projects usage",
  "page.overview.noData": "No data yet",
  "page.overview.noDataHint": "Import seed data or configure hooks",

  // Page: Ranking
  "page.ranking.title": "Ranking",
  "page.ranking.description": "Claude Code usage ranking by user",
  "page.ranking.heading": "User Ranking",
  "page.ranking.tableTitle": "User Ranking",
  "page.ranking.participants": "Participants",
  "page.ranking.totalSessions": "Total Sessions",
  "page.ranking.totalCost": "Total Cost",

  // Page: Users
  "page.users.title": "Users",
  "page.users.description": "Users of Claude Code",
  "page.users.heading": "User List",
  "page.users.count": "{count} users (last 90 days)",
  "page.users.noUsers": "No users found",
  "page.users.topTool": "Top tool:",

  // Page: Sessions
  "page.sessions.title": "Sessions",
  "page.sessions.description": "All Claude Code session history",
  "page.sessions.heading": "Session List",
  "page.sessions.count": "{count} Sessions",
  "page.sessions.noSessions": "No sessions found",
  "page.sessions.pagination": "Page {page} of {total}",

  // Page: Projects
  "page.projects.title": "Projects",
  "page.projects.description": "Claude Code usage by project",
  "page.projects.heading": "Project Analysis",
  "page.projects.count": "Projects",
  "page.projects.totalSessions": "Total Sessions",
  "page.projects.totalCost": "Total Cost",
  "page.projects.chartTitle": "Sessions by Project Top 12",
  "page.projects.tableTitle": "Project Details",
  "page.projects.sessionCount": "Sessions",

  // Page: Tools
  "page.tools.title": "Tool Analysis",
  "page.tools.description": "Detailed tool usage analysis",
  "page.tools.heading": "Tool Analysis",
  "page.tools.trendTitle": "Tool Usage Trend (Daily)",
  "page.tools.skills": "Skills",
  "page.tools.subagents": "Subagents",
  "page.tools.mcpTools": "MCP Tools",
  "page.tools.noSkillData": "No skill data",
  "page.tools.noSubagentData": "No subagent data",

  // Page: Models
  "page.models.title": "Models / Cost",
  "page.models.description": "AI model usage and cost analysis",
  "page.models.heading": "Model / Cost Analysis",
  "page.models.totalCost": "Total Cost",
  "page.models.totalTokens": "Total Tokens",
  "page.models.modelCount": "Models Used",
  "page.models.costEfficiency": "Cost Efficiency",
  "page.models.highEfficiency": "High",
  "page.models.mediumEfficiency": "Medium",
  "page.models.lowEfficiency": "Low",
  "page.models.tableTitle": "Model Detailed Stats",

  // Page: Insights
  "page.insights.title": "AI Insights",
  "page.insights.description": "Usage insights from AI analysis",
  "page.insights.heading": "AI Insights",
  "page.insights.generate": "Generate New Insight",
  "page.insights.generating": "Generating...",
  "page.insights.error": "Insight Generation Error",
  "page.insights.generationFailed": "Generation failed",
  "page.insights.apiKeyHint": "Make sure ANTHROPIC_API_KEY is set in .env.local",
  "page.insights.empty": "No insights yet",
  "page.insights.emptyHint":
    'Click the "Generate New Insight" button above to start AI analysis.',
  "page.insights.apiKeyNote": "* ANTHROPIC_API_KEY is required",
  "page.insights.reportTitle": "AI Analysis Report",

  // Insight types
  "insight.weeklySummary": "Weekly Summary",
  "insight.costOptimization": "Cost Optimization",
  "insight.anomaly": "Anomaly Detection",
  "insight.userInsight": "User Analysis",
  "insight.default": "Insight",

  // Page: User Detail
  "page.userDetail.title": "User Detail",
  "page.userDetail.notFound": "User not found",
  "page.userDetail.notFoundDesc": "No matching user found.",
  "page.userDetail.usageOf": "{name}'s Usage",
  "page.userDetail.sessions": "Sessions",
  "page.userDetail.toolUsage": "Tool Usage",
  "page.userDetail.estimatedCost": "Estimated Cost",
  "page.userDetail.activityTrend": "Activity Trend",
  "page.userDetail.toolTop10": "Tool Usage Top 10",
  "page.userDetail.modelCost": "Cost by Model",
  "page.userDetail.recentSessions": "Recent Sessions",
  "page.userDetail.noSessions": "No sessions",
  "page.userDetail.toolUsageLabel": "Tool Usage",
  "page.userDetail.usageCount": "Usage Count",

  // Header / Refresh
  "header.refresh": "Refresh",
  "header.autoRefresh": "Auto Refresh",
  "header.lastUpdated": "Updated: {time}",
  "header.refreshing": "Refreshing...",

  // Breadcrumbs
  "breadcrumb.home": "Home",

  // Empty states
  "empty.title": "No data",
  "empty.description": "No data to display yet.",
  "empty.hint": "Data will appear here once it is ingested.",

  // KPI trends
  "kpi.trend.up": "+{pct}% vs last period",
  "kpi.trend.down": "-{pct}% vs last period",
  "kpi.trend.neutral": "No change vs last period",
  "kpi.vsLastPeriod": "vs last period",
};

const ko: TranslationMap = {
  // Navigation
  "nav.groupLabel": "대시보드",
  "nav.overview": "개요",
  "nav.ranking": "순위",
  "nav.users": "사용자",
  "nav.sessions": "세션",
  "nav.projects": "프로젝트",
  "nav.tools": "도구 분석",
  "nav.models": "모델 / 비용",
  "nav.insights": "AI 인사이트",

  // Common
  "common.period": "기간",
  "common.sort": "정렬",
  "common.cost": "비용",
  "common.sessions": "세션",
  "common.users": "사용자",
  "common.tools": "도구",
  "common.toolUsage": "도구 사용",
  "common.messages": "메시지",
  "common.noData": "데이터 없음",
  "common.loading": "로딩 중...",
  "common.prev": "이전",
  "common.next": "다음",
  "common.networkError": "네트워크 오류",
  "common.period.7d": "7일",
  "common.period.30d": "30일",
  "common.period.90d": "90일",
  "common.ofTotal": "합계 중",

  // KPI cards
  "kpi.activeUsers": "활성 사용자",
  "kpi.sessions": "세션 수",
  "kpi.registeredUsers": "등록된 사용자 수",
  "kpi.allPeriod": "전체 기간:",
  "kpi.tokens": "토큰 사용량",
  "kpi.cacheInputOutput": "입출력:",
  "kpi.cache": "캐시:",
  "kpi.input": "입력:",
  "kpi.output": "출력:",
  "kpi.estimatedCost": "예상 비용",
  "kpi.periodTotal": "선택 기간 합계",

  // Charts
  "chart.activity.title": "활동 추이",
  "chart.activity.description": "일별 세션 및 도구 호출",
  "chart.sessions": "세션",
  "chart.toolCalls": "도구 호출",
  "chart.usageCount": "사용 횟수",
  "chart.toolUsage.title": "도구 사용 빈도 Top 10",
  "chart.toolUsage.description": "호출 횟수 순위",
  "chart.modelCost.title": "모델별 비용 분포",
  "chart.modelCost.description": "선택 기간의 모델 사용 비용",
  "chart.costTrend.title": "일별 비용 추이",
  "chart.costTrend.titleFull": "일별 비용 추이 (모델별)",
  "chart.costTrend.description": "모델별 누적 비용",
  "chart.toolCategory.categoryTitle": "카테고리별 사용 비율",
  "chart.toolCategory.top15": "도구 사용 빈도 Top 15",

  // Tables
  "table.rank": "순위",
  "table.user": "사용자",
  "table.sessions": "세션",
  "table.messages": "메시지",
  "table.toolUsage": "도구 사용",
  "table.cost": "비용",
  "table.topTool": "주요 도구",
  "table.project": "프로젝트",
  "table.users": "사용자",
  "table.workTime": "작업 시간",
  "table.lastUsed": "최근 사용",
  "table.model": "모델",
  "table.requests": "요청 수",
  "table.inputTokens": "입력 토큰",
  "table.outputTokens": "출력 토큰",
  "table.cacheRead": "캐시 읽기",
  "table.share": "점유율",

  // Page: Overview
  "page.overview.title": "개요",
  "page.overview.description": "Claude Code 사용 현황 전체 요약",
  "page.overview.heading": "대시보드",
  "page.overview.projectSessions": "프로젝트별 세션 수",
  "page.overview.projectsDescription": "상위 프로젝트 사용 현황",
  "page.overview.noData": "데이터가 아직 없습니다",
  "page.overview.noDataHint": "시드 데이터를 가져오거나 훅을 설정하세요",

  // Page: Ranking
  "page.ranking.title": "순위",
  "page.ranking.description": "사용자별 Claude Code 사용 현황 순위",
  "page.ranking.heading": "사용자 순위",
  "page.ranking.tableTitle": "사용자 순위",
  "page.ranking.participants": "참여 사용자 수",
  "page.ranking.totalSessions": "총 세션",
  "page.ranking.totalCost": "총 비용",

  // Page: Users
  "page.users.title": "사용자 목록",
  "page.users.description": "Claude Code 사용자",
  "page.users.heading": "사용자 목록",
  "page.users.count": "전체 {count} 사용자 (최근 90일)",
  "page.users.noUsers": "사용자가 없습니다",
  "page.users.topTool": "주요 도구:",

  // Page: Sessions
  "page.sessions.title": "세션 목록",
  "page.sessions.description": "Claude Code 전체 세션 이력",
  "page.sessions.heading": "세션 목록",
  "page.sessions.count": "전체 {count} 세션",
  "page.sessions.noSessions": "세션이 없습니다",
  "page.sessions.pagination": "{page} / {total} 페이지",

  // Page: Projects
  "page.projects.title": "프로젝트 분석",
  "page.projects.description": "프로젝트별 Claude Code 사용 현황",
  "page.projects.heading": "프로젝트 분석",
  "page.projects.count": "프로젝트 수",
  "page.projects.totalSessions": "총 세션",
  "page.projects.totalCost": "총 비용",
  "page.projects.chartTitle": "프로젝트별 세션 수 Top 12",
  "page.projects.tableTitle": "프로젝트 상세",
  "page.projects.sessionCount": "세션 수",

  // Page: Tools
  "page.tools.title": "도구 분석",
  "page.tools.description": "도구 사용 현황 상세 분석",
  "page.tools.heading": "도구 분석",
  "page.tools.trendTitle": "도구 사용 추이 (일별)",
  "page.tools.skills": "스킬 목록",
  "page.tools.subagents": "서브에이전트 목록",
  "page.tools.mcpTools": "MCP 도구 목록",
  "page.tools.noSkillData": "스킬 데이터 없음",
  "page.tools.noSubagentData": "서브에이전트 데이터 없음",

  // Page: Models
  "page.models.title": "모델 / 비용",
  "page.models.description": "AI 모델 사용 현황 및 비용 분석",
  "page.models.heading": "모델 / 비용 분석",
  "page.models.totalCost": "총 비용",
  "page.models.totalTokens": "총 토큰 수",
  "page.models.modelCount": "사용 모델 수",
  "page.models.costEfficiency": "비용 효율 지표",
  "page.models.highEfficiency": "고효율",
  "page.models.mediumEfficiency": "중효율",
  "page.models.lowEfficiency": "저효율",
  "page.models.tableTitle": "모델별 상세 통계",

  // Page: Insights
  "page.insights.title": "AI 인사이트",
  "page.insights.description": "AI 분석 기반 사용 현황 인사이트",
  "page.insights.heading": "AI 인사이트",
  "page.insights.generate": "새 인사이트 생성",
  "page.insights.generating": "생성 중...",
  "page.insights.error": "인사이트 생성 오류",
  "page.insights.generationFailed": "생성에 실패했습니다",
  "page.insights.apiKeyHint":
    "ANTHROPIC_API_KEY가 .env.local에 설정되어 있는지 확인하세요",
  "page.insights.empty": "인사이트가 아직 없습니다",
  "page.insights.emptyHint":
    '위의 "새 인사이트 생성" 버튼을 눌러 AI 분석을 시작하세요.',
  "page.insights.apiKeyNote": "* ANTHROPIC_API_KEY 설정이 필요합니다",
  "page.insights.reportTitle": "AI 분석 보고서",

  // Insight types
  "insight.weeklySummary": "주간 요약",
  "insight.costOptimization": "비용 최적화",
  "insight.anomaly": "이상 감지",
  "insight.userInsight": "사용자 분석",
  "insight.default": "인사이트",

  // Page: User Detail
  "page.userDetail.title": "사용자 상세",
  "page.userDetail.notFound": "사용자를 찾을 수 없습니다",
  "page.userDetail.notFoundDesc": "해당 사용자가 없습니다.",
  "page.userDetail.usageOf": "{name}의 사용 현황",
  "page.userDetail.sessions": "세션 수",
  "page.userDetail.toolUsage": "도구 사용 횟수",
  "page.userDetail.estimatedCost": "예상 비용",
  "page.userDetail.activityTrend": "활동 추이",
  "page.userDetail.toolTop10": "도구 사용 Top 10",
  "page.userDetail.modelCost": "모델별 비용",
  "page.userDetail.recentSessions": "최근 세션",
  "page.userDetail.noSessions": "세션이 없습니다",
  "page.userDetail.toolUsageLabel": "도구 사용",
  "page.userDetail.usageCount": "사용 횟수",

  // Header / Refresh
  "header.refresh": "새로고침",
  "header.autoRefresh": "자동 새로고침",
  "header.lastUpdated": "업데이트: {time}",
  "header.refreshing": "새로고침 중...",

  // Breadcrumbs
  "breadcrumb.home": "홈",

  // Empty states
  "empty.title": "데이터 없음",
  "empty.description": "표시할 데이터가 아직 없습니다.",
  "empty.hint": "데이터가 수집되면 여기에 표시됩니다.",

  // KPI trends
  "kpi.trend.up": "전기 대비 +{pct}%",
  "kpi.trend.down": "전기 대비 -{pct}%",
  "kpi.trend.neutral": "전기 대비 변화 없음",
  "kpi.vsLastPeriod": "전기 대비",
};

export const translations: Record<Locale, TranslationMap> = { ja, en, ko };
