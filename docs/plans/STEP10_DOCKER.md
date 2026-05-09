# Step 10 — Docker + Local Dev: Dockerfile, docker-compose

> Detailed implementation plan for containerizing the CalorieTracker app with multi-stage Docker builds and docker-compose for both production and local development.

## Summary

Create a production-ready multi-stage Dockerfile, docker-compose configuration for production deployment and local development, optional PostgreSQL service via compose profile, and convenience npm scripts. No application code changes required.

**New dependencies:** None.

---

## Compatibility with Step 9 (Calendar View)

Steps 9 and 10 proceed **in parallel** with no conflicts:

| Concern | Step 9 owns | Step 10 owns | Overlap |
|---|---|---|---|
| Frontend components | Calendar page, grid/list components | — | None |
| Docker infrastructure | — | Dockerfile, compose files, .dockerignore | None |
| package.json | May add dependencies for calendar | Adds `docker:*` scripts | Different sections |
| docs/PLAN.md | Checks off step 9 | Checks off step 10 | Different checklist items |

**Rule:** Step 10 does not touch `src/` at all. Step 9 does not touch Docker files.

---

## Design

### Dockerfile — Multi-stage (4 stages)

```
base ──→ deps ──→ build ──→ prod
```

| Stage | Base | Purpose |
|---|---|---|
| **base** | `node:22-alpine` | Enable pnpm via corepack, set WORKDIR |
| **deps** | base | Copy lockfile + workspace config, install all dependencies |
| **build** | deps | Copy source, run typecheck + build |
| **prod** | base (clean) | Copy build output + production node_modules, non-root user, healthcheck |

**Why no `dev` stage?** The dev workflow uses `target: deps` in the compose override. Source code is volume-mounted, so no COPY needed. This avoids maintaining a parallel layer that becomes stale.

**Production image contents:**
- `build/` — SvelteKit adapter-node output (bundled server + client)
- `node_modules/` — production-only deps (needed for Vite-externalized packages like `@libsql/client`)
- `package.json` — version info
- `/app/data` — owned by `node` user, volume mount target

**Why production node_modules?** `adapter-node` bundles most code via Vite, but externalizes packages with native/WASM bindings. The `@libsql/client` package (used for SQLite) uses WASM and is externalized. Running without `node_modules` would fail at runtime.

### docker-compose.yml (production base)

Single `app` service:
- Builds from Dockerfile `prod` target
- Named volume at `/app/data` — covers both SQLite DB and encrypted images
- `environment:` overrides `DATABASE_URL` to `file:data/local.db` — ensures DB lands inside the persistent volume
- Healthcheck via `wget` to `http://localhost:3000/`
- `env_file: .env` for all other config

**SQLite DB path:** The `DATABASE_URL` override in `environment:` takes precedence over `.env`. This ensures the DB file is created inside `/app/data` (which is a named volume) instead of `/app/local.db` (which would be lost on container recreation). When using the PostgreSQL profile, the user removes this override and sets the PG connection string in `.env`.

### docker-compose.override.yml (dev, auto-loaded)

Overrides for `app` service:
- `target: deps` — only install dependencies, no build
- `command: pnpm dev --host` — run Vite dev server with hot reload
- Port 5173 (Vite) instead of 3000
- Source volume mount (`.:/app`) for hot reload
- Anonymous volume for `/app/node_modules` — prevents Windows host `node_modules` from shadowing container's

`postgres` service under `profiles: ["pg"]`:
- `postgres:16-alpine`
- Default credentials: `calorietracker/calorietracker`
- Named volume for data persistence
- Port 5432 exposed
- Only starts with `docker compose --profile pg up`

### Non-root User

The production stage runs as `node` user (built-in to `node:22-alpine`). The `/app/data` directory is created and owned by `node` before switching user. This ensures the app can write SQLite DB and encrypted images without running as root.

### Healthcheck

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=10s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1
```

`wget` is available in Alpine. The healthcheck hits the root route. The `start-period` gives the Node.js server time to start before healthchecks begin.

---

## Files to Create/Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `.dockerignore` | **CREATE** | Exclude unnecessary files from build context |
| 2 | `.node-version` | **CREATE** | Pin Node.js 22 for tooling consistency |
| 3 | `Dockerfile` | **CREATE** | Multi-stage build for production image |
| 4 | `docker-compose.yml` | **CREATE** | Production compose config |
| 5 | `docker-compose.override.yml` | **CREATE** | Dev overrides + PG profile |
| 6 | `package.json` | **MODIFY** | Add `docker:*` convenience scripts |
| 7 | `.env.example` | **MODIFY** | Add Docker-specific DATABASE_URL comment |
| 8 | `docs/PLAN.md` | **MODIFY** | Check off step 10 |

---

## File Specifications

### 1. `.dockerignore` (NEW)

```
.git
.svelte-kit
build
node_modules
data/
*.db
.env
.env.*
!.env.example
tests/
docs/
drizzle/
.claude/
.agents/
*.md
!README.md
```

Excludes source control, build artifacts, local data, secrets, tests, docs, and development tooling. Keeps `README.md` and `.env.example` for documentation. This reduces build context size significantly.

### 2. `.node-version` (NEW)

```
22
```

Single line, used by `.nvmrc`-aware tools (fnm, volta, etc.). Matches the Docker base image.

### 3. `Dockerfile` (NEW)

```dockerfile
# ---- Base ----
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# ---- Dependencies ----
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

# ---- Build ----
FROM deps AS build
COPY . .
RUN pnpm build

# ---- Production ----
FROM base AS prod
COPY --from=build /app/build /app/build
COPY --from=build /app/package.json /app/package.json
RUN pnpm install --frozen-lockfile --prod
RUN mkdir -p /app/data && chown node:node /app/data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=10s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1
CMD ["node", "build"]
```

**Notes:**
- `corepack prepare pnpm@latest --activate` ensures pnpm is available in all stages
- `deps` stage only copies package manifests — Docker layer cache is reused unless dependencies change
- `build` stage copies all source and runs `pnpm build` (which runs `vite build` via adapter-node)
- `prod` stage is clean: starts from base (no build tools), copies only build output + installs production deps separately
- `pnpm install --frozen-lockfile --prod` in prod stage installs only production dependencies into a clean `node_modules`
- `/app/data` is created and chown'd before `USER node` so the app can write to it

### 4. `docker-compose.yml` (NEW)

```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: prod
    ports:
      - "${PORT:-3000}:3000"
    env_file: .env
    environment:
      DATABASE_URL: file:data/local.db
      ORIGIN: http://localhost:3000
    volumes:
      - app-data:/app/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

volumes:
  app-data:
```

**Notes:**
- `environment:` overrides `env_file:` — `DATABASE_URL` is forced to `file:data/local.db` to ensure the SQLite DB lands inside the named volume
- `ORIGIN` defaults to `http://localhost:3000` for local testing; override in `.env` for production deployments
- Single named volume `app-data` at `/app/data` covers both SQLite DB file and `data/images/` directory
- Healthcheck matches the Dockerfile but is declared here for compose visibility

**PostgreSQL usage:** When using `--profile pg`, the user should:
1. Remove `DATABASE_URL` from `environment:` (or override via `.env`)
2. Set `DATABASE_PROVIDER=pg` in `.env`
3. Set `DATABASE_URL=postgres://calorietracker:calorietracker@postgres:5432/calorietracker` in `.env`

### 5. `docker-compose.override.yml` (NEW)

```yaml
services:
  app:
    build:
      target: deps
    command: pnpm dev --host
    ports:
      - "5173:5173"
    volumes:
      - .:/app
      - /app/node_modules

  postgres:
    profiles: ["pg"]
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: calorietracker
      POSTGRES_PASSWORD: calorietracker
      POSTGRES_DB: calorietracker
    ports:
      - "5432:5432"
    volumes:
      - pg-data:/var/lib/postgresql/data

volumes:
  pg-data:
```

**Notes:**
- Auto-loaded by `docker compose up` — merged with `docker-compose.yml`
- `target: deps` — only installs dependencies, no build step
- `command: pnpm dev --host` — runs Vite dev server with hot reload, accessible on all interfaces
- `volumes: .:/app` — mounts source code for hot reload
- `/app/node_modules` (anonymous volume) — prevents host's `node_modules` from overwriting container's. Critical on Windows where native modules differ.
- `postgres` service only starts with `docker compose --profile pg up`

**To run production locally (skip override):**
```bash
docker compose -f docker-compose.yml up
```

### 6. `package.json` (MODIFY)

Add to `scripts`:

```json
"docker:build": "docker compose build",
"docker:up": "docker compose -f docker-compose.yml up -d",
"docker:down": "docker compose down",
"docker:dev": "docker compose up",
"docker:dev:pg": "docker compose --profile pg up"
```

- `docker:build` — builds the production image (uses `docker-compose.yml` target: prod by default, override merges dev target)
- `docker:up` — runs production container in detached mode (explicitly uses base compose only, skips override)
- `docker:down` — stops and removes all containers, networks, volumes remain
- `docker:dev` — starts dev container with source mount and hot reload
- `docker:dev:pg` — starts dev container + PostgreSQL service

### 7. `.env.example` (MODIFY)

Add comment for Docker-specific DATABASE_URL:

```bash
# Drizzle
DATABASE_URL=file:local.db
# For Docker: use file:data/local.db to persist DB in the named volume
```

### 8. `docs/PLAN.md` (MODIFY)

Check off step 10 after implementation:

```
- [x] 10. Docker + local dev — Dockerfile, docker-compose
```

---

## Implementation Order

### Phase 1: Create Docker files (no existing file modifications)

1. Create `.dockerignore`
2. Create `.node-version` with `22`
3. Create `Dockerfile` (multi-stage)
4. Create `docker-compose.yml` (production)
5. Create `docker-compose.override.yml` (dev + PG profile)

### Phase 2: Update existing files

6. Update `package.json` — add `docker:*` scripts
7. Update `.env.example` — add Docker comment

### Phase 3: Verify

8. Build production image: `pnpm docker:build`
9. Run production container: `pnpm docker:up`
10. Verify healthcheck: `docker compose ps` (healthy)
11. Test app: `curl http://localhost:3000/`
12. Test dev mode: `pnpm docker:dev` → verify hot reload works
13. Test PG profile: `pnpm docker:dev:pg` → verify PostgreSQL starts and app can connect
14. Update `docs/PLAN.md` — check off step 10
15. Write `docs/stages/STAGE10_IMPLEMENTATION.md`

---

## Usage Reference

| Scenario | Command |
|---|---|
| Bare metal dev (unchanged) | `pnpm dev` |
| Dev in Docker | `pnpm docker:dev` |
| Dev in Docker + PG | `pnpm docker:dev:pg` |
| Build production image | `pnpm docker:build` |
| Run production locally | `pnpm docker:up` |
| Stop all containers | `pnpm docker:down` |
| View logs | `docker compose logs -f app` |
| Shell into container | `docker compose exec app sh` |

---

## Integration with Future Steps

| Step | Interaction |
|---|---|
| **Step 9** (Calendar) | No shared files. Step 9 only modifies `src/routes/calendar/` and components. |
| **Step 11** (IaC) | Will reference the Docker image built here. Bicep template will pull from ACR and deploy to Azure Container Apps. The `prod` target is the deployable artifact. |
| **Step 12** (CI/CD) | Pipeline will run `docker compose build` (or `docker build`), push to ACR, then trigger Bicep deployment. The `docker:build` script can be used in CI. |

---

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| `@libsql/client` WASM bindings fail in Alpine | Tested in Phase 3. WASM should work on Alpine with Node 22. If not, switch to `node:22-slim` (Debian-based). |
| Windows host `node_modules` shadows container's | Anonymous volume for `/app/node_modules` in override prevents this. |
| Production `DATABASE_URL` override conflicts with PG usage | Documented clearly. PG users remove the override from `environment:` or set it in `.env`. |
| Docker build context too large | `.dockerignore` excludes `.git`, `node_modules`, `data/`, `tests/`, `docs/`. |
| `pnpm install --prod` in prod stage fails due to devDependencies needed at runtime | All runtime deps are in `dependencies` in `package.json`. `adapter-node` bundles dev dependency code at build time. |
| Healthcheck false positives during slow startup | `start-period: 10s` allows grace time. `wget` is lightweight. |
| Anonymous volume for `node_modules` accumulates stale deps | `docker compose down` followed by `docker compose up` recreates the container (anonymous volumes are recreated). For full reset: `docker compose down -v`. |

---

## Verification

### Production Image

1. `pnpm docker:build` — builds without errors
2. `docker compose -f docker-compose.yml up -d` — starts production container
3. `docker compose ps` — shows `healthy` status within 60 seconds
4. `curl http://localhost:3000/auth` — redirects to auth page (302)
5. Sign in → add a meal → verify meal persists after container restart:
   - `docker compose -f docker-compose.yml restart`
   - Sign in → meals still present (DB persisted in named volume)
6. `docker compose logs app` — structured Pino JSON logs visible
7. Image size check: `docker images calorietracker-app` — should be < 300MB

### Dev Mode

1. `pnpm docker:dev` — starts dev container
2. `curl http://localhost:5173/` — serves the app
3. Edit a `.svelte` file → verify hot reload (HMR) works in browser
4. Verify `node_modules` is intact: `docker compose exec app ls node_modules/.pnpm | wc -l` — should show packages

### PostgreSQL Profile

1. `pnpm docker:dev:pg` — starts dev container + PostgreSQL
2. Set in `.env`:
   ```
   DATABASE_PROVIDER=pg
   DATABASE_URL=postgres://calorietracker:calorietracker@postgres:5432/calorietracker
   ```
3. `docker compose exec postgres pg_isready` — PG is accepting connections
4. App starts without errors → uses PG instead of SQLite
5. `docker compose exec postgres psql -U calorietracker -c '\dt'` — tables created by Drizzle push

---

## Success Criteria

- [ ] `Dockerfile` builds successfully with multi-stage approach
- [ ] Production image runs as non-root `node` user
- [ ] Production container passes healthcheck
- [ ] SQLite DB and images persist across container recreation (named volume)
- [ ] Dev container starts with hot reload via source mount
- [ ] PostgreSQL profile starts PG 16 and app can connect
- [ ] `docker:*` npm scripts work as documented
- [ ] `.dockerignore` excludes unnecessary files (small build context)
- [ ] `.node-version` pins Node 22
- [ ] No changes to `src/` directory
- [ ] Typecheck passes (`pnpm check`)
- [ ] Lint passes (`pnpm lint`)
- [ ] Tests pass (`pnpm test`)
- [ ] PLAN.md updated with step 10 checked off
- [ ] STAGE10_IMPLEMENTATION.md written
