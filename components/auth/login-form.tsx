"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type LoginFormProps = {
  nextPath: string;
};

type AuthMode = "login" | "signup";

const REQUIRE_EMAIL_CONFIRMATION = process.env.NEXT_PUBLIC_REQUIRE_EMAIL_CONFIRMATION === "true";

function normalizeAuthError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const normalized = message.toLowerCase();

  if (
    normalized.includes("signups not allowed") ||
    normalized.includes("signup disabled") ||
    normalized.includes("signups are disabled") ||
    normalized.includes("registration disabled")
  ) {
    return "当前项目未开启邮箱注册，请在 Supabase Auth 设置中允许用户注册。";
  }

  if (
    normalized.includes("email logins are disabled") ||
    normalized.includes("email signup is disabled") ||
    normalized.includes("email signups are disabled") ||
    normalized.includes("provider is not enabled")
  ) {
    return "当前 Supabase 项目未开启 Email 登录/注册，请在 Authentication → Providers → Email 中启用 Email Provider。";
  }

  if (
    normalized.includes("user already registered") ||
    normalized.includes("already registered") ||
    normalized.includes("already exists") ||
    normalized.includes("user exists")
  ) {
    return "该邮箱已注册，请直接登录。";
  }

  if (
    normalized.includes("invalid login credentials") ||
    normalized.includes("invalid credentials") ||
    normalized.includes("email or password")
  ) {
    return "邮箱或密码不正确。";
  }

  if (
    normalized.includes("email not confirmed") ||
    normalized.includes("email_not_confirmed") ||
    normalized.includes("not confirmed")
  ) {
    return "邮箱尚未验证。开发环境请确认 Supabase 已关闭 Confirm Email；正式环境请前往邮箱完成验证。";
  }

  if (normalized.includes("rate limit") || normalized.includes("too many") || normalized.includes("over_email_send_rate_limit")) {
    return "请求过于频繁，邮件服务可能触发了频率限制，请稍后再试。";
  }

  if (normalized.includes("password")) {
    return "密码不符合要求，请至少输入 6 位字符。";
  }

  return "暂时无法完成操作，请稍后再试。";
}

function navigateTo(path: string) {
  window.location.assign(path);
}

export function LoginForm({ nextPath }: LoginFormProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();

      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password
        });

        if (error) {
          throw error;
        }

        if (data.session) {
          navigateTo(nextPath);
          return;
        }

        setStatusMessage(
          REQUIRE_EMAIL_CONFIRMATION ? "注册成功，请检查邮箱完成验证。" : "注册成功，请返回登录。"
        );
        setMode("login");
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        throw error;
      }

      navigateTo(nextPath);
    } catch (error) {
      console.warn("Supabase auth error", error);
      setErrorMessage(normalizeAuthError(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePasswordReset() {
    setIsResettingPassword(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      if (!email.trim()) {
        setErrorMessage("请先输入邮箱地址，再尝试重置密码。");
        return;
      }

      const redirectTo =
        typeof window === "undefined"
          ? undefined
          : `${window.location.origin}/login?next=${encodeURIComponent(nextPath)}`;
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo
      });

      if (error) {
        throw error;
      }

      setStatusMessage("密码重置邮件已尝试发送。开发阶段如果触发邮件频率限制，请稍后再试。");
    } catch (error) {
      console.warn("Supabase password reset error", error);
      setErrorMessage(normalizeAuthError(error));
    } finally {
      setIsResettingPassword(false);
    }
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setErrorMessage(null);
    setStatusMessage(null);
  }

  const isSignup = mode === "signup";

  return (
    <section className="soft-card auth-card">
      <div className="auth-intro cn-serif">
        <p className="auth-kicker">A ROOM OF ONE&apos;S OWN</p>
        <p className="auth-kicker auth-kicker-chinese">进入书架之前</p>
        <h1 className="auth-title">为自己留出一把钥匙</h1>
        <p className="auth-lead">
          书架、上传、阅读进度与后续的 AI 对话，都将和你的个人账户绑定。登录之后，这间房间才真正属于你。
        </p>
        <div className="auth-note-block">
          <p className="auth-note-english">Email and password access.</p>
          <p className="auth-note-chinese">开发阶段使用邮箱和密码进入，不依赖确认邮件。</p>
        </div>
      </div>

      <form className="auth-form-panel" onSubmit={handleSubmit}>
        <div className="auth-panel-head cn-serif">
          <p className="auth-panel-kicker">{isSignup ? "Create Account" : "Email Sign In"}</p>
          <h2 className="auth-panel-title">{isSignup ? "注册账户" : "邮箱登录"}</h2>
          <p className="auth-panel-copy">
            {isSignup
              ? "输入邮箱和密码，创建这间房间的个人钥匙。"
              : "输入邮箱和密码，进入你的书架、笔记和阅读现场。"}
          </p>
        </div>

        <div className="auth-mode-switch" role="tablist" aria-label="认证模式">
          <button
            aria-selected={!isSignup}
            className={`button-reset auth-mode-button ${!isSignup ? "is-active" : ""}`}
            onClick={() => switchMode("login")}
            role="tab"
            type="button"
          >
            登录
          </button>
          <button
            aria-selected={isSignup}
            className={`button-reset auth-mode-button ${isSignup ? "is-active" : ""}`}
            onClick={() => switchMode("signup")}
            role="tab"
            type="button"
          >
            注册
          </button>
        </div>

        <label className="field-stack" htmlFor="email">
          <span className="field-label">邮箱地址</span>
          <span className="field-label-english">Email address</span>
          <input
            autoComplete="email"
            className="text-input"
            id="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="reader@example.com"
            required
            type="email"
            value={email}
          />
        </label>

        <label className="field-stack" htmlFor="password">
          <span className="field-label">密码</span>
          <span className="field-label-english">Password</span>
          <input
            autoComplete={isSignup ? "new-password" : "current-password"}
            className="text-input"
            id="password"
            minLength={6}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="至少 6 位字符"
            required
            type="password"
            value={password}
          />
        </label>

        <p className="auth-panel-copy">
          忘记密码功能仍依赖 Supabase 邮件发送。开发阶段如果触发邮件频率限制，请稍后再试；正式上线前需要配置 Resend Custom SMTP。
        </p>

        {errorMessage ? <p className="form-error auth-feedback">{errorMessage}</p> : null}
        {statusMessage ? <p className="form-success auth-feedback">{statusMessage}</p> : null}

        <div className="auth-action-row">
          <button className="primary-link button-reset auth-submit" disabled={isSubmitting} type="submit">
            {isSubmitting ? "处理中…" : isSignup ? "注册并进入" : "登录"}
          </button>
          <button
            className="secondary-link button-reset auth-submit"
            disabled={isResettingPassword || isSubmitting}
            onClick={handlePasswordReset}
            type="button"
          >
            {isResettingPassword ? "正在处理…" : "忘记密码"}
          </button>
        </div>
      </form>
    </section>
  );
}
