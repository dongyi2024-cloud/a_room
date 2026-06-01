## ADDED Requirements

### Requirement: Users can register with email and password
The system SHALL allow a user to register through Supabase Auth using an email address and password, without custom email sending or service-role auth operations.

#### Scenario: Signup returns a session in development mode
- **WHEN** `NEXT_PUBLIC_REQUIRE_EMAIL_CONFIRMATION` is `false` and Supabase returns a session from `supabase.auth.signUp({ email, password })`
- **THEN** the system routes the user to the normal post-login destination without telling the user to check email

#### Scenario: Signup succeeds without a session in development mode
- **WHEN** `NEXT_PUBLIC_REQUIRE_EMAIL_CONFIRMATION` is `false` and Supabase signup succeeds without returning a session
- **THEN** the system shows a friendly Chinese success message such as `注册成功，请返回登录。`

#### Scenario: Signup succeeds when email confirmation is required
- **WHEN** `NEXT_PUBLIC_REQUIRE_EMAIL_CONFIRMATION` is `true` and Supabase signup succeeds without returning a session
- **THEN** the system tells the user `注册成功，请检查邮箱完成验证。`

### Requirement: Users can log in with email and password
The system SHALL allow a registered user to log in through Supabase Auth using `supabase.auth.signInWithPassword({ email, password })`.

#### Scenario: Successful login
- **WHEN** a user submits valid email and password credentials
- **THEN** the system signs the user in through Supabase Auth and redirects to the configured `next` path or the project default post-login page

#### Scenario: Invalid credentials
- **WHEN** Supabase rejects login because the email or password is wrong
- **THEN** the system shows `邮箱或密码不正确。`

#### Scenario: Unconfirmed email
- **WHEN** Supabase rejects login because the email is not confirmed
- **THEN** the system shows `邮箱尚未验证。开发环境请确认 Supabase 已关闭 Confirm Email；正式环境请前往邮箱完成验证。`

#### Scenario: Other login failure
- **WHEN** Supabase returns another login error
- **THEN** the system shows a friendly Chinese error and does not display raw English provider text

### Requirement: Auth flow preserves Supabase security boundaries
The system MUST use Supabase Auth for registration and login, MUST keep RLS enabled, and MUST NOT expose service-role credentials to the client.

#### Scenario: No custom email provider is added
- **WHEN** the email/password development auth flow is implemented
- **THEN** the codebase does not add Resend integration, `RESEND_API_KEY`, or custom mail sending

#### Scenario: No auth bypass is introduced
- **WHEN** the email/password development auth flow is implemented
- **THEN** protected routes still rely on the existing Supabase session/user helpers and database RLS remains unchanged

### Requirement: Email confirmation behavior is documented and configurable
The system SHALL document the development email confirmation mode and expose the client-readable setting `NEXT_PUBLIC_REQUIRE_EMAIL_CONFIRMATION=false` in `.env.example`.

#### Scenario: Development setup is documented
- **WHEN** a developer reads the auth documentation
- **THEN** they can find the Supabase Dashboard path `Authentication -> Providers -> Email -> disable Confirm Email`

#### Scenario: Production setup is documented
- **WHEN** a developer reads the auth documentation
- **THEN** they are told that production must configure Resend Custom SMTP or an equivalent SMTP provider and re-enable email confirmation before launch

### Requirement: Forgot password remains email-service dependent
The system SHALL preserve or document forgot-password behavior as a Supabase email-dependent flow and MUST NOT remove it as part of this temporary change.

#### Scenario: Forgot password is shown or described
- **WHEN** the user encounters forgot-password copy or documentation
- **THEN** the system explains that password reset depends on Supabase email delivery and may be rate-limited in development

#### Scenario: Production password reset requirement is documented
- **WHEN** a developer reads the auth documentation
- **THEN** they are told that reliable password reset in production requires configured SMTP
