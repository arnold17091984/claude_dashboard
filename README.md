# Claude Code Dashboard

Claude Code の利用状況を可視化するダッシュボード。セッション・コスト・ツール使用などを分析できます。

**対応言語:** 日本語 / English / 한국어

## スクリーンショット

| 概要 | ランキング | モデル / コスト |
|------|------------|-----------------|
| KPI + アクティビティグラフ | ユーザー別ランキング | コスト推移・モデル比較 |

---

## セットアップ方法

### 方法 A — Docker（推奨・最速）

Docker さえあれば他のツール不要。

```bash
git clone https://github.com/arnold17091984/claude_dashboard.git
cd claude_dashboard

# 設定ファイルを作成
cp .env.example .env
# .env を編集（DASHBOARD_API_KEY を任意の文字列に変更、ANTHROPIC_API_KEY はオプション）

# 起動
docker compose up -d

# ブラウザで開く
open http://localhost:3000
```

停止:
```bash
docker compose down
```

---

### 方法 B — ローカル開発環境

#### 前提条件

| ツール | バージョン | インストール方法 |
|--------|-----------|-----------------|
| Node.js | **v20.18.2** | [nvm](https://github.com/nvm-sh/nvm) 推奨 |
| pnpm | latest | `npm install -g pnpm` |

> **重要:** Node.js v22 では Turbopack が正常動作しないため、v20 を使用してください。

```bash
git clone https://github.com/arnold17091984/claude_dashboard.git
cd claude_dashboard

# Node.js バージョンを合わせる（nvm 使用の場合）
nvm install   # .nvmrc の値 (20.18.2) を自動読み込み
nvm use

# 依存パッケージをインストール
pnpm install

# 設定ファイルを作成
cp .env.example .env.local
# .env.local を編集

# データベースを初期化
mkdir -p data
pnpm drizzle-kit push

# 開発サーバーを起動
bash scripts/dev.sh
```

ブラウザで http://localhost:3000 を開く。

---

## 環境変数

`.env.example` をコピーして編集:

```bash
# データベースパス（変更不要）
DATABASE_URL=./data/dashboard.db

# API認証キー（任意の文字列を設定）
DASHBOARD_API_KEY=your-api-key-here

# AIインサイト機能（任意）
ANTHROPIC_API_KEY=sk-ant-...

# コレクター設定（Claude Code hooks 連携時）
DASHBOARD_URL=http://localhost:3000
DASHBOARD_USER_ID=your-user-id
```

---

## Claude Code データ収集（hooks 連携）

Claude Code のセッションデータを自動的にダッシュボードへ送信できます。

```bash
# コレクターをインストール（対話式）
bash collector/install.sh
```

または手動で `~/.claude/settings.json` に追加:

```json
{
  "hooks": {
    "PostToolUse": [...],
    "Stop": [
      {
        "matcher": "",
        "hooks": [{
          "type": "command",
          "command": "bash /path/to/collector/collect-on-session-end.sh"
        }]
      }
    ]
  }
}
```

---

## スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | Next.js 16, React, Tailwind CSS |
| UIコンポーネント | shadcn/ui, Recharts |
| バックエンド API | Hono |
| ORM / DB | Drizzle ORM + SQLite (better-sqlite3) |
| AI機能 | Anthropic Claude API |

---

## トラブルシューティング

### `better-sqlite3` のビルドエラー

Node.js のバージョン変更後に起こることがあります:

```bash
pnpm rebuild better-sqlite3
```

### ページが表示されない / Turbopack がハングする

Node.js v22 を使用している場合に発生します。v20 に切り替えてください:

```bash
nvm use 20.18.2
bash scripts/dev.sh
```

### Docker でポート競合

```bash
# 使用中のポートを確認
lsof -i :3000

# ポートを変更する場合は docker-compose.yml の ports を編集
ports:
  - "3001:3000"
```
