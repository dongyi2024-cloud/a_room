"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type LoginFormProps = {
  nextPath: string;
};

export function LoginForm({ nextPath }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const redirectUrl =
        typeof window === "undefined"
          ? undefined
          : `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectUrl
        }
      });

      if (error) {
        throw error;
      }

      setStatusMessage("登录链接已发送，请在当前设备打开邮件完成进入。");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "暂时无法发起登录，请稍后再试。");
    } finally {
      setIsSubmitting(false);
    }
  }

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
          <p className="auth-note-english">Sign in with a magic link.</p>
          <p className="auth-note-chinese">使用邮箱登录链接进入，不需要单独设置密码。</p>
        </div>
      </div>

      <form className="auth-form-panel" onSubmit={handleSubmit}>
        <div className="auth-panel-head cn-serif">
          <p className="auth-panel-kicker">Email Sign In</p>
          <h2 className="auth-panel-title">邮箱登录</h2>
          <p className="auth-panel-copy">
            输入常用邮箱，我们会向你发送一封登录邮件。请在同一设备内打开链接完成进入。
          </p>
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

        {errorMessage ? <p className="form-error auth-feedback">{errorMessage}</p> : null}
        {statusMessage ? <p className="form-success auth-feedback">{statusMessage}</p> : null}

        <button className="primary-link button-reset auth-submit" disabled={isSubmitting} type="submit">
          {isSubmitting ? "正在发送登录链接…" : "发送登录链接"}
        </button>
      </form>
    </section>
  );
}
