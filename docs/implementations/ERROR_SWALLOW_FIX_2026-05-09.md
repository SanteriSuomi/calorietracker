# Error Swallow Fix

**Date:** 2026-05-09
**Status:** Complete

## Problem

Auth form actions (`signIn`, `signUp` in `src/routes/auth/+page.server.ts`) had generic catch blocks that discarded the actual error object. When BetterAuth threw a non-`APIError` (e.g. database connection failure, missing schema), the catch block logged `"Sign-in failed: unexpected error"` with no details and returned `"Unexpected error"` to the UI.

The real error was invisible in both the console and the wide event log, making debugging impossible without modifying code.

## Root Cause

Two issues:

1. **Empty database** — `local.db` was 0 bytes (schema never pushed). BetterAuth tried to INSERT into nonexistent tables, throwing a libsql error (not a BetterAuth `APIError`).
2. **Swallowed error** — The generic catch blocks used string literals in `addLogContext` instead of including the actual error message.

## Why catch blocks exist (vs catch-all in hooks)

The catch-all in `handleLogging` (`hooks.server.ts:61-63`) only fires on uncaught exceptions. The auth actions need catch blocks because:

- `fail()` returns a form validation response that SvelteKit binds to `form.message` on the page. Uncaught exceptions render a 500 error page, losing the auth form UX.
- `APIError` from BetterAuth has user-facing messages ("Email already exists"). The generic catch handles everything else (DB down, network errors).

## Fix

Changed both generic catch blocks to include the actual error in `addLogContext`:

```ts
// Before
addLogContext(locals, {
    detail: 'Sign-up failed: unexpected error',
    authAction: 'signUp'
});

// After
addLogContext(locals, {
    detail: `Sign-up failed: ${error instanceof Error ? error.message : String(error)}`,
    authAction: 'signUp'
});
```

The wide event in `emitWideEvent` already logs the `detail` field — no separate `logger.error()` call needed.

## Files Modified

| File | Change |
| --- | --- |
| `src/routes/auth/+page.server.ts` | Generic catch blocks now include error message in `detail` |

## Audit of Other Endpoints

Only three server-side catch blocks exist outside `hooks.server.ts`:

| File | Line | Status |
| --- | --- | --- |
| `src/routes/auth/+page.server.ts:28` | signIn catch | Fixed |
| `src/routes/auth/+page.server.ts:60` | signUp catch | Fixed |
| `src/routes/api/ai/analyze/+server.ts:77` | AI error catch | Already captures `error.message` |

`hooks.server.ts` catch blocks (lines 61, 74) already pass the error object to logging.
