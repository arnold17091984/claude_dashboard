"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Tab = "login" | "register";

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("login");

  // Login state
  const [loginNickname, setLoginNickname] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Register state
  const [regNickname, setRegNickname] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regInviteCode, setRegInviteCode] = useState("");
  const [regError, setRegError] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [setupCopied, setSetupCopied] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: loginNickname, password: loginPassword }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || "ログインに失敗しました");
        return;
      }
      router.replace("/");
    } catch {
      setLoginError("ネットワークエラーが発生しました");
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setRegError("");
    setRegLoading(true);
    try {
      const res = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: regNickname,
          password: regPassword,
          inviteCode: regInviteCode,
        }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setRegError(data.error || "登録に失敗しました");
        return;
      }
      setNewApiKey(data.apiKey);
    } catch {
      setRegError("ネットワークエラーが発生しました");
    } finally {
      setRegLoading(false);
    }
  }

  function handleCopy() {
    if (!newApiKey) return;
    navigator.clipboard.writeText(newApiKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleContinue() {
    router.replace("/");
  }

  // After registration: show API key
  if (newApiKey) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-logo">
            <span className="login-logo-icon">CC</span>
          </div>
          <h1 className="login-title">登録完了</h1>
          <p className="login-subtitle">
            アカウントが作成されました。以下のAPIキーをClaude Codeのフック設定に追加してください。
          </p>

          <div className="api-key-box">
            <p className="api-key-label">あなたのAPIキー</p>
            <div className="api-key-value-row">
              <code className="api-key-value">{newApiKey}</code>
              <button
                type="button"
                onClick={handleCopy}
                className="api-key-copy-btn"
              >
                {copied ? "コピー済み" : "コピー"}
              </button>
            </div>
            <p className="api-key-warning">
              このキーは一度しか表示されません。必ず保存してください。
            </p>
          </div>

          <div className="api-key-instructions">
            <p className="instructions-title">ワンコマンドセットアップ</p>
            <p className="instructions-desc">
              ターミナルで以下のコマンドを実行するだけで、Claude Codeのフック設定が自動で完了します。
            </p>
            <div className="setup-command-box">
              <code className="setup-command-value">
                {`curl -s ${typeof window !== "undefined" ? window.location.origin : ""}/api/v1/auth/setup-script?key=${newApiKey} | bash`}
              </code>
              <button
                type="button"
                onClick={() => {
                  const cmd = `curl -s ${window.location.origin}/api/v1/auth/setup-script?key=${newApiKey} | bash`;
                  navigator.clipboard.writeText(cmd).then(() => {
                    setSetupCopied(true);
                    setTimeout(() => setSetupCopied(false), 2000);
                  });
                }}
                className="api-key-copy-btn"
              >
                {setupCopied ? "コピー済み" : "コピー"}
              </button>
            </div>
            <p className="setup-note">
              ※ jq が必要です（<code>brew install jq</code>）
            </p>
          </div>

          <button
            type="button"
            onClick={handleContinue}
            className="login-btn"
          >
            ダッシュボードへ進む
          </button>
        </div>

        <style>{loginStyles}</style>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <span className="login-logo-icon">CC</span>
        </div>
        <h1 className="login-title">Claude Code Dashboard</h1>
        <p className="login-subtitle">利用状況の管理・分析</p>

        <div className="login-tabs">
          <button
            type="button"
            className={`login-tab ${tab === "login" ? "login-tab--active" : ""}`}
            onClick={() => setTab("login")}
          >
            ログイン
          </button>
          <button
            type="button"
            className={`login-tab ${tab === "register" ? "login-tab--active" : ""}`}
            onClick={() => setTab("register")}
          >
            新規登録
          </button>
        </div>

        {tab === "login" && (
          <form onSubmit={handleLogin} className="login-form">
            <div className="form-group">
              <label className="form-label">ニックネーム</label>
              <input
                type="text"
                value={loginNickname}
                onChange={(e) => setLoginNickname(e.target.value)}
                placeholder="your-nickname"
                required
                autoComplete="username"
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">パスワード</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="form-input"
              />
            </div>

            {loginError && <p className="form-error">{loginError}</p>}

            <button
              type="submit"
              disabled={loginLoading}
              className="login-btn"
            >
              {loginLoading ? "ログイン中..." : "ログイン"}
            </button>
          </form>
        )}

        {tab === "register" && (
          <form onSubmit={handleRegister} className="login-form">
            <div className="form-group">
              <label className="form-label">ニックネーム</label>
              <input
                type="text"
                value={regNickname}
                onChange={(e) => setRegNickname(e.target.value)}
                placeholder="your-nickname"
                required
                autoComplete="username"
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">パスワード</label>
              <input
                type="password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                placeholder="6文字以上"
                required
                autoComplete="new-password"
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">招待コード</label>
              <input
                type="text"
                value={regInviteCode}
                onChange={(e) => setRegInviteCode(e.target.value)}
                placeholder="招待コードを入力"
                className="form-input"
              />
            </div>

            {regError && <p className="form-error">{regError}</p>}

            <button
              type="submit"
              disabled={regLoading}
              className="login-btn"
            >
              {regLoading ? "登録中..." : "アカウントを作成"}
            </button>
          </form>
        )}
      </div>

      <style>{loginStyles}</style>
    </div>
  );
}

const loginStyles = `
  * { box-sizing: border-box; margin: 0; padding: 0; }

  .login-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: oklch(0.985 0.004 65);
    font-family: var(--font-geist-sans, system-ui, sans-serif);
    padding: 1rem;
  }

  .login-card {
    background: oklch(0.998 0.002 65);
    border: 1px solid oklch(0.922 0.008 65);
    border-radius: 18px;
    padding: 2.5rem 2rem;
    width: 100%;
    max-width: 420px;
    box-shadow: 0 4px 24px oklch(0 0 0 / 0.06);
  }

  .login-logo {
    display: flex;
    justify-content: center;
    margin-bottom: 1.25rem;
  }

  .login-logo-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: 14px;
    background: oklch(0.600 0.190 65);
    color: oklch(0.985 0.005 65);
    font-weight: 700;
    font-size: 1.1rem;
    letter-spacing: -0.5px;
  }

  .login-title {
    text-align: center;
    font-size: 1.4rem;
    font-weight: 700;
    color: oklch(0.130 0.010 65);
    margin-bottom: 0.35rem;
    letter-spacing: -0.5px;
  }

  .login-subtitle {
    text-align: center;
    font-size: 0.875rem;
    color: oklch(0.480 0.015 65);
    margin-bottom: 1.75rem;
  }

  .login-tabs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    background: oklch(0.955 0.008 65);
    border-radius: 10px;
    padding: 3px;
    margin-bottom: 1.5rem;
  }

  .login-tab {
    padding: 0.5rem 1rem;
    border: none;
    background: transparent;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    color: oklch(0.480 0.015 65);
    cursor: pointer;
    transition: background 150ms, color 150ms;
  }

  .login-tab--active {
    background: oklch(0.998 0.002 65);
    color: oklch(0.130 0.010 65);
    box-shadow: 0 1px 4px oklch(0 0 0 / 0.08);
  }

  .login-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .form-label {
    font-size: 0.8125rem;
    font-weight: 500;
    color: oklch(0.400 0.008 65);
  }

  .form-input {
    padding: 0.625rem 0.875rem;
    border: 1px solid oklch(0.870 0.010 65);
    border-radius: 8px;
    font-size: 0.9375rem;
    background: oklch(0.998 0.002 65);
    color: oklch(0.130 0.010 65);
    outline: none;
    transition: border-color 150ms, box-shadow 150ms;
  }

  .form-input:focus {
    border-color: oklch(0.600 0.190 65);
    box-shadow: 0 0 0 3px oklch(0.600 0.190 65 / 0.15);
  }

  .form-input::placeholder {
    color: oklch(0.660 0.010 65);
  }

  .form-error {
    font-size: 0.8125rem;
    color: oklch(0.577 0.245 27.325);
    background: oklch(0.577 0.245 27.325 / 0.08);
    border: 1px solid oklch(0.577 0.245 27.325 / 0.2);
    border-radius: 8px;
    padding: 0.5rem 0.75rem;
  }

  .login-btn {
    margin-top: 0.25rem;
    padding: 0.6875rem 1rem;
    background: oklch(0.600 0.190 65);
    color: oklch(0.985 0.005 65);
    border: none;
    border-radius: 8px;
    font-size: 0.9375rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 150ms, opacity 150ms;
  }

  .login-btn:hover {
    background: oklch(0.520 0.175 65);
  }

  .login-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* API Key display after registration */
  .api-key-box {
    background: oklch(0.955 0.008 65);
    border: 1px solid oklch(0.870 0.010 65);
    border-radius: 10px;
    padding: 1rem;
    margin-bottom: 1.25rem;
  }

  .api-key-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: oklch(0.480 0.015 65);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.5rem;
  }

  .api-key-value-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .api-key-value {
    flex: 1;
    font-family: var(--font-geist-mono, monospace);
    font-size: 0.8125rem;
    color: oklch(0.130 0.010 65);
    word-break: break-all;
  }

  .api-key-copy-btn {
    flex-shrink: 0;
    padding: 0.375rem 0.75rem;
    background: oklch(0.600 0.190 65);
    color: oklch(0.985 0.005 65);
    border: none;
    border-radius: 6px;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 150ms;
  }

  .api-key-copy-btn:hover {
    background: oklch(0.520 0.175 65);
  }

  .api-key-warning {
    font-size: 0.75rem;
    color: oklch(0.577 0.245 27.325);
    font-weight: 500;
  }

  .api-key-instructions {
    margin-bottom: 1.25rem;
  }

  .instructions-title {
    font-size: 0.8125rem;
    font-weight: 600;
    color: oklch(0.400 0.008 65);
    margin-bottom: 0.5rem;
  }

  .instructions-list {
    font-size: 0.8125rem;
    color: oklch(0.480 0.015 65);
    padding-left: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    line-height: 1.6;
  }

  .instructions-desc {
    font-size: 0.8125rem;
    color: oklch(0.480 0.015 65);
    margin-bottom: 0.75rem;
    line-height: 1.6;
  }

  .setup-command-box {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    background: oklch(0.180 0.010 65);
    border-radius: 8px;
    padding: 0.75rem;
    margin-bottom: 0.5rem;
  }

  .setup-command-value {
    flex: 1;
    font-family: var(--font-geist-mono, monospace);
    font-size: 0.75rem;
    color: oklch(0.850 0.060 65);
    word-break: break-all;
    line-height: 1.5;
  }

  .setup-note {
    font-size: 0.75rem;
    color: oklch(0.580 0.015 65);
  }

  .setup-note code {
    font-family: var(--font-geist-mono, monospace);
    background: oklch(0.922 0.008 65);
    padding: 0.1em 0.35em;
    border-radius: 4px;
    font-size: 0.9em;
    color: oklch(0.280 0.006 65);
  }
`;
