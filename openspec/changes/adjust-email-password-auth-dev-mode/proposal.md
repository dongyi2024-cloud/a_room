## Why

The current login flow uses Supabase magic links, but the project does not yet have a verified Resend sending domain for reliable email delivery. During development and internal testing, Woolf Room needs a Supabase-native email/password flow that works when Supabase Confirm Email is disabled, without adding Resend or weakening auth/RLS boundaries.

## What Changes

- Replace the current magic-link-only login form with email/password registration and login actions using Supabase Auth:
  - `supabase.auth.signUp({ email, password })`
  - `supabase.auth.signInWithPassword({ email, password })`
- Add development-mode behavior controlled by `NEXT_PUBLIC_REQUIRE_EMAIL_CONFIRMATION=false`.
- When email confirmation is not required and Supabase returns a session after signup, route the user to the normal post-login destination.
- When signup succeeds without a session, show a Chinese success message that does not incorrectly force the user to check email unless email confirmation mode is enabled.
- Map login failures to friendly Chinese messages, including wrong credentials and unconfirmed email.
- Preserve forgot-password/reset-password behavior if present, but document that it depends on Supabase email delivery and requires SMTP for production reliability.
- Add documentation for the required Supabase Dashboard setting: Authentication -> Providers -> Email -> disable Confirm Email for development.
- Do not add Resend integration, `RESEND_API_KEY`, custom mail sending, service-role exposure, RLS changes, or auth bypasses.

## Capabilities

### New Capabilities

- `email-password-auth`: Defines the email/password registration and login behavior, development-mode email-confirmation settings, user-facing auth error handling, and auth setup documentation.

### Modified Capabilities

- None.

## Impact

- Affected UI: `components/auth/login-form.tsx` and the existing `/login` route.
- Affected Supabase Auth usage: browser client email/password sign-up and sign-in only; server-side auth helpers and RLS remain unchanged.
- Affected config: `.env.example` gains `NEXT_PUBLIC_REQUIRE_EMAIL_CONFIRMATION=false`.
- Affected docs: add `docs/auth.md` or README auth documentation explaining development vs production email behavior.
- Deployment impact: Vercel must set `NEXT_PUBLIC_REQUIRE_EMAIL_CONFIRMATION=false` for the current development deployment unless email confirmation is intentionally enabled.
