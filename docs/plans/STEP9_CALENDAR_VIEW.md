# Step 9 — Calendar View: Month Grid + List Tabs, Navigate to Day

> Detailed implementation plan for the calendar page with two views (grid and list), month navigation with 3-month prefetch, and integration with the existing day view.

## Summary

Build a `/calendar` route with two tabs (Grid and List), plus a calendar icon in the header. The **Grid tab** shows a month calendar with per-day calorie totals, allowing month navigation. The **List tab** shows a scrollable 30-day summary with date, calories, and macros. Tapping any day navigates to `/?date=YYYY-MM-DD`.

---

## Parallelism with Step 10 (Docker + Local Dev)

Steps 9 and 10 can proceed **in parallel** with no conflicts:

| Concern | Step 9 owns | Step 10 owns | Overlap |
|---|---|---|---|
| New route + components | `src/routes/calendar/`, `CalendarGrid.svelte`, `CalendarList.svelte` | — | None |
| Date utilities | `src/lib/utils/date.ts` | — | None |
| Layout header | One icon link addition | — | Minimal (single `<a>` tag) |
| Types | `src/lib/types.ts` (add `DaySummary`) | — | None |
| shadcn Tabs | `src/lib/components/ui/tabs/` | — | None |
| Docker/infra | — | Dockerfile, docker-compose, .dockerignore | None |
| `.env` files | — | May touch `.env.example` | Different vars |

**Rule:** Step 9 does not touch Docker, infra, or deployment files. Step 10 does not touch routes, components, or UI code.

---

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Calendar library | Custom grid | No mature Svelte 5 calendar lib; simple enough to build (~80 lines) |
| Date utilities | Extend existing `src/lib/utils/date.ts` | Consistent with codebase, no new deps, YYYY-MM-DD strings used everywhere |
| Tabs | Install shadcn-svelte `tabs` component | Already using shadcn-svelte, one CLI command |
| Calendar nav button | Header icon (next to Settings) | User preference; visible on every authenticated page |
| Grid data scope | 3-month prefetch (prev + current + next) | User preference; seamless month navigation without loading states |
| List data range | Last 30 days from today | User preference; covers most review use cases |
| Data loading | Server-side via `+page.server.ts` with SQL `GROUP BY date` | Consistent with existing pattern (day view loads server-side, no API endpoint) |
| Navigation to day | `goto('/?date=YYYY-MM-DD')` | Reuses existing day view + DateNav |
| Empty cells | Show prev/next month days (dimmed) | Standard calendar UX; gives visual context for month boundaries |
| Future dates | Not clickable in grid, not shown in list | Matches day view's "no future dates" rule |

---

## API/Data Loading

No new API endpoints. The calendar page loads all data server-side via `+page.server.ts`, consistent with the existing day view pattern.

### Aggregation Query

```sql
SELECT date,
       SUM(calories) as calories,
       SUM(protein)  as protein,
       SUM(carbs)    as carbs,
       SUM(fat)      as fat
FROM   meal
WHERE  userId = ?
  AND  date BETWEEN ? AND ?
GROUP BY date
ORDER BY date
```

Two queries in the server load:
1. **Grid data** — 3-month range (prev month 1st → next month last day)
2. **List data** — last 30 days from today (can reuse grid data if within range, otherwise separate query)

The `(userId, date)` composite index on the meal table supports efficient range queries.

---

## Files to Create/Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `src/lib/utils/date.ts` | **MODIFY** | Add `addMonths`, `getDaysInMonth`, `getFirstDayOfWeek`, `toDateString`, `formatMonthYear`, `startOfMonth`, `endOfMonth` |
| 2 | `src/lib/components/ui/tabs/` | **CREATE** | shadcn-svelte Tabs component (via CLI `npx shadcn-svelte@latest add tabs`) |
| 3 | `src/lib/types.ts` | **MODIFY** | Add `DaySummary` interface |
| 4 | `src/lib/components/CalendarGrid.svelte` | **CREATE** | Month grid with per-day calorie totals, month navigation |
| 5 | `src/lib/components/CalendarList.svelte` | **CREATE** | Scrollable 30-day summary cards |
| 6 | `src/routes/calendar/+page.server.ts` | **CREATE** | Load aggregated day summaries for grid + list |
| 7 | `src/routes/calendar/+page.svelte` | **CREATE** | Calendar page with Grid/List tabs |
| 8 | `src/routes/+layout.svelte` | **MODIFY** | Add `CalendarDays` icon link in header |

---

## Implementation Order

### Phase 1: Prerequisites (new deps + utility extensions)

1. Install shadcn-svelte Tabs: `npx shadcn-svelte@latest add tabs`
2. Extend `src/lib/utils/date.ts` — add calendar helper functions
3. Add `DaySummary` type to `src/lib/types.ts`

### Phase 2: Components (new files only)

4. Create `src/lib/components/CalendarGrid.svelte`
5. Create `src/lib/components/CalendarList.svelte`

### Phase 3: Route + Data Loading

6. Create `src/routes/calendar/+page.server.ts`
7. Create `src/routes/calendar/+page.svelte`

### Phase 4: Navigation Integration (shared file — minimal change)

8. Update `src/routes/+layout.svelte` — add calendar icon link in header

### Phase 5: Verify

9. Typecheck (`pnpm check`) → lint (`pnpm lint`) → tests (`pnpm test`)
10. Browser automation verification

---

## File Specifications

### 1. `src/lib/utils/date.ts` (MODIFY)

Add these functions:

```
addMonths(d: string, months: number): string
  - Parse YYYY-MM-DD, construct Date(year, month - 1 + months, day)
  - Format back to YYYY-MM-DD
  - Date constructor handles month overflow correctly

getDaysInMonth(year: number, month: number): number
  - new Date(year, month, 0).getDate() (month is 1-indexed)
  - e.g. getDaysInMonth(2026, 2) → 28

getFirstDayOfWeek(year: number, month: number): number
  - new Date(year, month - 1, 1).getDay()
  - Returns 0=Sunday through 6=Saturday

toDateString(year: number, month: number, day: number): string
  - `${year}-${pad(month)}-${pad(day)}`
  - Zero-pad month and day to 2 digits

formatMonthYear(monthStr: string): string
  - Input: "2026-04"
  - Output: "April 2026"
  - Use toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

startOfMonth(d: string): string
  - d.slice(0, 7) + '-01'

endOfMonth(d: string): string
  - Parse year/month from d
  - toDateString(year, month, getDaysInMonth(year, month))
```

### 2. `src/lib/components/ui/tabs/` (CREATE via CLI)

```bash
npx shadcn-svelte@latest add tabs
```

Generates `Tabs.Root`, `Tabs.List`, `Tabs.Trigger`, `Tabs.Content`.

### 3. `src/lib/types.ts` (MODIFY)

Add after existing interfaces:

```typescript
export interface DaySummary {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}
```

### 4. `src/lib/components/CalendarGrid.svelte` (NEW)

```
Imports:
  goto from '$app/navigation'
  Button from '$lib/components/ui/button'
  addMonths, getDaysInMonth, getFirstDayOfWeek, toDateString,
    today, formatMonthYear from '$lib/utils/date'
  type DaySummary from '$lib/types'

Props:
  currentMonth: string                          // "2026-04"
  daySummaries: Record<string, DaySummary>      // keyed by YYYY-MM-DD
  dailyCalorieGoal: number
  onPrevMonth: () => void
  onNextMonth: () => void

Constants:
  WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

Derived:
  todayStr = today()

  calendarDays = $derived.by(() => {
    const [year, month] = currentMonth.split('-').map(Number)
    const daysInMonth = getDaysInMonth(year, month)
    const firstDay = getFirstDayOfWeek(year, month)

    // Previous month padding
    const prevMonth = month === 1 ? 12 : month - 1
    const prevYear = month === 1 ? year - 1 : year
    const daysInPrevMonth = getDaysInMonth(prevYear, prevMonth)

    const days: { date: string; day: number; isCurrentMonth: boolean }[] = []

    for (let i = firstDay - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i
      days.push({ date: toDateString(prevYear, prevMonth, day), day, isCurrentMonth: false })
    }

    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ date: toDateString(year, month, d), day: d, isCurrentMonth: true })
    }

    // Trailing padding to complete last row
    const remainder = days.length % 7
    if (remainder > 0) {
      const nextMonth = month === 12 ? 1 : month + 1
      const nextYear = month === 12 ? year + 1 : year
      for (let d = 1; d <= 7 - remainder; d++) {
        days.push({ date: toDateString(nextYear, nextMonth, d), day: d, isCurrentMonth: false })
      }
    }

    return days
  })

Template:
  <div> container
    <!-- Month header -->
    <div class="flex items-center justify-between py-2 mb-2">
      <Button variant="ghost" size="icon" onclick={onPrevMonth}>◀</Button>
      <span class="font-medium text-sm">{formatMonthYear(currentMonth)}</span>
      <Button variant="ghost" size="icon" onclick={onNextMonth} disabled={isFutureMonth}>▶</Button>
    </div>

    <!-- Grid -->
    <div class="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
      <!-- Weekday headers -->
      {#each WEEKDAYS as day}
        <div class="bg-muted py-2 text-center text-xs font-medium text-muted-foreground">
          {day}
        </div>
      {/each}

      <!-- Day cells -->
      {#each calendarDays as cell}
        <button
          class="bg-background p-2 min-h-[64px] text-left relative
                 {!cell.isCurrentMonth ? 'opacity-40' : ''}
                 {cell.date === todayStr ? 'ring-2 ring-primary rounded-sm' : ''}"
          onclick={() => goto(`/?date=${cell.date}`)}
          disabled={cell.date > todayStr}
        >
          <span class="text-xs font-medium">{cell.day}</span>
          {#if daySummaries[cell.date]}
            <span class="block text-xs text-muted-foreground mt-1">
              {daySummaries[cell.date].calories}
            </span>
          {/if}
        </button>
      {/each}
    </div>
  </div>
```

### 5. `src/lib/components/CalendarList.svelte` (NEW)

```
Imports:
  goto from '$app/navigation'
  formatDate from '$lib/utils/date'
  type DaySummary from '$lib/types'

Props:
  days: DaySummary[]
  dailyCalorieGoal: number

Template:
  <div class="divide-y divide-border">
    {#each days as day (day.date)}
      <button
        class="flex w-full items-center justify-between px-4 py-3 text-left
               hover:bg-muted/50 transition-colors"
        onclick={() => goto(`/?date=${day.date}`)}
      >
        <div class="flex-1">
          <p class="text-sm font-medium">{formatDate(day.date)}</p>
          <p class="text-xs text-muted-foreground">
            P: {day.protein}g · C: {day.carbs}g · F: {day.fat}g
          </p>
        </div>
        <div class="text-right">
          <p class="text-sm font-semibold">{day.calories}</p>
          <p class="text-xs text-muted-foreground">/ {dailyCalorieGoal}</p>
        </div>
      </button>
    {:else}
      <div class="py-8 text-center text-sm text-muted-foreground">
        No meals logged yet
      </div>
    {/each}
  </div>
```

### 6. `src/routes/calendar/+page.server.ts` (NEW)

```
Imports:
  { and, between, desc, eq, sql } from 'drizzle-orm'
  { db } from '$lib/server/db'
  { meal, userSettings } from '$lib/server/db/schema'
  { DEFAULT_CALORIE_GOAL } from '$lib/server/db/shared/constants'
  type { DaySummary } from '$lib/types'
  { addMonths, endOfMonth, isValidDate, startOfMonth, today } from '$lib/utils/date'
  type { PageServerLoad } from './$types'

Constants:
  MONTH_RE = /^\d{4}-\d{2}$/

Helper:
  parseDaySummaryRows(rows): Record<string, DaySummary>
    - Convert array of { date, calories, ... } to Record keyed by date
    - Cast SUM results to Number (SQLite returns strings for aggregates)

Load function:
  export const load: PageServerLoad = async ({ url, locals }) => {
    const user = locals.user
    if (!user) return { gridData: {}, listData: [], currentMonth: today().slice(0, 7), dailyCalorieGoal: DEFAULT_CALORIE_GOAL }

    // Parse ?month= param (YYYY-MM format, defaults to current month)
    const raw = url.searchParams.get('month')
    const currentMonth = raw && MONTH_RE.test(raw) ? raw : today().slice(0, 7)
    // Prevent future months
    const maxMonth = today().slice(0, 7)
    const effectiveMonth = currentMonth > maxMonth ? maxMonth : currentMonth

    // 3-month range for grid: prev month start → next month end
    const gridStart = startOfMonth(addMonths(effectiveMonth + '-01', -1))
    const gridEnd = endOfMonth(addMonths(effectiveMonth + '-01', 1))

    // List range: 30 days ago → today
    const listEnd = today()
    const listStart = addDays(listEnd, -29)

    // Queries
    const [gridRows, listRows, settingsResult] = await Promise.all([
      db.select({
        date: meal.date,
        calories: sql<number>`cast(sum(${meal.calories}) as integer)`,
        protein: sql<number>`cast(sum(${meal.protein}) as integer)`,
        carbs: sql<number>`cast(sum(${meal.carbs}) as integer)`,
        fat: sql<number>`cast(sum(${meal.fat}) as integer)`
      })
        .from(meal)
        .where(and(eq(meal.userId, user.id), between(meal.date, gridStart, gridEnd)))
        .groupBy(meal.date)
        .orderBy(meal.date),

      db.select({
        date: meal.date,
        calories: sql<number>`cast(sum(${meal.calories}) as integer)`,
        protein: sql<number>`cast(sum(${meal.protein}) as integer)`,
        carbs: sql<number>`cast(sum(${meal.carbs}) as integer)`,
        fat: sql<number>`cast(sum(${meal.fat}) as integer)`
      })
        .from(meal)
        .where(and(eq(meal.userId, user.id), between(meal.date, listStart, listEnd)))
        .groupBy(meal.date)
        .orderBy(desc(meal.date)),

      db.select({ dailyCalorieGoal: userSettings.dailyCalorieGoal })
        .from(userSettings)
        .where(eq(userSettings.userId, user.id))
        .limit(1)
    ])

    return {
      gridData: parseDaySummaryRows(gridRows),
      listData: listRows as DaySummary[],
      currentMonth: effectiveMonth,
      dailyCalorieGoal: settingsResult[0]?.dailyCalorieGoal ?? DEFAULT_CALORIE_GOAL
    }
  }
```

**Note on SQLite aggregate types:** SQLite returns strings for `SUM()`. Use `cast(sum(...) as integer)` in SQL to get proper integers. If that's insufficient, wrap with `Number()` in `parseDaySummaryRows`.

### 7. `src/routes/calendar/+page.svelte` (NEW)

```
Imports:
  { invalidateAll } from '$app/navigation'
  * as Tabs from '$lib/components/ui/tabs'
  CalendarGrid from '$lib/components/CalendarGrid.svelte'
  CalendarList from '$lib/components/CalendarList.svelte'
  { addMonths } from '$lib/utils/date'
  type PageData from './$types'

Props:
  let { data }: { data: PageData } = $props()

State:
  let activeTab = $state('grid')
  let currentMonth = $state(data.currentMonth)

Effects:
  $effect(() => { currentMonth = data.currentMonth })

Derived:
  todayMonth = today().slice(0, 7)
  isFutureMonth = currentMonth >= todayMonth

Handlers:
  function handlePrevMonth() {
    currentMonth = addMonths(currentMonth + '-01', -1).slice(0, 7)
    goto(`?month=${currentMonth}`)  // triggers server load
  }

  function handleNextMonth() {
    const next = addMonths(currentMonth + '-01', 1).slice(0, 7)
    if (next > todayMonth) return
    currentMonth = next
    goto(`?month=${currentMonth}`)
  }

Template:
  <svelte:head>
    <title>Calendar — CalorieTracker</title>
  </svelte:head>

  <!-- Back link -->
  <div class="mb-4">
    <a href="/" class="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
      ← Back to today
    </a>
  </div>

  <Tabs.Root bind:value={activeTab}>
    <Tabs.List class="mb-4">
      <Tabs.Trigger value="grid">Grid</Tabs.Trigger>
      <Tabs.Trigger value="list">List</Tabs.Trigger>
    </Tabs.List>

    <Tabs.Content value="grid">
      <CalendarGrid
        {currentMonth}
        daySummaries={data.gridData}
        dailyCalorieGoal={data.dailyCalorieGoal}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
      />
    </Tabs.Content>

    <Tabs.Content value="list">
      <CalendarList
        days={data.listData}
        dailyCalorieGoal={data.dailyCalorieGoal}
      />
    </Tabs.Content>
  </Tabs.Root>
```

### 8. `src/routes/+layout.svelte` (MODIFY)

Add calendar icon link in header, between the app name and the Settings icon:

```
Import:
  CalendarDays from '@lucide/svelte'    (add to existing lucide import)

In the header <div class="flex items-center gap-3">:
  Add before the Settings <a>:
    <a href="/calendar"
       class="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
       aria-label="Calendar">
      <CalendarDays size={18} />
    </a>
```

---

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| SQLite `SUM()` returns strings | Use `cast(sum(...) as integer)` in SQL; wrap with `Number()` if needed |
| 3-month prefetch payload size | Max ~90 aggregated rows; negligible payload |
| shadcn-svelte Tabs API changes | Verify with Context7 before implementation; simple fallback: button-based toggle |
| Merge conflict with step 10 on `+layout.svelte` | Step 10 unlikely to touch layout; conflict is one icon link — trivial to resolve |
| Future month navigation shows empty data | Disabled next button when current month is current/future |
| Day view `?date=` param already used | Calendar navigates via `?month=` param on `/calendar`; day navigation uses `?date=` on `/` — no conflict |

---

## Verification

### Automated

1. **Typecheck:** `pnpm check` — no errors
2. **Lint:** `pnpm lint` — no errors
3. **Tests:** `pnpm test` — all pass

### Browser Automation

Use `browser-automation` skill with a running dev server:

- Navigate to `/calendar` while authenticated
- **Grid tab:**
  - Verify current month header renders (e.g. "April 2026")
  - Verify weekday row: Su Mo Tu We Th Fr Sa
  - Verify today's cell has ring highlight
  - Verify prev/next month padding days are dimmed (opacity-40)
  - Verify days with meals show calorie count
  - Click prev month — verify month changes, data from prefetch loads
  - Click next month — verify month changes back
  - Verify next month button disabled when at current month
  - Click a day cell — verify navigation to `/?date=YYYY-MM-DD`
  - Verify day view shows correct date and meals
- **List tab:**
  - Switch to List tab
  - Verify shows last 30 days (most recent first)
  - Each row shows date, calories/goal, macros
  - Click a row — verify navigation to day view
  - Empty state shows "No meals logged yet" when no data
- **Header navigation:**
  - From day view `/`, click calendar icon in header
  - Verify navigation to `/calendar`
  - Click "← Back to today" — verify return to day view
- **Mobile viewport:** set viewport to 375×812 (iPhone)
  - Verify grid cells are tappable (min-h-[64px])
  - Verify list rows are tappable (py-3 ≥ 44px)
  - Verify no horizontal scroll
  - Verify tabs are accessible

---

## Success Criteria

- [ ] `/calendar` route renders with Grid and List tabs
- [ ] Grid tab shows month calendar with calorie totals per day
- [ ] Grid shows prev/next month padding days (dimmed)
- [ ] Grid highlights today's cell
- [ ] Month navigation (prev/next) works with 3-month prefetch
- [ ] Future months are blocked (next button disabled)
- [ ] List tab shows 30-day summary with date, calories, macros (most recent first)
- [ ] Tapping any day navigates to `/?date=YYYY-MM-DD`
- [ ] Calendar icon in header navigates to `/calendar`
- [ ] "Back to today" link returns to day view
- [ ] Mobile-friendly (tap targets ≥44px, no horizontal scroll)
- [ ] Typecheck passes (`pnpm check`)
- [ ] Lint passes (`pnpm lint`)
- [ ] Tests pass (`pnpm test`)
- [ ] No conflicts with step 10 (Docker + local dev)
- [ ] PLAN.md updated with step 9 checked off
- [ ] STAGE9_IMPLEMENTATION.md written
