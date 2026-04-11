## Project Configuration

- **Language**: TypeScript
- **Package Manager**: pnpm
- **Add-ons**: tailwindcss, drizzle, better-auth, vitest, sveltekit-adapter, prettier, eslint

---

# AGENTS.md

AI agent context file for the CalorieTracker project.

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
src/
├── lib/
│   ├── auth.ts              # BetterAuth server instance
│   ├── auth-client.ts       # BetterAuth client (nanostores)
│   ├── server/
│   │   ├── auth.ts          # BetterAuth config (drizzle adapter, dynamic provider)
│   │   └── db/
│   │       ├── index.ts     # Conditional driver init (DATABASE_PROVIDER switch)
│   │       ├── schema.ts    # Re-exports sqlite/schema
│   │       ├── shared/
│   │       │   ├── constants.ts  # MEAL_SOURCES, DEFAULT_CALORIE_GOAL
│   │       │   └── provider.ts   # DATABASE_PROVIDER reader
│   │       ├── sqlite/
│   │       │   ├── schema.ts     # All tables via sqliteTable + relations
│   │       │   └── driver.ts     # drizzle-orm/libsql client
│   │       └── pg/
│   │           ├── schema.ts     # All tables via pgTable + relations
│   │           └── driver.ts     # drizzle-orm/node-postgres client
│   ├── crypto.ts            # AES-256-GCM encrypt/decrypt + scrypt key derivation
│   ├── logger.ts            # Pino singleton + request logger helper
│   ├── ai.ts                # Vercel AI SDK provider setup + prompt templates
│   ├── components/
│   │   ├── ui/              # shadcn-svelte primitives
│   │   ├── CalorieDoughnut.svelte
│   │   ├── MealCard.svelte
│   │   ├── MealList.svelte
│   │   ├── ManualEntrySheet.svelte
│   │   ├── AiInputBar.svelte
│   │   └── DateNav.svelte
│   └── utils.ts
├── routes/
│   ├── +layout.server.ts    # Auth gate, load session
│   ├── +page.svelte         # Day view (main screen)
│   ├── calendar/+page.svelte
│   ├── settings/+page.svelte
│   ├── auth/+page.svelte
│   └── api/
│       ├── meals/+server.ts
│       ├── meals/[id]/+server.ts
│       ├── ai/analyze/+server.ts
│       ├── images/[filename]/+server.ts
│       └── settings/+server.ts
├── hooks.server.ts          # BetterAuth handler + auth middleware + logging
└── app.html
tests/
├── db/
│   ├── constants.test.ts    # Shared constants
│   ├── sqlite.test.ts       # SQLite integration (in-memory)
│   └── pg.test.ts           # PG integration (Docker)
infra/
├── main.bicep               # Azure resources (Container Apps, ACR, PostgreSQL, Blob, KeyVault)
└── parameters.json
docs/
├── PLAN.md                  # Implementation plan
└── stages/                  # Stage implementation logs
data/                        # Runtime data (gitignored)
```

## Documentation

- `docs/PLAN.md` — Living implementation plan with step checklist and design specs
- `docs/stages/` — Implementation logs for each completed step (STAGE0, STAGE1, STAGE2, …)
- Stage files record what was done, verification results, files created/modified/deleted, and design decisions

## Code Conventions

- Svelte 5 runes only (no `$:` reactive syntax)
- Explicit named imports, no wildcards or barrel files
- Case-sensitive paths always
- Strict TypeScript, types reflect reality (`?` for optional, `| null` for nullable)
- Audit fields on all custom tables: `createdAt, createdBy, updatedAt, updatedBy` (via `auditColumns()` helper spread into table definitions)
- Comments only for exotic functions, workarounds, complex algorithms
- Logging: one wide event per request, emitted in `finally`, structured JSON via Pino

## Database Provider Switching

`DATABASE_PROVIDER` env var selects the adapter:

- `libsql` → Drizzle libsql driver, local file, `ENCRYPTION_KEY` for encryption at rest
- `pg` → Drizzle postgres driver, Azure PostgreSQL Flexible Server

Separate schema files per dialect (`sqlite/schema.ts` uses `sqliteTable`, `pg/schema.ts` uses `pgTable`). Both must be kept in sync. `index.ts` uses top-level await with dynamic import to load only the active provider's driver.

Drizzle configs: `drizzle.config.ts` (SQLite, default), `drizzle-pg.config.ts` (PG). Migration output goes to `drizzle/sqlite/` and `drizzle/pg/` respectively.

## Auth Middleware

`hooks.server.ts` handles:

1. BetterAuth `svelteKitHandler` for auth routes
2. `auth.api.getSession()` on all `/api/*` routes → 401 if unauthenticated
3. Populate `event.locals.session` + `event.locals.user`
4. Request logging (Pino wide event with method, path, requestId, userId, statusCode, duration_ms)

## AI Integration

- User configures endpoint URL, model, API key in Settings (stored in `userSettings` table)
- Vercel AI SDK `createOpenAI({ baseURL, apiKey })` creates provider per-request
- System prompt instructs structured JSON: `{description, calories, protein, carbs, fat}`
- Vision: images sent as base64 content blocks
- Source tracked: `"manual" | "ai_text" | "ai_vision" | "ai_text_vision"`

## Key Environment Variables

```
BETTER_AUTH_SECRET=       # >=32 chars, high entropy
BETTER_AUTH_URL=          # Public URL of the app
ENCRYPTION_SECRET=        # For DB encryption + file key derivation
DATABASE_PROVIDER=libsql  # or pg
DATABASE_URL=             # Connection string
ENCRYPTION_KEY=           # libsql encryption key (self-hosted only)
AZURE_BLOB_CONNECTION_STRING=  # Azure deployment only
```

## Testing

After changes, run in order (fail fast):

1. Type check → 2. Lint → 3. Unit tests → 4. Integration tests
