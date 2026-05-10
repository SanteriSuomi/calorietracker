# Step 6 — Manual Meal CRUD: ManualEntrySheet, API Routes, Day View Integration

> Detailed implementation plan for manual meal add/edit/delete.

## Summary

Add the ability to manually create, edit, and delete meals on the day view. Includes API routes for CRUD operations, a bottom sheet form component (ManualEntrySheet), and integration into the existing day view with edit/delete actions on MealCard.

**New dependencies:** None — `@lucide/svelte` already installed, `bits-ui` (Sheet primitive) already installed.

---

## Design

### UI: ManualEntrySheet

Bottom sheet (slides up from bottom) with form fields:
- **Description** (text input, required)
- **Calories** (number input, required)
- **Protein** (number input, optional, default 0)
- **Carbs** (number input, optional, default 0)
- **Fat** (number input, optional, default 0)
- **Date** (text input, optional, defaults to today)
- **Submit** button

When editing, fields are pre-populated with existing meal data.

### API Routes

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/meals` | POST | Create meal |
| `/api/meals/[id]` | PUT | Update meal |
| `/api/meals/[id]` | DELETE | Delete meal |

All routes require auth (enforced by middleware). All routes write `createdBy`, `updatedBy` from session.

### Day View Integration

- **Add button**: Floating action button (FAB) at bottom-right of day view, opens ManualEntrySheet
- **Edit/Delete**: MealCard shows edit/delete actions on tap
- **Delete**: Confirmation prompt before deleting
- **After save**: Re-fetch meals via `invalidate()`

---

## Files to Create/Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `src/lib/types.ts` | **MODIFY** | Add `MealFormData` interface |
| 2 | `src/routes/api/meals/+server.ts` | **CREATE** | POST handler |
| 3 | `src/routes/api/meals/[id]/+server.ts` | **CREATE** | PUT + DELETE handlers |
| 4 | `src/lib/components/ManualEntrySheet.svelte` | **CREATE** | Form component |
| 5 | `src/lib/components/MealCard.svelte` | **MODIFY** | Add id, onEdit, onDelete props |
| 6 | `src/lib/components/MealList.svelte` | **MODIFY** | Pass through handlers |
| 7 | `src/routes/+page.svelte` | **MODIFY** | Add FAB, wire up sheet |
| 8 | `tests/api/meals.test.ts` | **CREATE** | API route tests |
| 9 | `docs/PLAN.md` | **MODIFY** | Mark step 5 done, mark step 6 done |
| 10 | `docs/stages/STAGE6_IMPLEMENTATION.md` | **CREATE** | Stage log |

---

## Implementation Order

1. Add `MealFormData` type to `src/lib/types.ts`
2. Create `src/routes/api/meals/+server.ts` — POST handler
3. Create `src/routes/api/meals/[id]/+server.ts` — PUT + DELETE handlers
4. Install shadcn-svelte `sheet` component (`pnpm dlx shadcn-svelte@latest add sheet`)
5. Create `src/lib/components/ManualEntrySheet.svelte`
6. Modify `MealCard.svelte` — add id, onEdit, onDelete
7. Modify `MealList.svelte` — pass through handlers
8. Modify `+page.svelte` — add FAB, wire up sheet
9. Run typecheck → lint → tests (fail fast)
10. Verify with browser automation
11. Update `docs/PLAN.md` + write stage log

---

## File Specifications

### 1. `src/lib/types.ts` (MODIFY)

Add `MealFormData` interface:

```typescript
export interface MealFormData {
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  date: string;
}
```

### 2. `src/routes/api/meals/+server.ts` (NEW)

POST handler for creating meals.

```
Imports:
  json from '@sveltejs/kit'
  db, meal from '$lib/server/db'
  addLogContext from '$lib/server/logger'
  isValidDate, today from '$lib/utils/date'

Function signature:
  export async function POST({ request, locals }) => json | error

Flow:
  1. Parse JSON body
  2. Validate description (non-empty string)
  3. Validate calories (non-negative integer, required)
  4. Validate protein, carbs, fat (non-negative integers, default 0)
  5. Validate date format (YYYY-MM-DD), default to today
  6. Insert into DB with:
     - source: "manual"
     - userId: locals.user.id
     - createdBy: locals.user.id
     - updatedBy: locals.user.id
  7. addLogContext(locals, { mealId: created.id, source: "manual" })
  8. Return 201 with created meal

Error handling:
  Invalid JSON → 400 { error: "Invalid JSON" }
  Missing/invalid fields → 400 { error: "Validation failed", fields: { ... } }
  DB error → 500
```

### 3. `src/routes/api/meals/[id]/+server.ts` (NEW)

PUT and DELETE handlers.

```
Imports:
  json, error from '@sveltejs/kit'
  eq, and from 'drizzle-orm'
  db, meal from '$lib/server/db'
  addLogContext from '$lib/server/logger'

Shared helper:
  async function getOwnedMeal(id, userId) — queries meal by id + userId
  Returns meal row or null

PUT /api/meals/[id]:
  1. Parse JSON body
  2. getOwnedMeal(params.id, locals.user.id)
  3. If null → 404 { error: "Meal not found" }
  4. Build update object from provided fields only
  5. Set updatedAt, updatedBy
  6. Update in DB
  7. addLogContext(locals, { mealId: params.id })
  8. Return 200 with updated meal

DELETE /api/meals/[id]:
  1. getOwnedMeal(params.id, locals.user.id)
  2. If null → 404 { error: "Meal not found" }
  3. Delete from DB
  4. addLogContext(locals, { mealId: params.id })
  5. Return 204
```

### 4. `src/lib/components/ManualEntrySheet.svelte` (NEW)

Bottom sheet form component using shadcn-svelte Sheet.

```
Props:
  open: boolean (controlled by parent)
  meal?: Meal (optional, for editing — null/undefined = create mode)
  date: string (YYYY-MM-DD, initial date value)
  onSubmit: (data: MealFormData) => Promise<void>
  onClose: () => void

State:
  description: string = meal?.description ?? ""
  calories: string = meal?.calories?.toString() ?? ""
  protein: string = meal?.protein?.toString() ?? "0"
  carbs: string = meal?.carbs?.toString() ?? "0"
  fat: string = meal?.fat?.toString() ?? "0"
  dateInput: string = meal ? date : date
  submitting: boolean = false
  errors: Record<string, string> = {}

Behavior:
  - Uses shadcn-svelte Sheet component (Radix Dialog primitive)
  - Sheet slides up from bottom (side="bottom")
  - Form inputs use native HTML validation + custom validation
  - On submit:
    1. Validate fields
    2. Set errors if invalid
    3. Call onSubmit with parsed data
    4. Reset form on success
  - On close: call onClose
  - Edit mode: pre-populate all fields from meal prop

Validation:
  description: required, non-empty string
  calories: required, positive integer
  protein, carbs, fat: non-negative integers (default 0)
  date: valid YYYY-MM-DD format

Layout:
  Sheet with title "Add Meal" or "Edit Meal"
  Form fields stacked vertically with labels
  Cancel + Submit buttons at bottom
```

### 5. `src/lib/components/MealCard.svelte` (MODIFY)

Add id, onEdit, onDelete props and action icons.

```
New props:
  id: string
  onEdit?: () => void
  onDelete?: () => void

Changes:
  - Add action buttons (edit + delete) to the right side of the card
  - Use @lucide/svelte icons: Pencil (edit), Trash2 (delete)
  - Buttons are small, icon-only, muted-foreground color
  - Edit button calls onEdit
  - Delete button shows confirm() then calls onDelete
  - Both buttons visible on hover/tap (not always visible on mobile)
```

### 6. `src/lib/components/MealList.svelte` (MODIFY)

Pass through edit/delete handlers.

```
New props:
  onEdit?: (meal: Meal) => void
  onDelete?: (meal: Meal) => void

Changes:
  - Accept onEdit and onDelete callbacks
  - Pass to each MealCard:
    id={meal.id}
    onEdit={() => onEdit?.(meal)}
    onDelete={() => onDelete?.(meal)}
```

### 7. `src/routes/+page.svelte` (MODIFY)

Add FAB button and wire up ManualEntrySheet.

```
New imports:
  ManualEntrySheet from '$lib/components/ManualEntrySheet.svelte'
  Plus from '@lucide/svelte'
  invalidate from '$app/navigation'

New state:
  sheetOpen: boolean = false
  editingMeal: Meal | null = null

New functions:
  handleAddMeal(data: MealFormData) — POST to /api/meals, then invalidate
  handleEditMeal(data: MealFormData) — PUT to /api/meals/[id], then invalidate
  handleDeleteMeal(meal: Meal) — DELETE /api/meals/[id], then invalidate
  openAddSheet() — set editingMeal = null, sheetOpen = true
  openEditSheet(meal: Meal) — set editingMeal = meal, sheetOpen = true

Changes to template:
  - Add MealList with onEdit and onDelete callbacks
  - Add FAB button:
    fixed bottom-6 right-6 z-40 rounded-full bg-primary p-4 text-primary-foreground shadow-lg
  - Add ManualEntrySheet with open, meal, date, onSubmit, onClose

Re-fetch strategy:
  await invalidate('/') — SvelteKit re-runs server load function
```

### 8. `tests/api/meals.test.ts` (NEW)

API route unit tests.

```
Test cases:

POST /api/meals:
  - Creates meal with valid data → 201
  - Creates meal with defaults (protein/carbs/fat = 0) → 201
  - Creates meal with date defaulting to today → 201
  - Missing description → 400
  - Missing calories → 400
  - Negative calories → 400
  - Invalid date format → 400
  - Sets source to "manual"
  - Sets audit fields from session user

PUT /api/meals/[id]:
  - Updates provided fields only → 200
  - Meal not found → 404
  - Meal belongs to different user → 404 (don't leak existence)
  - Partial update (only description) → 200
  - Updates updatedAt and updatedBy

DELETE /api/meals/[id]:
  - Deletes meal → 204
  - Meal not found → 404
  - Meal belongs to different user → 404
  - Meal removed from DB after delete
```

---

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| shadcn-svelte `sheet` component not installed | Install via `pnpm dlx shadcn-svelte@latest add sheet` |
| SvelteKit form actions don't work on `+server.ts` | Use `fetch()` from client + `invalidate()` for revalidation |
| Date validation edge cases | Use existing `isValidDate()` from `$lib/utils/date` |
| MealCard icons clutter on small screens | Use small icons, show on hover/tap only |
| Re-fetch after mutation causes flash | `invalidate()` is fast; optimistic updates deferred to step 13 |

---

## Verification

### After API routes (steps 1-3)

1. **Typecheck:** `pnpm check` — no errors
2. **Lint:** `pnpm lint` — no errors
3. **Unit tests:** `pnpm test` — all pass
4. **Manual test with pm2:**
   - Start dev server: `npx pm2 start scripts/pm2-dev.mjs --name calorietracker`
   - Sign in via browser
   - Use browser dev tools to POST to `/api/meals` with valid body
   - Verify 201 response with created meal
   - Verify meal appears in day view
   - PUT to `/api/meals/[id]` with partial body
   - Verify only provided fields updated
   - DELETE to `/api/meals/[id]`
   - Verify 204 and meal removed
   - Test validation errors (missing description, negative calories)
   - Check pm2 logs for `addLogContext` fields in wide events
   - Clean up: `npx pm2 stop calorietracker && npx pm2 delete calorietracker`

### After component implementation (steps 4-8)

1. **Typecheck:** `pnpm check` — no errors
2. **Lint:** `pnpm lint` — no errors
3. **Unit tests:** `pnpm test` — all pass

### After full implementation (step 10)

Use **browser-automation** skill to verify the complete CRUD flow:

- Navigate to `/` while authenticated
- Verify FAB button visible at bottom-right
- Click FAB → verify sheet opens with empty form
- Fill form: description "Test Meal", calories 500, protein 30, carbs 40, fat 20
- Submit → verify sheet closes, meal appears in list
- Verify calorie doughnut updated (500 / 2000)
- Verify macro summary updated (P: 30g, C: 40g, F: 20g)
- Tap meal card → verify edit/delete icons visible
- Click edit → verify sheet opens with pre-populated data
- Modify description, submit → verify meal updated in list
- Click delete → verify confirm dialog appears
- Confirm → verify meal removed, doughnut resets to 0/2000
- Mobile viewport → verify FAB accessible, sheet usable
- Check browser console → no errors

---

## Success Criteria

- [ ] POST /api/meals creates meal with correct audit fields
- [ ] PUT /api/meals/[id] updates only provided fields
- [ ] DELETE /api/meals/[id] removes meal
- [ ] All routes verify meal ownership
- [ ] Validation errors return 400 with error details
- [ ] ManualEntrySheet opens/closes correctly
- [ ] FAB button visible on day view
- [ ] Edit/delete work on existing meals
- [ ] Meals re-fetch after mutations via `invalidate()`
- [ ] Typecheck passes (`pnpm check`)
- [ ] Lint passes (`pnpm lint`)
- [ ] Unit tests pass (`pnpm test`)
- [ ] Browser automation verification passes
- [ ] PLAN.md updated with steps 5 and 6 checked off
- [ ] STAGE6_IMPLEMENTATION.md written
