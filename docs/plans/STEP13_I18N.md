# Step 13 — Internationalization (i18n)

> Detailed implementation plan for adding multilingual support to CalorieTracker using Paraglide JS, starting with English (base) + Finnish.

## Summary

Add compile-time i18n via Paraglide JS (`@inlang/paraglide-js`) with URL-based locale routing. English is the base locale (no URL prefix). Finnish gets the `/fi/` prefix. API routes remain unlocalized. Server-side error messages stay in English — the frontend maps status codes to translated user-facing strings.

**New dependencies:** `@inlang/paraglide-js` (dev)

---

## Architecture

### Library: Paraglide JS

Compile-time i18n — messages are JSON files compiled to tree-shakable JS functions. Official Svelte CLI add-on (`npx sv add paraglide`). First-class SvelteKit 2 + Svelte 5 runes support. Messages are plain functions (no stores).

### URL-based routing via `reroute` hook

```
/fi/settings  →  reroute strips /fi  →  SvelteKit routes to /settings
/settings     →  no prefix (en)      →  SvelteKit routes to /settings
/api/meals    →  not localized        →  SvelteKit routes to /api/meals
```

No file restructuring needed. Routes stay in their current location. The `reroute` function in `src/hooks.ts` strips the locale prefix before SvelteKit matches routes. `paraglideMiddleware` in `hooks.server.ts` detects locale, sets cookie, replaces `%lang%`/`%dir%` placeholders.

### Locale detection strategy

Priority order: `url → cookie → baseLocale`

1. **URL** — `/fi/...` prefix determines locale
2. **Cookie** — `PARAGLIDE_LOCALE` cookie (set by language switcher)
3. **baseLocale** — fallback to `en`

### Languages

| Tag | Language | URL prefix | Direction |
|-----|----------|------------|-----------|
| `en` | English | *(none)* | LTR |
| `fi` | Finnish | `/fi/` | LTR |

---

## Files to Create/Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `project.inlang/settings.json` | **CREATE** | Paraglide project config |
| 2 | `messages/en.json` | **CREATE** | English message file (base locale) |
| 3 | `messages/fi.json` | **CREATE** | Finnish translations |
| 4 | `src/hooks.ts` | **CREATE** | Reroute hook — strips locale prefix |
| 5 | `vite.config.ts` | **MODIFY** | Add `paraglideVitePlugin` |
| 6 | `src/app.html` | **MODIFY** | `%lang%` and `%dir%` placeholders |
| 7 | `src/hooks.server.ts` | **MODIFY** | Add `handleParaglide` to handle chain, update auth guard |
| 8 | `.gitignore` | **MODIFY** | Add `src/lib/paraglide/` (generated output) |
| 9 | `src/routes/+layout.svelte` | **MODIFY** | Replace hardcoded strings, use `localizeHref()` for links |
| 10 | `src/routes/+page.svelte` | **MODIFY** | Replace hardcoded strings |
| 11 | `src/routes/auth/+page.svelte` | **MODIFY** | Replace hardcoded strings |
| 12 | `src/routes/auth/+page.server.ts` | **MODIFY** | Update redirect targets to locale-aware |
| 13 | `src/routes/calendar/+page.svelte` | **MODIFY** | Replace hardcoded strings, use `localizeHref()` for links |
| 14 | `src/routes/settings/+page.svelte` | **MODIFY** | Replace hardcoded strings, add language switcher, update links |
| 15 | `src/lib/components/CalorieDoughnut.svelte` | **MODIFY** | Replace chart labels |
| 16 | `src/lib/components/CalendarGrid.svelte` | **MODIFY** | Localize weekday abbreviations |
| 17 | `src/lib/components/CalendarList.svelte` | **MODIFY** | Replace hardcoded strings, use `localizeHref()` for navigation |
| 18 | `src/lib/components/DateNav.svelte` | **MODIFY** | Replace aria labels |
| 19 | `src/lib/components/InputBar.svelte` | **MODIFY** | Replace hardcoded strings |
| 20 | `src/lib/components/MacroSummary.svelte` | **MODIFY** | Replace macro badge labels |
| 21 | `src/lib/components/ManualEntrySheet.svelte` | **MODIFY** | Replace hardcoded strings |
| 22 | `src/lib/components/MealCard.svelte` | **MODIFY** | Replace strings, use `localizeHref()` for navigation |
| 23 | `src/lib/components/MealList.svelte` | **MODIFY** | Replace strings |
| 24 | `src/lib/utils/date.ts` | **MODIFY** | Use current locale for date formatting |
| 25 | `docs/PLAN.md` | **MODIFY** | Check off step 13 |

**API routes (`src/routes/api/**`) are NOT modified.** Server-side error messages stay in English.

---

## File Specifications

### 1. `project.inlang/settings.json` (NEW)

```json
{
  "$schema": "https://inlang.com/schema/project-settings",
  "baseLocale": "en",
  "locales": ["en", "fi"],
  "modules": [
    "https://cdn.jsdelivr.net/npm/@inlang/plugin-message-format@latest/dist/index.js",
    "https://cdn.jsdelivr.net/npm/@inlang/plugin-m-function-matcher@latest/dist/index.js"
  ],
  "plugin.inlang.messageFormat": {
    "pathPattern": "./messages/{locale}.json"
  }
}
```

### 2. `messages/en.json` (NEW)

All ~130 user-facing strings extracted from components and pages. Organized by section with descriptive keys.

```json
{
  "$schema": "https://inlang.com/schema/inlang-message-format",

  "app_name": "CalorieTracker",

  "layout_sign_out": "Sign out",
  "layout_nav_calendar": "Calendar",
  "layout_nav_settings": "Settings",

  "auth_title_sign_in": "Sign In",
  "auth_title_sign_up": "Sign Up",
  "auth_tab_sign_in": "Sign In",
  "auth_tab_sign_up": "Sign Up",
  "auth_email_label": "Email",
  "auth_email_placeholder": "you@example.com",
  "auth_password_label": "Password",
  "auth_password_placeholder_sign_in": "••••••••",
  "auth_password_placeholder_sign_up": "Min. 8 characters",
  "auth_name_label": "Name",
  "auth_name_placeholder": "Your name",
  "auth_submit_sign_in": "Sign In",
  "auth_submit_sign_up": "Create Account",

  "home_title": "{date} — CalorieTracker",

  "calendar_title": "Calendar — CalorieTracker",
  "calendar_back_to_today": "← Back to today",
  "calendar_tab_grid": "Grid",
  "calendar_tab_list": "List",
  "calendar_no_meals": "No meals logged yet",
  "calendar_macro_summary": "P: {protein}g · C: {carbs}g · F: {fat}g",

  "settings_title": "Settings — CalorieTracker",
  "settings_heading": "Settings",
  "settings_goals": "Goals",
  "settings_daily_calorie_goal": "Daily Calorie Goal",
  "settings_calorie_placeholder": "2000",
  "settings_ai_config": "AI Configuration",
  "settings_endpoint_url": "Endpoint URL",
  "settings_endpoint_placeholder": "https://api.openai.com/v1",
  "settings_api_key": "API Key",
  "settings_api_key_placeholder": "sk-...",
  "settings_model": "Model",
  "settings_model_placeholder": "gpt-4o",
  "settings_saved": "Saved",
  "settings_saving": "Saving...",
  "settings_save": "Save Settings",
  "settings_account": "Account",
  "settings_sign_out": "Sign out",
  "settings_language": "Language",
  "settings_language_en": "English",
  "settings_language_fi": "Suomi",

  "manual_title_edit": "Edit Meal",
  "manual_title_add_ai": "Add Meal (AI)",
  "manual_title_add": "Add Meal",
  "manual_desc_edit": "Update meal details",
  "manual_desc_add": "Log a new meal",
  "manual_description_label": "Description",
  "manual_description_placeholder": "e.g. Chicken breast with rice",
  "manual_preview_alt": "Preview",
  "manual_remove_image": "Remove image",
  "manual_meal_photo_alt": "Meal photo",
  "manual_change_photo": "Change",
  "manual_add_photo": "Add photo",
  "manual_calories_label": "Calories",
  "manual_calories_placeholder": "500",
  "manual_protein_label": "Protein (g)",
  "manual_carbs_label": "Carbs (g)",
  "manual_fat_label": "Fat (g)",
  "manual_date_label": "Date",
  "manual_date_placeholder": "YYYY-MM-DD",
  "manual_cancel": "Cancel",
  "manual_saving": "Saving...",
  "manual_update": "Update",
  "manual_add_meal": "Add Meal",

  "meal_delete_confirm": "Delete this meal?",
  "meal_edit_aria": "Edit meal",
  "meal_delete_aria": "Delete meal",
  "meal_protein_badge": "P: {count}g",
  "meal_carbs_badge": "C: {count}g",
  "meal_fat_badge": "F: {count}g",

  "meals_heading": "Meals",
  "meals_empty": "No meals logged yet",

  "doughnut_over": "Over",
  "doughnut_eaten": "Eaten",
  "doughnut_remaining": "Remaining",
  "doughnut_center_over": "{over} over",
  "doughnut_center_normal": "of {goal} kcal",

  "input_placeholder": "Describe your meal...",
  "input_camera_title": "Coming soon",
  "input_ai_button": "AI",
  "input_manual_button": "Manual",
  "input_ai_not_configured": "Configure AI in Settings first",
  "input_ai_failed": "AI analysis failed",
  "input_network_error": "Network error",

  "date_nav_prev_aria": "Previous day",
  "date_nav_next_aria": "Next day",

  "error_upload_image": "Failed to upload image",
  "error_create_meal": "Failed to create meal",
  "error_update_meal": "Failed to update meal",
  "error_delete_meal": "Failed to delete meal",
  "error_save_meal": "Failed to save meal",
  "error_save_settings": "Failed to save settings",
  "error_network": "Network error",

  "weekday_su": "Su",
  "weekday_mo": "Mo",
  "weekday_tu": "Tu",
  "weekday_we": "We",
  "weekday_th": "Th",
  "weekday_fr": "Fr",
  "weekday_sa": "Sa"
}
```

### 3. `messages/fi.json` (NEW)

Finnish translations for all keys. Created in phase 5 after English extraction is verified.

**Brand name rule:** `app_name` must remain `"CalorieTracker"` (untranslated). All `_title` strings (e.g. `home_title`, `calendar_title`, `settings_title`) must use `"CalorieTracker"` as-is — never translate the brand.

### 4. `src/hooks.ts` (NEW)

```ts
import type { Reroute } from '@sveltejs/kit';
import { deLocalizeUrl } from '$lib/paraglide/runtime';

export const reroute: Reroute = (request) => {
	return deLocalizeUrl(request.url).pathname;
};
```

### 5. `vite.config.ts` (MODIFY)

Add `paraglideVitePlugin` after `sveltekit()`:

```ts
import { paraglideVitePlugin } from '@inlang/paraglide-js';

export default defineConfig({
  ssr: { external: ['@libsql/client'] },
  plugins: [
    tailwindcss(),
    sveltekit(),
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: './src/lib/paraglide',
      strategy: ['url', 'cookie', 'baseLocale'],
      urlPatterns: [
        {
          pattern: '/:path(.*)?',
          localized: [
            ['fi', '/fi/:path(.*)?'],
            ['en', '/:path(.*)?'],
          ],
        },
      ],
    }),
  ],
  // ... test config unchanged
});
```

### 6. `src/app.html` (MODIFY)

Replace `<html lang="en">` with:

```html
<html lang="%lang%" dir="%dir%">
```

### 7. `src/hooks.server.ts` (MODIFY)

**a) Add paraglide handle as first in sequence:**

```ts
import { paraglideMiddleware } from '$lib/paraglide/server';
import { getTextDirection } from '$lib/paraglide/runtime';
import { deLocalizeUrl } from '$lib/paraglide/runtime';

const handleParaglide: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request: localizedRequest, locale }) => {
		event.request = localizedRequest;
		return resolve(event, {
			transformPageChunk: ({ html }) => {
				return html.replace('%lang%', locale).replace('%dir%', getTextDirection(locale));
			}
		});
	});

export const handle: Handle = sequence(handleParaglide, handleLogging, handleBetterAuth, handleAuthGuard);
```

**b) Update `handleAuthGuard` to use `deLocalizeUrl()` for path matching:**

The auth guard currently compares raw `pathname` against constants like `/auth` and `/api`. With URL-based locale routing, the pathname might be `/fi/auth` instead of `/auth`. The fix:

```ts
const handleAuthGuard: Handle = async ({ event, resolve }) => {
	if (building) return resolve(event);

	const { pathname } = event.url;
	const canonicalPath = deLocalizeUrl(event.url).pathname;

	const isAuthPage = canonicalPath === AUTH_PAGE_ROUTE;
	const isApiRoute = pathname.startsWith(API_BASE);

	if (pathname.startsWith(AUTH_API_ROUTE)) {
		return resolve(event);
	}

	if (!event.locals.user) {
		if (isApiRoute) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}
		if (!isAuthPage) {
			const locale = getLocale();
			const authRedirect = locale === 'en' ? AUTH_PAGE_ROUTE : `/${locale}${AUTH_PAGE_ROUTE}`;
			return new Response(null, {
				status: 302,
				headers: { Location: authRedirect }
			});
		}
	} else if (isAuthPage) {
		const locale = getLocale();
		const homeRedirect = locale === 'en' ? '/' : `/${locale}/`;
		return new Response(null, {
			status: 302,
			headers: { Location: homeRedirect }
		});
	}

	return resolve(event);
};
```

**Note:** The exact mechanism for reading the current locale in the auth guard needs verification during implementation. Options: `getLocale()` from paraglide runtime (uses AsyncLocalStorage on server), or extract from `pathname` prefix.

### 8. `.gitignore` (MODIFY)

Add:

```
src/lib/paraglide/
```

### 9–24. Component modifications (pattern)

Every component follows the same pattern:

```svelte
<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { localizeHref } from '$lib/paraglide/runtime.js';
</script>

<!-- Before -->
<h1>Settings</h1>
<a href="/calendar">Calendar</a>

<!-- After -->
<h1>{m.settings_heading()}</h1>
<a href={localizeHref('/calendar')}>{m.layout_nav_calendar()}</a>
```

**Navigation links** use `localizeHref()` for absolute paths. Relative query-only `goto()` calls (e.g., `goto('?date=...')`) are unchanged.

**API calls** (`fetch('/api/...')`, `<img src="/api/images/...">`) are unchanged — API routes stay at `/api/*` without locale prefix.

### 24. `src/lib/utils/date.ts` (MODIFY)

Replace hardcoded `'en-US'` locale with current locale from Paraglide:

```ts
import { getLocale } from '$lib/paraglide/runtime.js';

export function formatDate(d: string): string {
	const [y, m, day] = d.split('-').map(Number);
	return new Date(y, m - 1, day).toLocaleDateString(getLocale(), {
		month: 'long',
		day: 'numeric',
		year: 'numeric'
	});
}

export function formatMonthYear(monthStr: string): string {
	const [y, m] = monthStr.split('-').map(Number);
	return new Date(y, m - 1, 1).toLocaleDateString(getLocale(), {
		month: 'long',
		year: 'numeric'
	});
}
```

Note: `getLocale()` works on both client and server (uses AsyncLocalStorage on server).

### Language Switcher (in Settings page)

Add a language selector in the Settings page, in a new Language section before Account:

```svelte
<script lang="ts">
  import { locales, localizeHref } from '$lib/paraglide/runtime.js';
  import { page } from '$app/state';
  import { m } from '$lib/paraglide/messages.js';
</script>

<div>
  <Label>{m.settings_language()}</Label>
  <div class="flex gap-2">
    {#each locales as locale}
      <a
        href={localizeHref(page.url.pathname, { locale })}
        data-sveltekit-reload
        class="rounded-md border px-3 py-1.5 text-sm"
      >
        {locale === 'en' ? m.settings_language_en() : m.settings_language_fi()}
      </a>
    {/each}
  </div>
</div>
```

`data-sveltekit-reload` forces full page reload on locale switch, ensuring the server middleware runs and the cookie is updated.

---

## Navigation Changes Detail

### Links that need `localizeHref()`

| File | Before | After |
|------|--------|-------|
| `+layout.svelte` | `href="/calendar"` | `href={localizeHref('/calendar')}` |
| `+layout.svelte` | `href="/settings"` | `href={localizeHref('/settings')}` |
| `+layout.svelte` | `window.location.href = '/'` | `window.location.href = localizeHref('/')` |
| `calendar/+page.svelte` | `href="/"` | `href={localizeHref('/')}` |
| `settings/+page.svelte` | `window.location.href = '/'` | `window.location.href = localizeHref('/')` |
| `settings/+page.svelte` | `href="/"` | `href={localizeHref('/')}` |
| `CalendarGrid.svelte` | `goto('/?date=...')` | `goto(localizeHref('/') + '?date=...')` |
| `CalendarList.svelte` | `goto('/?date=...')` | `goto(localizeHref('/') + '?date=...')` |

### Links that stay unchanged

| File | Why |
|------|-----|
| `DateNav.svelte` `goto('?date=...')` | Relative query-only, no path |
| `calendar/+page.svelte` `goto('?month=...')` | Relative query-only, no path |
| All `fetch('/api/...')` calls | API routes not localized |
| All `<img src="/api/images/...">` | API routes not localized |

### Server-side redirects

| File | Before | After |
|------|--------|-------|
| `hooks.server.ts` → redirect to `/auth` | `Location: '/auth'` | Locale-prefixed via `getLocale()` |
| `hooks.server.ts` → redirect to `/` | `Location: '/'` | Locale-prefixed via `getLocale()` |
| `auth/+page.server.ts:9` → redirect to `/` | `redirect(302, '/')` | `redirect(302, localizedHome)` |
| `auth/+page.server.ts:44` → redirect to `/` | `redirect(302, '/')` | `redirect(302, localizedHome)` |
| `auth/+page.server.ts:76` → redirect to `/` | `redirect(302, '/')` | `redirect(302, localizedHome)` |

Note: Server-side redirects need locale context. The `getLocale()` function from paraglide runtime works server-side via AsyncLocalStorage (set by `paraglideMiddleware`).

---

## Implementation Order

### Phase 1: Infrastructure setup

1. Install `@inlang/paraglide-js` as dev dependency
2. Create `project.inlang/settings.json`
3. Create `messages/en.json` with all English strings
4. Update `vite.config.ts` — add `paraglideVitePlugin`
5. Update `src/app.html` — `%lang%` and `%dir%` placeholders
6. Create `src/hooks.ts` — `reroute` export
7. Update `src/hooks.server.ts` — add `handleParaglide` + update auth guard
8. Update `.gitignore` — add `src/lib/paraglide/`
9. Run `pnpm dev` — verify Paraglide compiles and app works in English

### Phase 2: Extract strings — components

10. Update `src/lib/components/MacroSummary.svelte`
11. Update `src/lib/components/MealCard.svelte`
12. Update `src/lib/components/MealList.svelte`
13. Update `src/lib/components/CalorieDoughnut.svelte`
14. Update `src/lib/components/DateNav.svelte`
15. Update `src/lib/components/CalendarGrid.svelte`
16. Update `src/lib/components/CalendarList.svelte`
17. Update `src/lib/components/ManualEntrySheet.svelte`
18. Update `src/lib/components/InputBar.svelte`

### Phase 3: Extract strings — pages and layout

19. Update `src/routes/+layout.svelte`
20. Update `src/routes/+page.svelte`
21. Update `src/routes/auth/+page.svelte`
22. Update `src/routes/auth/+page.server.ts`
23. Update `src/routes/calendar/+page.svelte`
24. Update `src/routes/settings/+page.svelte`

### Phase 4: Locale-aware formatting

25. Update `src/lib/utils/date.ts` — use `getLocale()` instead of `'en-US'`
26. Update `CalendarGrid.svelte` weekday abbreviations to use locale-aware `Intl.DateTimeFormat`

### Phase 5: Finnish translations

27. Create `messages/fi.json` with Finnish translations for all keys
28. Verify `/fi/` routes work and display Finnish text

### Phase 6: Language switcher

29. Add language switcher to Settings page

### Phase 7: Verify

30. `pnpm check` — typecheck passes
31. `pnpm lint` — lint passes
32. `pnpm test` — tests pass
33. Browser test: English (`/`) — all pages, navigation, forms
34. Browser test: Finnish (`/fi/`) — all pages, navigation, forms
35. Browser test: Language switcher — switching persists via cookie
36. Browser test: Direct URL access — `/fi/settings` renders Finnish
37. Browser test: Auth flows — sign in/up redirects maintain locale
38. Update `docs/PLAN.md` — check off step 13
39. Write `docs/stages/STAGE13_IMPLEMENTATION.md`

---

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| `getLocale()` not available in server `handle` function | Paraglide uses `AsyncLocalStorage` on server. `paraglideMiddleware` sets the store before downstream handles run. Verify during phase 1. |
| Auth guard redirect loses locale context | Extract locale from URL pathname before redirecting. Use `deLocalizeUrl()` for matching, re-localize redirect target. |
| `CalendarGrid` weekday abbreviations need locale-aware formatting | Use `Intl.DateTimeFormat(locale, { weekday: 'narrow' })` for each day. Falls back gracefully for unknown locales. |
| Finnish translations quality | Use native Finnish speaker or professional translation service. Machine translation as starting point, review required. |
| Brand name "CalorieTracker" gets translated | Explicit rule: `app_name` and all `_title` strings keep "CalorieTracker" unchanged in every locale. Brand names are never translated. |
| Paraglide compiler conflicts with existing Vitest config | Both use Vite. Paraglide plugin runs at build/dev time, not during tests. Should not conflict. Verify with `pnpm test` after setup. |
| `data-sveltekit-reload` on language switcher causes full reload | This is intentional — ensures server middleware runs and cookie is set. Acceptable UX for a language switch. |
| `@inlang/paraglide-js` requires Node 18+ | Project uses Node 22 (Docker, `.node-version`). No issue. |
| Message key naming conflicts with JS reserved words | All keys use `snake_case` with letter prefix. No conflicts. |
| `localizeHref()` on base locale returns path without prefix | This is correct behavior — English (`en`) has no URL prefix. `/calendar` is the English URL. |

---

## Success Criteria

- [ ] Paraglide compiles messages without errors
- [ ] English (`/`) renders all pages correctly with no visible changes
- [ ] Finnish (`/fi/`) renders all pages with Finnish text
- [ ] Brand name "CalorieTracker" is never translated (appears as-is in all locales)
- [ ] Language switcher in Settings persists choice via cookie
- [ ] All internal navigation links work in both locales
- [ ] Auth flows (sign in, sign up, sign out) maintain locale
- [ ] Date formatting uses locale-aware format (e.g., Finnish: "9. toukokuuta 2026")
- [ ] Calendar weekday abbreviations are locale-aware
- [ ] API routes (`/api/*`) are unlocalized and work unchanged
- [ ] Server error messages remain in English
- [ ] `pnpm check` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes
- [ ] PLAN.md updated with step 13 checked off
- [ ] STAGE13_IMPLEMENTATION.md written
