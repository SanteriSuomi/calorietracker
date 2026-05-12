# Stage 16 — Settings & Calendar Improvements

## Summary

Exposed macro goals (protein/carbs/fat) in Settings UI with defaults. Added configurable AI system prompt with assertive default and enforced format suffix. Reordered Settings sections: AI Config → Goals → Language → Account. Enhanced Calendar List: 90-day range, scroll container, calories per day row, date search/filter.

## Implementation

All features were implemented in commit `7fe4846` as part of the step 15 branch and merged to main.

### What was done

| Phase | Description | Status |
|-------|-------------|--------|
| A | Macro goals in Settings UI (protein/carbs/fat inputs with defaults) | Done |
| B | Configurable AI system prompt (textarea, assertive default, enforced suffix) | Done |
| C | Settings reorder (AI Config → Goals → Language → Account) | Done |
| D | Calendar List improvements (90-day range, scroll, calories per row, filter) | Done |
| E | i18n keys for all new UI elements (EN + FI) | Done |
| F | Tests for macro goals, system prompt, AI analyze | Done |

### Key decisions

- Macro goals default to 150g protein, 250g carbs, 65g fat when null in DB
- AI system prompt: custom prompt replaces default entirely; `AI_FORMAT_SUFFIX` always appended
- Vision path uses separate `SYSTEM_PROMPT_VISION` (not configurable) — intentional
- Calendar filter matches both YYYY-MM-DD format and localized display format
- Scroll container capped at 70vh for mobile viewport

## Verification

| Check | Result |
|-------|--------|
| Typecheck (`pnpm check`) | Pass (0 errors, 9 warnings — all `state_referenced_locally`) |
| Lint (`pnpm lint`) | Pre-existing CRLF format issues (not from step 16) |
| Tests (`pnpm test`) | 76/79 pass — 3 PG tests fail due to remote DB missing `ai_system_prompt` column (needs `pnpm db:push:pg`) |
| Settings page — macro goal inputs | Verified by explore agent |
| Settings page — AI system prompt textarea | Verified by explore agent |
| Settings page — section reorder | Verified by explore agent |
| Calendar list — 90-day range | Verified by explore agent |
| Calendar list — scroll container | Verified by explore agent |
| Calendar list — date filter | Verified by explore agent |
| Calendar list — calories per row | Verified by explore agent |
| Day view — MacroSummary with goals | Verified by explore agent |

## Files

- `src/lib/server/db/shared/constants.ts` — Macro default constants, AI prompt constants
- `src/lib/types.ts` — Macro goals + system prompt in `UserSettings`
- `src/lib/server/db/sqlite/schema.ts` — `aiSystemPrompt` column
- `src/lib/server/db/pg/schema.ts` — `aiSystemPrompt` column
- `src/routes/api/settings/+server.ts` — Macro goals + system prompt in GET/PUT
- `src/routes/settings/+page.server.ts` — Return macro goals with defaults, system prompt
- `src/routes/settings/+page.svelte` — Reorder, macro inputs, system prompt textarea
- `src/routes/+page.server.ts` — Return macro goals with defaults
- `src/routes/+page.svelte` — Pass macro goals to MacroSummary
- `src/lib/components/MacroSummary.svelte` — "X/Yg" format when goal set
- `src/routes/api/ai/analyze/+server.ts` — Configurable prompt + suffix
- `src/routes/calendar/+page.server.ts` — 90-day list range
- `src/lib/components/CalendarList.svelte` — Scroll, filter, calories per row
- `src/routes/calendar/+page.svelte` — Pass `dailyCalorieGoal` to CalendarList
- `messages/en.json` — All new i18n keys
- `messages/fi.json` — All new i18n keys
- `tests/api/settings.test.ts` — Macro goal + system prompt tests
- `tests/api/ai-analyze.test.ts` — Custom prompt + format suffix tests
- `docs/plans/STEP16_SETTINGS_CALENDAR.md` — Implementation plan
