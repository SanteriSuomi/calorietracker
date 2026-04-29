# Stage 4 — Logging Implementation

> Implementation log for Step 4: Pino singleton + request logging middleware.

## What Was Done

Implemented structured logging with wide-event pattern using Pino. One structured JSON event emitted per HTTP request, with business context support via `addLogContext()`.

## Files Created

| File | Purpose |
|------|---------|
| `src/lib/server/logger.ts` | Pino singleton with LOG_LEVEL support, `addLogContext()` helper |
| `src/lib/server/types/logging.ts` | Types: `LogLevel`, `WideEvent`, `LogError`, `LogContext`, `toLogError()` |
| `tests/logger.test.ts` | Unit tests for `resolveLevel()` and `addLogContext()` |
| `scripts/pm2-dev.mjs` | pm2 wrapper script (pm2 cannot run `.cmd` on Windows) |
| `docs/agents/pm2.md` | Full pm2 dev server guide |
| `docs/agents/worktree-bootstrap.md` | Worktree setup reference |

## Files Modified

| File | Change |
|------|--------|
| `src/app.d.ts` | Added `requestId?: string` and `logContext?: LogContext` to `App.Locals` |
| `src/hooks.server.ts` | Added `handleLogging` middleware (outermost), session extraction error logging, `emitWideEvent` helper using typed `WideEvent` and `toLogError` |
| `src/routes/auth/+page.server.ts` | Added `addLogContext` calls for sign-in/sign-up success/failure |
| `docs/PLAN.md` | Marked step 4 complete |
| `AGENTS.md` | Added LOG_LEVEL env var, logging conventions, pm2 section, commit conventions, project structure updates |

## Design Decisions

1. **`emitWideEvent` helper**: Separate function for the wide-event emission. The try/catch pattern in `handleLogging` gives clear control flow — response path vs error path. No non-null assertions needed.

2. **`resolveLevel` exported for testing**: The LOG_LEVEL mapping function is exported so tests can verify the mapping without re-importing the module (which would re-create the pino singleton).

3. **`addLogContext(locals, data)` signature**: Accepts `App.Locals` directly (not full event) so it works in both hooks (which have the event) and form actions (which receive `{ locals, request, ... }`).

4. **4xx = success outcome**: Client errors (400, 401, 404) are logged as `outcome: "success"` — the server handled the request correctly by rejecting it. Only 5xx and exceptions get `outcome: "error"`.

5. **`LevelWithSilent` type**: Used `pino.LevelWithSilent` instead of `pino.Level` for the LOG_LEVEL_MAP to include the `"silent"` value.

6. **`toLogError` helper**: Extracted `unknown` → `LogError` conversion into a shared function to avoid duplication between `emitWideEvent` and `handleBetterAuth` session error logging.

7. **`LogContext` kept generic**: Only `detail?` is a named field. Auth-specific keys (`authAction`, `authError`) are passed via the index signature — no domain-specific fields in the logging type.

8. **`RequestEvent` used directly**: Instead of `Parameters<Handle>[0]['event']` indirection, `emitWideEvent` accepts `RequestEvent` from `@sveltejs/kit`.

## Verification

- Typecheck: `svelte-check` — 0 errors, 0 warnings
- Lint: `biome check` on changed files — all pass
- Tests: `vitest run --project=server tests/logger.test.ts` — 9/9 passed
  - 6 tests for `resolveLevel()` (verbose/info/error/none/undefined/unrecognized)
  - 3 tests for `addLogContext()` (empty merge, existing merge, overwrite)

## Manual Verification (pm2)

Started dev server via pm2, exercised auth flows with browser automation.

### Flows tested

| Flow | `detail` | `userId` | `authAction` | `authError` |
|---|---|---|---|---|
| `GET /auth` (page load) | `"GET /auth"` | `"anonymous"` | — | — |
| Sign-up (success) | `"Sign-up successful"` | `"anonymous"` | `"signUp"` | — |
| Sign-in (wrong password) | `"Sign-in failed: Invalid email or password"` | `"anonymous"` | `"signIn"` | `"Invalid email or password"` |
| Sign-in (success) | `"Sign-in successful"` | `"anonymous"` | `"signIn"` | — |
| `GET /` (authenticated) | `"GET /"` | `"DSwjXrK..."` (real user ID) | — | — |
| Sign-out → redirect to `/auth` | `"GET /auth"` | `"anonymous"` | — | — |

### Observations

- Every HTTP request produced exactly one wide event
- `requestId` unique per request (UUID)
- `duration_ms` reasonable (2–246ms)
- `outcome: "success"` for all (no 5xx or exceptions)
- Pino-pretty output human-readable in dev
- No sensitive data in logs
- No uncaught exceptions in stderr

## Dependencies

- `pino` (10.3.1) and `pino-pretty` (13.1.3) — already in package.json
- `pm2` (6.0.14) — added as devDependency
