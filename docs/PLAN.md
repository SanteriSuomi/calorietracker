# CalorieTracker — Implementation Plan

> Living document. Tracks the implementation roadmap for the CalorieTracker app.
> See `docs/INITIAL_PLAN.md` for the original plan.

## Overview

Mobile-first calorie and macro tracker with AI-powered food logging via text description and/or photo analysis. Two views: day view (main) and calendar/history.

## Stack

| Layer      | Choice                                                                              |
| ---------- | ----------------------------------------------------------------------------------- |
| Frontend   | SvelteKit 2 + Svelte 5 (runes)                                                      |
| Styling    | Tailwind CSS + shadcn-svelte                                                        |
| Charts     | Chart.js (doughnut) via direct Svelte 5 `$effect`                                   |
| Backend    | SvelteKit server routes (`src/routes/api/`)                                         |
| Database   | Drizzle ORM — dual provider: libsql (self-hosted) / PostgreSQL (Azure)              |
| Auth       | BetterAuth (email/password + optional Google OAuth)                                 |
| AI         | Vercel AI SDK (`ai` + `@ai-sdk/openai`) + zod (output schema), user-configured endpoint |
| i18n       | paraglide-js — compile-time, English + Finnish                                      |
| Logging    | Pino — structured JSON, wide-event pattern, `info`/`error` only                     |
| Encryption | libsql `encryptionKey` (DB) + AES-256-GCM per-user (images, self-hosted)            |
| CI/CD      | GitHub Actions                                                                      |
| Deploy     | Azure Container Apps (consumption) + self-hosted server (parallel stages)           |
| IaC        | Bicep (idempotent, Azure-native)                                                    |

---

## Data Model

See `docs/SCHEMA.md` for full schema details including column types per dialect.

### Audit Base (applied to all custom tables)

```
createdAt  — timestamp, not null, default now
createdBy  — text, not null (user id)
updatedAt  — timestamp, not null, default now
updatedBy  — text, not null (user id)
```

### BetterAuth Tables (auto-generated)

`user`, `session`, `account`, `verification`

### Custom Tables

**meal**
| Column | Type | Notes |
|---|---|---|
| id | text (PK) | UUID via `crypto.randomUUID()` |
| userId | text (FK → user) | Cascade delete |
| date | text | YYYY-MM-DD |
| description | text | Food description |
| calories | integer | kcal |
| protein | integer | grams |
| carbs | integer | grams |
| fat | integer | grams |
| imageFilename | text? | Encrypted image filename |
| source | text | `"manual" \| "ai_text" \| "ai_vision" \| "ai_text_vision"` |
| _audit fields_ | | |

Index: `meal_userId_date_idx` on `(userId, date)`.

**userSettings**
| Column | Type | Notes |
|---|---|---|
| id | text (PK) | UUID via `crypto.randomUUID()` |
| userId | text (FK → user, unique) | 1:1 with user, cascade delete |
| dailyCalorieGoal | integer | Default 2000 |
| dailyProteinGoal | integer? | Default 150 |
| dailyCarbsGoal | integer? | Default 250 |
| dailyFatGoal | integer? | Default 65 |
| aiEndpointUrl | text? | e.g. `https://api.openai.com/v1` |
| aiApiKey | text? | User's API key |
| aiModel | text? | e.g. `gpt-4o` |
| aiSystemPrompt | text? | Override default AI system prompt |
| _audit fields_ | | |

---

## UI Design

### Main Screen (`/`) — Day View

```
┌─────────────────────────┐
│  ◀  April 9, 2026  ▶   │  ← DateNav: arrows to change day
│                         │
│      ╭─────────╮        │
│     │  1,450   │        │  ← CalorieDoughnut (Chart.js)
│     │  / 2,200 │        │     calories eaten / daily goal
│      ╰─────────╯        │
│   P: 120g  C: 180g  F: 55g │  ← macro summary
│                         │
│  ┌───────────────────┐  │
│  │ Chicken & Rice     │  │  ← MealList (flat, scrollable)
│  │    450 cal         │  │     each item = MealCard
│  │ Protein Shake      │  │     tap to edit/delete
│  │    200 cal         │  │
│  └───────────────────┘  │
│                         │
│ ┌─────────────────────┐ │
│ │ [text box: describe] │ │  ← InputBar (sticky bottom)
│ └─────────────────────┘ │
│  📷  [Submit to AI]  ✏️  │  ← camera / submit / manual
│                        📅│  ← nav to calendar
└─────────────────────────┘
```

### Calendar View (`/calendar`)

Two tabs:

1. **Grid** — Month calendar, each day cell shows calorie total, tap navigates to day
2. **List** — Scrollable list of recent days with summary cards (date, calories, macros)

### Settings (`/settings`)

- AI config: endpoint URL, model name, API key, system prompt
- Daily goals: calorie, protein, carbs, fat
- Language switcher
- Account info / sign out

### Auth (`/auth`)

- Sign in (email/password, optional Google OAuth)
- Sign up

---

## API Routes

| Endpoint                     | Method | Purpose                              |
| ---------------------------- | ------ | ------------------------------------ |
| `/api/meals?date=YYYY-MM-DD` | GET    | Get meals for date                   |
| `/api/meals`                 | POST   | Create meal                          |
| `/api/meals/[id]`            | PUT    | Update meal                          |
| `/api/meals/[id]`            | DELETE | Delete meal                          |
| `/api/ai/analyze`            | POST   | AI text+vision analysis → nutrition  |
| `/api/images/upload`         | POST   | Upload image (multipart form data)   |
| `/api/images/[filename]`     | GET    | Serve decrypted image (auth-checked) |
| `/api/settings`              | GET    | Get user settings                    |
| `/api/settings`              | PUT    | Update user settings                 |

---

## Auth Middleware (`hooks.server.ts`)

`sequence(handleParaglide, handleLogging, handleBetterAuth, handleAuthGuard)`:

1. `handleParaglide` — i18n locale detection and cookie setting
2. `handleLogging` — generates `requestId`, emits one wide event per request in `finally`
3. `handleBetterAuth` — `auth.api.getSession()` extracts session into `event.locals`, then `svelteKitHandler` processes `/api/auth/*`
4. `handleAuthGuard` — `/api/auth/*` passes through; `/api/*` without session → 401 JSON; page routes without session → 302 to `/auth`; `/auth` with session → 302 to `/`

---

## Logging

Pino with wide-event pattern in `hooks.server.ts`:

- One structured JSON event per API request, emitted in `finally`
- Fields: `method, path, requestId, userId, statusCode, duration_ms, outcome, error?`
- Business context added per-handler (e.g., `mealId`, `aiSource`)
- Two levels only: `info` and `error`

---

## AI Flow

1. User provides text description and/or photo in InputBar
2. Frontend sends `{ description?, imageFile? }` to `POST /api/ai/analyze`
3. Server reads user's AI settings from DB
4. Creates Vercel AI SDK provider: `createOpenAI({ baseURL, apiKey })`
5. Builds prompt with user's system prompt (or default) + format suffix
6. If image: uploads to encrypted storage, sends as base64 content block
7. Calls `generateText()` with zod output schema for structured response
8. Returns nutrition data to frontend → saves as meal

---

## Encryption

### Database (self-hosted)

libsql with `encryptionKey` derived from `ENCRYPTION_SECRET` env var.

### Images (self-hosted)

- Per-user key derived via `scrypt(userId, ENCRYPTION_SECRET)` → 32 bytes
- AES-256-GCM: random IV per file, auth tag for integrity
- File layout: `[IV 16B][AuthTag 16B][Ciphertext]`
- Stored at `data/images/{userId}/{timestamp}.enc`

### Azure deployment

- PostgreSQL: TLS in transit, Azure-managed encryption at rest
- Blob Storage: Azure-managed encryption at rest
- No application-level encryption needed

---

## Dual Database & Storage Strategy

|                 | Self-hosted                    | Azure                       |
| --------------- | ------------------------------ | --------------------------- |
| Database        | libsql (local encrypted file)  | PostgreSQL Flexible Server  |
| Drizzle adapter | `drizzle-orm/libsql`           | `drizzle-orm/node-postgres` |
| Images          | Local filesystem (AES-256-GCM) | Azure Blob Storage          |
| DB switch       | `DATABASE_PROVIDER=libsql`     | `DATABASE_PROVIDER=pg`      |
| Storage switch  | `STORAGE_PROVIDER=local`       | `STORAGE_PROVIDER=azure`    |

Same Drizzle schema, different adapter. Storage providers: `src/lib/server/storage/`.

---

## CI/CD Pipeline (GitHub Actions)

```
Job 1: Build & Test
  → Install deps, lint, typecheck, test
  → Build Docker image
  → Push to GitHub Container Registry (GHCR)

Job 2: Deploy Azure (on main, after build)
  → az deployment group create -f infra/main.bicep (idempotent)
  → az containerapp update --image <new-tag>

Job 3: Deploy MiniPC (on main, after build, parallel to Job 2)
  → Self-hosted GitHub Actions runner on MiniPC
  → docker pull from GHCR + docker compose up -d
```

## Infrastructure

### Azure Resources (infra/main.bicep)

- Container Apps Environment
- Container App (ACR image, minReplicas: 0)
- Azure Container Registry
- PostgreSQL Flexible Server + Database
- Blob Storage Account
- Key Vault (secrets)

### MiniPC (192.168.1.233)

- Docker Compose for CalorieTracker (separate from existing `~/mediaserver/compose.yml`)
- Self-hosted GitHub Actions runner (Docker container)
- Tailscale VPN (already configured)
- Reverse proxy + HTTPS (Traefik or Caddy)
- `.env` template for self-hosted config

---

## Environment Variables

```
BETTER_AUTH_SECRET=          # >=32 chars, high entropy
ORIGIN=                      # Public URL (BetterAuth baseURL)
ENCRYPTION_SECRET=           # DB + file encryption
DATABASE_PROVIDER=libsql     # or pg
DATABASE_URL=                # Connection string
STORAGE_PROVIDER=local       # or azure
ENCRYPTION_KEY=              # libsql only
AZURE_BLOB_CONNECTION_STRING= # Azure only
GOOGLE_CLIENT_ID=            # Optional
GOOGLE_CLIENT_SECRET=        # Optional
```

---

## Implementation Steps

- [x] 0. Project init — git init, .gitignore, PLAN.md, AGENTS.md, commit, push to GitHub
- [x] 1. Scaffold — `sv create`, install all deps
- [x] 2. Database — Drizzle schema with audit fields, dual-provider setup, initial migration
- [x] 3. Auth — BetterAuth config, hooks, sign-in/up page, middleware (Google OAuth deferred)
- [x] 4. Logging — Pino singleton, request logging middleware in hooks
- [x] 5. Main day view — CalorieDoughnut (Chart.js), DateNav, empty MealList
- [x] 6. Manual meal CRUD — ManualEntrySheet, API routes, DB operations
- [x] 7. AI integration — Settings page, Vercel AI SDK provider, analyze endpoint, InputBar
- [x] 8. Image handling — Upload, encrypt/decrypt (dual storage), serve with auth check
- [x] 9. Calendar view — Month grid + list tabs, navigate to day
- [x] 10. Docker + local dev — Dockerfile, docker-compose
- [ ] 11. IaC — Bicep templates for Azure resources *(superseded by step 18)*
- [ ] 12. CI/CD — Azure DevOps pipeline *(superseded by step 19)*
- [x] 13. Internationalization — i18n setup (paraglide), locale detection, extract all hardcoded strings to translation files, language switcher in Settings, English + Finnish
- [x] 14. Polish — Loading states, error handling, PWA manifest. Bugfixes: title link to home, brand name not translated ("CalorieTracker"), settings page scrollbar, image+text AI input
- [x] 15. Password Recovery — Forgot password flow: email with reset link, reset password page. Requires email provider (Resend/SendGrid/SMTP). BetterAuth built-in email verification + password reset plugins
- [x] 16. Settings & Calendar Improvements — Expose macro goals (protein/carbs/fat) in Settings UI. Configurable AI system prompt with assertive default + enforced format suffix. Reorder Settings: AI Config → Goals → Language → Account. Calendar List: extended range (90 days), scroll container, calories per day row, date search/filter
- [ ] 17. AI Goal Estimation & Account Management — User profile inputs (age, weight, height, activity level, goal). POST /api/ai/estimate-goals → AI returns kcal + macro targets. "Estimate with AI" button pre-fills Goals section. Delete account + all user data (meals, settings, images, auth). Confirmation dialog, cascade cleanup, sign out + redirect
- [ ] 18. Infrastructure Setup — Azure: Bicep templates (Container Apps, ACR, PostgreSQL, Blob Storage, Key Vault). MiniPC: Docker Compose, self-hosted GitHub Actions runner, Tailscale networking, reverse proxy + HTTPS, .env template
- [ ] 19. CI/CD — GitHub Actions: build + lint + typecheck + test, Docker image → GHCR, deploy Azure (Bicep + container app update), deploy MiniPC (self-hosted runner pulls image + docker compose up -d)
