# Step 3: Auth — Implementation Log

**Date:** 2026-04-12
**Status:** Complete

## What was done

### 1. BetterAuth client module

Created `src/lib/auth-client.ts` using `createAuthClient` from `better-auth/svelte`. Exports `authClient` (for direct API calls like `signOut`) and `useSession` (nanostore Atom for reactive session state in components).

### 2. Root layout server load

Created `src/routes/+layout.server.ts` — passes `{ user, session }` from `event.locals` into page data. Returns `null` for both when unauthenticated. All child routes/components receive auth state via `$props().data`.

Created `src/routes/+layout.ts` — universal load that forwards server data to the page.

### 3. Auth page (sign-in/sign-up)

`src/routes/auth/+page.server.ts`:

- `load`: redirects authenticated users to `/`
- `actions.signIn`: calls `auth.api.signInEmail`, returns validation errors via `fail()`, redirects to `/` on success
- `actions.signUp`: calls `auth.api.signUpEmail`, same error handling pattern

`src/routes/auth/+page.svelte`:

- Single page with toggle between sign-in and sign-up modes
- Sign-in: email + password fields
- Sign-up: name + email + password fields
- Error message display from form action failures
- Mobile-first styling with Tailwind (centered card, max-w-sm, pill toggle)

### 4. Auth guard middleware

Updated `src/hooks.server.ts` to use `sequence()` with two handlers:

**Handler 1 (handleBetterAuth):** Existing — session extraction + BetterAuth route handling via `svelteKitHandler`.

**Handler 2 (handleAuthGuard):** New — enforces authentication:

- `/api/auth/*` — passes through (BetterAuth internal routes)
- `/api/*` without session → 401 JSON response
- Page routes without session → 302 redirect to `/auth`
- `/auth` with session → 302 redirect to `/`
- Skips all checks during `building` (static build)

### 5. Root layout (authenticated shell)

Updated `src/routes/+layout.svelte`:

- When authenticated: renders header with "CalorieTracker" branding, user email, sign-out button + main content area (max-w-2xl, centered)
- Sign-out uses `authClient.signOut()` (client-side) then `window.location.href = '/'` (lets hooks redirect to `/auth`)
- When unauthenticated: renders children directly (no shell), so `/auth` page appears standalone

## Verification

| Check                                                         | Result               |
| ------------------------------------------------------------- | -------------------- |
| `pnpm run check` (typecheck)                                  | 0 errors, 0 warnings |
| `pnpm run lint` (prettier + eslint)                           | Pass                 |
| `pnpm run test` (all tests)                                   | 20/20 pass           |
| Browser: unauthenticated `/` redirects to `/auth`             | Pass                 |
| Browser: `/auth` renders sign-in/sign-up toggle               | Pass                 |
| Browser: sign-up creates account, redirects to `/`            | Pass                 |
| Browser: authenticated `/` shows header with email + sign-out | Pass                 |
| Browser: sign-out redirects to `/auth`                        | Pass                 |
| Browser: sign-in with created credentials redirects to `/`    | Pass                 |

## Design decisions

- **Client-side sign-out** — uses `authClient.signOut()` + `window.location.href` redirect instead of a server form action. Avoids needing a shared action route (SvelteKit actions are page-scoped).
- **`window.location.href` over `goto()`** — ESLint rule `svelte/no-navigation-without-resolve` flags `goto()` in event handlers. Full page navigation is fine for sign-out (clears all client state).
- **Single auth page with toggle** — avoids separate routes. Toggle is client-side state (`$state`), no URL change needed. Forms POST to distinct actions (`?/signIn`, `?/signUp`).
- **Google OAuth deferred** — will be added in a future step. Email/password only for now.
- **No auth guard on `/auth` load in hooks** — the hooks guard redirects authenticated users away from `/auth`, and the page server load also checks. Double coverage ensures no edge cases.

## Files created

```
src/lib/auth-client.ts
src/lib/server/constants.ts   # API_BASE, API_VERSION, AUTH_API_ROUTE, AUTH_PAGE_ROUTE
src/routes/+layout.server.ts
src/routes/+layout.ts
src/routes/auth/+page.server.ts
src/routes/auth/+page.svelte
```

## Files modified

```
src/hooks.server.ts          # Added handleAuthGuard via sequence(), uses route constants
src/routes/+layout.svelte    # Authenticated shell with header + sign-out
```
