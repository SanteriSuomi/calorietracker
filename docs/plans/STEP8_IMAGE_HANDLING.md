# Step 8 — Image Handling: Upload, Encrypt/Decrypt (Dual Storage), Serve with Auth Check

> Detailed implementation plan for image upload, encryption, storage, serving, and display.

## Summary

Build the complete image pipeline: server-side encryption module (AES-256-GCM), dual storage backend (local encrypted files + Azure Blob Storage), upload/serve API endpoints, image display in MealCard, and image upload UI in ManualEntrySheet. Uses a separate `STORAGE_PROVIDER` env var to select the backend.

**New dependencies:** `@azure/storage-blob` (production, dynamically imported when `STORAGE_PROVIDER=azure`)

---

## Async Compatibility with Step 7

Steps 7 and 8 can proceed **in parallel** with no conflicts:

| Concern | Step 7 owns | Step 8 owns | Integration (after both) |
|---|---|---|---|
| Settings page | Settings UI + `/api/settings` | — | — |
| AiInputBar | Text-only AI input component | — | Wire photo button to upload endpoint |
| `/api/ai/analyze` | Text-only AI analysis | — | Add image/vision support |
| Image infrastructure | — | Upload, encrypt, store, serve | — |
| MealCard image display | — | Thumbnail rendering | — |
| ManualEntrySheet image | — | Upload UI in form | — |
| `+page.svelte` | Adds AiInputBar section | Modifies ManualEntrySheet + MealCard sections | Separate sections, no overlap |
| `+page.server.ts` | May add settings data | Adds `imageFilename` to meal select | Different columns |
| `src/lib/types.ts` | May add AI types | Adds `imageFilename` to `Meal` | Different fields |

**Rule:** Step 7 does not touch `imageFilename`, ManualEntrySheet, MealCard, or image routes. Step 8 does not touch AiInputBar, AI routes, or settings.

---

## Design

### Encryption Module (`src/lib/server/encryption.ts`)

Per PLAN.md spec:
- Key derivation: `scrypt(userId, ENCRYPTION_SECRET)` → 32 bytes
- Algorithm: AES-256-GCM
- Random IV per file (16 bytes)
- File layout: `[IV 16B][AuthTag 16B][Ciphertext]`
- Uses Node.js built-in `crypto` module (no external deps)

### Storage Abstraction

Interface (`src/lib/server/storage/index.ts`):
```
StorageProvider:
  save(userId, filename, data: Buffer) → Promise<void>
  read(userId, filename) → Promise<Buffer>
  remove(userId, filename) → Promise<void>
```

Factory uses dynamic import (same pattern as DB drivers) based on `STORAGE_PROVIDER` env var:
- `local` (default) → `LocalStorage` — encrypts with AES-256-GCM, stores at `data/images/{userId}/{uuid}.{ext}.enc`
- `azure` → `AzureStorage` — stores in Azure Blob Storage (`images/{userId}/{uuid}.{ext}`), Azure-managed encryption

### Image Upload Flow

```
1. User selects image in ManualEntrySheet (or future AiInputBar)
2. Frontend: On form submit → if image selected, POST /api/images/upload (multipart)
3. Server validates: file type (JPEG/PNG/WebP), size (≤5MB)
4. Server generates filename: {uuid}.{ext}
5. Server stores via StorageProvider (encrypted for local, blob for azure)
6. Server returns { filename: "{uuid}.{ext}" }
7. Frontend: POST /api/meals with JSON body including imageFilename
8. Meal creation links imageFilename to meal row
```

### Image Serve Flow

```
1. Browser requests GET /api/images/{filename}
2. Auth check: middleware enforces session (all /api/* routes)
3. Ownership check: query meal table WHERE imageFilename = ? AND userId = session.user.id
4. If not found → 404
5. Read from StorageProvider (decrypt for local, download blob for azure)
6. Derive Content-Type from file extension
7. Return with Cache-Control: private, max-age=86400
```

### Image in MealCard

Small thumbnail (48×48) to the left of description when `imageFilename` is present. Uses `<img src="/api/images/{filename}">` — browser sends auth cookies automatically (same-origin).

### Image Upload in ManualEntrySheet

Add camera/gallery button below the Description field:
- `<input type="file" accept="image/*">` for file selection (opens camera on mobile)
- Image preview (small thumbnail) after selection
- Clear button to remove selected image
- On submit: upload image first (if new), then create/update meal

### Meal Delete Cleanup

When deleting a meal that has an `imageFilename`, also call `storage.remove(userId, filename)` to clean up the stored image.

### Meal Edit Image Handling

- Show current image preview (if exists) when editing
- Allow replacing with new image (upload new, delete old)
- Allow removing image (set `imageFilename` to `null`, delete old file)
- If no change, keep existing `imageFilename`

---

## API Routes

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/images/upload` | POST | Upload image, return filename |
| `/api/images/[filename]` | GET | Serve decrypted/auth-checked image |

Meal API routes modified to handle `imageFilename`:

| Endpoint | Method | Change |
|---|---|---|
| `/api/meals` | POST | Accept optional `imageFilename` field |
| `/api/meals/[id]` | PUT | Accept `imageFilename` updates, delete old image if replaced |
| `/api/meals/[id]` | DELETE | Delete associated image from storage |

---

## Files to Create/Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `src/lib/server/encryption.ts` | **CREATE** | Key derivation + AES-256-GCM encrypt/decrypt |
| 2 | `src/lib/server/storage/index.ts` | **CREATE** | StorageProvider interface + factory |
| 3 | `src/lib/server/storage/local.ts` | **CREATE** | Local filesystem storage (AES-256-GCM) |
| 4 | `src/lib/server/storage/azure.ts` | **CREATE** | Azure Blob Storage |
| 5 | `src/routes/api/images/upload/+server.ts` | **CREATE** | POST image upload |
| 6 | `src/routes/api/images/[filename]/+server.ts` | **CREATE** | GET image serve |
| 7 | `src/lib/types.ts` | **MODIFY** | Add `imageFilename` to `Meal` |
| 8 | `src/routes/api/meals/+server.ts` | **MODIFY** | Handle `imageFilename` in create |
| 9 | `src/routes/api/meals/[id]/+server.ts` | **MODIFY** | Handle `imageFilename` update + delete cleanup |
| 10 | `src/routes/+page.server.ts` | **MODIFY** | Select `imageFilename` from meals |
| 11 | `src/lib/components/MealCard.svelte` | **MODIFY** | Show image thumbnail |
| 12 | `src/lib/components/MealList.svelte` | **MODIFY** | Pass `imageFilename` to MealCard |
| 13 | `src/lib/components/ManualEntrySheet.svelte` | **MODIFY** | Add image upload UI |
| 14 | `src/routes/+page.svelte` | **MODIFY** | Update submit handlers for image upload |
| 15 | `.gitignore` | **MODIFY** | Add `data/` |
| 16 | `.env.example` | **MODIFY** | Add `STORAGE_PROVIDER`, `ENCRYPTION_SECRET`, `AZURE_BLOB_CONNECTION_STRING` |
| 17 | `tests/unit/encryption.test.ts` | **CREATE** | Encryption unit tests |
| 18 | `tests/api/images.test.ts` | **CREATE** | Image API tests |
| 19 | `docs/PLAN.md` | **MODIFY** | Mark step 8 done |
| 20 | `docs/stages/STAGE8_IMPLEMENTATION.md` | **CREATE** | Stage log |

---

## Implementation Order

### Phase 1: Infrastructure (no UI changes, can run fully async with Step 7)

1. Install `@azure/storage-blob`: `pnpm add @azure/storage-blob`
2. Update `.gitignore` — add `data/`
3. Update `.env.example` — add `STORAGE_PROVIDER`, `ENCRYPTION_SECRET`, `AZURE_BLOB_CONNECTION_STRING`
4. Create `src/lib/server/encryption.ts` — key derivation + encrypt/decrypt
5. Create `src/lib/server/storage/index.ts` — interface + factory
6. Create `src/lib/server/storage/local.ts` — local encrypted storage
7. Create `src/lib/server/storage/azure.ts` — Azure Blob Storage
8. Create `src/routes/api/images/upload/+server.ts` — POST upload
9. Create `src/routes/api/images/[filename]/+server.ts` — GET serve
10. Create `tests/unit/encryption.test.ts` — encryption tests
11. Create `tests/api/images.test.ts` — image API tests
12. Run typecheck → lint → unit tests (fail fast)

### Phase 2: Integration (minimal conflict surface with Step 7)

13. Update `src/lib/types.ts` — add `imageFilename` to `Meal`
14. Update `src/routes/+page.server.ts` — select `imageFilename` from meals
15. Update `src/routes/api/meals/+server.ts` — handle `imageFilename` in create
16. Update `src/routes/api/meals/[id]/+server.ts` — handle image update + delete cleanup

### Phase 3: UI (modify shared files with Step 7 — merge carefully)

17. Update `src/lib/components/MealCard.svelte` — show image thumbnail
18. Update `src/lib/components/MealList.svelte` — pass `imageFilename`
19. Update `src/lib/components/ManualEntrySheet.svelte` — add image upload UI
20. Update `src/routes/+page.svelte` — update submit handlers for image flow
21. Run typecheck → lint → tests (fail fast)
22. Browser automation verification
23. Update `docs/PLAN.md` + write `docs/stages/STAGE8_IMPLEMENTATION.md`

---

## File Specifications

### 1. `src/lib/server/encryption.ts` (NEW)

```
Imports:
  randomBytes, createCipheriv, createDecipheriv, scryptSync from 'node:crypto'
  env from '$env/dynamic/private'

Constants:
  ALGORITHM = 'aes-256-gcm'
  IV_LENGTH = 16
  AUTH_TAG_LENGTH = 16

Functions:
  getEncryptionSecret(): string
    - Reads env.ENCRYPTION_SECRET, throws if not set
    - Called at encrypt/decrypt time (not module init) so it only fails when needed

  deriveUserKey(userId: string): Buffer
    - scryptSync(userId, getEncryptionSecret(), 32)
    - Returns 32-byte key for AES-256

  encrypt(data: Buffer, key: Buffer): Buffer
    - Generate random IV (16 bytes)
    - createCipheriv(ALGORITHM, key, iv, { authTagLength: 16 })
    - Concat: [IV][AuthTag][Ciphertext]
    - Returns single Buffer

  decrypt(data: Buffer, key: Buffer): Buffer
    - Extract IV (first 16 bytes)
    - Extract AuthTag (next 16 bytes)
    - Extract Ciphertext (remainder)
    - createDecipheriv(ALGORITHM, key, iv, { authTagLength: 16 })
    - decipher.setAuthTag(authTag)
    - Returns decrypted Buffer
    - Throws if auth tag verification fails (tampered data)
```

### 2. `src/lib/server/storage/index.ts` (NEW)

```
Imports:
  env from '$env/dynamic/private'

Types:
  StorageProviderType = 'local' | 'azure'

  StorageProvider (interface):
    save(userId: string, filename: string, data: Buffer): Promise<void>
    read(userId: string, filename: string): Promise<Buffer>
    remove(userId: string, filename: string): Promise<void>

Factory:
  const provider = (env.STORAGE_PROVIDER as StorageProviderType) ?? 'local'
  export const storage: StorageProvider = await dynamic import based on provider
  - 'local' → import('./local') → new LocalStorage()
  - 'azure' → import('./azure') → new AzureStorage()
  (Uses top-level await, same pattern as db/index.ts)
```

### 3. `src/lib/server/storage/local.ts` (NEW)

```
Imports:
  mkdir, readFile, writeFile, unlink from 'node:fs/promises'
  existsSync from 'node:fs'
  join from 'node:path'
  deriveUserKey, encrypt, decrypt from '../encryption'
  StorageProvider from './index'

Constants:
  BASE_DIR = 'data/images'

Class LocalStorage implements StorageProvider:
  save(userId, filename, data):
    1. dir = join(BASE_DIR, userId)
    2. if (!existsSync(dir)) mkdir(dir, { recursive: true })
    3. key = deriveUserKey(userId)
    4. encrypted = encrypt(data, key)
    5. writeFile(join(dir, `${filename}.enc`), encrypted)

  read(userId, filename):
    1. path = join(BASE_DIR, userId, `${filename}.enc`)
    2. encrypted = await readFile(path)
    3. key = deriveUserKey(userId)
    4. return decrypt(encrypted, key)

  remove(userId, filename):
    1. path = join(BASE_DIR, userId, `${filename}.enc`)
    2. if (existsSync(path)) await unlink(path)
```

### 4. `src/lib/server/storage/azure.ts` (NEW)

```
Imports:
  BlobServiceClient from '@azure/storage-blob'
  env from '$env/dynamic/private'
  StorageProvider from './index'

Constants:
  CONTAINER_NAME = 'calorietracker-images'

Helper:
  getClient(): BlobServiceClient
    - Reads env.AZURE_BLOB_CONNECTION_STRING, throws if not set
    - Returns BlobServiceClient.fromConnectionString(connStr)

Class AzureStorage implements StorageProvider:
  save(userId, filename, data):
    1. client = getClient()
    2. container = client.getContainerClient(CONTAINER_NAME)
    3. await container.createIfNotExists()
    4. blob = container.getBlockBlobClient(`${userId}/${filename}`)
    5. await blob.uploadData(data)

  read(userId, filename):
    1. client = getClient()
    2. container = client.getContainerClient(CONTAINER_NAME)
    3. blob = container.getBlockBlobClient(`${userId}/${filename}`)
    4. response = await blob.download()
    5. Collect readableStreamBody chunks into Buffer
    6. return Buffer.concat(chunks)

  remove(userId, filename):
    1. client = getClient()
    2. container = client.getContainerClient(CONTAINER_NAME)
    3. blob = container.getBlockBlobClient(`${userId}/${filename}`)
    4. await blob.deleteIfExists()
```

### 5. `src/routes/api/images/upload/+server.ts` (NEW)

```
Imports:
  json from '@sveltejs/kit'
  RequestHandler from './$types'
  storage from '$lib/server/storage'
  addLogContext from '$lib/server/logger'

Constants:
  ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
  MAX_SIZE = 5 * 1024 * 1024  // 5MB
  EXT_MAP = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' }

POST handler:
  1. Check locals.user → 401 if null
  2. Parse formData from request
  3. Get 'image' field from formData
  4. Validate: exists, is File instance → 400 if not
  5. Validate size ≤ MAX_SIZE → 400
  6. Validate type in ALLOWED_TYPES → 400
  7. ext = EXT_MAP[file.type]
  8. filename = `${crypto.randomUUID()}.${ext}`
  9. buffer = Buffer.from(await file.arrayBuffer())
  10. await storage.save(user.id, filename, buffer)
  11. addLogContext(locals, { imageFilename: filename, imageSize: file.size })
  12. Return 201 { filename }
```

### 6. `src/routes/api/images/[filename]/+server.ts` (NEW)

```
Imports:
  json from '@sveltejs/kit'
  RequestHandler from './$types'
  storage from '$lib/server/storage'
  db from '$lib/server/db'
  meal from '$lib/server/db/schema'
  eq, and from 'drizzle-orm'
  addLogContext from '$lib/server/logger'

Constants:
  MIME_MAP = { 'jpeg': 'image/jpeg', 'jpg': 'image/jpeg', 'png': 'image/png', 'webp': 'image/webp' }

GET handler:
  1. Check locals.user → 401 if null
  2. filename = params.filename
  3. Ownership check:
     SELECT meal.id FROM meal
     WHERE meal.imageFilename = filename AND meal.userId = user.id
     LIMIT 1
  4. If no result → 404 { error: "Not found" }
  5. buffer = await storage.read(user.id, filename)
  6. ext = filename.split('.').pop()
  7. contentType = MIME_MAP[ext] ?? 'application/octet-stream'
  8. addLogContext(locals, { imageFilename: filename })
  9. Return new Response(buffer, {
       headers: {
         'Content-Type': contentType,
         'Cache-Control': 'private, max-age=86400'
       }
     })

Error: if storage.read throws → 404 { error: "Image not found" }
```

### 7. `src/lib/types.ts` (MODIFY)

Add `imageFilename` to `Meal`:

```typescript
export interface Meal {
  id: string;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  source: string;
  imageFilename?: string | null;
}
```

### 8. `src/routes/api/meals/+server.ts` (MODIFY)

Add `imageFilename` handling to POST:

```
In MealBody interface, add:
  imageFilename?: unknown

After validation, before insert:
  const imageFilename = parsed.imageFilename;
  let imageFilenameVal: string | null = null;
  if (imageFilename !== undefined) {
    if (typeof imageFilename !== 'string') {
      return json({ error: 'imageFilename must be a string' }, { status: 400 });
    }
    imageFilenameVal = imageFilename;
  }

In .values({}), add:
  imageFilename: imageFilenameVal,
```

### 9. `src/routes/api/meals/[id]/+server.ts` (MODIFY)

Add `imageFilename` to UpdateBody and handle image cleanup:

```
In UpdateBody interface, add:
  imageFilename?: unknown

New imports:
  storage from '$lib/server/storage'

In PUT handler, add after date validation:
  if (parsed.imageFilename !== undefined) {
    if (parsed.imageFilename !== null && typeof parsed.imageFilename !== 'string') {
      return json({ error: 'imageFilename must be a string or null' }, { status: 400 });
    }
    if (existing.imageFilename && existing.imageFilename !== parsed.imageFilename) {
      try { await storage.remove(user.id, existing.imageFilename); } catch { /* log only */ }
    }
    update.imageFilename = parsed.imageFilename;
  }

In DELETE handler, add before db.delete:
  if (existing.imageFilename) {
    try { await storage.remove(user.id, existing.imageFilename); } catch { /* log only */ }
  }
```

### 10. `src/routes/+page.server.ts` (MODIFY)

Add `imageFilename` to meal select:

```typescript
// In the select object, add:
imageFilename: meal.imageFilename,
```

### 11. `src/lib/components/MealCard.svelte` (MODIFY)

Add `imageFilename` prop and thumbnail display:

```
New prop:
  imageFilename?: string | null

Changes to template:
  - Before the description text, add conditional image thumbnail:
    {#if imageFilename}
      <img
        src={`/api/images/${imageFilename}`}
        alt={description}
        class="w-12 h-12 rounded-md object-cover flex-shrink-0 mr-3"
        loading="lazy"
      />
    {/if}
  - Wrap description + actions in a flex row with the image
```

### 12. `src/lib/components/MealList.svelte` (MODIFY)

Pass `imageFilename` to each MealCard:

```
In the MealCard component call, add:
  imageFilename={meal.imageFilename}
```

### 13. `src/lib/components/ManualEntrySheet.svelte` (MODIFY)

Add image upload UI:

```
New props:
  imageFilename?: string | null  // existing image for edit mode

New state:
  selectedFile: File | null = null
  previewUrl: string | null = null

New $effect:
  When open changes, clear selectedFile and previewUrl
  When selectedFile changes, create Object URL for preview (revoke old)

Changes to template:
  After description field, add:
    - If previewUrl: show preview image (small thumbnail) with clear button
    - If imageFilename (existing) and no selectedFile: show existing image thumbnail
    - File input button with camera icon: <input type="file" accept="image/*">
    - "Remove image" button if existing imageFilename and no selectedFile

Changes to handleSubmit:
  - Accept optional File parameter
  - If selectedFile, pass to onSubmit along with MealFormData

Changes to onClose:
  - Revoke previewUrl if set
  - Reset selectedFile, previewUrl

Update onsubmit call:
  await onSubmit(formData, selectedFile);
```

**Note:** The `onSubmit` callback signature changes from `(data: MealFormData) => Promise<void>` to `(data: MealFormData, imageFile?: File) => Promise<void>`.

### 14. `src/routes/+page.svelte` (MODIFY)

Update submit handlers for image upload flow:

```
Update handleAddMeal signature:
  async function handleAddMeal(formData: MealFormData, imageFile?: File)
  1. If imageFile:
     a. const uploadData = new FormData()
     b. uploadData.append('image', imageFile)
     c. const uploadRes = await fetch('/api/images/upload', { method: 'POST', body: uploadData })
     d. if !uploadRes.ok throw new Error('Failed to upload image')
     e. const { filename } = await uploadRes.json()
     f. Add imageFilename to meal body
  2. POST /api/meals with JSON body (including imageFilename if uploaded)
  3. await invalidateAll()

Update handleEditMeal signature:
  async function handleEditMeal(formData: MealFormData, imageFile?: File)
  1. If imageFile:
     a. Upload image (same as add)
     b. Include imageFilename in PUT body
  2. If no imageFile and editingMeal had no imageFilename:
     a. Don't include imageFilename in PUT body (no change)
  3. PUT /api/meals/[id] with JSON body
  4. await invalidateAll()

Update ManualEntrySheet props:
  imageFilename={editingMeal?.imageFilename}

Update ManualEntrySheet onSubmit:
  onSubmit={editingMeal ? handleEditMeal : handleAddMeal}
  (Signature matches because both now accept optional File)
```

### 15. `.gitignore` (MODIFY)

Add after `*.db`:
```
# Image storage
data/
```

### 16. `.env.example` (MODIFY)

Add after existing entries:
```
STORAGE_PROVIDER=local
ENCRYPTION_SECRET=
AZURE_BLOB_CONNECTION_STRING=
```

### 17. `tests/unit/encryption.test.ts` (NEW)

```
Test cases:
  deriveUserKey:
    - Returns 32-byte Buffer
    - Same inputs produce same key
    - Different userIds produce different keys
    - Different secrets produce different keys

  encrypt + decrypt roundtrip:
    - Encrypts then decrypts returns original data
    - Works with empty buffer
    - Works with large buffer (1MB)
    - Encrypted output is different from input
    - Each encryption produces different output (random IV)

  decrypt tamper detection:
    - Throws on tampered ciphertext
    - Throws on tampered IV
    - Throws on wrong key
```

### 18. `tests/api/images.test.ts` (NEW)

```
Test cases:
  POST /api/images/upload:
    - Uploads valid JPEG → 201 with filename
    - Uploads valid PNG → 201 with filename
    - Uploads valid WebP → 201 with filename
    - Missing image field → 400
    - File too large (>5MB) → 400
    - Invalid file type → 400
    - Unauthenticated → 401
    - Filename is UUID.{ext} format

  GET /api/images/[filename]:
    - Serves uploaded image → 200 with correct Content-Type
    - Returns 404 for non-existent filename
    - Returns 404 for image belonging to different user
    - Unauthenticated → 401
    - Sets Cache-Control header
```

---

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| `@azure/storage-blob` adds bundle size | Dynamic import — only loaded when STORAGE_PROVIDER=azure |
| Encryption failures in production (missing ENCRYPTION_SECRET) | Module throws clear error at usage time, not import time |
| Orphan images (user uploads but doesn't create meal) | Accept for v1; can add periodic cleanup in polish step |
| `+page.svelte` merge conflict with Step 7 | Changes are in separate sections (MealCard area vs AiInputBar area). Phase 3 can wait for Step 7 to merge if needed. |
| Large images consume storage | 5MB limit per upload, file type validation |
| Node.js `scryptSync` blocks event loop | Key derivation is infrequent (per image upload/read), ~50ms. Acceptable for v1. Could switch to async `scrypt` later. |
| Image request triggers DB query for ownership check | Acceptable for v1. Cache-Control: private reduces repeat requests. Could add a signed URL pattern later. |

---

## Verification

### After Phase 1 (Infrastructure)

1. **Typecheck:** `pnpm check` — no errors
2. **Lint:** `pnpm lint` — no errors
3. **Unit tests:** `pnpm test` — encryption tests pass
4. **Manual test with pm2:**
   - Start dev server
   - Sign in
   - Upload image via curl: `curl -X POST -F "image=@test.jpg" http://localhost:5173/api/images/upload -H "Cookie: ..."`
   - Verify 201 with filename
   - GET the image: `curl http://localhost:5173/api/images/{filename} -H "Cookie: ..."`
   - Verify image returned
   - Verify encrypted file exists at `data/images/{userId}/`
   - Check pm2 logs for wide event with imageFilename

### After Phase 2 (Integration)

1. **Typecheck:** `pnpm check` — no errors
2. **Lint:** `pnpm lint` — no errors
3. **Unit tests:** `pnpm test` — all pass

### After Phase 3 (UI)

Use **browser-automation** skill:

- Navigate to `/` while authenticated
- Click FAB → ManualEntrySheet opens
- Verify image upload button present
- Select image → verify preview shown
- Fill form: description "Grilled Chicken", calories 400
- Submit → verify meal appears in list with image thumbnail
- Verify doughnut updated (400 / 2000)
- Click on meal image → verify full image loads
- Edit meal → verify existing image preview shown
- Select new image → submit → verify updated
- Delete meal → verify meal removed, image file deleted
- Test without image → verify meal created without thumbnail
- Mobile viewport → verify upload button accessible
- Check browser console → no errors

---

## Success Criteria

- [ ] `src/lib/server/encryption.ts` encrypts/decrypts correctly with AES-256-GCM
- [ ] `src/lib/server/storage/` provides dual backend (local + azure)
- [ ] `STORAGE_PROVIDER` env var selects storage backend
- [ ] POST /api/images/upload validates and stores images
- [ ] GET /api/images/[filename] serves images with ownership check
- [ ] MealCard displays image thumbnail when present
- [ ] ManualEntrySheet supports image upload with preview
- [ ] Meal DELETE cleans up stored image
- [ ] Meal PUT handles image replacement and removal
- [ ] `data/` directory is gitignored
- [ ] `.env.example` updated with new env vars
- [ ] Typecheck passes (`pnpm check`)
- [ ] Lint passes (`pnpm lint`)
- [ ] Unit tests pass (`pnpm test`)
- [ ] Browser automation verification passes
- [ ] No conflicts with Step 7 changes
- [ ] PLAN.md updated with step 8 checked off
- [ ] STAGE8_IMPLEMENTATION.md written
