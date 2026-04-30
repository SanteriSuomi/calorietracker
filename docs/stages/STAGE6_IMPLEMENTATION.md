# STAGE6 — Manual Meal CRUD Implementation

## What Was Done

Implemented full CRUD for manual meals: API routes, bottom sheet form, FAB button, edit/delete on MealCard, and re-fetch via `invalidate()`.

Also fixed pre-existing issues: sheet component type errors (bits-ui v2 API), API route imports (schema re-export), and test type errors.

## Files Created

| File | Purpose |
|------|---------|
| `src/lib/components/ManualEntrySheet.svelte` | Bottom sheet form for add/edit meal |
| `docs/stages/STAGE6_IMPLEMENTATION.md` | This file |

## Files Modified

| File | Changes |
|------|---------|
| `src/lib/types.ts` | Added `MealFormData` interface |
| `src/routes/api/meals/+server.ts` | Fixed import: `meal` from `$lib/server/db/schema`, type narrowing for insert values |
| `src/routes/api/meals/[id]/+server.ts` | Fixed import: `meal` from `$lib/server/db/schema`, added `UpdateBody` interface, top-level `isValidDate` import |
| `src/lib/components/ui/sheet/sheet.svelte` | Fixed `Dialog.RootProps` type, removed invalid `class` prop |
| `src/lib/components/ui/sheet/sheet-content.svelte` | Added `side` prop (top/bottom/left/right), fixed `Dialog.ContentProps` type, import order |
| `src/lib/components/ui/sheet/sheet-close.svelte` | Fixed `Dialog.CloseProps` type |
| `src/lib/components/ui/sheet/sheet-description.svelte` | Fixed `Dialog.DescriptionProps` type |
| `src/lib/components/ui/sheet/sheet-overlay.svelte` | Fixed `Dialog.OverlayProps` type |
| `src/lib/components/ui/sheet/sheet-title.svelte` | Fixed `Dialog.TitleProps` type |
| `src/lib/components/ui/sheet/index.ts` | Fixed import order |
| `src/lib/components/MealCard.svelte` | Added `onEdit`, `onDelete` props with Pencil/Trash2 icons |
| `src/lib/components/MealList.svelte` | Added `onEdit`, `onDelete` callbacks, passed through to MealCard |
| `src/routes/+page.svelte` | Added FAB button, ManualEntrySheet, CRUD handlers, `invalidate()` re-fetch |
| `tests/api/meals.test.ts` | Fixed ownership tests to use `and()` with userId in WHERE clause |
| `docs/PLAN.md` | Marked steps 5 and 6 complete |

## Verification

- `pnpm check` — 0 errors, 0 warnings
- `pnpm test` — 36 passed (5 test files)
- Lint has pre-existing CRLF formatting issues in untouched files; no new lint errors in modified files

## Design Decisions

1. **Sheet side="bottom"**: Updated SheetContent with a `side` prop supporting all four directions (top/bottom/left/right) with appropriate CSS positioning and animations
2. **Form state reset via `$effect`**: Form fields reset when `open` becomes true, pulling from `meal` prop (edit) or defaults (create)
3. **Bind `open`**: Sheet uses `bind:open` so both the close button and successful submit close the sheet
4. **API imports**: Fixed to use `$lib/server/db/schema` directly instead of `$lib/server/db` which doesn't re-export schema tables
5. **Ownership tests**: Tests use `and(eq(meal.id, ...), eq(meal.userId, ...))` matching the API route pattern rather than checking `result.changes`
