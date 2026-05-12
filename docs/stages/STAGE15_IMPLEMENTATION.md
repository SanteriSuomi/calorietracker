# Stage 15 — Password Recovery Implementation

## What was done

### Phase 1: Dependencies & Email Infrastructure
- Installed `nodemailer@7.0.3` + `@types/nodemailer@6.4.17`
- Created `src/lib/server/email/` module with dual-provider abstraction (Resend + Azure ACS stub)
- `sendEmail()` function with graceful handling when API key not configured (logs warning, returns silently)

### Phase 2: BetterAuth Configuration
- Added `sendResetPassword` callback inside `emailAndPassword` config
- Added `emailVerification` with `sendOnSignUp: true` (non-blocking)
- Token expiry: 1 hour for password reset

### Phase 3: Auth Guard Update
- Changed `isAuthPage` from exact match to prefix match in `hooks.server.ts`
- Allows `/auth/forgot-password` and `/auth/reset-password` to function as auth pages

### Phase 4: Forgot Password Page
- New route `/auth/forgot-password` with email entry form
- Always returns success to prevent email enumeration
- Server action calls `auth.api.requestPasswordReset`

### Phase 5: Reset Password Page
- New route `/auth/reset-password` with new password + confirm form
- Token extracted from URL search params
- Validates password length and confirmation match
- Shows invalid/expired token message when no token present

### Phase 6: Sign-In Page Update
- Added "Forgot password?" link below password field on sign-in form

### Phase 7: i18n
- 18 new keys in `messages/en.json` and `messages/fi.json`

### Phase 8: Tests
- Created `tests/api/auth-password-reset.test.ts` with 7 tests covering validation logic and provider selection

## Key Decisions

- **Nodemailer + Resend SMTP** chosen over Resend SDK for transport-layer abstraction. Both Resend and Azure ACS use identical Nodemailer transports — only config differs.
- **Dual-provider pattern** matches existing `DATABASE_PROVIDER`/`STORAGE_PROVIDER` approach. `EMAIL_PROVIDER` env var (default: `resend`). Azure ACS stub ready for step 18.
- **Email verification included** since email infra was being built anyway. Non-blocking (`requireEmailVerification: false`).
- **Silent skip** when API key not configured — good for local dev without email.

## Verification Results

| Check | Result |
|-------|--------|
| `pnpm check` (typecheck) | PASS — 0 errors, 9 warnings (pre-existing) |
| `pnpm lint` | PASS — no new lint errors (38 pre-existing in shadcn components) |
| `pnpm test` | PASS — 84/84 pass (3 pre-existing PG failures unrelated) |
| Browser: `/auth` — "Forgot password?" link | PASS |
| Browser: `/auth/forgot-password` — form renders | PASS |
| Browser: `/auth/reset-password` — invalid token message | PASS |

## Files Created

1. `src/lib/server/email/index.ts` — Email module with dual-provider `sendEmail()`
2. `src/lib/server/email/resend.ts` — Resend SMTP transport
3. `src/lib/server/email/azure.ts` — Azure ACS SMTP transport (stub)
4. `src/routes/auth/forgot-password/+page.svelte` — Forgot password form
5. `src/routes/auth/forgot-password/+page.server.ts` — Request reset action
6. `src/routes/auth/reset-password/+page.svelte` — Reset password form
7. `src/routes/auth/reset-password/+page.server.ts` — Reset password action
8. `tests/api/auth-password-reset.test.ts` — Password reset tests
9. `docs/plans/STEP15_PASSWORD_RECOVERY.md` — Implementation plan
10. `docs/stages/STAGE15_IMPLEMENTATION.md` — This file

## Files Modified

1. `src/lib/server/auth.ts` — Added `sendResetPassword`, `emailVerification`
2. `src/hooks.server.ts` — Auth guard prefix match for `/auth/*`
3. `src/routes/auth/+page.svelte` — Added "Forgot password?" link
4. `messages/en.json` — 18 new i18n keys
5. `messages/fi.json` — 18 new Finnish translations
6. `package.json` — Added `nodemailer`, `@types/nodemailer`
7. `docs/PLAN.md` — Checked off step 15
8. `docs/SCHEMA.md` — Added verification table note
9. `AGENTS.md` — Added email env vars section
