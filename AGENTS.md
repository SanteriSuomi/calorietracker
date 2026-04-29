## Project Configuration

- **Language**: TypeScript
- **Package Manager**: pnpm
- **Add-ons**: tailwindcss, drizzle, better-auth, vitest, sveltekit-adapter, biome

---

# AGENTS.md

AI agent context file for the CalorieTracker project. **Keep this file up-to-date** — when you add, remove, or significantly change files, modules, patterns, or conventions, update the relevant section below. Accuracy here saves context in future sessions.

## Project Overview

CalorieTracker is a mobile-first web app for tracking daily calorie and macro intake. Users can manually log meals, or use AI (text description and/or photo) to estimate nutrition.

## Tech Stack

- **Frontend**: SvelteKit 2 + Svelte 5 (runes: `$state`, `$derived`, `$effect`, `$props`)
- **Styling**: Tailwind CSS + shadcn-svelte
- **Charts**: Chart.js (doughnut) via direct Svelte 5 `$effect` integration
- **Backend**: SvelteKit server routes (API routes in `src/routes/api/`)
- **Database**: Dual-provider via Drizzle ORM:
  - Azure: PostgreSQL Flexible Server
  - Self-hosted: libsql (encrypted SQLite)
- **Auth**: BetterAuth (`better-auth`) — email/password + optional Google OAuth
- **AI**: Vercel AI SDK (`ai` + `@ai-sdk/openai`) with user-configured OpenAI-compatible endpoint
- **Logging**: Pino — structured JSON, wide-event pattern, `info` and `error` levels only
- **Encryption**:
  - Database: libsql `encryptionKey` (self-hosted) / TLS + Azure-managed encryption (Azure)
  - Images: AES-256-GCM per-user (self-hosted) / Azure Blob Storage encryption (Azure)
- **CI/CD**: Azure DevOps Pipelines
- **Deploy**: Azure Container Apps (consumption, scale-to-zero) + self-hosted server (parallel stage)
- **IaC**: Bicep (idempotent, Azure-native)

## Project Structure

```
src/lib/server/       # Server-only code (auth, db, constants)
src/lib/components/   # Shared Svelte components
src/routes/           # SvelteKit routes (pages + API endpoints)
src/hooks.server.ts   # Logging middleware + auth middleware (session extraction + route guards)
tests/                # Vitest unit & integration tests
infra/                # Bicep IaC templates
docs/                 # PLAN.md, stage logs, schema docs
data/                 # Runtime data (gitignored)
```

Key entry points: `src/lib/server/auth.ts` (BetterAuth config), `src/lib/auth-client.ts` (client-side auth), `src/lib/server/constants.ts` (route constants), `src/lib/server/db/` (dual-provider DB with Drizzle).

## Documentation

- `docs/PLAN.md` — Living implementation plan with step checklist and design specs
- `docs/plans/` — Detailed implementation plans written **before** coding each step (e.g., `STEP4_LOGGING.md`, `STEP5_DAY_VIEW.md`). These document file specs, implementation order, risks, and success criteria. Updated if scope changes during implementation.
- `docs/stages/` — Implementation logs written **after** completing each step (STAGE0..STAGE3+). Record what was done, verification results, files created/modified/deleted, and design decisions.
- `docs/agents/` — Agent-oriented reference docs (e.g., `pm2.md` for dev server process management)
- `docs/` — Schema, architecture, design docs, and transition logs

## Code Conventions

- Svelte 5 runes only (no `$:` reactive syntax)
- Explicit named imports, no wildcards or barrel files
- Case-sensitive paths always
- Strict TypeScript, types reflect reality (`?` for optional, `| null` for nullable)
- Audit fields on all custom tables: `createdAt, createdBy, updatedAt, updatedBy` (via `auditColumns()` helper spread into table definitions)
- Comments only for exotic functions, workarounds, complex algorithms
- Logging: one wide event per request, emitted in `finally`, structured JSON via Pino. Handlers use `addLogContext()` from `$lib/server/logger` to add business context; the middleware emits the event automatically.
- Two levels only: `logger.info()` and `logger.error()`, controlled by `LOG_LEVEL` env var (`verbose`/`info`/`error`/`none`, default `info`)

## Linting & Formatting

- **Tool**: Biome (`@biomejs/biome`) — replaces Prettier + ESLint
- **Config**: `biome.json` at project root
- **Commands**: `pnpm lint` (check only), `pnpm format` (check + fix)
- **Svelte support**: experimental (`html.experimentalFullSupportEnabled: true`)
- **Svelte overrides**: `noUnusedVariables`, `noUnusedImports`, `useConst`, `useImportType` disabled for `.svelte` files (false positives until cross-language support lands)
- **Tailwind**: `css.parser.tailwindDirectives: true` (replaces `prettier-plugin-tailwindcss`)
- **Known issue**: Biome's Svelte formatter may produce incorrect indentation in `<script>` blocks — review manually after bulk reformatting

## Database Provider Switching

`DATABASE_PROVIDER` env var selects the adapter:

- `libsql` → Drizzle libsql driver, local file, `ENCRYPTION_KEY` for encryption at rest
- `pg` → Drizzle postgres driver, Azure PostgreSQL Flexible Server

Separate schema files per dialect (`sqlite/schema.ts` uses `sqliteTable`, `pg/schema.ts` uses `pgTable`). Both must be kept in sync. `index.ts` uses top-level await with dynamic import to load only the active provider's driver.

Drizzle configs: `drizzle.config.ts` (SQLite, default), `drizzle-pg.config.ts` (PG). Migration output goes to `drizzle/sqlite/` and `drizzle/pg/` respectively.

## Auth Middleware

`hooks.server.ts` uses `sequence(handleLogging, handleBetterAuth, handleAuthGuard)`:

1. **handleLogging** (outermost): generates `requestId`, initializes `logContext`, emits one wide event per request in `finally` with `method, path, requestId, userId, statusCode, duration_ms, outcome, detail` + any `logContext` fields. Handlers add context via `addLogContext(locals, data)` from `$lib/server/logger`.
	2. **handleBetterAuth**: `auth.api.getSession()` extracts session into `event.locals`, then `svelteKitHandler` processes BetterAuth internal routes (`/api/auth/*`)
	3. **handleAuthGuard**: enforces auth on all other routes:
   - `/api/auth/*` → pass through (BetterAuth needs its own endpoints unauthenticated)
   - `/api/*` without session → 401 JSON
   - Page routes without session → 302 redirect to `/auth`
   - `/auth` with session → 302 redirect to `/`
   - Skips all checks during `building` (static build)

Route paths are defined in `src/lib/server/constants.ts`: `API_BASE`, `AUTH_API_ROUTE`, `AUTH_PAGE_ROUTE`, `API_VERSION`.

## Auth Client

`src/lib/auth-client.ts` exports `authClient` (for API calls like `signOut()`) and `useSession` (nanostore Atom for reactive session state). Uses `createAuthClient` from `better-auth/svelte`. Sign-out uses `authClient.signOut()` + `window.location.href` to force a full page reload.

## Auth Page

`/auth` is a single page with client-side toggle between sign-in and sign-up modes. Form actions `?/signIn` and `?/signUp` call BetterAuth server API. Error messages displayed via `form.message`. Google OAuth is deferred to a future step.

## AI Integration

- User configures endpoint URL, model, API key in Settings (stored in `userSettings` table)
- Vercel AI SDK `createOpenAI({ baseURL, apiKey })` creates provider per-request
- System prompt instructs structured JSON: `{description, calories, protein, carbs, fat}`
- Vision: images sent as base64 content blocks
- Source tracked: `"manual" | "ai_text" | "ai_vision" | "ai_text_vision"`

## Key Environment Variables

```
ORIGIN=                    # Public URL of the app (used by BetterAuth baseURL)
BETTER_AUTH_SECRET=       # >=32 chars, high entropy
ENCRYPTION_SECRET=        # For DB encryption + file key derivation
DATABASE_PROVIDER=libsql  # or pg
DATABASE_URL=             # Connection string
ENCRYPTION_KEY=           # libsql encryption key (self-hosted only)
LOG_LEVEL=info            # verbose|info|error|none — controls Pino log level
AZURE_BLOB_CONNECTION_STRING=  # Azure deployment only
GOOGLE_CLIENT_ID=            # Optional (deferred)
GOOGLE_CLIENT_SECRET=        # Optional (deferred)
```

## Testing

After changes, run in order (fail fast):

1. Type check → 2. Lint → 3. Unit tests → 4. Integration tests

For web apps: use `browser-automation` skill to verify UI changes work.

## Dev Server (pm2)

Use pm2 when testing the running server (e.g., verifying logs, auth flows). Full guide: `docs/agents/pm2.md`.

```bash
npx pm2 start scripts/pm2-dev.mjs --name calorietracker  # start
npx pm2 logs calorietracker --lines 20 --nostream        # view logs
npx pm2 stop calorietracker && npx pm2 delete calorietracker  # clean up
```

## Commit Conventions

- One commit per session — amend the existing commit as work progresses
- Only commit and push when explicitly asked
- Imperative form ("Add feature" not "Added feature")
