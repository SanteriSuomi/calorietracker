# pm2 Dev Server Guide

> Full reference for using pm2 as the process manager during development.

## Why pm2

pm2 runs the dev server in a detached process. Logs go to `~/.pm2/logs/<name>-*.log`.
This lets you start the server once, interact with it via browser automation,
and inspect structured log output without juggling terminal windows.

pm2 is a devDependency. On Windows Git Bash, use `npx pm2` (not `pnpm exec pm2`,
which fails to resolve the `.CMD` shim).

## Wrapper Script

`scripts/pm2-dev.mjs` — pm2 cannot execute `.cmd`/`.bat` scripts (it interprets
them as Node.js). The wrapper calls `pnpm run dev` via `execSync`.

The wrapper resolves the project root from its own location, so it works in
worktrees and from any cwd.

## Commands

```bash
# Start
npx pm2 start scripts/pm2-dev.mjs --name calorietracker

# View recent logs (20 lines, no tail)
npx pm2 logs calorietracker --lines 20 --nostream

# Tail logs (live, Ctrl+C to stop)
npx pm2 logs calorietracker

# Restart (after code or schema changes)
npx pm2 restart calorietracker

# Check status
npx pm2 list

# Clean up
npx pm2 stop calorietracker && npx pm2 delete calorietracker
```

## What to Look For in Logs

Each HTTP request produces one wide event with these fields:

| Field | Example | Notes |
|-------|---------|-------|
| `method` | `"POST"` | HTTP method |
| `path` | `"/auth"` | URL pathname |
| `requestId` | `"abc-123..."` | UUID, unique per request |
| `userId` | `"user-1"` or `"anonymous"` | Real ID after auth |
| `statusCode` | `200` | HTTP response status |
| `duration_ms` | `45` | Request duration |
| `outcome` | `"success"` or `"error"` | Error only for 5xx/exceptions |
| `detail` | `"Sign-in successful"` | Human-readable summary |

In dev mode, pino-pretty formats output as colored, multi-line text.
In production, output is raw JSON lines.

## LOG_LEVEL

Set via `LOG_LEVEL` env var before starting:

```bash
LOG_LEVEL=verbose npx pm2 restart calorietracker  # trace and above
LOG_LEVEL=error npx pm2 restart calorietracker     # errors only
LOG_LEVEL=none npx pm2 restart calorietracker      # nothing
npx pm2 restart calorietracker                     # default: info
```

## Gotchas

- pm2 logs accumulate at `~/.pm2/logs/`. Delete old logs with `rm ~/.pm2/logs/calorietracker-*.log`.
- `npx pm2 restart` does NOT reload `.env` changes. Use `npx pm2 delete` then `npx pm2 start` to pick up env changes, or set env vars inline (`LOG_LEVEL=error npx pm2 restart calorietracker`).
- If the process crashes immediately, check stderr: `npx pm2 logs calorietracker --err --lines 20 --nostream`.
- `pnpm exec pm2` fails in Git Bash on Windows — use `npx pm2` or `./node_modules/.bin/pm2` instead.
