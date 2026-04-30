# Stage 8 — Image Handling: Implementation Log

**Date:** 2026-04-30
**Status:** Complete

## What was done

### Phase 1: Infrastructure
- Added `@azure/storage-blob` dependency (dynamically imported when `STORAGE_PROVIDER=azure`)
- Created `src/lib/server/encryption.ts` — AES-256-GCM encrypt/decrypt with scrypt key derivation per user
- Created `src/lib/server/storage/index.ts` — `StorageProvider` interface + dynamic import factory (same pattern as DB)
- Created `src/lib/server/storage/local.ts` — Local encrypted filesystem storage at `data/images/{userId}/{uuid}.{ext}.enc`
- Created `src/lib/server/storage/azure.ts` — Azure Blob Storage backend
- Created `src/routes/api/images/upload/+server.ts` — POST with file type/size validation (JPEG/PNG/WebP, 5MB max)
- Created `src/routes/api/images/[filename]/+server.ts` — GET with ownership check via meal table query

### Phase 2: Integration
- Added `imageFilename` field to `Meal` interface in `src/lib/types.ts`
- Updated `src/routes/+page.server.ts` — select `imageFilename` from meals
- Updated `src/routes/api/meals/+server.ts` — accept optional `imageFilename` in create
- Updated `src/routes/api/meals/[id]/+server.ts` — handle image replacement, removal, and delete cleanup

### Phase 3: UI
- Updated `src/lib/components/MealCard.svelte` — 48x48 image thumbnail with lazy loading
- Updated `src/lib/components/MealList.svelte` — pass `imageFilename` to MealCard
- Updated `src/lib/components/ManualEntrySheet.svelte` — image upload UI with preview, change, remove
- Updated `src/routes/+page.svelte` — `uploadImage` helper, modified submit handlers for image flow

### Phase 4: Verification
- `pnpm check` — 0 errors, 0 warnings
- `pnpm test` — 53 tests pass (42 existing + 11 new)
- Browser verification (partial — agent-browser `upload` command crashes CDP on Windows):
  - Meal list renders correctly
  - Add meal sheet shows "Add photo" button
  - File selection triggers preview with "Change" and "Remove image" buttons
  - Form validation works
  - Meal creation succeeds (POST /api/meals 201)
  - Cancel/Close buttons work

## Key decisions

- `STORAGE_PROVIDER` env var selects backend (default: `local`), separate from `DATABASE_PROVIDER`
- Per-user encryption keys derived via `scryptSync(userId, ENCRYPTION_SECRET, 32)` — no per-file keys needed since user-scoped
- `$env/dynamic/private` with `process.env` fallback for test environment compatibility
- `onSubmit` signature changed to `(data, imageFile?, removeExistingImage?)` to support both add and edit flows
- Image ownership verified via DB query (meal table), not signed URLs — acceptable for v1
- Orphan images (uploaded but meal not created) accepted for v1

## Browser automation findings

- agent-browser `upload` command on hidden file inputs crashes CDP connection (#1102)
- agent-browser `open` hangs intermittently on Windows due to daemon IPC bugs (#1270, #1308)
- Created `scripts/abr` wrapper — redirects stdin/stdout to `/dev/null` to prevent opencode bash tool from hanging (daemon inherits file descriptors)
- Upgraded agent-browser from 0.25.3 to 0.26.0
- Documented workarounds in `AGENTS.md`

## Files created
- `src/lib/server/encryption.ts`
- `src/lib/server/storage/index.ts`
- `src/lib/server/storage/local.ts`
- `src/lib/server/storage/azure.ts`
- `src/routes/api/images/upload/+server.ts`
- `src/routes/api/images/[filename]/+server.ts`
- `tests/unit/encryption.test.ts`
- `tests/api/images.test.ts`
- `tests/fixtures/test-image.jpg`
- `scripts/abr`

## Files modified
- `package.json` (added `@azure/storage-blob`)
- `src/lib/types.ts`
- `src/routes/+page.server.ts`
- `src/routes/+page.svelte`
- `src/routes/api/meals/+server.ts`
- `src/routes/api/meals/[id]/+server.ts`
- `src/lib/components/MealCard.svelte`
- `src/lib/components/MealList.svelte`
- `src/lib/components/ManualEntrySheet.svelte`
- `.gitignore` (added `data/`)
- `.env.example` (added `STORAGE_PROVIDER`, `ENCRYPTION_SECRET`, `AZURE_BLOB_CONNECTION_STRING`)
- `AGENTS.md` (git worktree notes, browser automation findings)
