## 1. Auth Form

- [x] 1.1 Replace magic-link submission in `components/auth/login-form.tsx` with email/password login and registration modes
- [x] 1.2 Add password input, mode switching, and copy that preserves the current page style
- [x] 1.3 Use `supabase.auth.signUp({ email, password })` for registration
- [x] 1.4 Use `supabase.auth.signInWithPassword({ email, password })` for login
- [x] 1.5 Redirect successful login or auto-login signup to the sanitized `nextPath`

## 2. User Messaging

- [x] 2.1 Add `NEXT_PUBLIC_REQUIRE_EMAIL_CONFIRMATION` handling for signup success copy
- [x] 2.2 Show development-mode signup success without telling users to check email
- [x] 2.3 Show email-confirmation success copy only when `NEXT_PUBLIC_REQUIRE_EMAIL_CONFIRMATION=true`
- [x] 2.4 Normalize invalid-credential, unconfirmed-email, rate-limit, and generic auth failures into friendly Chinese messages
- [x] 2.5 Add forgot-password guidance without adding Resend or custom email sending

## 3. Configuration and Documentation

- [x] 3.1 Add `NEXT_PUBLIC_REQUIRE_EMAIL_CONFIRMATION=false` to `.env.example`
- [x] 3.2 Add `docs/auth.md` with the Supabase Dashboard path for disabling Confirm Email in development
- [x] 3.3 Document that development mode is only for local/internal testing
- [x] 3.4 Document that production must configure Resend Custom SMTP or equivalent SMTP and re-enable email confirmation
- [x] 3.5 Document that forgot-password and verification emails depend on Supabase email delivery

## 4. Safety Verification

- [x] 4.1 Confirm no `RESEND_API_KEY` or Resend integration is added
- [x] 4.2 Confirm RLS and service-role usage are unchanged for auth
- [x] 4.3 Confirm protected routes still rely on existing Supabase session helpers
- [x] 4.4 Run `npx tsc --noEmit`
- [x] 4.5 Run `npm run build`
