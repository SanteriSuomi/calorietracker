# Step 14 — Polish

> Detailed implementation plan for polish pass: loading states, error handling, PWA manifest, and bugfixes.

## Summary

Four bugfixes plus loading states, error handling, and minimal PWA manifest. No new dependencies except PWA icons (generated from existing favicon). Full PWA with offline sync deferred to step 19.

---

## Bugfixes

### Bug 1: Title Link to Home

**File:** `src/routes/+layout.svelte:24`

The brand name "CalorieTracker" in the header is a `<span>`, not a link. Clicking it does nothing.

**Fix:** Wrap in `<a href={localizeHref('/')}>`:

```svelte
<!-- Before -->
<span class="text-sm font-semibold text-foreground">{m.app_name()}</span>

<!-- After -->
<a href={localizeHref('/')} class="text-sm font-semibold text-foreground hover:text-foreground/80 transition-colors">{m.app_name()}</a>
```

### Bug 2: Brand Name Not Translated

**Files:** `messages/fi.json`, `messages/en.json`

The brand name "CalorieTracker" is translated to "KaloriSeuranta" in Finnish. Per product decision, the brand name must never be translated — it should always be "CalorieTracker".

**Fix:**

1. `messages/fi.json` — change `app_name` from `"KaloriSeuranta"` to `"CalorieTracker"`
2. `messages/fi.json` — change title strings to use "CalorieTracker" instead of "KaloriSeuranta":
   - `home_title`: `"{date} — CalorieTracker"`
   - `calendar_title`: `"Kalenteri — CalorieTracker"`
   - `settings_title`: `"Asetukset — CalorieTracker"`
3. Verify `messages/en.json` title strings already use "CalorieTracker" (they do)

### Bug 3: Settings Page Scrollbar

**File:** `src/routes/settings/+page.svelte`

Reported scrollbar issue on smaller screens (912x1368). Needs browser testing to identify root cause. Likely causes:

- Double scrollbar from parent + child overflow
- Content extending past viewport without proper scroll containment
- The `<main class="flex-1">` inside `min-h-dvh` container may create layout overflow on short viewports

**Investigation:** Open settings page at 912x1368 viewport during browser verification phase. Inspect overflow behavior. Fix depends on findings.

### Bug 4: Image+Text AI Input

**Files:** `src/lib/components/InputBar.svelte`, `src/routes/api/ai/analyze/+server.ts`

Currently:
- Camera button is **disabled** with "Coming soon" title
- `/api/ai/analyze` only accepts JSON `{ description }` — no image support
- Users cannot combine a photo with text for AI analysis

**Fix:** Full implementation — enable camera button with file picker, modify endpoint to accept FormData with optional image, send multi-modal input to AI. See "Image+Text AI Implementation" section below.

---

## Loading States

### Auth Form Submission

**File:** `src/routes/auth/+page.svelte`

The auth forms use `use:enhance` but no loading indicator. The submit button stays enabled during server action processing.

**Fix:** Add `submitting` state, toggle via `use:enhance` callbacks:

```svelte
<script lang="ts">
  let submitting = $state(false);
</script>

<form method="POST" action="?/signIn" use:enhance={() => {
  submitting = true;
  return async ({ update }) => {
    await update();
    submitting = false;
  };
}}>
  <button type="submit" disabled={submitting}>
    {#if submitting}<Loader2 size={16} class="animate-spin" />{/if}
    {m.auth_submit_sign_in()}
  </button>
</form>
```

Apply to both sign-in and sign-up forms. Import `Loader2` from `@lucide/svelte`.

### Meal Delete Operation

**File:** `src/routes/+page.svelte:76-80`

`handleDeleteMeal` has no loading state and errors are uncaught. The meal disappears only after `invalidateAll()` completes.

**Fix:** Add a `deletingMealId` state. Show a spinner/disabled state on the MealCard's delete button while deleting. Wrap in try/catch with error display.

```ts
let deletingMealId = $state<string | null>(null);
let deleteError = $state('');

async function handleDeleteMeal(meal: Meal) {
  deletingMealId = meal.id;
  deleteError = '';
  try {
    const res = await fetch(`/api/meals/${meal.id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error();
    await invalidateAll();
  } catch {
    deleteError = m.error_delete_meal();
    setTimeout(() => { deleteError = ''; }, 5000);
  } finally {
    deletingMealId = null;
  }
}
```

Pass `deletingMealId` to MealList/MealCard. MealCard shows Loader2 on delete button when `meal.id === deletingMealId`.

**Files changed:** `src/routes/+page.svelte`, `src/lib/components/MealCard.svelte` (add `deleting` prop), `src/lib/components/MealList.svelte` (pass through).

### Navigation Progress Bar

**File:** `src/routes/+layout.svelte`

Use `$app/state` → `navigating` store to show a thin progress bar during client-side navigation (date arrows, page changes).

```svelte
{#if navigating}
  <div class="fixed top-14 left-0 right-0 z-50 h-0.5 bg-primary/30">
    <div class="h-full bg-primary animate-pulse-progress"></div>
  </div>
{/if}
```

Add CSS animation in `src/routes/layout.css`:

```css
@keyframes pulse-progress {
  0% { width: 0%; }
  50% { width: 70%; }
  100% { width: 90%; }
}
.animate-pulse-progress {
  animation: pulse-progress 2s ease-in-out infinite;
}
```

---

## Error Handling

### Custom Error Page

**File:** `src/routes/+error.svelte` (NEW)

No custom error page exists. Create a minimal one consistent with the app design:

```svelte
<script lang="ts">
  import { page } from '$app/state';
  import { Button } from '$lib/components/ui/button';
  import { localizeHref } from '$lib/paraglide/runtime';
</script>

<div class="flex flex-col items-center justify-center py-20 text-center">
  <h1 class="text-4xl font-bold">{page.status}</h1>
  <p class="mt-2 text-muted-foreground">
    {page.status === 404 ? 'Page not found' : page.error?.message ?? 'Something went wrong'}
  </p>
  <a href={localizeHref('/')} class="mt-6">
    <Button>Go home</Button>
  </a>
</div>
```

Note: Error pages can't reliably use Paraglide message functions because locale context may not be available. Use hardcoded English strings (server errors are always English per project convention).

### Delete Meal Error Display

Covered in "Meal Delete Operation" above. Add error display below MealList:

```svelte
{#if deleteError}
  <span class="text-xs text-destructive mt-2">{deleteError}</span>
{/if}
```

### ManualEntrySheet Error Placement

**File:** `src/lib/components/ManualEntrySheet.svelte:117-118`

Catch block sets `errors.date = m.error_save_meal()`. This shows a generic save error in the date field's error slot — misleading.

**Fix:** Use a separate `formError` state displayed at form level. In catch: `formError = m.error_save_meal()` instead of `errors.date = ...`. Add display above the form fields.

---

## PWA Manifest (Minimal — No Service Worker)

Minimal manifest for installability only. No offline support, no service worker. Full PWA with offline sync deferred to step 19.

### `static/manifest.json` (NEW)

```json
{
  "name": "CalorieTracker",
  "short_name": "CalorieTracker",
  "description": "Track your daily calorie and macro intake",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#0a0a0a",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```

### App Icons

Generate `static/icon-192.png` and `static/icon-512.png` from `src/lib/assets/favicon.svg`. The existing favicon is the Svelte logo — use it as a placeholder. Consider a custom CalorieTracker icon later.

### `src/app.html` Modifications

Add PWA meta tags in `<head>`:

```html
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#0a0a0a" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<link rel="apple-touch-icon" href="/icon-192.png" />
```

---

## Image+Text AI Implementation

### InputBar Changes

**File:** `src/lib/components/InputBar.svelte`

1. Add `selectedImage` state + hidden file input
2. Enable Camera button to trigger file input
3. Show image preview thumbnail next to input (with X to remove)
4. Send `FormData` with `description` and/or `image` to `/api/ai/analyze`
5. Support text-only, image-only, and text+image submissions

Key code patterns:

```ts
let selectedImage = $state<File | null>(null);
let previewUrl = $state<string | null>(null);

$effect(() => {
  if (selectedImage) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(selectedImage);
  } else if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }
});

async function handleAiSubmit() {
  const hasText = description.trim().length > 0;
  const hasImage = selectedImage !== null;
  if (!hasText && !hasImage) return;
  if (!aiConfigured) { showError(m.input_ai_not_configured()); return; }

  clearError();
  loading = true;
  try {
    const formData = new FormData();
    if (hasText) formData.append('description', description.trim());
    if (selectedImage) formData.append('image', selectedImage);

    const res = await fetch('/api/ai/analyze', { method: 'POST', body: formData });
    // ... response handling unchanged ...
    description = '';
    selectedImage = null;
  } catch {
    showError(m.input_network_error());
  } finally {
    loading = false;
  }
}
```

Template: Replace disabled Camera button with working file picker. Add preview thumbnail when image is selected.

### AI Analyze Endpoint Changes

**File:** `src/routes/api/ai/analyze/+server.ts`

Accept both `multipart/form-data` (with optional image) and `application/json` (text only, backward compatible).

Key changes:

1. Detect content type — `multipart/form-data` vs `application/json`
2. For FormData: extract `description` (string field) and `image` (File field)
3. For JSON: parse as before (backward compatible)
4. Require at least one of `description` or `image`
5. If image present: convert to base64 data URL, send as multi-modal content to AI
6. Set `aiSource` based on input: `ai_text`, `ai_vision`, or `ai_text_vision`

Multi-modal AI call pattern (verify against AI SDK docs during implementation):

```ts
const { output } = await generateText({
  model: provider(settings.aiModel),
  output: Output.object({ schema: nutritionSchema }),
  system: SYSTEM_PROMPT,
  messages: [{
    role: 'user',
    content: imageFile
      ? [
          ...(description ? [{ type: 'text' as const, text: description }] : []),
          { type: 'image' as const, image: `data:${mediaType};base64,${base64}` }
        ]
      : description!
  }]
});
```

---

## Files to Create/Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `src/routes/+layout.svelte` | **MODIFY** | Title link to home, navigation progress bar |
| 2 | `messages/fi.json` | **MODIFY** | Brand name fix: "KaloriSeuranta" → "CalorieTracker" |
| 3 | `src/lib/components/InputBar.svelte` | **MODIFY** | Enable camera, file picker, image preview, send FormData |
| 4 | `src/routes/api/ai/analyze/+server.ts` | **MODIFY** | Accept FormData, multi-modal AI call |
| 5 | `src/routes/auth/+page.svelte` | **MODIFY** | Submit loading state on both forms |
| 6 | `src/routes/+page.svelte` | **MODIFY** | Delete loading state + error handling |
| 7 | `src/lib/components/MealCard.svelte` | **MODIFY** | Add `deleting` prop, Loader2 on delete button |
| 8 | `src/lib/components/MealList.svelte` | **MODIFY** | Pass deletingMealId through to MealCard |
| 9 | `src/lib/components/ManualEntrySheet.svelte` | **MODIFY** | Fix error placement: `formError` at form level |
| 10 | `src/routes/+error.svelte` | **CREATE** | Custom error page |
| 11 | `static/manifest.json` | **CREATE** | PWA manifest |
| 12 | `static/icon-192.png` | **CREATE** | App icon 192x192 |
| 13 | `static/icon-512.png` | **CREATE** | App icon 512x512 |
| 14 | `src/app.html` | **MODIFY** | PWA meta tags |
| 15 | `src/routes/layout.css` | **MODIFY** | Navigation progress bar animation |
| 16 | `messages/en.json` | **MODIFY** | New message keys if needed |
| 17 | `messages/fi.json` | **MODIFY** | Matching Finnish translations for new keys |

---

## Implementation Order

### Phase 1: Bugfixes (quick wins)

1. Fix title link to home — `src/routes/+layout.svelte`
2. Fix brand name translation — `messages/fi.json`
3. Fix ManualEntrySheet error placement — `src/lib/components/ManualEntrySheet.svelte`

### Phase 2: Error handling

4. Create custom error page — `src/routes/+error.svelte`
5. Add delete error handling — `src/routes/+page.svelte`, `MealCard.svelte`, `MealList.svelte`

### Phase 3: Loading states

6. Auth form submission loading — `src/routes/auth/+page.svelte`
7. Navigation progress bar — `src/routes/+layout.svelte`, `src/routes/layout.css`

### Phase 4: Image+Text AI

8. Modify InputBar — enable camera, file picker, FormData, preview
9. Modify AI analyze endpoint — accept FormData, multi-modal AI call
10. Verify with browser test

### Phase 5: PWA manifest

11. Generate app icons → `static/icon-192.png`, `static/icon-512.png`
12. Create `static/manifest.json`
13. Add PWA meta tags to `src/app.html`

### Phase 6: Settings scrollbar investigation

14. Browser test at 912x1368 viewport
15. Identify and fix scrollbar issue

### Phase 7: Verify

16. `pnpm check` — typecheck passes
17. `pnpm lint` — lint passes
18. `pnpm test` — tests pass
19. Browser test: all bugfixes verified
20. Browser test: loading states work (auth forms, delete, navigation)
21. Browser test: error page renders for 404/500
22. Browser test: image+text AI input works (text only, image only, both)
23. Browser test: PWA install prompt appears on mobile
24. Browser test: Finnish locale — brand name is "CalorieTracker"
25. Browser test: settings page at 912x1368 — no scrollbar issue
26. Update `docs/PLAN.md` — check off step 14, add step 19 placeholder
27. Write `docs/stages/STAGE14_IMPLEMENTATION.md`

---

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| AI SDK multi-modal content format may differ across versions | Verify against `@ai-sdk/openai` docs during implementation. Use `context7-api` skill to get current API. |
| Settings scrollbar cause unknown | Browser test at 912x1368 to identify. Common fix: adjust overflow on parent container. |
| App icons from SVG may look bad at large sizes | Existing favicon is the Svelte logo — use as placeholder. Custom icon later. |
| FormData changes may break existing text-only AI flow | Keep JSON fallback in endpoint (content-type check). Text-only continues to work. |
| Navigation progress bar may flash on fast navigations | Only show after a short delay (200ms), or accept the flash as acceptable UX. |

---

## Success Criteria

- [ ] Brand name "CalorieTracker" appears unchanged in all locales
- [ ] Clicking "CalorieTracker" in header navigates to home
- [ ] Settings page scrolls correctly on 912x1368 viewport
- [ ] Camera button works — users can select image for AI analysis
- [ ] AI analyzes text only, image only, and text+image correctly
- [ ] Auth form buttons show spinner and disable during submission
- [ ] Delete meal shows loading state and error on failure
- [ ] Navigation progress bar appears during page transitions
- [ ] Custom error page renders for 404 and 500 errors
- [ ] ManualEntrySheet shows save errors at form level, not in date field
- [ ] PWA manifest valid — install prompt appears on mobile browsers
- [ ] `pnpm check` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes
- [ ] PLAN.md updated with step 14 checked off + step 19 placeholder
- [ ] STAGE14_IMPLEMENTATION.md written
