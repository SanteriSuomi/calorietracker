# Step 15 — Settings & Calendar Improvements

> Detailed implementation plan for exposing macro goals in Settings, adding a configurable AI system prompt, reordering Settings sections, and enhancing the Calendar List view.

## Summary

Four changes:
1. **Macro goals** — Expose `dailyProteinGoal`, `dailyCarbsGoal`, `dailyFatGoal` in Settings UI (DB columns already exist). Show "eaten/goal" in day view MacroSummary badges.
2. **Configurable AI system prompt** — New `aiSystemPrompt` column in `userSettings`. Assertive default + enforced format suffix that cannot be overridden.
3. **Settings reorder** — AI Config → Goals → Language → Account.
4. **Calendar List** — Extended range (30 → 90 days), scroll container, calories per day row, text-based date filter.

**No new dependencies.** One schema change (`aiSystemPrompt` column).

---

## A. Macro Goals (Settings + Day View)

### Current State

- DB schema: `dailyProteinGoal`, `dailyCarbsGoal`, `dailyFatGoal` exist as nullable integers in both SQLite and PG schemas.
- Types, API, page load, and UI: **completely unused** — not selected, not returned, not displayed.
- No default constants for macros.

### Files to Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| A1 | `src/lib/server/db/shared/constants.ts` | MODIFY | Add `DEFAULT_PROTEIN_GOAL`, `DEFAULT_CARBS_GOAL`, `DEFAULT_FAT_GOAL` |
| A2 | `src/lib/types.ts` | MODIFY | Add macro fields to `UserSettings` |
| A3 | `src/routes/api/settings/+server.ts` | MODIFY | Add to `SettingsBody`, validate, include in GET/PUT |
| A4 | `src/routes/settings/+page.server.ts` | MODIFY | Return macro goals with defaults |
| A5 | `src/routes/settings/+page.svelte` | MODIFY | Add 3 number inputs under calorie goal |
| A6 | `src/routes/+page.server.ts` | MODIFY | Select macro goals from `userSettings` |
| A7 | `src/lib/components/MacroSummary.svelte` | MODIFY | Accept optional goal props, show "X/Yg" format |
| A8 | `src/routes/+page.svelte` | MODIFY | Pass macro goals to MacroSummary |
| A9 | `messages/en.json` | MODIFY | Add macro goal labels |
| A10 | `messages/fi.json` | MODIFY | Add macro goal translations |

### A1. `src/lib/server/db/shared/constants.ts`

Add after `DEFAULT_CALORIE_GOAL`:

```ts
export const DEFAULT_PROTEIN_GOAL = 150;
export const DEFAULT_CARBS_GOAL = 250;
export const DEFAULT_FAT_GOAL = 65;
```

### A2. `src/lib/types.ts`

Add to `UserSettings` interface:

```ts
dailyProteinGoal: number | null;
dailyCarbsGoal: number | null;
dailyFatGoal: number | null;
```

### A3. `src/routes/api/settings/+server.ts`

**`SettingsBody` interface** — add:

```ts
dailyProteinGoal?: unknown;
dailyCarbsGoal?: unknown;
dailyFatGoal?: unknown;
```

**Validation** (after existing macro fields) — each is optional, must be non-negative integer if provided:

```ts
if (body.dailyProteinGoal !== undefined) {
    if (typeof body.dailyProteinGoal !== 'number' || !Number.isInteger(body.dailyProteinGoal) || body.dailyProteinGoal < 0) {
        return json({ error: 'dailyProteinGoal must be a non-negative integer' }, { status: 400 });
    }
}
// same pattern for dailyCarbsGoal, dailyFatGoal
```

**GET handler** — select macro goal columns:

```ts
dailyProteinGoal: userSettings.dailyProteinGoal,
dailyCarbsGoal: userSettings.dailyCarbsGoal,
dailyFatGoal: userSettings.dailyFatGoal,
```

**PUT handler** — include in `.set()` / `.values()`:

```ts
dailyProteinGoal: validatedBody.dailyProteinGoal ?? null,
dailyCarbsGoal: validatedBody.dailyCarbsGoal ?? null,
dailyFatGoal: validatedBody.dailyFatGoal ?? null,
```

### A4. `src/routes/settings/+page.server.ts`

Add to the returned data object:

```ts
dailyProteinGoal: settingsRow?.dailyProteinGoal ?? DEFAULT_PROTEIN_GOAL,
dailyCarbsGoal: settingsRow?.dailyCarbsGoal ?? DEFAULT_CARBS_GOAL,
dailyFatGoal: settingsRow?.dailyFatGoal ?? DEFAULT_FAT_GOAL,
```

### A5. `src/routes/settings/+page.svelte`

Add three `$state` variables (after `dailyCalorieGoal`):

```ts
let proteinGoal = $state(data.dailyProteinGoal);
let carbsGoal = $state(data.dailyCarbsGoal);
let fatGoal = $state(data.dailyFatGoal);
```

Add three number inputs in the Goals section, after the calorie goal input. Same pattern as `dailyCalorieGoal` — `<Input type="number">` with `<Label>`.

Include in save payload and validation (non-negative integers).

### A6. `src/routes/+page.server.ts` (day view)

Add to the `userSettings` select query:

```ts
dailyProteinGoal: userSettings.dailyProteinGoal,
dailyCarbsGoal: userSettings.dailyCarbsGoal,
dailyFatGoal: userSettings.dailyFatGoal,
```

Return in page data with defaults:

```ts
dailyProteinGoal: settingsResult[0]?.dailyProteinGoal ?? DEFAULT_PROTEIN_GOAL,
dailyCarbsGoal: settingsResult[0]?.dailyCarbsGoal ?? DEFAULT_CARBS_GOAL,
dailyFatGoal: settingsResult[0]?.dailyFatGoal ?? DEFAULT_FAT_GOAL,
```

### A7. `src/lib/components/MacroSummary.svelte`

Update props:

```ts
let {
    protein,
    carbs,
    fat,
    proteinGoal = null,
    carbsGoal = null,
    fatGoal = null
}: {
    protein: number;
    carbs: number;
    fat: number;
    proteinGoal?: number | null;
    carbsGoal?: number | null;
    fatGoal?: number | null;
} = $props();
```

Badge rendering — show "X/Yg" when goal is set, "Xg" when not:

```svelte
<Badge variant="secondary">
    {#if proteinGoal}
        {m.meal_protein_badge({ count: protein })}/{proteinGoal}g
    {:else}
        {m.meal_protein_badge({ count: protein })}
    {/if}
</Badge>
```

### A8. `src/routes/+page.svelte` (day view)

Pass macro goals to MacroSummary:

```svelte
<MacroSummary
    protein={totals.protein}
    carbs={totals.carbs}
    fat={totals.fat}
    proteinGoal={data.dailyProteinGoal}
    carbsGoal={data.dailyCarbsGoal}
    fatGoal={data.dailyFatGoal}
/>
```

### A9–A10. i18n Keys

Add to both `messages/en.json` and `messages/fi.json`:

| Key | EN | FI |
|-----|----|----|
| `settings_daily_protein_goal` | Daily Protein Goal (g) | Päivittäinen proteiinitavoite (g) |
| `settings_daily_carbs_goal` | Daily Carbs Goal (g) | Päivittäinen hiilihydraattitavoite (g) |
| `settings_daily_fat_goal` | Daily Fat Goal (g) | Päivittäinen rasvatavoite (g) |
| `settings_protein_placeholder` | 150 | 150 |
| `settings_carbs_placeholder` | 250 | 250 |
| `settings_fat_placeholder` | 65 | 65 |

---

## B. Configurable AI System Prompt

### Schema Change

Add `aiSystemPrompt text` (nullable) to `userSettings` in both schemas:

| # | File | Action |
|---|------|--------|
| B1 | `src/lib/server/db/sqlite/schema.ts` | Add `aiSystemPrompt: text('ai_system_prompt')` |
| B2 | `src/lib/server/db/pg/schema.ts` | Add `aiSystemPrompt: text('ai_system_prompt')` |

Run `pnpm db:push` and `pnpm db:push:pg` after schema change.

### Files to Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| B3 | `src/lib/server/db/shared/constants.ts` | MODIFY | Extract default prompt + format suffix |
| B4 | `src/lib/types.ts` | MODIFY | Add `aiSystemPrompt` to `UserSettings` |
| B5 | `src/routes/api/settings/+server.ts` | MODIFY | Read/write `aiSystemPrompt` |
| B6 | `src/routes/settings/+page.server.ts` | MODIFY | Return custom prompt |
| B7 | `src/routes/settings/+page.svelte` | MODIFY | Add textarea for system prompt |
| B8 | `src/routes/api/ai/analyze/+server.ts` | MODIFY | Use configurable prompt + suffix |
| B9 | `messages/en.json` | MODIFY | Add prompt label/description keys |
| B10 | `messages/fi.json` | MODIFY | Add prompt translations |

### B3. `src/lib/server/db/shared/constants.ts`

Extract the current hardcoded prompt into an assertive default, and define an enforced suffix:

```ts
export const DEFAULT_AI_SYSTEM_PROMPT =
    'You are an expert nutrition estimation assistant. Given a food description and/or image, ' +
    'provide your best estimate of the nutritional content for a typical serving. Be specific ' +
    'and confident in your estimates. If the input is ambiguous, estimate for a standard portion.';

export const AI_FORMAT_SUFFIX =
    '\n\nYou MUST respond with ONLY a valid JSON object (no markdown, no explanation) with ' +
    'exactly these fields: { "description": string, "calories": number, "protein": number, ' +
    '"carbs": number, "fat": number }. All numeric values must be non-negative integers. ' +
    '"description" must be a concise cleaned-up food name.';
```

### B4. `src/lib/types.ts`

Add to `UserSettings`:

```ts
aiSystemPrompt: string | null;
```

### B5. `src/routes/api/settings/+server.ts`

Add to `SettingsBody`, validate (optional string, max length e.g. 2000 chars), include in GET response and PUT upsert.

### B6. `src/routes/settings/+page.server.ts`

Return:

```ts
aiSystemPrompt: settingsRow?.aiSystemPrompt ?? '',
```

### B7. `src/routes/settings/+page.svelte`

Add a `<Textarea>` in the AI Config section (after the model input). Show the default prompt as placeholder text. Add a helper text below: "Leave empty to use the default prompt. A format instruction is always appended automatically."

### B8. `src/routes/api/ai/analyze/+server.ts`

Replace the hardcoded `SYSTEM_PROMPT` with:

```ts
import { DEFAULT_AI_SYSTEM_PROMPT, AI_FORMAT_SUFFIX } from '$lib/server/db/shared/constants';

const systemPrompt = (settingsRow?.aiSystemPrompt || DEFAULT_AI_SYSTEM_PROMPT) + AI_FORMAT_SUFFIX;
```

### B9–B10. i18n Keys

| Key | EN | FI |
|-----|----|----|
| `settings_ai_system_prompt` | System Prompt | Järjestelmäkehote |
| `settings_ai_system_prompt_desc` | Customize the AI's behavior. Leave empty for the default. Format instructions are always appended. | Mukauta tekoälyn toimintaa. Jätä tyhjäksi oletuksen käyttämiseksi. Muotoiluohjeet liitetään aina automaattisesti. |

---

## C. Settings Section Reorder

**Single file:** `src/routes/settings/+page.svelte`

Move the Goals section (A5 inputs + calorie goal) below the AI Config section. New order:

1. **AI Configuration** — endpoint URL, API key, model, system prompt
2. **Goals** — daily calorie goal, protein, carbs, fat
3. **Language** — locale switcher
4. **Account** — email, sign out

Each section separated by a horizontal rule, each with its own `<Label>` heading.

---

## D. Calendar List Improvements

### Current State

- List range: fixed 30 days ending today.
- Scroll: none — relies on page scrolling.
- Per-row display: date + macros on the left. No calories shown.
- Filtering: none.

### Files to Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| D1 | `src/routes/calendar/+page.server.ts` | MODIFY | Extend list range to 90 days |
| D2 | `src/lib/components/CalendarList.svelte` | MODIFY | Scroll container, calories per row, date filter |
| D3 | `src/routes/calendar/+page.svelte` | MODIFY | Pass `dailyCalorieGoal` to CalendarList |
| D4 | `messages/en.json` | MODIFY | Add calendar filter keys |
| D5 | `messages/fi.json` | MODIFY | Add calendar filter translations |

### D1. `src/routes/calendar/+page.server.ts`

Change the list range from 30 days to 90 days:

```ts
// Before: today - 29 days
const listStart = addDays(today(), -29);

// After: today - 89 days
const listStart = addDays(today(), -89);
```

### D2. `src/lib/components/CalendarList.svelte`

**Props update:**

```ts
let {
    days,
    dailyCalorieGoal = 2000
}: {
    days: DaySummary[];
    dailyCalorieGoal?: number;
} = $props();
```

**Date filter state:**

```ts
let filterText = $state('');
```

**Filtering logic:**

```ts
let filteredDays = $derived(
    filterText.trim()
        ? days.filter(d => d.date.includes(filterText.trim()) || formatDate(d.date).toLowerCase().includes(filterText.trim().toLowerCase()))
        : days
);
```

**Render the filter input** at the top of the list:

```svelte
<Input
    type="text"
    placeholder={m.calendar_filter_placeholder()}
    bind:value={filterText}
    class="mb-3"
/>
```

**Scroll container** — wrap the day list:

```svelte
<div class="max-h-[70vh] overflow-y-auto divide-y divide-border rounded-lg border">
    {#each filteredDays as day (day.date)}
        ...
    {/each}
</div>
```

**Per-row display** — add calories on the right:

```svelte
<button class="flex w-full items-center justify-between px-4 py-3 ...">
    <div class="text-left">
        <div class="font-medium">{formatDate(day.date)}</div>
        <div class="text-sm text-muted-foreground">
            {m.calendar_macro_summary({ protein: day.protein, carbs: day.carbs, fat: day.fat })}
        </div>
    </div>
    <div class="text-right">
        <div class="font-semibold">{day.calories}</div>
        <div class="text-xs text-muted-foreground">/ {dailyCalorieGoal}</div>
    </div>
</button>
```

### D3. `src/routes/calendar/+page.svelte`

Pass `dailyCalorieGoal` to CalendarList (it's already fetched in the server load):

```svelte
<CalendarList days={data.listData} dailyCalorieGoal={data.dailyCalorieGoal} />
```

### D4–D5. i18n Keys

| Key | EN | FI |
|-----|----|----|
| `calendar_filter_placeholder` | Filter by date... | Suodata päivämäärällä... |
| `calendar_kcal` | {count} kcal | {count} kcal |

---

## E. Tests

### Files to Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| E1 | `tests/api/settings.test.ts` | MODIFY | Add macro goal round-trip, system prompt round-trip |
| E2 | `tests/api/ai-analyze.test.ts` | MODIFY | Test custom prompt used, format suffix appended |

### E1. `tests/api/settings.test.ts`

Add test cases:
- PUT with macro goals → GET returns them
- PUT with null macro goals → GET returns null
- PUT with negative macro goal → 400
- PUT with custom system prompt → GET returns it
- PUT clearing system prompt → GET returns null
- PUT with system prompt exceeding max length → 400

### E2. `tests/api/ai-analyze.test.ts`

Add test cases:
- When user has custom system prompt → it's used (mock DB to return custom prompt, verify `generateText` receives it)
- Format suffix is always appended (verify final prompt ends with `AI_FORMAT_SUFFIX`)
- When user has no custom prompt → default is used

---

## Implementation Order

### Phase 1: Schema + Constants

1. Add macro default constants to `shared/constants.ts` (A1)
2. Extract AI prompt constants to `shared/constants.ts` (B3)
3. Add `aiSystemPrompt` column to both schema files (B1, B2)
4. Run `pnpm db:push` to update SQLite DB

### Phase 2: Types

5. Add all new fields to `UserSettings` in `types.ts` (A2, B4)

### Phase 3: Settings API

6. Update `SettingsBody`, GET, PUT in settings API route (A3, B5)

### Phase 4: Settings Page

7. Update settings page server load (A4, B6)
8. Update settings page component — reorder + all new inputs (A5, B7, C)

### Phase 5: Day View

9. Update day view server load to select macro goals (A6)
10. Update MacroSummary to show eaten/goal (A7)
11. Update day view page to pass macro goals (A8)

### Phase 6: AI Endpoint

12. Update AI analyze endpoint to use configurable prompt (B8)

### Phase 7: Calendar

13. Extend list range to 90 days (D1)
14. Update CalendarList — scroll, calories, filter (D2)
15. Update calendar page to pass `dailyCalorieGoal` (D3)

### Phase 8: i18n

16. Add all new keys to `messages/en.json` (A9, B9, D4)
17. Add all new keys to `messages/fi.json` (A10, B10, D5)
18. Regenerate paraglide messages

### Phase 9: Tests + Verification

19. Update settings tests (E1)
20. Update AI analyze tests (E2)
21. `pnpm check` — typecheck
22. `pnpm lint` — lint
23. `pnpm test` — tests
24. Browser verification — Settings page (reorder, macro inputs, system prompt), Day view (macro goals in badges), Calendar list (90 days, scroll, calories, filter)
25. Update `docs/PLAN.md` — check off step 15

---

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| `aiSystemPrompt` column migration needed for existing DBs | Column is nullable with no default — `db:push` adds it cleanly. No data loss. |
| Custom prompt breaks AI JSON output | `AI_FORMAT_SUFFIX` is always appended and cannot be overridden. If the user's prompt is incompatible, the suffix enforces the required format. |
| Macro goals of `null` vs. default in day view | MacroSummary accepts `null` goals and falls back to showing absolute values only (no "/Yg"). |
| 90-day calendar list query performance | Single `GROUP BY date` query over 90 days is trivial for SQLite/PG at personal scale. |
| Calendar filter UX — typing dates in different formats | Filter matches both `YYYY-MM-DD` format and localized display format. Broad matching is intentional. |
| Settings reorder confuses existing users | All sections are clearly labeled. No functionality is removed or hidden. |

---

## Success Criteria

- [ ] Settings page shows macro goal inputs (protein, carbs, fat) with defaults
- [ ] Settings page order: AI Config → Goals → Language → Account
- [ ] Settings page shows AI system prompt textarea with default as placeholder
- [ ] Saving macro goals persists to DB and round-trips via API
- [ ] Saving custom system prompt persists to DB and round-trips via API
- [ ] Day view MacroSummary shows "X/Yg" when goals are set, "Xg" when null
- [ ] AI analyze endpoint uses custom prompt when set, default when not
- [ ] AI format suffix is always appended regardless of custom prompt
- [ ] Calendar list shows 90 days of data
- [ ] Calendar list has scroll container (70vh max height)
- [ ] Calendar list shows calories per day row (right-aligned)
- [ ] Calendar list text filter narrows visible days
- [ ] All new i18n keys present in EN and FI
- [ ] `pnpm check` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes (including new test cases)
- [ ] Browser-verified: Settings, Day view, Calendar
- [ ] `docs/PLAN.md` updated with step 15 checked off
