# Step 7 — AI Integration: Settings, Vercel AI SDK, Analyze Endpoint, InputBar

> Detailed implementation plan for AI-powered food logging via text description.

## Summary

Add AI-powered food logging via text description. Includes: Settings page for AI configuration, Settings API (GET/PUT), AI analyze endpoint using `generateObject()` with zod schema, an `InputBar` component (replaces FAB), and integration into the day view. Also updates `ManualEntrySheet` to use shadcn-svelte `Input`/`Label` components.

**New dependency:** `zod`

**Deferred to Step 8:** Image upload, encryption/decryption, `imageFilename`. The InputBar camera button is a disabled placeholder. Note: the local llama.cpp server already supports vision — once Step 8 adds image upload, vision (`ai_vision`, `ai_text_vision`) will work immediately.

**Step 7/8 async boundary:** Step 7 and Step 8 can be developed in parallel. Step 7 is text-only AI. The two shared files are `InputBar.svelte` (camera placeholder → Step 8 wires it) and `/api/ai/analyze` (text-only → Step 8 adds image). No file-level conflicts otherwise.

### Local AI Testing Setup

A local llama.cpp server is available for testing:

```
URL:     http://192.168.1.233:8525/v1
Model:   Qwen3.6-35B-A3B Q8_0
API Key: sk-dummy
Support: text + image input
```

Settings page test values:
- Endpoint URL: `http://192.168.1.233:8525/v1`
- API Key: `sk-dummy`
- Model: (the model identifier exposed by the server)

`@ai-sdk/openai` (already installed) supports OpenAI-compatible endpoints via `createOpenAI({ baseURL })`. No need for `@ai-sdk/openai-compatible`. The `compatibility` option must be omitted or set to `'compatible'` — `'strict'` may break non-OpenAI responses.

---

## Design Decisions

| Decision | Choice |
|----------|--------|
| AI result flow | Pre-fill `ManualEntrySheet` for user review before saving |
| FAB replacement | Replaced by `InputBar` sticky bottom bar with all actions |
| Form components | Use shadcn-svelte `Input`/`Label` everywhere, update `ManualEntrySheet` |
| AI structured output | `generateObject()` with zod schema |
| Camera button | Disabled placeholder with tooltip, Step 8 wires it |
| Settings row creation | Upsert (`onConflictDoUpdate`) on first save |
| AI not configured | Analyze endpoint returns 400; InputBar shows error linking to `/settings` |

---

## Files to Create/Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `package.json` | **MODIFY** | Add `zod` dependency |
| 2 | shadcn components | **INSTALL** | `input`, `label`, `separator` |
| 3 | `src/lib/types.ts` | **MODIFY** | Add `AiAnalysisResult`, `UserSettings` interfaces |
| 4 | `src/routes/api/settings/+server.ts` | **CREATE** | GET + PUT for user settings |
| 5 | `src/routes/api/ai/analyze/+server.ts` | **CREATE** | POST AI text analysis endpoint |
| 6 | `src/routes/settings/+page.server.ts` | **CREATE** | Load user settings for settings page |
| 7 | `src/routes/settings/+page.svelte` | **CREATE** | Settings page UI |
| 8 | `src/lib/components/InputBar.svelte` | **CREATE** | Sticky bottom bar with text input + AI/manual/camera buttons |
| 9 | `src/lib/components/ManualEntrySheet.svelte` | **MODIFY** | Add `prefill` prop, use shadcn Input/Label |
| 10 | `src/routes/+page.svelte` | **MODIFY** | Replace FAB with InputBar, wire AI flow |
| 11 | `src/routes/+page.server.ts` | **MODIFY** | Add `aiConfigured` boolean to load data |
| 12 | `src/routes/+layout.svelte` | **MODIFY** | Add Settings link (gear icon) in header |
| 13 | `tests/api/settings.test.ts` | **CREATE** | Settings API tests |
| 14 | `tests/api/ai-analyze.test.ts` | **CREATE** | AI analyze endpoint tests |
| 15 | `docs/PLAN.md` | **MODIFY** | Mark step 7 done |
| 16 | `docs/stages/STAGE7_IMPLEMENTATION.md` | **CREATE** | Stage log |

---

## Implementation Order

### Phase 1: Foundation (no UI changes)

1. `pnpm add zod`
2. Install shadcn components: `input`, `label`, `separator`
3. Update `src/lib/types.ts` — add `AiAnalysisResult`, `UserSettings`
4. Create `src/routes/api/settings/+server.ts` — GET + PUT
5. Create `src/routes/api/ai/analyze/+server.ts` — POST (text-only)

### Phase 2: Settings page

6. Create `src/routes/settings/+page.server.ts`
7. Create `src/routes/settings/+page.svelte`
8. Modify `src/routes/+layout.svelte` — add Settings gear icon in header

### Phase 3: InputBar + day view integration

9. Modify `src/lib/components/ManualEntrySheet.svelte` — add `prefill` prop, switch to shadcn Input/Label
10. Create `src/lib/components/InputBar.svelte`
11. Modify `src/routes/+page.server.ts` — add `aiConfigured`
12. Modify `src/routes/+page.svelte` — replace FAB with InputBar, wire AI flow

### Phase 4: Verification

13. `pnpm check` → `pnpm lint` → `pnpm test` (fail fast)
14. Browser automation verification
15. Update `docs/PLAN.md`, write `docs/stages/STAGE7_IMPLEMENTATION.md`

---

## File Specifications

### 1. `package.json` (MODIFY)

Add `zod` to dependencies:

```json
"zod": "^3.24.0"
```

### 2. shadcn components (INSTALL)

```bash
pnpm dlx shadcn-svelte@latest add input label separator
```

### 3. `src/lib/types.ts` (MODIFY)

Add types for AI analysis results and user settings:

```typescript
export interface AiAnalysisResult {
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface UserSettings {
  dailyCalorieGoal: number;
  aiEndpointUrl: string | null;
  aiApiKey: string | null;
  aiModel: string | null;
}
```

### 4. `src/routes/api/settings/+server.ts` (NEW)

GET + PUT handler for user settings.

```
Imports:
  json from '@sveltejs/kit'
  type RequestHandler from './$types'
  db, userSettings from '$lib/server/db'
  eq from 'drizzle-orm'
  addLogContext from '$lib/server/logger'
  DEFAULT_CALORIE_GOAL from '$lib/server/db/shared/constants'

GET /api/settings:
  1. Auth check (locals.user)
  2. Query userSettings by userId
  3. If no row → return defaults { dailyCalorieGoal: 2000, aiEndpointUrl: null, aiApiKey: null, aiModel: null }
  4. Return settings (NEVER return full API key — mask it: "sk-...abc4")
  5. addLogContext(locals, { settingsLoaded: true })

PUT /api/settings:
  1. Auth check
  2. Parse JSON body
  3. Validate fields:
     - dailyCalorieGoal: non-negative integer
     - aiEndpointUrl: optional string, valid URL if provided
     - aiApiKey: optional string
     - aiModel: optional string
  4. If existing row → update
     No row → insert (upsert via onConflictDoUpdate on userId)
  5. Set audit fields (createdBy/updatedBy = user.id)
  6. Return updated settings (with masked API key)
  7. addLogContext(locals, { settingsUpdated: true })

API key masking:
  - GET: return "sk-****" if key exists, null if not
  - PUT: if body.aiApiKey === "sk-****" (the masked value), don't overwrite
    Only update the key if a new value is provided
```

**Note on API key security:** The API key is stored as plaintext in the database (user-provided, per-user). The GET endpoint masks it. The PUT endpoint ignores the masked value to prevent accidental overwrite. This is acceptable for a self-hosted / single-user app. For Azure deployment, keys would be stored in Key Vault (future step).

### 5. `src/routes/api/ai/analyze/+server.ts` (NEW)

POST handler for AI text analysis.

```
Imports:
  json from '@sveltejs/kit'
  type RequestHandler from './$types'
  db, userSettings from '$lib/server/db'
  eq from 'drizzle-orm'
  addLogContext from '$lib/server/logger'
  createOpenAI from '@ai-sdk/openai'
  generateObject from 'ai'
  z from 'zod'

Zod schema:
  const nutritionSchema = z.object({
    description: z.string(),
    calories: z.number().int().nonnegative(),
    protein: z.number().int().nonnegative(),
    carbs: z.number().int().nonnegative(),
    fat: z.number().int().nonnegative(),
  })

POST /api/ai/analyze:
  1. Auth check
  2. Parse JSON body: { description: string }
  3. Validate: description is non-empty string
  4. Load AI settings from userSettings (aiEndpointUrl, aiApiKey, aiModel)
  5. If any AI setting missing → 400 { error: "AI not configured. Go to Settings to configure." }
  6. Create provider:
     const provider = createOpenAI({
       baseURL: settings.aiEndpointUrl,
       apiKey: settings.aiApiKey,
       // Do NOT use compatibility: 'strict' — breaks non-OpenAI endpoints (llama.cpp, etc.)
     })
  7. Call generateObject:
     const { object } = await generateObject({
       model: provider(settings.aiModel),
       schema: nutritionSchema,
       system: SYSTEM_PROMPT,
       prompt: description,
     })
  8. Return object as JSON
  9. addLogContext(locals, { aiSource: 'ai_text', aiModel: settings.aiModel })

System prompt (constant at top of file):
  "You are a nutrition estimation assistant. Given a food description, estimate the nutritional content for a typical serving. Return a JSON object with: description (cleaned-up food name), calories (kcal), protein (grams), carbs (grams), fat (grams). All numeric values must be non-negative integers. If the input is ambiguous, estimate for a standard portion."

Error handling:
  - Invalid JSON body → 400
  - Missing description → 400
  - AI not configured → 400
  - AI SDK error (invalid API key, model not found, rate limit) → 502 { error: "AI service error" }
  - Schema validation fails → 502 { error: "AI returned invalid response" }
  - Log all errors with addLogContext
```

**Extension point for Step 8:** This endpoint will later accept an optional `imageFile` in a `FormData` body. The handler will need to detect `multipart/form-data` vs `application/json` and process the image accordingly. For now, only `application/json` with `{ description }` is supported.

### 6. `src/routes/settings/+page.server.ts` (NEW)

```
Imports:
  db, userSettings from '$lib/server/db'
  eq from 'drizzle-orm'
  DEFAULT_CALORIE_GOAL from '$lib/server/db/shared/constants'
  type PageServerLoad

Load function:
  1. locals.user check — if no user, redirect to /auth (but middleware handles this)
  2. Query userSettings by userId
  3. Return {
       dailyCalorieGoal: row?.dailyCalorieGoal ?? DEFAULT_CALORIE_GOAL,
       aiEndpointUrl: row?.aiEndpointUrl ?? '',
       aiApiKey: row?.aiApiKey ? 'sk-****' : '',
       aiModel: row?.aiModel ?? ''
     }
```

### 7. `src/routes/settings/+page.svelte` (NEW)

Settings page with form sections.

```
Imports:
  Button from '$lib/components/ui/button'
  Input from '$lib/components/ui/input'
  Label from '$lib/components/ui/label'
  Separator from '$lib/components/ui/separator'
  invalidateAll from '$app/navigation'
  goto from '$app/navigation'
  authClient from '$lib/auth-client'

Layout:
  - Back button/link to / (← arrow + "Settings" title)
  - Section: "Goals"
    - Daily Calorie Goal (number input)
  - Separator
  - Section: "AI Configuration"
    - Endpoint URL (text input, placeholder: "https://api.openai.com/v1")
    - API Key (password input, placeholder: "sk-...")
    - Model (text input, placeholder: "gpt-4o")
  - Save button
  - Separator
  - Section: "Account"
    - Email display (from layout data)
    - Sign out button

State:
  dailyCalorieGoal: string
  aiEndpointUrl: string
  aiApiKey: string
  aiModel: string
  saving: boolean
  errors: Record<string, string>
  success: boolean

Behavior:
  - On mount: populate from data (server load)
  - Save: PUT /api/settings with form data
  - On success: show "Saved" feedback, invalidateAll()
  - On error: show error message
  - API key: if value is still "sk-****", don't send it (server ignores masked value)
  - Sign out: authClient.signOut() → redirect to /

Validation:
  - dailyCalorieGoal: required, non-negative integer
  - aiEndpointUrl: if provided, must be valid URL (starts with http:// or https://)
  - aiApiKey: optional string
  - aiModel: optional string
```

### 8. `src/lib/components/InputBar.svelte` (NEW)

Sticky bottom bar replacing the FAB.

```
Imports:
  Button from '$lib/components/ui/button'
  Input from '$lib/components/ui/input'
  Camera, Pencil, Sparkles, Loader2 from '@lucide/svelte'

Props:
  date: string
  aiConfigured: boolean
  onAiResult: (data: MealFormData) => void
  onManualEntry: () => void

State:
  description: string = ''
  loading: boolean = false
  error: string = ''

Layout:
  ┌──────────────────────────────────────┐
  │ [text input: "Describe your meal..."] │
  ├──────────────────────────────────────┤
  │ 📷 (disabled)  [AI ✨]  [Manual ✏️]  │
  └──────────────────────────────────────┘
  Fixed bottom, full width within max-w-2xl container, z-40

  - Camera button: disabled, title="Coming soon"
  - AI button (Sparkles icon): calls POST /api/ai/analyze
  - Manual button (Pencil icon): calls onManualEntry()

Behavior:
  1. User types description, clicks AI button
  2. Validate: description not empty
  3. If !aiConfigured → show "Configure AI in Settings" error
  4. Loading state (Spinner in button, disabled inputs)
  5. Call POST /api/ai/analyze with { description }
  6. On success: call onAiResult({ ...result, date }), clear input
  7. On error: show error string below input
  8. Manual button: calls onManualEntry() — parent opens ManualEntrySheet

Error display:
  - Below the text input, small destructive text
  - Auto-clears after 5 seconds or on new submission
```

### 9. `src/lib/components/ManualEntrySheet.svelte` (MODIFY)

Two changes: add `prefill` prop, update to use shadcn Input/Label.

```
New prop:
  prefill?: MealFormData | null
  When provided (and meal is null), initializes form fields from prefill
  instead of empty strings

Updated imports:
  Add: Input from '$lib/components/ui/input'
       Label from '$lib/components/ui/label'

$effect change:
  if (open) {
    if (meal) {
      // existing: populate from meal
    } else if (prefill) {
      // populate from prefill (AI result)
    } else {
      // existing: empty defaults
    }
  }

Template change:
  Replace all <label>/<span>/<input> patterns with:
  <Label for="field">Label Text</Label>
  <Input id="field" type="..." bind:value={...} placeholder="..." />

  Error messages remain as <span class="text-xs text-destructive">

Title logic:
  meal ? 'Edit Meal' : prefill ? 'Add Meal (AI)' : 'Add Meal'
```

### 10. `src/routes/+page.svelte` (MODIFY)

Replace FAB with InputBar, wire AI flow.

```
Remove:
  - Plus import from @lucide/svelte
  - FAB <button> element
  - openAddSheet function

Add imports:
  InputBar from '$lib/components/InputBar.svelte'

New state:
  aiPrefill: MealFormData | null = null

New functions:
  handleAiResult(data: MealFormData):
    - Set aiPrefill = data
    - Set editingMeal = null
    - Set sheetOpen = true (opens ManualEntrySheet with prefill)

  openManualEntry():
    - Set aiPrefill = null
    - Set editingMeal = null
    - Set sheetOpen = true

Updated ManualEntrySheet props:
  <ManualEntrySheet
    bind:open={sheetOpen}
    meal={editingMeal}
    prefill={aiPrefill}
    date={data.date}
    onSubmit={editingMeal ? handleEditMeal : handleAddMeal}
    onClose={handleClose}
  />

  Add $effect to clear aiPrefill when sheet closes

Template additions:
  <InputBar
    date={data.date}
    aiConfigured={data.aiConfigured}
    onAiResult={handleAiResult}
    onManualEntry={openManualEntry}
  />
```

### 11. `src/routes/+page.server.ts` (MODIFY)

Add `aiConfigured` to load data.

```
Change:
  In the settings query, also select aiEndpointUrl, aiApiKey, aiModel

  Return additional field:
    aiConfigured: !!(settingsResult[0]?.aiEndpointUrl
                  && settingsResult[0]?.aiApiKey
                  && settingsResult[0]?.aiModel)
```

### 12. `src/routes/+layout.svelte` (MODIFY)

Add Settings link in header.

```
Add imports:
  Settings from '@lucide/svelte'

Change header right section:
  <div class="flex items-center gap-3">
    <a href="/settings" class="p-2 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors" aria-label="Settings">
      <Settings size={18} />
    </a>
    <span class="text-sm text-muted-foreground">{data.user.email}</span>
    <button ...>Sign out</button>
  </div>
```

### 13. `tests/api/settings.test.ts` (NEW)

```
Test cases:

GET /api/settings:
  - Returns settings for authenticated user
  - Returns defaults when no settings row exists
  - Returns 401 for unauthenticated user
  - Masks API key in response

PUT /api/settings:
  - Creates settings row (first save, no existing row)
  - Updates existing settings row
  - Validates dailyCalorieGoal (non-negative integer)
  - Validates aiEndpointUrl (valid URL if provided)
  - Ignores masked API key value (doesn't overwrite)
  - Updates actual API key when new value provided
  - Returns 401 for unauthenticated user
  - Returns masked API key in response
```

### 14. `tests/api/ai-analyze.test.ts` (NEW)

```
Test cases:

POST /api/ai/analyze:
  - Returns nutrition data for valid description
  - Returns 400 for missing description
  - Returns 400 for empty description
  - Returns 400 when AI not configured
  - Returns 502 when AI service fails (mocked)
  - Returns 401 for unauthenticated user
  - Logs aiSource and aiModel in context

Note: AI SDK calls must be mocked. Mock generateObject to return
      predictable nutrition data. Test validation and error paths.
```

---

## Step 7 / Step 8 Async Boundary

### Files Step 7 creates that Step 8 will later extend:

| File | Step 7 | Step 8 |
|------|--------|--------|
| `src/routes/api/ai/analyze/+server.ts` | Text-only analysis, JSON body | Add FormData parsing, image processing, vision source |
| `src/lib/components/InputBar.svelte` | Camera button disabled | Wire camera button to file picker + upload |

### Files with no overlap:

- Step 7 only: settings route, settings API, InputBar, types, ManualEntrySheet changes
- Step 8 only: encryption utils, `/api/images/[filename]`, `data/` directory

### Merge strategy:

Step 7 should merge first. Step 8 branches from Step 7's result and extends the two shared files. If developed truly in parallel on separate branches, Step 8's merge will have clear, predictable conflicts in exactly those two files.

---

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Vercel AI SDK v6 API differs from docs | Use `context7-api` skill during implementation to check current API |
| `generateObject` may not work with non-OpenAI endpoints | Fallback: `generateText` with manual JSON parsing. Test with local llama.cpp first. |
| API key stored plaintext in DB | Acceptable for self-hosted; Azure uses Key Vault (future). Mask in API responses. |
| Upsert syntax differs between libsql and pg | Drizzle's `onConflictDoUpdate` works with both adapters |
| User enters invalid AI endpoint | Validate URL format on server + client |
| AI returns unrealistic values | zod schema validates non-negative integers; user reviews in ManualEntrySheet before saving |
| `prefill` prop conflicts with `meal` prop in ManualEntrySheet | Explicit priority: `meal` > `prefill` > empty |
| Qwen model may not follow structured output reliably | If `generateObject` fails, fallback to `generateText` + manual JSON parse. Local testing catches this early. |

---

## Verification

### Phase 1 (API only — steps 1-5)

1. `pnpm check` — no type errors
2. `pnpm lint` — no lint errors
3. `pnpm test` — all pass
4. Start dev server, use browser dev tools to:
   - `PUT /api/settings` with AI config (endpoint, key, model)
   - `GET /api/settings` — verify masked key
   - `POST /api/ai/analyze` with `{ description: "chicken breast 200g with rice" }`
   - Verify nutrition data returned

### Phase 2 (Settings page — steps 6-8)

1. `pnpm check` → `pnpm lint` → `pnpm test`
2. Browser automation:
   - Navigate to `/settings`
   - Verify form shows current values
   - Update daily calorie goal, save
   - Verify success feedback, redirect works
   - Configure AI settings (endpoint, key, model), save
   - Sign out from settings

### Phase 3 (Full integration — steps 9-12)

1. `pnpm check` → `pnpm lint` → `pnpm test`
2. Browser automation:
   - Navigate to `/` (day view)
   - Verify InputBar visible at bottom (no FAB)
   - Verify Settings gear icon in header
   - Type "grilled chicken breast with brown rice" in InputBar
   - Click AI submit → verify loading state
   - Verify ManualEntrySheet opens with AI-pre-filled values
   - Edit if needed → submit → verify meal created with source "ai_text"
   - Verify doughnut and macros update
   - Click Manual button → verify empty ManualEntrySheet opens
   - Test error: submit AI without configuring settings → verify error message
   - Test InputBar camera button → verify disabled

---

## Success Criteria

- [ ] `zod` added as dependency
- [ ] shadcn-svelte `input`, `label`, `separator` installed
- [ ] `GET /api/settings` returns settings with masked API key
- [ ] `PUT /api/settings` creates or updates settings (upsert)
- [ ] `POST /api/ai/analyze` returns structured nutrition data
- [ ] Settings page at `/settings` with goals + AI config + account sections
- [ ] Settings gear icon in layout header
- [ ] `InputBar` replaces FAB, sticky at bottom of day view
- [ ] AI analysis result pre-fills `ManualEntrySheet` for review
- [ ] `ManualEntrySheet` uses shadcn Input/Label, supports `prefill` prop
- [ ] Camera button in InputBar is disabled placeholder
- [ ] All validation on client + server
- [ ] `aiConfigured` flag passed from server load to page
- [ ] `pnpm check` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes
- [ ] Browser automation verification passes
- [ ] PLAN.md updated, STAGE7_IMPLEMENTATION.md written
