# Step 17: AI Goal Estimation & Account Management

## Summary

Add user profile inputs (age, weight, height, activity level, goal) to Settings, with an "Estimate with AI" button that sends profile data to `POST /api/ai/estimate-goals` and pre-fills the Goals section with AI-estimated kcal/macro targets. Add a "Delete account" feature with confirmation dialog that cascades through all user data (meals, settings, images, auth) and redirects to the auth page.

## Design Decisions

### 1. Profile fields stored in `userSettings` table (not a new table)

Profile fields (`age`, `weight`, `height`, `activityLevel`, `goal`) are 1:1 with the user and only used for goal estimation. Adding columns to the existing `userSettings` table avoids a JOIN and keeps the schema simple.

### 2. Activity level and goal as text enums

Use text fields with validated enum values rather than integers. This keeps the AI prompt readable and the UI straightforward. Activity levels: `sedentary`, `light`, `moderate`, `active`, `very_active`. Goals: `lose`, `maintain`, `gain`.

### 3. AI estimation reuses existing AI SDK pattern

The estimate endpoint follows the same `createOpenAI` + `generateText` + `Output.object({ schema })` pattern as `/api/ai/analyze`. Uses a dedicated system prompt for TDEE-based estimation.

### 4. Account deletion via custom API route (not BetterAuth's `/delete-user`)

BetterAuth provides `POST /api/auth/delete-user` but it only deletes auth records (user, session, account). We need to cascade through custom tables (meal, userSettings) and storage (encrypted images). A custom route `/api/account/delete` handles the full cleanup:

1. Delete all meal image files from storage (query meals with imageFilename, remove each)
2. Delete user's image directory (local) or prefix (azure)
3. Delete `meal` rows (cascade from user would handle this, but images need manual cleanup first)
4. Delete `userSettings` rows (cascade from user handles this too)
5. Call `auth.api.deleteUser()` to delete auth tables (session, account, user)
6. Sign out on the client and redirect to `/auth`

### 5. Confirmation dialog using custom Svelte 5 component

No AlertDialog component exists in shadcn-svelte yet. Build a simple confirmation dialog using `bits-ui` Dialog primitives (already a dependency via shadcn-svelte), styled consistently with the existing vega theme.

### 6. "Estimate with AI" button placed in Goals section

A button at the top of the Goals section in Settings. When clicked, it sends profile data to the AI endpoint. On success, the goal fields are populated with the AI estimates. The user still needs to click "Save Settings" to persist.

## API/Data Spec

### Schema Changes

New columns on `userSettings` (both SQLite and PG schemas):

| Column | SQLite Type | PG Type | Default | Notes |
|---|---|---|---|---|
| `age` | `integer` | `integer` | `null` | Years |
| `weight` | `integer` | `integer` | `null` | kg |
| `height` | `integer` | `integer` | `null` | cm |
| `activityLevel` | `text` | `text` | `null` | `sedentary` \| `light` \| `moderate` \| `active` \| `very_active` |
| `goal` | `text` | `text` | `null` | `lose` \| `maintain` \| `gain` |

### New Route: `POST /api/ai/estimate-goals`

**Request:**
```json
{
  "age": 30,
  "weight": 75,
  "height": 180,
  "activityLevel": "moderate",
  "goal": "lose"
}
```

**Response (success):**
```json
{
  "calories": 2100,
  "protein": 160,
  "carbs": 230,
  "fat": 60,
  "explanation": "Based on your profile..."
}
```

**Response (error):**
```json
{ "error": "AI not configured. Go to Settings to configure." }
```

**Validation:** All fields required. Age: 10-120, Weight: 20-500, Height: 50-300, activityLevel and goal must match enum values.

### New Route: `POST /api/account/delete`

**Request:** No body required (user identified by session).

**Response:** `200 OK` with `{ "success": true }` or error.

### Modified Route: `PUT /api/settings`

Add optional fields: `age`, `weight`, `height`, `activityLevel`, `goal`.

### Modified Route: `GET /api/settings`

Return new fields in response.

### Storage Provider Extension

Add `removeAll(userId: string): Promise<void>` to `StorageProvider` interface to delete all images for a user:
- **Local**: `rm -rf data/images/{userId}/` directory
- **Azure**: Delete all blobs with prefix `{userId}/`

## Files to Create or Modify

| File | Action | Purpose |
|---|---|---|
| `src/lib/server/db/sqlite/schema.ts` | Modify | Add profile columns to `userSettings` |
| `src/lib/server/db/pg/schema.ts` | Modify | Add profile columns to `userSettings` |
| `src/routes/api/ai/estimate-goals/+server.ts` | Create | AI goal estimation endpoint |
| `src/routes/api/account/delete/+server.ts` | Create | Account deletion with cascade cleanup |
| `src/lib/server/storage/index.ts` | Modify | Add `removeAll` to `StorageProvider` interface |
| `src/lib/server/storage/local.ts` | Modify | Implement `removeAll` (delete user image directory) |
| `src/lib/server/storage/azure.ts` | Modify | Implement `removeAll` (delete all blobs with user prefix) |
| `src/routes/api/settings/+server.ts` | Modify | Handle new profile fields in GET/PUT |
| `src/routes/settings/+page.server.ts` | Modify | Return new profile fields in load |
| `src/routes/settings/+page.svelte` | Modify | Profile inputs, "Estimate with AI" button, delete account section, confirmation dialog |
| `messages/en.json` | Modify | New i18n strings |
| `messages/fi.json` | Modify | New i18n strings (Finnish translations) |
| `docs/SCHEMA.md` | Modify | Document new columns |
| `docs/PLAN.md` | Modify | Mark step 17 complete |

## Implementation Phases

### Phase 1: Schema migration

1. Add 5 new columns to `userSettings` in both `src/lib/server/db/sqlite/schema.ts` and `src/lib/server/db/pg/schema.ts`
2. Run `pnpm db:push` to apply to local SQLite
3. Update `docs/SCHEMA.md`

**Deliverable:** Schema builds, no type errors.

### Phase 2: Storage `removeAll` method

1. Add `removeAll(userId: string): Promise<void>` to `StorageProvider` interface in `src/lib/server/storage/index.ts`
2. Implement in `local.ts`: `rm -rf` the user's image directory using `fs.rm(path, { recursive: true, force: true })`
3. Implement in `azure.ts`: list all blobs with prefix `{userId}/`, delete each

**Deliverable:** Typecheck passes with new interface methods.

### Phase 3: Backend — Settings API + profile fields

1. Update `PUT /api/settings` to accept and validate new profile fields (`age`, `weight`, `height`, `activityLevel`, `goal`)
2. Update `GET /api/settings` to return new fields
3. Update `src/routes/settings/+page.server.ts` load function to return new fields
4. Add validation: age 10-120, weight 20-500, height 50-300, activityLevel/goal enum validation

**Deliverable:** Settings API accepts and returns profile fields.

### Phase 4: Backend — AI estimate-goals endpoint

1. Create `src/routes/api/ai/estimate-goals/+server.ts`
2. Reuse AI settings lookup pattern from `/api/ai/analyze`
3. Build system prompt for TDEE/macro estimation
4. Define zod output schema: `{ calories, protein, carbs, fat, explanation }`
5. Validate request body (all 5 profile fields required)
6. Return structured AI response

**Deliverable:** `POST /api/ai/estimate-goals` returns estimated macros.

### Phase 5: Backend — Account deletion endpoint

1. Create `src/routes/api/account/delete/+server.ts`
2. Query all meals for the user that have `imageFilename`
3. Remove each image from storage
4. Call `storage.removeAll(userId)` to clean up any remaining files
5. Delete meals, userSettings (or let cascade handle it)
6. Delete user record (which cascades to session, account via DB FK)
7. Return success response

**Deliverable:** `POST /api/account/delete` removes all user data.

### Phase 6: Frontend — Settings page UI

1. Add profile section above Goals section in Settings page
2. Add fields: Age (number), Weight in kg (number), Height in cm (number), Activity Level (native `<select>` with 5 options), Goal (native `<select>` with 3 options)
3. Add "Estimate with AI" button in Goals section header area
4. Wire button to call `POST /api/ai/estimate-goals` with profile data
5. On success, populate goal fields with AI response
6. Add "Delete account" button in Account section
7. Build inline confirmation dialog (using bits-ui Dialog primitives or simple conditional render with destructive styling)
8. Wire delete to `POST /api/account/delete`, then `authClient.signOut()` + redirect to `/auth`

**Deliverable:** Complete Settings page with profile, AI estimation, and account deletion.

### Phase 7: i18n strings

1. Add all new strings to `messages/en.json`
2. Add Finnish translations to `messages/fi.json`

**Deliverable:** All UI text uses i18n messages.

### Phase 8: Tests

1. Unit test for `POST /api/ai/estimate-goals` (mock `generateText`)
2. Unit test for `POST /api/account/delete` (cascade cleanup)
3. Unit test for `PUT /api/settings` with new profile fields

**Deliverable:** All tests pass.

### Phase 9: Documentation & verification

1. Update `docs/SCHEMA.md` with new columns
2. Update `docs/PLAN.md` — cross off step 17
3. Run `pnpm check` → `pnpm lint` → `pnpm test`
4. Browser verification: profile inputs, AI estimation, delete account flow

**Deliverable:** Clean typecheck, lint, tests, browser-verified.

## Verification Steps

1. `pnpm check` — no type errors
2. `pnpm lint` — no Biome violations
3. `pnpm test` — all tests pass
4. Browser: Settings page renders profile fields
5. Browser: Fill profile, click "Estimate with AI" → goals pre-fill
6. Browser: Save settings → reload → profile + goals persisted
7. Browser: Delete account → confirmation dialog → account removed → redirected to `/auth`
8. Browser: Verify deleted user cannot sign in

## Success Criteria

- [ ] User can enter age, weight, height, activity level, and goal in Settings
- [ ] "Estimate with AI" button calls the endpoint and pre-fills goal fields
- [ ] Goal fields are still manually editable after AI estimation
- [ ] Profile and goals persist across page reloads
- [ ] "Delete account" shows confirmation dialog
- [ ] Account deletion removes all user data: meals, settings, images, auth records
- [ ] After deletion, user is signed out and redirected to auth page
- [ ] All i18n strings present in English and Finnish
- [ ] `pnpm check`, `pnpm lint`, `pnpm test` all pass

## i18n Strings

### New strings to add

```
settings_profile=Profile
settings_age=Age
settings_age_placeholder=30
settings_weight=Weight (kg)
settings_weight_placeholder=75
settings_height=Height (cm)
settings_height_placeholder=180
settings_activity_level=Activity Level
settings_activity_sedentary=Sedentary
settings_activity_light=Light
settings_activity_moderate=Moderate
settings_activity_active=Active
settings_activity_very_active=Very Active
settings_goal=Goal
settings_goal_lose=Lose weight
settings_goal_maintain=Maintain weight
settings_goal_gain=Gain weight
settings_estimate_goals=Estimate with AI
settings_estimating=Estimating...
settings_estimate_hint=Fill in your profile above, then let AI estimate your daily targets.
settings_estimate_not_configured=Configure AI in the section above first.
settings_estimate_failed=AI estimation failed. Check your AI configuration.
settings_delete_account=Delete Account
settings_delete_account_desc=Permanently delete your account and all data. This cannot be undone.
settings_delete_account_confirm=Yes, delete my account
settings_delete_account_cancel=Cancel
settings_delete_account_title=Delete Account?
settings_delete_account_warning=This will permanently delete your account, all meals, settings, and images. This action cannot be undone.
settings_deleting=Deleting...
error_delete_account=Failed to delete account
```

### Finnish translations

```
settings_profile=Profiili
settings_age=Ikä
settings_age_placeholder=30
settings_weight=Paino (kg)
settings_weight_placeholder=75
settings_height=Pituus (cm)
settings_height_placeholder=180
settings_activity_level=Aktiivisuustaso
settings_activity_sedentary=Istuma
settings_activity_light=Kevyt
settings_activity_moderate=Keskiverto
settings_activity_active=Aktiivinen
settings_activity_very_active=Erittäin aktiivinen
settings_goal=Tavoite
settings_goal_lose=Painonpudotus
settings_goal_maintain=Painon ylläpito
settings_goal_gain=Painon kasvatus
settings_estimate_goals=Arvioi tekoälyllä
settings_estimating=Arvioidaan...
settings_estimate_hint=Täytä profiilisi yllä ja anna tekoälyn arvioida päivittäiset tavoitteesi.
settings_estimate_not_configured=Määritä tekoäly ensin yllä olevassa osiossa.
settings_estimate_failed=Tekoälyarvio epäonnistui. Tarkista tekoälyn asetukset.
settings_delete_account=Poista tili
settings_delete_account_desc=Poista tilisi ja kaikki tiedot pysyvästi. Tätä ei voi perua.
settings_delete_account_confirm=Kyllä, poista tilini
settings_delete_account_cancel=Peruuta
settings_delete_account_title=Poista tili?
settings_delete_account_warning=Tämä poistaa tilisi, kaikki ateriat, asetukset ja kuvat pysyvästi. Tätä toimintoa ei voi perua.
settings_deleting=Poistetaan...
error_delete_account=Tilin poisto epäonnistui
```

## Open Questions

None — the design is straightforward, reuses existing patterns throughout.
