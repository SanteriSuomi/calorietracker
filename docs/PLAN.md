# CalorieTracker — Implementation Plan

> Living document. Tracks the implementation roadmap for the CalorieTracker app.

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
| AI         | Vercel AI SDK (`ai` + `@ai-sdk/openai`), user-configured OpenAI-compatible endpoint |
| Logging    | Pino — structured JSON, wide-event pattern, `info`/`error` only                     |
| Encryption | libsql `encryptionKey` (DB) + AES-256-GCM per-user (images, self-hosted)            |
| CI/CD      | Azure DevOps Pipelines                                                              |
| Deploy     | Azure Container Apps (consumption) + self-hosted server (parallel stages)           |
| IaC        | Bicep (idempotent, Azure-native)                                                    |

---

## Data Model

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

**meals**
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| userId | text (FK → user) | |
| date | text | YYYY-MM-DD |
| description | text | Food description |
| calories | integer | kcal |
| protein | integer | grams |
| carbs | integer | grams |
| fat | integer | grams |
| imageFilename | text? | Encrypted image filename |
| source | text | "manual" \| "ai*text" \| "ai_vision" \| "ai_text_vision" |
| \_audit fields* | | |

**userSettings**
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| userId | text (FK → user, unique) | One settings row per user |
| dailyCalorieGoal | integer | Default 2000 |
| aiEndpointUrl | text? | e.g. https://api.openai.com/v1 |
| aiApiKey | text? | User's API key |
| aiModel | text? | e.g. gpt-4o |
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
│ │ [text box: describe] │ │  ← AiInputBar (sticky bottom)
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

- Daily calorie goal input
- AI config: endpoint URL, model name, API key
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
| `/api/images/[filename]`     | GET    | Serve decrypted image (auth-checked) |
| `/api/settings`              | GET    | Get user settings                    |
| `/api/settings`              | PUT    | Update user settings                 |

---

## Auth Middleware (`hooks.server.ts`)

1. BetterAuth `svelteKitHandler` for auth routes
2. `auth.api.getSession()` on all `/api/*` → 401 if unauthenticated
3. Populate `event.locals.session` + `event.locals.user`

---

## Logging

Pino with wide-event pattern in `hooks.server.ts`:

- One structured JSON event per API request, emitted in `finally`
- Fields: `method, path, requestId, userId, statusCode, duration_ms, outcome, error?`
- Business context added per-handler (e.g., `mealId`, `aiSource`)
- Two levels only: `info` and `error`

---

## AI Flow

1. User provides text description and/or photo in AiInputBar
2. Frontend sends `{ description?, imageFile? }` to `POST /api/ai/analyze`
3. Server reads user's AI settings from DB
4. Creates Vercel AI SDK provider: `createOpenAI({ baseURL, apiKey })`
5. Builds prompt with system instruction to return structured JSON
6. If image: uploads to encrypted storage, sends as base64 content block
7. Calls `generateText()` with the model
8. Parses `{description, calories, protein, carbs, fat}` from response
9. Returns nutrition data to frontend → saves as meal

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

## Dual Database Strategy

|                 | Self-hosted                    | Azure                       |
| --------------- | ------------------------------ | --------------------------- |
| Database        | libsql (local encrypted file)  | PostgreSQL Flexible Server  |
| Drizzle adapter | `drizzle-orm/libsql`           | `drizzle-orm/node-postgres` |
| Images          | Local filesystem (AES-256-GCM) | Azure Blob Storage          |
| Switch          | `DATABASE_PROVIDER=libsql`     | `DATABASE_PROVIDER=pg`      |

Same Drizzle schema, different adapter.

---

## CI/CD Pipeline (azure-pipelines.yml)

```
Stage 1: Build
  → Install deps, lint, typecheck, test
  → Build Docker image
  → Push to Azure Container Registry

Stage 2: Deploy Azure (on main)
  → az deployment group create -f infra/main.bicep (idempotent)
  → az containerapp update --image <new-tag>

Stage 3: Deploy Self-Hosted (on main, parallel to Stage 2)
  → SSH into server
  → docker pull + docker-compose up -d
```

## Bicep Resources (infra/main.bicep)

- Container Apps Environment
- Container App (ACR image, minReplicas: 0)
- Azure Container Registry
- PostgreSQL Flexible Server + Database
- Blob Storage Account
- Key Vault (secrets)

---

## Environment Variables

```
BETTER_AUTH_SECRET=          # >=32 chars, high entropy
BETTER_AUTH_URL=             # Public URL
ENCRYPTION_SECRET=           # DB + file encryption
DATABASE_PROVIDER=libsql     # or pg
DATABASE_URL=                # Connection string
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
- [x] 7. AI integration — Settings page, Vercel AI SDK provider, analyze endpoint, AiInputBar
- [x] 8. Image handling — Upload, encrypt/decrypt (dual storage), serve with auth check
- [x] 9. Calendar view — Month grid + list tabs, navigate to day
- [x] 10. Docker + local dev — Dockerfile, docker-compose
- [ ] 11. IaC — Bicep templates for Azure resources
- [ ] 12. CI/CD — Azure DevOps pipeline (build, deploy Azure, deploy self-hosted)
- [ ] 13. Internationalization — i18n setup (e.g. `sveltekit-i18n` or `paraglide`), locale detection, extract all hardcoded strings to translation files, language switcher in Settings, start with English + one additional language
- [ ] 14. Polish — Edit/delete, loading states, error handling, PWA manifest
