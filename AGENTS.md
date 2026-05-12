# AGENTS.md

## Project

Mobile-first web app for tracking daily calorie and macro intake. Users log meals
manually or via AI (text/photo). See `docs/PLAN.md` for roadmap.

## Tech Stack

- SvelteKit 2 + Svelte 5 (runes only — forced globally in `svelte.config.js`)
- Tailwind CSS + shadcn-svelte (vega style)
- Drizzle ORM — dual provider: `libsql` (default) / `pg`, selected by `DATABASE_PROVIDER`
- BetterAuth — email/password
- Vercel AI SDK (`ai` + `@ai-sdk/openai`) — multi-modal via `generateText`
- Biome (not Prettier/ESLint) — config in `biome.json`
- Pino — structured JSON, wide-event pattern
- pnpm

## Structure

```
src/lib/server/       # Server-only code (auth, db, logger, storage, encryption)
src/lib/components/   # Shared components (ui/ is shadcn-svelte generated)
src/routes/           # SvelteKit routes (pages + API endpoints)
src/hooks.server.ts   # Middleware: i18n → logging → auth → route guards
tests/                # Vitest unit & integration tests
docs/                 # PLAN.md, SCHEMA.md, step plans
scripts/              # seed-dev.ts, pm2-dev.mjs
```

## Commands

```
pnpm check              # svelte-check type checking
pnpm lint               # Biome check (no fix)
pnpm format             # Biome check --write (fix)
pnpm test               # All tests (non-watch)
pnpm db:push            # Push SQLite schema
pnpm db:push:pg         # Push PG schema
pnpm db:generate        # Generate SQLite migration
pnpm db:generate:pg     # Generate PG migration
pnpm auth:schema        # Regenerate BetterAuth schema
pnpm seed:dev           # Create test user (libsql only)
```

## Non-Obvious Conventions

- Svelte 5 runes only (no `$:` syntax) — forced in `svelte.config.js`
- Two Vitest projects: `client` (Browser/Playwright) and `server` (Node) — see `vite.config.ts`
- Browser verification mandatory for UI changes — typecheck+lint+tests are not sufficient
- Audit columns (`createdAt, createdBy, updatedAt, updatedBy`) on all custom tables via `auditColumns()`
- Wide-event logging: one event per request in `finally` block
- Validation on both frontend and backend (server is source of truth)
- Multi-modal AI content uses `{ type: 'file', mediaType, data }` (not `{ type: 'image' }`)
- Dual DB schemas (`sqlite/schema.ts` and `pg/schema.ts`) must stay in sync

## Gotchas

- `tsx` doesn't auto-load `.env` — use `MSYS_NO_PATHCONV=1 npx tsx -r dotenv/config <script>`
- `.env` is gitignored and NOT copied to worktrees — copy manually + `drizzle-kit push`
- Agent may run outside the worktree directory — show full file paths when in worktrees or similar

## Living Docs

- `docs/PLAN.md` — update when steps complete
- `docs/SCHEMA.md` — update when schema or routes change
