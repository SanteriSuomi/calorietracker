# Step 2: Database — Implementation Log

**Date:** 2026-04-11
**Status:** Complete

## What was done

### 1. Dual-provider database schema

Implemented separate Drizzle ORM schemas for both libsql (SQLite) and PostgreSQL, sharing the same table/column semantics but using dialect-specific builders (`sqliteTable` vs `pgTable`).

#### Custom tables (added to both dialects)

**`meal`**

| Column          | Type                                  | Constraints                                 | Notes                                                                         |
| --------------- | ------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------- |
| `id`            | `text`                                | PK, `$defaultFn(() => crypto.randomUUID())` | Matches BetterAuth text PK convention                                         |
| `userId`        | `text`                                | FK → `user.id`, cascade delete              |                                                                               |
| `date`          | `text`                                | not null                                    | `YYYY-MM-DD` format                                                           |
| `description`   | `text`                                | not null                                    |                                                                               |
| `calories`      | `integer`                             | not null                                    | kcal                                                                          |
| `protein`       | `integer`                             | not null                                    | grams                                                                         |
| `carbs`         | `integer`                             | not null                                    | grams                                                                         |
| `fat`           | `integer`                             | not null                                    | grams                                                                         |
| `imageFilename` | `text`                                | nullable                                    | Opaque storage key, resolved by adapter                                       |
| `source`        | `text`                                | not null                                    | `"manual" \| "ai_text" \| "ai_vision" \| "ai_text_vision"` — validated in app |
| `createdAt`     | `integer` (sqlite) / `timestamp` (pg) | not null, default now                       |                                                                               |
| `createdBy`     | `text`                                | not null                                    |                                                                               |
| `updatedAt`     | `integer` (sqlite) / `timestamp` (pg) | not null, default now                       |                                                                               |
| `updatedBy`     | `text`                                | not null                                    |                                                                               |

Index: `meal_userId_date_idx` on `(userId, date)` for day-view queries.

**`user_settings`**

| Column             | Type                                  | Constraints                                 | Notes                                     |
| ------------------ | ------------------------------------- | ------------------------------------------- | ----------------------------------------- |
| `id`               | `text`                                | PK, `$defaultFn(() => crypto.randomUUID())` |                                           |
| `userId`           | `text`                                | FK → `user.id`, unique, cascade delete      | 1:1 with user                             |
| `dailyCalorieGoal` | `integer`                             | not null, default `2000`                    |                                           |
| `dailyProteinGoal` | `integer`                             | nullable                                    | grams                                     |
| `dailyCarbsGoal`   | `integer`                             | nullable                                    | grams                                     |
| `dailyFatGoal`     | `integer`                             | nullable                                    | grams                                     |
| `aiEndpointUrl`    | `text`                                | nullable                                    | e.g. `https://api.openai.com/v1`          |
| `aiApiKey`         | `text`                                | nullable                                    | Plaintext — DB-level encryption covers it |
| `aiModel`          | `text`                                | nullable                                    | e.g. `gpt-4o`                             |
| `createdAt`        | `integer` (sqlite) / `timestamp` (pg) | not null, default now                       |                                           |
| `createdBy`        | `text`                                | not null                                    |                                           |
| `updatedAt`        | `integer` (sqlite) / `timestamp` (pg) | not null, default now                       |                                           |
| `updatedBy`        | `text`                                | not null                                    |                                           |

#### BetterAuth tables (rewritten for each dialect)

`user`, `session`, `account`, `verification` — originally generated by `better-auth generate` for SQLite only. Rewritten for PG with:

- `boolean()` instead of `integer({ mode: 'boolean' })`
- `timestamp({ withTimezone: true })` instead of `integer({ mode: 'timestamp_ms' })`
- `defaultNow()` instead of `sql\`(cast(unixepoch('subsecond') \* 1000 as integer))\``

#### Relations

Added to both dialects:

- `user` → many `meal`, many `userSettings` (in addition to existing sessions/accounts)
- `meal` → one `user`
- `userSettings` → one `user`

### 2. Directory structure

```
src/lib/server/db/
├── index.ts              # Conditional driver init (top-level await)
├── schema.ts             # Re-exports sqlite/schema (used by non-driver imports)
├── shared/
│   ├── constants.ts      # MEAL_SOURCES, DEFAULT_CALORIE_GOAL, MealSource type
│   └── provider.ts       # Reads DATABASE_PROVIDER env, exports type + value
├── sqlite/
│   ├── schema.ts         # All tables via sqliteTable + relations
│   └── driver.ts         # drizzle-orm/libsql client init
└── pg/
    ├── schema.ts         # All tables via pgTable + relations
    └── driver.ts         # drizzle-orm/node-postgres client init
```

Old `auth.schema.ts` removed — auth tables are now embedded in each dialect's `schema.ts`.

### 3. Provider switching

`src/lib/server/db/index.ts` uses a top-level `await` with dynamic `import()`:

```typescript
export const { db } = await (provider === 'pg' ? import('./pg/driver') : import('./sqlite/driver'));
```

This ensures only the active provider's driver module is loaded at runtime.

`shared/provider.ts` reads `DATABASE_PROVIDER` env var (defaults to `'libsql'`).

### 4. Auth adapter updated

`src/lib/server/auth.ts` now uses dynamic provider:

```typescript
database: drizzleAdapter(db, { provider: databaseProvider === 'pg' ? 'pg' : 'sqlite' });
```

### 5. Drizzle Kit configs

| File                   | Dialect    | Schema path                            | Migration output   |
| ---------------------- | ---------- | -------------------------------------- | ------------------ |
| `drizzle.config.ts`    | sqlite     | `./src/lib/server/db/sqlite/schema.ts` | `./drizzle/sqlite` |
| `drizzle-pg.config.ts` | postgresql | `./src/lib/server/db/pg/schema.ts`     | `./drizzle/pg`     |

Added scripts to `package.json`: `db:push:pg`, `db:generate:pg`, `db:migrate:pg`.

### 6. Migrations generated

- `drizzle/sqlite/0000_chilly_shinobi_shaw.sql` — all 6 tables, SQLite dialect
- `drizzle/pg/0000_bitter_the_liberteens.sql` — all 6 tables, PostgreSQL dialect

### 7. Integration tests

| Test file                    | Provider            | Tests | What's covered                                                                     |
| ---------------------------- | ------------------- | ----- | ---------------------------------------------------------------------------------- |
| `tests/db/constants.test.ts` | N/A                 | 2     | MEAL_SOURCES values, DEFAULT_CALORIE_GOAL                                          |
| `tests/db/sqlite.test.ts`    | libsql (in-memory)  | 8     | Meal CRUD, settings CRUD, defaults, unique constraint, audit fields, UUID auto-gen |
| `tests/db/pg.test.ts`        | PostgreSQL (Docker) | 8     | Same coverage as SQLite tests                                                      |

Updated `vite.config.ts` to include `tests/**/*.{test,spec}.{js,ts}` in the server test project.

## Verification

| Check                                                            | Result               |
| ---------------------------------------------------------------- | -------------------- |
| `pnpm run check` (typecheck)                                     | 0 errors, 0 warnings |
| `pnpm run lint` (prettier + eslint)                              | Pass                 |
| `drizzle-kit push` (SQLite)                                      | 6 tables created     |
| `drizzle-kit push --config=drizzle-pg.config.ts` (PG via Docker) | 6 tables created     |
| `drizzle-kit generate` (SQLite)                                  | 1 migration file     |
| `drizzle-kit generate --config=drizzle-pg.config.ts` (PG)        | 1 migration file     |
| `pnpm run test` (all tests)                                      | 20/20 pass           |

## Design decisions

- **Text UUID PKs** for custom tables — matches BetterAuth's existing convention, avoids integer/auto-increment across providers.
- **No native enums** — `source` column is `text`, validated in app code. Compatible with both libsql and PG without conditional schema logic.
- **Macro goals in userSettings** — nullable integer columns rather than a separate table. 1:1 with user, no extra join.
- **AI API key in plaintext** — relies on DB-level encryption (libsql `encryptionKey` / PG TLS + Azure-managed encryption at rest).
- **`imageFilename` as opaque text key** — storage adapter resolves to local path or Azure Blob path. Schema doesn't know about storage backend.
- **Separate schema files per dialect** — Drizzle requires `sqliteTable` for libsql and `pgTable` for PG. No shared abstraction possible. Both files must be kept in sync manually.

## Files created

```
src/lib/server/db/shared/constants.ts
src/lib/server/db/shared/provider.ts
src/lib/server/db/sqlite/schema.ts
src/lib/server/db/sqlite/driver.ts
src/lib/server/db/pg/schema.ts
src/lib/server/db/pg/driver.ts
drizzle-pg.config.ts
drizzle/sqlite/0000_chilly_shinobi_shaw.sql
drizzle/sqlite/meta/
drizzle/pg/0000_bitter_the_liberteens.sql
drizzle/pg/meta/
tests/db/constants.test.ts
tests/db/sqlite.test.ts
tests/db/pg.test.ts
```

## Files modified

```
src/lib/server/db/index.ts          # Rewritten for dual-provider
src/lib/server/db/schema.ts         # Re-exports sqlite/schema
src/lib/server/auth.ts              # Dynamic provider in drizzleAdapter
drizzle.config.ts                   # Updated schema path + migration output
package.json                        # Added PG drizzle scripts
vite.config.ts                      # Added tests/ to server project include
```

## Files deleted

```
src/lib/server/db/auth.schema.ts    # Auth tables moved into dialect schemas
```
