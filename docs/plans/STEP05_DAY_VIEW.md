# Step 5 — Main Day View: CalorieDoughnut, DateNav, MealList

> Detailed implementation plan for the main day view page with shadcn-svelte
> setup.

## Summary

Build the authenticated home page (`/`) with three core UI components:
**CalorieDoughnut** (Chart.js doughnut chart), **DateNav** (day navigation),
and **MealList** (scrollable meal list with empty state). Includes shadcn-svelte
initialization as a prerequisite. Data loading via `+page.server.ts` server load
function querying meals and settings from the database.

**No new dependencies** — `chart.js` (4.5.1) already installed. shadcn-svelte
init adds `clsx`, `tailwind-merge`, `tailwind-variants`, `tw-animate-css`.

---

## Prerequisites

### shadcn-svelte Setup

Run before any component work:

```bash
pnpm dlx shadcn-svelte@latest init
```

Interactive prompts — recommended answers:

| Prompt | Answer |
|--------|--------|
| Base color | Slate |
| Global CSS file | `src/routes/layout.css` |
| Import alias for lib | `$lib` |
| Import alias for components | `$lib/components` |
| Import alias for utils | `$lib/utils` |
| Import alias for hooks | `$lib/hooks` |
| Import alias for ui | `$lib/components/ui` |

Then add components:

```bash
pnpm dlx shadcn-svelte@latest add card button badge
```

### What init creates/modifies

| File | Action |
|------|--------|
| `components.json` | Created — CLI config |
| `src/routes/layout.css` | Overwritten — OKLCH CSS variables, `@theme inline` block, `@import "tw-animate-css"` |
| `src/lib/utils.ts` | Created — `cn()` helper + Svelte 5 type helpers |
| `src/lib/components/ui/card/*` | Created by `add card` |
| `src/lib/components/ui/button/*` | Created by `add button` |
| `src/lib/components/ui/badge/*` | Created by `add badge` |
| `package.json` | Modified — adds `clsx`, `tailwind-merge`, `tailwind-variants`, `tw-animate-css` |

### Verification after init

- Run `pnpm dev` and verify `/auth` page still renders correctly
- Verify `+layout.svelte` header still appears for authenticated users
- Existing pages use raw Tailwind classes (`bg-gray-50`, `text-gray-900`) which
  remain valid — no breaking changes

---

## Files to Create/Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `src/lib/components/DateNav.svelte` | **CREATE** | Date navigation with prev/next arrows |
| 2 | `src/lib/components/CalorieDoughnut.svelte` | **CREATE** | Chart.js doughnut with center text |
| 3 | `src/lib/components/MacroSummary.svelte` | **CREATE** | P/C/F macro badges |
| 4 | `src/lib/components/MealList.svelte` | **CREATE** | Scrollable meal list with empty state |
| 5 | `src/lib/components/MealCard.svelte` | **CREATE** | Individual meal row |
| 6 | `src/routes/+page.server.ts` | **CREATE** | Server load — fetch meals + settings for date |
| 7 | `src/routes/+page.svelte` | **MODIFY** | Replace SvelteKit placeholder with day view |

---

## Implementation Order

1. Run shadcn-svelte `init` + `add card button badge`
2. Verify existing pages still render
3. Create `CalorieDoughnut.svelte` — most complex (Chart.js integration)
4. Create `DateNav.svelte` — URL param navigation
5. Create `MacroSummary.svelte` — simple badge display
6. Create `MealCard.svelte` — single meal display
7. Create `MealList.svelte` — list wrapper with empty state
8. Create `+page.server.ts` — server load function
9. Modify `+page.svelte` — compose all components
10. Run typecheck → lint → tests (fail fast)
11. Verify with browser automation

---

## File Specifications

### 1. `src/lib/components/DateNav.svelte` (NEW)

Date navigation bar with left/right arrow buttons and formatted date display.

```
Props:
  date: string (YYYY-MM-DD)

Behavior:
  - Displays formatted date (e.g., "April 14, 2026")
  - Left arrow: navigates to previous day (?date=YYYY-MM-DD)
  - Right arrow: navigates to next day, capped at today
  - Uses goto() from $app/navigation to update URL search params
  - Date changes trigger full server load (fresh data via URL change)

Styling:
  - shadcn Button (variant="ghost", size="icon") for arrows
  - Centered date text with font-medium
  - Compact height, fits within layout

Edge cases:
  - Right arrow disabled (or hidden) when date === today
  - Date validation: YYYY-MM-DD format only
```

### 2. `src/lib/components/CalorieDoughnut.svelte` (NEW)

Chart.js doughnut chart showing calories eaten vs remaining.

```
Props:
  eaten: number
  goal: number

Chart.js integration:
  - Import: Chart, DoughnutController, ArcElement, Tooltip, Legend from 'chart.js'
  - Register once at module level: Chart.register(DoughnutController, ArcElement, Tooltip, Legend)
  - $effect creates chart, returns cleanup function (chart.destroy())
  - $effect is browser-only — no SSR issues
  - MUST use $state.snapshot() before passing data/options to Chart.js
    (Svelte 5 deep reactive proxies break Chart.js internals)

Center text plugin (inline):
  - id: 'centerText'
  - beforeDraw hook renders:
    - Main text: calories eaten number (bold, large)
    - Subtext: "of X kcal" or "X over" when over budget
  - Reads from options.plugins.centerText.text and .subtext

Chart configuration:
  type: 'doughnut'
  data:
    - Over budget: single segment [eaten], color ['#ef4444'] (red)
    - Under budget: two segments [eaten, remaining], colors ['#22c55e', '#e5e7eb']
    - borderWidth: 0
  options:
    responsive: true
    maintainAspectRatio: true
    cutout: '75%'
    animation: { animateRotate: true, animateScale: false }
    plugins:
      legend: { display: false }
      tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${ctx.parsed} kcal` } }
      centerText: { text: `${eaten}`, subtext: computed based on remaining/over }

Container sizing (mobile-first):
  <div class="mx-auto w-48 h-48 sm:w-56 sm:h-56">
    <canvas bind:this={canvas}></canvas>
  </div>
```

### 3. `src/lib/components/MacroSummary.svelte` (NEW)

Horizontal bar showing protein, carbs, fat totals.

```
Props:
  protein: number
  carbs: number
  fat: number

Styling:
  - Three shadcn Badge components in a row with justify-around
  - Badge variant="secondary"
  - Format: "P: 120g", "C: 180g", "F: 55g"
  - Compact spacing, sits below the doughnut chart
```

### 4. `src/lib/components/MealList.svelte` (NEW)

Scrollable list of MealCard components with empty-state fallback.

```
Props:
  meals: Array<{
    id: string
    description: string
    calories: number
    protein: number
    carbs: number
    fat: number
    source: string
  }>

Behavior:
  - If meals.length === 0: show empty state
  - If meals.length > 0: render MealCard for each meal

Empty state:
  - Centered text: "No meals logged yet"
  - Subtle muted text color (text-muted-foreground)
  - Small icon or unicode character (e.g., a plate icon)

Styling:
  - Scrollable container with flex-1 (fills remaining space)
  - Vertical stack of MealCards with gap-3
  - Section header "Meals" above the list
```

### 5. `src/lib/components/MealCard.svelte` (NEW)

Individual meal display card.

```
Props:
  description: string
  calories: number
  protein: number
  carbs: number
  fat: number
  source: string

Layout (compact):
  ┌─────────────────────────┐
  │ Chicken & Rice    450   │
  │ P: 35g  C: 45g  F: 18g │
  └─────────────────────────┘

  - Top row: description (left, font-medium) + calories (right, font-semibold)
  - Bottom row: three small Badge components for macros
  - shadcn Card.Content wrapper with py-3 px-4

Note: Tap-to-edit/delete is Step 6/13 scope — purely visual for now.
```

### 6. `src/routes/+page.server.ts` (NEW)

Server load function — runs on server only, fetches data before page renders.

```
Imports:
  type PageServerLoad from './$types'
  db, meal, userSettings from '$lib/server/db'
  { eq, and } from 'drizzle-orm'
  { DEFAULT_CALORIE_GOAL } from '$lib/server/db/shared/constants'

Function signature:
  export const load: PageServerLoad = async ({ url, locals }) => {

Flow:
  1. Validate locals.user exists (should always be true — auth guard redirects)
  2. Extract date from url.searchParams.get('date')
  3. Validate date format (YYYY-MM-DD regex), default to today if missing/invalid
  4. Clamp date to not exceed today (no future dates)
  5. Query meals:
     db.select().from(meal)
       .where(and(eq(meal.userId, locals.user.id), eq(meal.date, date)))
  6. Query settings:
     db.select({ dailyCalorieGoal: userSettings.dailyCalorieGoal })
       .from(userSettings)
       .where(eq(userSettings.userId, locals.user.id))
       .limit(1)
  7. Return {
       meals: result rows (empty array if none),
       date: validated date string,
       dailyCalorieGoal: settings?.dailyCalorieGoal ?? DEFAULT_CALORIE_GOAL
     }

Return type inferred by SvelteKit — becomes data prop in +page.svelte.
```

### 7. `src/routes/+page.svelte` (MODIFY)

Replace SvelteKit placeholder with day view composing all components.

```
Imports:
  DateNav, CalorieDoughnut, MacroSummary, MealList from '$lib/components/'

Props:
  let { data } = $props()
  // data.meals, data.date, data.dailyCalorieGoal from server load

Computed values:
  totals = $derived({
    calories: data.meals.reduce((sum, m) => sum + m.calories, 0),
    protein: data.meals.reduce((sum, m) => sum + m.protein, 0),
    carbs: data.meals.reduce((sum, m) => sum + m.carbs, 0),
    fat: data.meals.reduce((sum, m) => sum + m.fat, 0),
  })

Layout (matches PLAN.md mockup):
  <DateNav date={data.date} />

  <div class="flex justify-center py-4">
    <CalorieDoughnut eaten={totals.calories} goal={data.dailyCalorieGoal} />
  </div>

  <MacroSummary protein={totals.protein} carbs={totals.carbs} fat={totals.fat} />

  <MealList meals={data.meals} />

  <svelte:head>
    <title>{formatted date} — CalorieTracker</title>
  </svelte:head>
```

---

## Component Hierarchy

```
+page.svelte
├── DateNav
│   └── Button (left arrow)
│   └── <span> formatted date
│   └── Button (right arrow)
├── CalorieDoughnut
│   └── <canvas> (Chart.js)
├── MacroSummary
│   └── Badge × 3 (P/C/F)
└── MealList
    ├── empty state (when no meals)
    └── MealCard × N (when meals exist)
        └── description + calories row
        └── Badge × 3 (macros)
```

---

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| `layout.css` overwritten by shadcn init | Verify auth page + layout render correctly after init |
| Chart.js SSR issues | `$effect` is browser-only by spec; no dynamic imports needed |
| Svelte 5 reactive proxies break Chart.js | Use `$state.snapshot()` before passing data to Chart constructor |
| Date navigation creates full page reloads | Using `goto()` with search params triggers SvelteKit client-side navigation — only the server load re-runs, not a full reload |
| Empty `src/lib/components/` dir not yet created | shadcn init creates `src/lib/components/ui/`; custom components go in `src/lib/components/` directly |

---

## Verification

### After shadcn-svelte init

1. `pnpm dev` — verify `/auth` renders (form inputs, toggle, buttons)
2. Sign in — verify layout header shows with email and sign-out button
3. Navigate to `/` — verify SvelteKit placeholder still shows (no regression)

### After component implementation

1. Navigate to `/` while authenticated — verify day view renders:
   - DateNav shows today's date with arrows
   - CalorieDoughnut shows "0 / 2000" (empty day)
   - MacroSummary shows "P: 0g / C: 0g / F: 0g"
   - MealList shows empty state "No meals logged yet"
2. Click left arrow — date changes, URL updates, server load re-runs
3. Click right arrow — navigates forward, disabled at today
4. Check browser console — no Chart.js errors, no SSR warnings
5. Mobile viewport — responsive layout, doughnut scales correctly
6. Run `pnpm lint` + `pnpm check` — no errors

### After full implementation

Use browser-automation skill to verify the complete day view renders and
navigates correctly.

---

## Success Criteria

- [ ] shadcn-svelte initialized with card, button, badge components
- [ ] Existing pages (auth, layout) still render without regressions
- [ ] `CalorieDoughnut.svelte` renders doughnut with center text, responds to prop changes
- [ ] `DateNav.svelte` navigates between days via URL search params
- [ ] `MacroSummary.svelte` displays protein/carbs/fat totals as badges
- [ ] `MealList.svelte` shows empty state when no meals
- [ ] `MealCard.svelte` displays meal description, calories, and macros
- [ ] `+page.server.ts` loads meals and settings from database
- [ ] `+page.svelte` composes all components into the day view layout
- [ ] Typecheck and lint pass
- [ ] Browser automation verification passes
