# Data Model

## Audit Base

All custom tables include audit columns via `auditColumns()` helper:

| Column      | Type      | SQLite                              | PostgreSQL                          |
| ----------- | --------- | ----------------------------------- | ----------------------------------- |
| `createdAt` | timestamp | `integer({ mode: 'timestamp_ms' })` | `timestamp({ withTimezone: true })` |
| `createdBy` | text      | not null                            | not null                            |
| `updatedAt` | timestamp | `integer({ mode: 'timestamp_ms' })` | `timestamp({ withTimezone: true })` |
| `updatedBy` | text      | not null                            | not null                            |

## BetterAuth Tables (auto-generated)

`user`, `session`, `account`, `verification` — defined in both `src/lib/server/db/sqlite/schema.ts` and `src/lib/server/db/pg/schema.ts`.

## Custom Tables

### meal

| Column         | Type             | Notes                                                                         |
| -------------- | ---------------- | ----------------------------------------------------------------------------- |
| id             | text (PK)        | UUID via `crypto.randomUUID()`                                                |
| userId         | text (FK → user) | Cascade delete                                                                |
| date           | text             | YYYY-MM-DD                                                                    |
| description    | text             | Food description                                                              |
| calories       | integer          | kcal                                                                          |
| protein        | integer          | grams                                                                         |
| carbs          | integer          | grams                                                                         |
| fat            | integer          | grams                                                                         |
| imageFilename  | text?            | Encrypted image filename (opaque storage key)                                 |
| source         | text             | `"manual" \| "ai_text" \| "ai_vision" \| "ai_text_vision"` — validated in app |
| _audit fields_ |                  |                                                                               |

Index: `meal_userId_date_idx` on `(userId, date)`.

### userSettings

| Column           | Type                     | Notes                            |
| ---------------- | ------------------------ | -------------------------------- |
| id               | text (PK)                | UUID via `crypto.randomUUID()`   |
| userId           | text (FK → user, unique) | 1:1 with user, cascade delete    |
| dailyCalorieGoal | integer                  | Default 2000                     |
| dailyProteinGoal | integer?                 | grams                            |
| dailyCarbsGoal   | integer?                 | grams                            |
| dailyFatGoal     | integer?                 | grams                            |
| aiEndpointUrl    | text?                    | e.g. `https://api.openai.com/v1` |
| aiApiKey         | text?                    | DB-level encryption covers it    |
| aiModel          | text?                    | e.g. `gpt-4o`                    |
| aiSystemPrompt   | text?                    | Override default AI system prompt|
| _audit fields_   |                          |                                  |

## Constants

Defined in `src/lib/server/db/shared/constants.ts`:

- `DEFAULT_CALORIE_GOAL = 2000`
- `DEFAULT_PROTEIN_GOAL = 150`
- `DEFAULT_CARBS_GOAL = 250`
- `DEFAULT_FAT_GOAL = 65`
- `DEFAULT_AI_SYSTEM_PROMPT` — assertive nutrition estimation prompt
- `AI_FORMAT_SUFFIX` — enforced JSON output format instruction (appended to system prompt)
- `MEAL_SOURCES = ['manual', 'ai_text', 'ai_vision', 'ai_text_vision']`
- `MealSource` type

## Relations

- `user` → many `meal`, many `userSettings`
- `meal` → one `user`
- `userSettings` → one `user`
