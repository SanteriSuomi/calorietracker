# Step 4 — Logging: Pino Singleton + Request Logging Middleware

> Detailed implementation plan for structured logging with wide-event pattern.

## Summary

Add Pino structured logging with one wide event per request. Includes logging
infrastructure, auth event logging (folded in from completed step 3), and manual
verification via pm2.

**No new dependencies** — `pino` (10.3.1) and `pino-pretty` (13.1.3) already installed.

---

## LOG_LEVEL Environment Variable

Controls the minimum log level. Set via `LOG_LEVEL` env var (private, runtime).

| LOG_LEVEL | Pino level | What gets logged |
|-----------|-----------|------------------|
| `verbose` | `trace` (10) | Everything — reserves room for future verbose/debug calls |
| `info` | `info` (30) | `info` + `error` calls **(default)** |
| `error` | `error` (50) | Only `error` calls |
| `none` | `silent` (Infinity) | Nothing |

All code uses `logger.info()` and `logger.error()` only. LOG_LEVEL controls which
actually emit. Default is `info` if unset or unrecognized.

### Documented in

- This file (primary reference)
- `AGENTS.md` → Key Environment Variables section
- `src/lib/server/logger.ts` → JSDoc on the logger export

---

## Dev vs Prod Output

Both write to **stdout** (`process.stdout`). The difference is format:

- **Dev** (`import.meta.env.DEV === true`): Pino pipes through `pino-pretty`
  transport. Human-readable, colored, multi-line output in terminal.
  ```
  INFO (1745132400000): POST /api/meals
      method: "POST"
      path: "/api/meals"
      requestId: "abc-123"
      userId: "user-1"
      statusCode: 200
      duration_ms: 45
      outcome: "success"
      detail: "Created meal"
  ```

- **Prod** (`import.meta.env.DEV === false`): Raw JSON lines to stdout. No
  transformation. Suitable for log aggregators (Azure Monitor, Fluent Bit, etc.)
  ```json
  {"level":30,"time":1745132400000,"method":"POST","path":"/api/meals","requestId":"abc-123","userId":"user-1","statusCode":200,"duration_ms":45,"outcome":"success","detail":"Created meal"}
  ```

In Docker, stdout is captured by the container runtime. `docker logs <container>`
shows the output. Azure Container Apps forwards stdout to Azure Monitor / Log
Analytics.

No files to rotate. No log directory. Standard containerized Node.js pattern.

---

## Files to Create/Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `src/lib/server/logger.ts` | **CREATE** | Pino singleton, LOG_LEVEL config, `addLogContext()` helper |
| 2 | `src/app.d.ts` | **MODIFY** | Add `requestId`, `logContext` to `Locals` |
| 3 | `src/hooks.server.ts` | **MODIFY** | Add `handleLogging` middleware (outermost), `logger.error` in `handleBetterAuth` for session extraction failures |
| 4 | `src/routes/auth/+page.server.ts` | **MODIFY** | Add `addLogContext` calls for sign-in/up success/failure |
| 5 | `tests/logger.test.ts` | **CREATE** | Logger creation, addLogContext, middleware behavior |
| 6 | `docs/PLAN.md` | **MODIFY** | Mark step 4 done, add logging annotations to steps 5-13 |
| 7 | `AGENTS.md` | **MODIFY** | Add `LOG_LEVEL` to env vars, add logging conventions section |
| 8 | `docs/stages/STAGE4_IMPLEMENTATION.md` | **CREATE** | Stage implementation log |

---

## Implementation Order

1. `src/lib/server/logger.ts` — singleton + helpers
2. `src/app.d.ts` — Locals types
3. `src/hooks.server.ts` — logging middleware + session error logging
4. `src/routes/auth/+page.server.ts` — auth event logging
5. `tests/logger.test.ts` — unit tests
6. Run typecheck → lint → tests (fail fast)
7. Update `docs/PLAN.md` + `AGENTS.md` — documentation
8. Write `docs/stages/STAGE4_IMPLEMENTATION.md` — stage log
9. Manual test with pm2 (see Verification section below)

---

## File Specifications

### 1. `src/lib/server/logger.ts` (NEW)

Pino singleton with LOG_LEVEL support and context helper.

```
Imports: pino
Exports: logger, addLogContext

LOG_LEVEL env var mapping:
  'verbose' → 'trace'
  'info'    → 'info'
  'error'   → 'error'
  'none'    → 'silent'
  undefined/unrecognized → 'info' (default)

Dev config (import.meta.env.DEV === true):
  level from LOG_LEVEL mapping
  transport: { target: 'pino-pretty' }

Prod config (import.meta.env.DEV === false):
  level from LOG_LEVEL mapping
  no transport (raw JSON)

addLogContext(event: RequestEvent, data: Record<string, unknown>):
  Merges `data` into `event.locals.logContext`
  Creates `event.locals.logContext` if undefined
  Used by API handlers to add business context (mealId, aiSource, etc.)
```

JSDoc on `logger` should document:
- What LOG_LEVEL values are accepted and their behavior
- That code only uses `logger.info()` and `logger.error()`
- Dev gets pino-pretty, prod gets JSON stdout

### 2. `src/app.d.ts` (MODIFY)

Add two optional fields to `App.Locals`:

```typescript
requestId?: string;                        // set by handleLogging middleware
logContext?: Record<string, unknown>;       // set by handleLogging, extended by handlers via addLogContext()
```

Both optional because they're only set at runtime, not during build or static
analysis.

### 3. `src/hooks.server.ts` (MODIFY)

#### 3a. New `handleLogging` middleware

Inserted **first** (outermost) in `sequence()` so it wraps all other handlers
including auth. New sequence:

```typescript
export const handle: Handle = sequence(handleLogging, handleBetterAuth, handleAuthGuard);
```

**Flow:**

1. If `building` → skip, return `resolve(event)`
2. Generate `requestId = crypto.randomUUID()`
3. Set `event.locals.requestId = requestId`
4. Initialize `event.locals.logContext = {}`
5. Record `startTime = Date.now()`
6. Try/catch/finally:
   - `try`: `response = await resolve(event)` — runs all inner handlers
   - `catch (error)`: store error, re-throw (don't swallow)
   - `finally`: emit the wide event

**Wide event fields:**

| Field | Source | Example |
|-------|--------|---------|
| `method` | `event.request.method` | `"POST"` |
| `path` | `event.url.pathname` | `"/api/meals"` |
| `requestId` | `event.locals.requestId` | `"abc-123"` |
| `userId` | `event.locals.user?.id ?? "anonymous"` | `"user-1"` |
| `statusCode` | `response.status` | `200` |
| `duration_ms` | `Date.now() - startTime` | `45` |
| `outcome` | `"success"` or `"error"` | `"success"` |
| `detail` | Default: `"${method} ${path}"`, overridable via `logContext.detail` | `"POST /api/meals"` |
| `error` | Error message + type, only on exceptions | `{ message: "...", type: "..." }` |
| `...logContext` | Spread of `event.locals.logContext` | `{ mealId: "...", source: "ai_text" }` |

**Outcome + level logic:**

```
Exception thrown:
  outcome = "error"
  error = { message: error.message, type: error.constructor.name }
  logger.error(wideEvent)

Response status >= 500:
  outcome = "error"
  logger.error(wideEvent)

Response status < 500 (including redirects, 4xx):
  outcome = "success"
  logger.info(wideEvent)
```

Note: 4xx client errors (400 bad request, 401 unauthorized) are "success" from
the infrastructure perspective — the server handled the request correctly by
rejecting it. Business-level failures (e.g., auth failures) are distinguished by
the `detail` field and `logContext`.

**Detail field:**
- Default: `"${method} ${path}"` (e.g., `"GET /"`, `"POST /api/auth/sign-in"`)
- Handlers override via `addLogContext(event, { detail: "Sign-in failed: invalid credentials" })`
- If `logContext.detail` exists, use it; otherwise use default

#### 3b. `handleBetterAuth` — session extraction error logging

Add `try/catch` around `auth.api.getSession()` call:

```typescript
const handleBetterAuth: Handle = async ({ event, resolve }) => {
  try {
    const session = await auth.api.getSession({ headers: event.request.headers });
    if (session) {
      event.locals.session = session.session;
      event.locals.user = session.user;
    }
  } catch (error) {
    logger.error({
      method: event.request.method,
      path: event.url.pathname,
      detail: 'Session extraction failed',
      error: {
        message: error instanceof Error ? error.message : String(error),
        type: error instanceof Error ? error.constructor.name : 'Unknown',
      },
    });
  }

  return svelteKitHandler({ event, resolve, auth, building });
};
```

This logs a standalone error (not part of the wide event) because the session
extraction happens before the wide event is emitted. The middleware's wide event
will still capture the request metadata in `finally`.

### 4. `src/routes/auth/+page.server.ts` (MODIFY)

Add `addLogContext` calls to form actions. These run during `resolve()` inside
the logging middleware, so the wide event in `finally` will pick them up.

**signIn action:**

```typescript
signIn: async ({ request, locals }) => {
  const formData = await request.formData();
  const email = formData.get('email')?.toString() ?? '';
  const password = formData.get('password')?.toString() ?? '';

  try {
    await auth.api.signInEmail({ body: { email, password } });
    addLogContext({ event: ... }, {
      detail: 'Sign-in successful',
      authAction: 'signIn',
    });
  } catch (error) {
    if (error instanceof APIError) {
      addLogContext({ event: ... }, {
        detail: `Sign-in failed: ${error.message}`,
        authAction: 'signIn',
        authError: error.message,
      });
      return fail(400, { message: error.message || 'Sign in failed', mode: 'signin' });
    }
    addLogContext({ event: ... }, {
      detail: 'Sign-in failed: unexpected error',
      authAction: 'signIn',
    });
    return fail(500, { message: 'Unexpected error', mode: 'signin' });
  }

  return redirect(302, '/');
},
```

**signUp action:** Same pattern with `authAction: 'signUp'`.

**Important:** Form actions receive `locals` directly (not the full `event`).
Need to verify the SvelteKit types — `Actions` functions receive `{ request,
cookies, locals, ... }`. The `addLogContext` helper needs to accept either the
full event or just locals. Two options:

- Option A: `addLogContext(locals, data)` — accepts locals directly
- Option B: `addLogContext({ event }, data)` — need to pass event through

**Decision: Option A.** `addLogContext(locals: App.Locals, data)` — simpler,
works in both hooks (has event) and form actions (has locals). The helper just
does `locals.logContext = { ...locals.logContext, ...data }`.

### 5. `tests/logger.test.ts` (NEW)

Server-side tests (Vitest `server` project, Node environment).

**Test cases:**

1. **Logger singleton creation**
   - Dev mode: logger has pino-pretty transport configured
   - Prod mode: logger has no transport, outputs JSON

2. **LOG_LEVEL mapping**
   - `verbose` → pino level `trace`
   - `info` → pino level `info`
   - `error` → pino level `error`
   - `none` → pino level `silent`
   - undefined → defaults to `info`
   - unrecognized string → defaults to `info`

3. **addLogContext helper**
   - Merges data into empty logContext
   - Merges data into existing logContext (preserves previous keys)
   - Overwrites existing keys with new values

4. **handleLogging middleware**
   - Sets requestId on locals
   - Initializes logContext as empty object
   - Emits wide event with correct fields
   - outcome is "success" for 2xx/3xx/4xx responses
   - outcome is "error" for 5xx responses
   - outcome is "error" with error details on exception
   - detail defaults to `"${method} ${path}"`
   - detail overridden by logContext.detail
   - Skips during building
   - duration_ms is a positive number

5. **handleBetterAuth session extraction failure**
   - Logs error when getSession throws
   - Still completes request (doesn't block)

---

## Logging Guidance for Future Steps

Each future implementation step should add `addLogContext` calls in API handlers
to enrich the wide event with business context. The middleware handles all
infrastructure fields automatically — handlers only add domain-specific data.

| Step | Logging Points | logContext fields to add |
|------|---------------|------------------------|
| **5** (Day view) | None — just page loads, middleware handles it | — |
| **6** (Meal CRUD) | `POST /api/meals` | `{ mealId, source: "manual" }` |
| | `PUT /api/meals/[id]` | `{ mealId }` |
| | `DELETE /api/meals/[id]` | `{ mealId }` |
| **7** (AI integration) | `POST /api/ai/analyze` | `{ aiSource, model }` |
| | On success | `{ detail: "AI analysis completed", aiSource, model }` |
| | On failure | `{ detail: "AI analysis failed: <reason>", aiSource, model }` |
| **8** (Images) | `GET /api/images/[filename]` | `{ imageFilename, operation: "serve" }` |
| | Image upload in analyze | `{ imageFilename, operation: "upload" }` |
| **9** (Calendar) | None — just page loads | — |
| **10** (Docker) | No app logging changes | — |
| **11** (IaC) | No app logging changes | — |
| **12** (CI/CD) | No app logging changes | — |
| **13** (Polish) | Improve error details in existing logging calls | — |

### Convention for adding logging in handlers

```
1. Import: import { addLogContext } from '$lib/server/logger';
2. On success: addLogContext(locals, { detail: "Did X successfully", ...businessFields });
3. On failure: addLogContext(locals, { detail: "X failed: <reason>", ...businessFields });
4. That's it. The middleware emits the wide event automatically.
```

For standalone errors outside request lifecycle (rare), use `logger.error()`
directly — see the `handleBetterAuth` session extraction pattern.

---

## Verification: Manual Testing with pm2

After implementation is complete, verify logging works end-to-end using pm2
to capture and inspect process stdout.

### Prerequisites

- pm2 installed globally (`npm install -g pm2`)
- Dev environment configured (`.env` with all required vars)

### Steps

1. **Start dev server via pm2:**
   ```bash
   pm2 start "pnpm dev" --name calorietracker --output logs/out.log --error logs/err.log
   ```
   This captures stdout to `logs/out.log` and stderr to `logs/err.log`.

2. **Tail the log file:**
   ```bash
   tail -f logs/out.log
   ```

3. **Exercise auth flows (in browser):**
   - Navigate to `/auth` — observe page load log event
   - Submit sign-up with valid data — observe `"Sign-up successful"` detail
   - Sign out
   - Submit sign-in with valid data — observe `"Sign-in successful"` detail
   - Submit sign-in with wrong password — observe `"Sign-in failed"` detail

4. **Verify log output contains:**
   - Each request is a structured event with: `method`, `path`, `requestId`,
     `userId`, `statusCode`, `duration_ms`, `outcome`, `detail`
   - `requestId` is unique per request
   - `userId` is `"anonymous"` for unauthenticated requests, actual user ID after auth
   - `duration_ms` is a reasonable number (< 1000ms for page loads)
   - Auth success events have `authAction` and `detail` fields
   - Auth failure events have `authError` field
   - Format is human-readable (pino-pretty active in dev)

5. **Test LOG_LEVEL env var:**
   ```bash
   LOG_LEVEL=error pm2 restart calorietracker
   ```
   - Perform sign-in — info-level events should NOT appear
   - Trigger a server error — error-level events should still appear

   ```bash
   LOG_LEVEL=none pm2 restart calorietracker
   ```
   - Perform any action — no log events should appear

   ```bash
   pm2 restart calorietracker   # back to default (info)
   ```

6. **Clean up:**
   ```bash
   pm2 stop calorietracker && pm2 delete calorietracker
   ```
   Add `logs/` to `.gitignore` if not already present.

### What to look for

- No uncaught exceptions in stderr
- Every HTTP request produces exactly one wide event in stdout
- Events are well-formed and parseable
- No sensitive data (passwords, API keys) in log output
- `detail` field gives a human-readable summary without needing to parse JSON

---

## Success Criteria

- [ ] `src/lib/server/logger.ts` exists with Pino singleton + `addLogContext`
- [ ] LOG_LEVEL env var documented and functional (verbose/info/error/none)
- [ ] Dev output uses pino-pretty (human-readable)
- [ ] Prod output is raw JSON lines to stdout
- [ ] `handleLogging` middleware emits one wide event per request
- [ ] Wide event contains: method, path, requestId, userId, statusCode, duration_ms, outcome, detail
- [ ] Auth form actions log success/failure with business context
- [ ] Session extraction failures logged with `logger.error` in handleBetterAuth
- [ ] No sensitive data (passwords, API keys) in any log output
- [ ] Unit tests pass for logger, addLogContext, and middleware
- [ ] Typecheck and lint pass
- [ ] PLAN.md updated with step 4 checked off and logging annotations on future steps
- [ ] AGENTS.md updated with LOG_LEVEL env var and logging conventions
- [ ] STAGE4_IMPLEMENTATION.md written
- [ ] Manual pm2 verification successful
