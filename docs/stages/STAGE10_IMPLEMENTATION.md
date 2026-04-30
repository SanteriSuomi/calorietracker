# Stage 10 — Docker + Local Dev: Implementation Log

## Summary

Containerized the CalorieTracker app with a multi-stage Dockerfile, docker-compose for production and development, optional PostgreSQL via compose profile, and convenience npm scripts.

## Files Created

| File | Purpose |
|------|---------|
| `.dockerignore` | Exclude `.git`, `node_modules`, `data/`, `.env`, `tests/`, `docs/` from build context |
| `.node-version` | Pin Node.js 22 for tooling consistency |
| `Dockerfile` | 4-stage build: base → deps → build → prod |
| `docker-compose.yml` | Production: app service with named volume, healthcheck, env_file |
| `docker-compose.override.yml` | Dev overrides + PostgreSQL profile |

## Files Modified

| File | Change |
|------|--------|
| `package.json` | Added `docker:*` scripts; moved `@libsql/client` to dependencies |
| `.env.example` | Added Docker-specific DATABASE_URL comment |
| `vite.config.ts` | Added `ssr.external: ['@libsql/client']` for native binding support |
| `docs/PLAN.md` | Checked off step 10 |

## Deviations from Plan

### 1. Build-time env vars required

The Dockerfile build stage needs `DATABASE_URL` and `BETTER_AUTH_SECRET` as build args because both the DB driver and BetterAuth throw during module evaluation (top-level await / eager initialization). Added:

```dockerfile
ARG DATABASE_URL=file:local.db
ARG BETTER_AUTH_SECRET=build-only-dummy-secret-not-for-production
```

These are build-time only — the runtime uses values from `.env` and `docker-compose.yml` `environment`.

### 2. Lockfile + workspace config in prod stage

The prod stage needs `pnpm-lock.yaml`, `pnpm-workspace.yaml`, and `.npmrc` copied from the build stage for `pnpm install --frozen-lockfile --prod` to work.

### 3. `@libsql/client` externalized + moved to dependencies

The `@libsql/client` package uses native platform-specific bindings (`@libsql/linux-x64-musl` for Alpine). Vite's bundler can't handle the dynamic `require()` call at runtime, producing:
```
Error: Could not dynamically require "@libsql/linux-x64-musl"
```

Fix:
- Added `ssr: { external: ['@libsql/client'] }` to `vite.config.ts` — tells Vite to load it from `node_modules` at runtime instead of bundling
- Moved `@libsql/client` from `devDependencies` to `dependencies` — ensures it's installed in the prod stage

### 4. Healthcheck uses `127.0.0.1` instead of `localhost`

The `adapter-node` server listens on IPv4 only. Alpine's `wget` resolves `localhost` to `[::1]` (IPv6 loopback), causing connection refused. Changed healthcheck URL from `http://localhost:3000/` to `http://127.0.0.1:3000/` in both Dockerfile and docker-compose.yml.

## Verification Results

### Production Image

| Test | Result |
|------|--------|
| `docker compose -f docker-compose.yml build` | Builds successfully |
| `docker compose -f docker-compose.yml up -d` | Starts, listens on port 3000 |
| `curl http://localhost:3000/` | 302 redirect to `/auth` |
| `curl http://localhost:3000/auth` | 200 OK |
| `docker compose ps` (after 35s) | Status: `healthy` |
| `docker compose logs app` | Structured Pino JSON logs |
| Image size | 511MB (larger than 300MB target due to `@libsql/client` native deps) |

### Dev Mode

| Test | Result |
|------|--------|
| `docker compose build` (deps target) | Builds successfully |
| `docker compose up -d` | Vite dev server on port 5173 |
| `curl -4 http://localhost:5173/auth` | 200 OK |
| `wget` from inside container | Full HTML page returned |

Note: `curl` from host must use `-4` flag — the Docker port forwarding doesn't proxy IPv6 correctly to the container.

### PostgreSQL Profile

| Test | Result |
|------|--------|
| `docker compose --profile pg up -d` | Both app + postgres start |
| `docker compose exec postgres pg_isready` | Accepting connections |
| `docker compose exec postgres psql -U calorietracker -c '\dt'` | Empty (no tables pushed yet — expected) |

## Image Size Analysis

511MB is larger than the plan's 300MB target. Breakdown:
- `node:22-alpine` base: ~120MB
- `@libsql/client` + native bindings: ~90MB
- Other production deps (pg, pino, chart.js, ai, etc.): ~100MB
- Build output: ~10MB

The size increase is primarily from `@libsql/client` being in production `node_modules` (required for native bindings). This is a known trade-off — the alternative would be to use `@libsql/client`'s WASM mode, which is slower.

## Usage Reference

```bash
# Production
pnpm docker:build              # Build production image
pnpm docker:up                 # Run production container (detached)
pnpm docker:down               # Stop all containers

# Development
docker compose build           # Build dev image (deps target)
docker compose up              # Start dev container with hot reload

# With PostgreSQL
docker compose --profile pg up # Dev + PostgreSQL
```
