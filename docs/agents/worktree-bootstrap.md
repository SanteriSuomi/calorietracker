# Worktree Bootstrap

> Reference for setting up a git worktree for implementation work.

## Overview

Implementation work happens in git worktrees (e.g., `../step4-impl`) on feature
branches. A fresh worktree needs bootstrap before the app can run.

## Steps

```bash
# 1. Create worktree (from project root)
git worktree add ../<name> -b <name>

# 2. Copy env file
cp .env ../<name>/.env

# 3. Install dependencies
cd ../<name> && pnpm install

# 4. Create data directory (libsql needs it)
mkdir -p data

# 5. Push database schema (non-interactive — requires --force in non-TTY shells)
npx drizzle-kit push --force

# 6. Start dev server
npx pm2 start scripts/pm2-dev.mjs --name calorietracker
```

## Notes

- `drizzle-kit push` uses interactive prompts that don't work in non-TTY shells
  (piped stdin). Always use `--force`.
- The `data/` directory is gitignored — it must be created manually.
- The `.env` file is gitignored — copy from the main project.
- `pnpm install` is needed because worktrees don't share `node_modules`.

## Cleanup

```bash
# Remove worktree (from project root)
git worktree remove ../<name>

# Or forcefully if uncommitted changes
git worktree remove --force ../<name>
```
