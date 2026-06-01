## Context

The current `/login` UI uses `supabase.auth.signInWithOtp()` and magic-link copy. The project is currently deploying without a verified custom email domain, so email-dependent auth can block development and internal testing. Supabase already supports email/password auth and can be configured in Dashboard to skip email confirmation during development.

## Goals / Non-Goals

**Goals:**

- Use Supabase Auth email/password registration and login from the browser client.
- Support the development setting where Supabase Email Provider has Confirm Email disabled.
- Add `NEXT_PUBLIC_REQUIRE_EMAIL_CONFIRMATION=false` as the local/deployment switch for signup success copy.
- Give users clear Chinese messages for successful signup/login and common auth failures.
- Document Supabase Dashboard setup and the difference between development and production email behavior.
- Preserve existing protected routes, server auth helpers, RLS, and visual styling.

**Non-Goals:**

- Do not integrate Resend.
- Do not add `RESEND_API_KEY`.
- Do not implement custom email sending.
- Do not bypass Supabase Auth.
- Do not disable RLS or expose service-role keys.
- Do not redesign the login page beyond the controls needed for email/password registration and login.

## Decisions

### Use one auth form with mode switching

Keep the existing `/login` route and `LoginForm` component, but replace magic-link behavior with an email/password form that supports "登录" and "注册" modes. This avoids introducing a new route while making the temporary development flow explicit.

Alternative considered: add a separate `/register` route. Rejected for this temporary change because it increases routing and copy surface without changing the underlying Supabase Auth calls.

### Use Supabase browser auth APIs only

Registration SHALL call:

```ts
supabase.auth.signUp({ email, password })
```

Login SHALL call:

```ts
supabase.auth.signInWithPassword({ email, password })
```

No service-role client or server action should be used for these user-initiated auth operations.

### Email confirmation copy is environment-controlled

Add a small client-readable helper or inline check for:

```env
NEXT_PUBLIC_REQUIRE_EMAIL_CONFIRMATION=false
```

When false, signup success should not instruct the user to check email. If Supabase returns a session, route to the post-login destination immediately. If Supabase returns no session, show "注册成功，请返回登录。"

When true, signup success without session should show "注册成功，请检查邮箱完成验证。"

### Friendly error normalization

Normalize Supabase auth errors before showing them:

- Invalid credentials: "邮箱或密码不正确。"
- Unconfirmed email: "邮箱尚未验证。开发环境请确认 Supabase 已关闭 Confirm Email；正式环境请前往邮箱完成验证。"
- Rate limits or email sending pressure: friendly retry-later copy.
- Other errors: generic Chinese failure message without raw English provider text.

### Forgot password handling

If password reset UI exists or is added, it should call Supabase reset-password functionality and clearly state that password reset still depends on Supabase email delivery. For this temporary change, password reset should not be removed and should not gain custom SMTP logic.

### Documentation

Create `docs/auth.md` if no README auth section exists. The document should include:

- Supabase Dashboard path: Authentication -> Providers -> Email -> disable Confirm Email.
- `.env` setting: `NEXT_PUBLIC_REQUIRE_EMAIL_CONFIRMATION=false`.
- This mode is only for development/internal testing.
- Production must configure Resend Custom SMTP or equivalent SMTP and re-enable email confirmation.
- Forgot password and verification emails still depend on email service availability.

## Risks / Trade-offs

- [Risk] Development signup without email confirmation allows unverified emails. -> Mitigation: document this as development/internal-only and require re-enabling confirmation before production.
- [Risk] Existing magic-link users may expect email-link login. -> Mitigation: keep the route stable and update copy clearly to email/password.
- [Risk] Supabase Dashboard may still have Confirm Email enabled. -> Mitigation: unconfirmed email error explicitly points developers to the Dashboard setting.
- [Risk] Password reset may still hit Supabase email limits. -> Mitigation: keep a clear user-facing warning and production SMTP requirement.

## Migration Plan

1. Add `NEXT_PUBLIC_REQUIRE_EMAIL_CONFIRMATION=false` to `.env.example`.
2. Update `LoginForm` from magic link to email/password login and registration.
3. Add friendly auth error normalization.
4. Add or preserve forgot-password copy without adding Resend.
5. Add `docs/auth.md` with Supabase Dashboard and production SMTP instructions.
6. Verify signup/login behavior with Confirm Email disabled and type/build checks.

Rollback: restore magic-link submission in `LoginForm` and remove the development email confirmation copy switch, leaving docs available for future auth setup reference.
