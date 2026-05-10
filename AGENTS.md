# AGENTS.md

AI agent context for the CalorieTracker project. **Keep this file up-to-date** — when adding, removing, or significantly changing modules, patterns, or conventions during implementation, update the relevant section below.

## Context Management

- **Explore agent** (`subagent_type: explore`) — codebase navigation, finding files, understanding architecture. Use for any non-trivial task to avoid consuming main context with discovery work.
- **Researcher agent** (`subagent_type: researcher`) — web searches, documentation lookups, API references. Use frequently during planning to verify library APIs, check best practices, and read framework docs before writing code.

Only run grep/glob/websearch directly in main context when results are trivial (single file lookup, known path) or needed immediately for an in-progress decision.

## Project Overview

Mobile-first web app for tracking daily calorie and macro intake. Users log meals manually or via AI (text/photo). Current progress: steps 0-14 done (auth, logging, day view, manual meal CRUD, AI text+vision, images, calendar view, Docker, polish). See `docs/PLAN.md` for full roadmap.

## Tech Stack

- **Frontend**: SvelteKit 2 + Svelte 5 (runes only — `svelte.config.js` forces `runes: true` globally)
- **Styling**: Tailwind CSS + shadcn-svelte (vega style, lucide icons)
- **Charts**: Chart.js (doughnut) via direct Svelte 5 `$effect` integration
- **Backend**: SvelteKit server routes (`src/routes/api/`)
- **Database**: Dual-provider via Drizzle ORM — `DATABASE_PROVIDER` env var selects adapter:
  - `libsql` (default) → local encrypted SQLite
  - `pg` → PostgreSQL Flexible Server (Azure)
- **Auth**: BetterAuth — email/password (Google OAuth deferred)
- **AI**: Vercel AI SDK (`ai` + `@ai-sdk/openai`) — text-only and multi-modal (image+text) via `generateText` with `Output.object`
- **Logging**: Pino — structured JSON, wide-event pattern, `info` and `error` levels only
- **Package manager**: pnpm

## Project Structure

```
src/lib/server/       # Server-only code (auth, db, constants, logger, storage, encryption)
src/lib/components/   # Shared Svelte components (ui/ is shadcn-svelte generated)
src/routes/           # SvelteKit routes (pages + API endpoints)
src/hooks.server.ts   # i18n + logging + auth middleware (session extraction + route guards)
tests/                # Vitest unit & integration tests
docs/                 # PLAN.md, SCHEMA.md, step plans, INITIAL_PLAN.md
scripts/              # seed-dev.ts, pm2-dev.mjs
```

Key entry points: `src/lib/server/auth.ts` (BetterAuth), `src/lib/auth-client.ts` (client auth), `src/lib/server/constants.ts` (route constants), `src/lib/server/db/index.ts` (dual-provider DB via top-level await dynamic import), `src/lib/utils/date.ts` (YYYY-MM-DD string utilities).

## Commands

```bash
pnpm dev                # Vite dev server
pnpm build              # Production build
pnpm check              # svelte-check type checking
pnpm lint               # Biome check (no fix)
pnpm format             # Biome check --write (fix)
pnpm test               # All tests (non-watch)
pnpm test:unit          # All tests (watch mode)
pnpm db:push            # Push SQLite schema to DB
pnpm db:push:pg         # Push PG schema to DB
pnpm db:generate        # Generate SQLite migration
pnpm db:generate:pg     # Generate PG migration
pnpm auth:schema        # Regenerate BetterAuth schema
pnpm seed:dev           # Create test user (libsql only)
```

## Testing

Two Vitest projects configured in `vite.config.ts`:

| Project | Environment | File pattern |
|---------|------------|-------------|
| `client` | Browser (Playwright/Chromium) | `src/**/*.svelte.{test,spec}.{js,ts}` |
| `server` | Node | `src/**/*.{test,spec}.{js,ts}`, `tests/**/*.{test,spec}.{js,ts}` |

Client tests exclude `src/lib/server/**`. Both projects exclude each other's file patterns.

**Verification order (fail fast):** typecheck → lint → tests → browser test

**Browser verification is mandatory for UI changes.** Passing typecheck + lint + tests is not sufficient — real bugs (e.g., sheet children not passed to Dialog.Root, `invalidate()` not triggering re-fetch) were only caught by browser testing. Use the `browser-automation` skill with a running dev server.

**Browser-first implementation:** When implementing a plan that includes UI changes, browser testing must happen as part of the implementation — not deferred to the end. Start the dev server (pm2) before making changes and verify incrementally as you complete each phase. Do not mark a task complete without browser-verifying the specific UI change.

## Code Conventions

- Svelte 5 runes only (no `$:` reactive syntax). Forced globally in `svelte.config.js` except for `node_modules`.
- Explicit named imports, no wildcards or barrel files
- Strict TypeScript — `?` for optional, `| null` for nullable
- **Validation on both frontend and backend.** Server-side is the source of truth.
- Audit fields on all custom tables: `createdAt, createdBy, updatedAt, updatedBy` via `auditColumns()` helper
- Comments only for exotic functions, workarounds, complex algorithms
- Logging: one wide event per request in `finally`, `addLogContext(locals, data)` from `$lib/server/logger` to add business context
- Two log levels: `logger.info()` and `logger.error()`, controlled by `LOG_LEVEL` env var (`verbose`/`info`/`error`/`none`)

## AI SDK Patterns

Multi-modal content uses `{ type: 'file', mediaType, data }` (not `{ type: 'image' }`). Text+image messages:

```ts
messages: [{ role: 'user', content: [
  { type: 'text', text: description },
  { type: 'file', mediaType: 'image/jpeg', data: base64String }
] }]
```

Always verify against Context7 API docs before implementing AI SDK features — the API evolves frequently.

## Linting & Formatting

Biome (`@biomejs/biome`) — replaces Prettier + ESLint. Config: `biome.json`.

- **Style**: tabs, single quotes, no trailing commas, semicolons always
- **Svelte**: experimental full support (`html.experimentalFullSupportEnabled: true`)
- **Svelte overrides**: `noUnusedVariables`, `noUnusedImports`, `useConst`, `useImportType` disabled for `.svelte` files (false positives)
- **shadcn-svelte** (`src/lib/components/ui/**`): a11y rule `useValidAriaRole` disabled
- **Known issue**: Biome may produce incorrect `<script>` block indentation — review manually after bulk reformatting

## Database

`DATABASE_PROVIDER` env var selects the adapter (defaults to `libsql`). Separate schema files per dialect: `sqlite/schema.ts` (`sqliteTable`) and `pg/schema.ts` (`pgTable`). Both must stay in sync.

Drizzle configs: `drizzle.config.ts` (SQLite), `drizzle-pg.config.ts` (PG). Migrations output to `drizzle/sqlite/` and `drizzle/pg/`.

## Auth

**Middleware** (`hooks.server.ts`): `sequence(handleParaglide, handleLogging, handleBetterAuth, handleAuthGuard)`:
1. `handleParaglide` — i18n locale detection and cookie setting
2. `handleLogging` — generates `requestId`, emits one wide event per request in `finally`
3. `handleBetterAuth` — `auth.api.getSession()` extracts session into `event.locals`, then `svelteKitHandler` processes `/api/auth/*`
4. `handleAuthGuard` — `/api/auth/*` passes through; `/api/*` without session → 401 JSON; page routes without session → 302 to `/auth`; `/auth` with session → 302 to `/`

Route paths: `src/lib/server/constants.ts` (`API_BASE`, `AUTH_API_ROUTE`, `AUTH_PAGE_ROUTE`).

**Client**: `src/lib/auth-client.ts` exports `authClient` (API calls) and `useSession` (reactive session state). Sign-out forces full page reload.

## Dev Seed

`pnpm seed:dev` creates test user (libsql only): `test@gmail.com` / `Password1`. Requires `DEV_SEED=true` in `.env`. Idempotent. **Note:** `tsx` does not auto-load `.env` — run with `MSYS_NO_PATHCONV=1 npx tsx -r dotenv/config scripts/seed-dev.ts`.

## Environment Variables

```bash
DATABASE_URL=file:local.db    # Connection string
ORIGIN=                       # Public URL (BetterAuth baseURL)
BETTER_AUTH_SECRET=           # >=32 chars, high entropy
# DEV_SEED=true               # Enable seed script
# LOG_LEVEL=info              # verbose|info|error|none
# DATABASE_PROVIDER=libsql    # or pg
# STORAGE_PROVIDER=local      # or azure
```

Additional vars for future steps: `ENCRYPTION_SECRET`, `ENCRYPTION_KEY`, `AZURE_BLOB_CONNECTION_STRING`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

## Git Worktrees

`.env` is gitignored and NOT copied when creating a worktree. After creating a new worktree:

```bash
cp ../CalorieTracker/.env .env   # copy from main worktree
npx drizzle-kit push --force     # create local DB
```

If the DB driver fails with `DATABASE_URL is not set`, the `.env` is missing.

## Dev Server & Browser Verification

Use the **pm2** skill to run the dev server in the background:

```bash
npx pm2 start scripts/pm2-dev.mjs --name calorietracker
```

Then use `agent-browser` against the port shown in `npx pm2 logs calorietracker --lines 5 --nostream`.

### agent-browser on Windows (v0.26.0)

Known issues: `open` hangs intermittently (#1270, #1308), `upload` on hidden inputs kills CDP (#1102), orphan Chrome processes accumulate (#1263).

**Proactive cleanup before browser sessions:**

```bash
agent-browser close --all 2>/dev/null
taskkill //F //IM chrome.exe 2>/dev/null
taskkill //F //IM agent-browser-win32-x64.exe 2>/dev/null
```

**Avoid `batch` for complex workflows** — use individual commands instead. The `batch` command can hang when chaining too many operations.

**Hidden file inputs:** Do NOT use `upload` on `display:none` inputs. Use `eval` to make the input visible first, then upload, or set files entirely via JavaScript.

**Recovery:** If `open` hangs, kill all Chrome/daemon processes and retry.

**Fallback when `open` hangs persistently:** Use `curl -s -b /tmp/cookies.txt` to verify SSR output. Sign in via `curl -c /tmp/cookies.txt -X POST http://localhost:5173/api/auth/sign-in/email -H 'Content-Type: application/json' -d '{"email":"test@gmail.com","password":"Password1"}'`, then use `-b /tmp/cookies.txt` for authenticated requests. Grep the HTML for element IDs, text content, and CSS classes to verify UI correctness. This doesn't test client-side interactivity but confirms server data flows and component rendering.

## Documentation

- `docs/PLAN.md` — **Living implementation plan** with step checklist. Must be updated when steps are completed or new steps are added.
- `docs/SCHEMA.md` — **Living database schema reference.** Must be updated when tables, columns, indexes, or constants change.
- `docs/plans/` — Detailed plans written **before** coding each step
- `docs/INITIAL_PLAN.md` — Original plan (historical reference)

**Living contracts:** `PLAN.md` and `SCHEMA.md` must reflect the current codebase. When modifying database schema, API routes, or completing implementation steps, update the corresponding doc in the same commit.

## Post-Implementation

After completing any implementation:
1. Cross off the completed step in `docs/PLAN.md`
2. If the change modified database schema or API routes, update `docs/SCHEMA.md`

## Commit Conventions

- One commit per session — amend as work progresses
- Only commit and push when explicitly asked
- Imperative form ("Add feature" not "Added feature")
