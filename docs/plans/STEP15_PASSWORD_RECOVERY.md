# Step 15 — Password Recovery

> Detailed implementation plan for forgot password flow: email with reset link, reset password page, and email verification.

## Summary

Add password reset functionality using BetterAuth's built-in `sendResetPassword` callback. Users click "Forgot password?" on the sign-in form, enter their email, receive a reset link via email (Resend), and set a new password on a dedicated reset page. Email verification is included as a bonus since the same email infrastructure is needed.

---

## Design Decisions

### Email: Nodemailer + Dual-Provider Abstraction

Nodemailer as the transport layer with a dual-provider pattern matching the existing `DATABASE_PROVIDER`/`STORAGE_PROVIDER` approach:
- `EMAIL_PROVIDER=resend` (default) — Resend SMTP (free tier: 3,000 emails/month)
- `EMAIL_PROVIDER=azure` — Azure Communication Services SMTP (for Azure deployment, configured later)

Both providers use identical Nodemailer SMTP transports — only config differs. The abstraction is built now so Azure ACS can be added in step 18 without code changes.

**Env vars:** `EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM`. Azure adds `ACS_SMTP_USERNAME`, `ACS_SMTP_PASSWORD` later.

### Route Structure: New Routes Under `/auth`

Two new SvelteKit routes:
- `/auth/forgot-password` — email entry form (unauthenticated)
- `/auth/reset-password` — new password form, receives `?token=` from email link (unauthenticated)

This keeps them separate from the sign-in/sign-up page rather than adding modes to the existing tab switcher. The auth guard must be updated to allow these routes without authentication.

### Auth Guard: Prefix Match for `/auth`

Currently `handleAuthGuard` does an exact match: `canonicalPath === AUTH_PAGE_ROUTE`. This needs to become a prefix check: `canonicalPath.startsWith(AUTH_PAGE_ROUTE)` so all `/auth/*` routes are treated as auth pages (accessible without session, redirected home if already logged in).

### Email Verification: Included

Since the email infrastructure is being built anyway, enable BetterAuth's `emailVerification` with `sendOnSignUp: true`. New users get a verification email on signup. This is not blocking (`requireEmailVerification: false`) — just informational.

### Password Reset Token Handling

BetterAuth handles the full flow server-side:
1. Client calls `authClient.requestPasswordReset({ email, redirectTo })` 
2. BetterAuth generates a token in the `verification` table, calls `sendResetPassword` callback
3. Email contains a link to BetterAuth's built-in endpoint which validates the token and redirects to `/auth/reset-password?token=...`
4. Client extracts token from URL, calls `authClient.resetPassword({ newPassword, token })`

No new database tables. The existing `verification` table is reused.

---

## API / Data Spec

### BetterAuth Built-in Endpoints (no custom code needed)

| Method | Endpoint | Body |
|--------|----------|------|
| POST | `/api/auth/request-password-reset` | `{ email, redirectTo }` |
| POST | `/api/auth/reset-password` | `{ newPassword, token }` |
| POST | `/api/auth/send-verification-email` | `{ email, callbackURL }` |
| GET | `/api/auth/verify-email?token=...` | — (redirects) |

### New SvelteKit Routes

| Route | Purpose |
|-------|---------|
| `/auth/forgot-password` | Form: enter email to request reset |
| `/auth/reset-password` | Form: enter new password (token from URL param) |

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `RESEND_API_KEY` | Yes | Resend API key for sending emails |
| `ORIGIN` | Yes | Already exists — used by BetterAuth to construct reset URLs |

---

## Files to Create/Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `src/lib/server/email/index.ts` | **CREATE** | Email module entry: dual-provider via `EMAIL_PROVIDER` env var, shared `sendEmail()` function |
| 2 | `src/lib/server/email/resend.ts` | **CREATE** | Resend SMTP transport config for Nodemailer |
| 3 | `src/lib/server/email/azure.ts` | **CREATE** | Azure ACS SMTP transport config (stub, ready for step 18) |
| 4 | `src/lib/server/auth.ts` | **MODIFY** | Add `sendResetPassword` callback, `emailVerification` config |
| 5 | `src/hooks.server.ts` | **MODIFY** | Update auth guard: prefix match for `/auth` routes |
| 6 | `src/routes/auth/forgot-password/+page.svelte` | **CREATE** | Forgot password form (email input) |
| 7 | `src/routes/auth/forgot-password/+page.server.ts` | **CREATE** | Server actions: `requestReset` |
| 8 | `src/routes/auth/reset-password/+page.svelte` | **CREATE** | Reset password form (new password + confirm) |
| 9 | `src/routes/auth/reset-password/+page.server.ts` | **CREATE** | Server actions: `resetPassword`, load to validate token |
| 10 | `src/routes/auth/+page.svelte` | **MODIFY** | Add "Forgot password?" link on sign-in form |
| 11 | `messages/en.json` | **MODIFY** | Add i18n keys for password recovery |
| 12 | `messages/fi.json` | **MODIFY** | Finnish translations for password recovery |
| 13 | `package.json` | **MODIFY** | Add `nodemailer` dependency |
| 14 | `docs/SCHEMA.md` | **MODIFY** | No schema changes needed — note that `verification` table is reused |
| 15 | `tests/api/auth-password-reset.test.ts` | **CREATE** | Integration tests for forgot-password and reset-password flows |
| 16 | `AGENTS.md` | **MODIFY** | Add `RESEND_API_KEY`, `EMAIL_PROVIDER`, `EMAIL_FROM` to env vars section |

---

## Implementation Phases

### Phase 1: Dependencies & Email Infrastructure

1. Install `nodemailer` package (pinned exact version)
2. Create `src/lib/server/email/resend.ts` — Resend SMTP transport via Nodemailer
3. Create `src/lib/server/email/azure.ts` — Azure ACS SMTP transport stub (throws if configured but not yet set up)
4. Create `src/lib/server/email/index.ts`:
   - Reads `EMAIL_PROVIDER` env var (default: `resend`)
   - Exports `sendEmail({ to, subject, html, text })` function
   - Creates the appropriate Nodemailer transport based on provider
   - Graceful handling when provider API key is not set (log warning, don't throw)

### Phase 2: BetterAuth Configuration

3. Modify `src/lib/server/auth.ts`:
   - Add `sendResetPassword` callback inside `emailAndPassword` — calls `sendPasswordResetEmail`
   - Add `emailVerification` top-level option with `sendVerificationEmail` callback
   - Set `resetPasswordTokenExpiresIn: 3600` (1 hour default)
   - Set `sendOnSignUp: true` for email verification

### Phase 3: Auth Guard Update

4. Modify `src/hooks.server.ts`:
   - Change `isAuthPage` from exact match (`===`) to prefix match (`startsWith`)
   - This allows `/auth/forgot-password` and `/auth/reset-password` to be treated as auth pages

### Phase 4: Forgot Password Page

5. Create `src/routes/auth/forgot-password/+page.server.ts`:
   - `load`: redirect to home if already logged in
   - `requestReset` action: calls `auth.api.requestPasswordReset({ body: { email, redirectTo } })`
   - `redirectTo` = `${ORIGIN}/auth/reset-password`
   - Always shows success message (prevents email enumeration)
   - Logging with `addLogContext`

6. Create `src/routes/auth/forgot-password/+page.svelte`:
   - Email input form with `use:enhance`
   - Success state: shows "Check your email" message
   - Link back to sign-in
   - Consistent styling with existing auth page (raw Tailwind, same classes)
   - Uses `Loader2` spinner during submission

### Phase 5: Reset Password Page

7. Create `src/routes/auth/reset-password/+page.server.ts`:
   - `load`: redirect to home if already logged in; pass `token` from URL search params to page data
   - `resetPassword` action: validates password (min 8 chars, confirmation match), calls `auth.api.resetPassword({ body: { newPassword, token } })`
   - Logging with `addLogContext`

8. Create `src/routes/auth/reset-password/+page.svelte`:
   - New password + confirm password fields
   - Validates: minimum length, passwords match
   - On success: redirect to `/auth` with success message
   - Error states: invalid/expired token, password mismatch
   - Consistent auth page styling

### Phase 6: Sign-In Page Update

9. Modify `src/routes/auth/+page.svelte`:
   - Add "Forgot password?" link below the password field on sign-in form
   - Link points to `/auth/forgot-password` (localized)

### Phase 7: i18n

10. Add keys to `messages/en.json`:
    - `auth_forgot_password_link` — "Forgot password?"
    - `auth_forgot_password_title` — "Reset Password"
    - `auth_forgot_password_heading` — "Forgot your password?"
    - `auth_forgot_password_desc` — "Enter your email and we'll send you a reset link."
    - `auth_forgot_password_email_label` — "Email"
    - `auth_forgot_password_email_placeholder` — "you@example.com"
    - `auth_forgot_password_submit` — "Send Reset Link"
    - `auth_forgot_password_success` — "If an account exists with that email, we've sent a reset link."
    - `auth_forgot_password_back` — "Back to sign in"
    - `auth_reset_password_title` — "Set New Password — CalorieTracker"
    - `auth_reset_password_heading` — "Set new password"
    - `auth_reset_password_new_password_label` — "New Password"
    - `auth_reset_password_new_password_placeholder` — "Min. 8 characters"
    - `auth_reset_password_confirm_label` — "Confirm Password"
    - `auth_reset_password_confirm_placeholder` — "Re-enter password"
    - `auth_reset_password_submit` — "Reset Password"
    - `auth_reset_password_success` — "Password reset successfully. You can now sign in."
    - `auth_reset_password_invalid_token` — "This reset link is invalid or has expired."
    - `auth_reset_password_back` — "Back to sign in"
    - `error_password_mismatch` — "Passwords do not match"

11. Add corresponding Finnish translations to `messages/fi.json`

### Phase 8: Tests

12. Create `tests/api/auth-password-reset.test.ts`:
    - Test `POST /auth/forgot-password` — form action calls `requestPasswordReset`
    - Test `POST /auth/reset-password` — form action calls `resetPassword` with valid/invalid token
    - Test password validation (too short, mismatch)
    - Test that logged-in users are redirected away from both pages
    - Mock `auth.api` methods

### Phase 9: Verify

13. `pnpm check` — typecheck passes
14. `pnpm lint` — lint passes
15. `pnpm test` — tests pass
16. Browser test: forgot password flow end-to-end
17. Browser test: reset password page with valid/invalid token
18. Browser test: "Forgot password?" link visible on sign-in form
19. Browser test: Finnish locale — all new strings translated
20. Update `docs/PLAN.md` — check off step 15
21. Update `AGENTS.md` — add `RESEND_API_KEY` to env vars

---

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Resend free tier limits (100/day) | Sufficient for dev and low-traffic. Production can upgrade or switch to SMTP. |
| BetterAuth `requestPasswordReset` API may differ from v1.4 docs | Already verified against Context7 — v1.4.21 uses `requestPasswordReset` (not `forgotPassword`) |
| Email goes to spam during dev | Acceptable for dev. Use Resend's test mode or a real domain for production. |
| No `RESEND_API_KEY` in dev environment | Email module logs a warning and returns silently. UI still shows success to prevent enumeration. |
| Auth guard prefix match may affect future routes | `/auth/*` prefix is correct — all auth-related pages should be unauthenticated. |

---

## Success Criteria

- [ ] "Forgot password?" link appears on sign-in form
- [ ] Entering email on `/auth/forgot-password` shows success message (regardless of account existence)
- [ ] Reset email is sent via Resend when `RESEND_API_KEY` is configured
- [ ] Clicking reset link navigates to `/auth/reset-password?token=...`
- [ ] Setting new password on `/auth/reset-password` works with valid token
- [ ] Invalid/expired token shows error message
- [ ] Password validation enforces min 8 chars and confirmation match
- [ ] Logged-in users are redirected away from forgot/reset pages
- [ ] All new UI text has Finnish translations
- [ ] `pnpm check` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes (including new password reset tests)
- [ ] PLAN.md updated with step 15 checked off
