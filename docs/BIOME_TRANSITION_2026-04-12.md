# Biome Transition Log

**Date:** 2026-04-12
**Status:** Complete

## Decision

Replaced Prettier + ESLint with Biome (`@biomejs/biome@2.4.11`). Single tool for formatting and linting, ~35x faster, built-in Tailwind directive support, experimental Svelte support.

**Strategy chosen:** All Biome — no Prettier or ESLint retained. Accept experimental Svelte gaps.

## Packages Removed (10)

| Package                       | Version |
| ----------------------------- | ------- |
| `eslint`                      | 10.2.0  |
| `@eslint/js`                  | 10.0.1  |
| `@eslint/compat`              | 2.0.4   |
| `eslint-config-prettier`      | 10.1.8  |
| `eslint-plugin-svelte`        | 3.17.0  |
| `typescript-eslint`           | 8.58.1  |
| `globals`                     | 17.4.0  |
| `prettier`                    | 3.8.1   |
| `prettier-plugin-svelte`      | 3.5.1   |
| `prettier-plugin-tailwindcss` | 0.7.2   |

## Package Added (1)

| Package          | Version        |
| ---------------- | -------------- |
| `@biomejs/biome` | 2.4.11 (exact) |

## Config Mapping

### Prettier → Biome

| Prettier (.prettierrc)                   | Biome (biome.json)                                     |
| ---------------------------------------- | ------------------------------------------------------ |
| `useTabs: true`                          | `formatter.indentStyle: "tab"`                         |
| `singleQuote: true`                      | `javascript.formatter.quoteStyle: "single"`            |
| `trailingComma: "none"`                  | `javascript.formatter.trailingCommas: "none"`          |
| `printWidth: 100`                        | `formatter.lineWidth: 100`                             |
| `plugins: [prettier-plugin-tailwindcss]` | `css.parser.tailwindDirectives: true`                  |
| `plugins: [prettier-plugin-svelte]`      | `html.experimentalFullSupportEnabled: true`            |
| `.prettierignore`                        | `vcs.useIgnoreFile: true` + `files.includes` with `!!` |

### ESLint → Biome

| ESLint                       | Biome                                            |
| ---------------------------- | ------------------------------------------------ |
| `js.configs.recommended`     | `linter.rules.recommended: true`                 |
| `ts.configs.recommended`     | Covered by Biome recommended rules               |
| `svelte.configs.recommended` | Partially covered; Svelte-specific rules dropped |
| `eslint-config-prettier`     | Not needed (Biome handles both)                  |
| `no-undef: "off"` (TS)       | Not needed (Biome handles this correctly)        |

### Scripts

| Before                                   | After                   |
| ---------------------------------------- | ----------------------- |
| `lint`: `prettier --check . && eslint .` | `biome check .`         |
| `format`: `prettier --write .`           | `biome check --write .` |

## Svelte Overrides

Biome's experimental Svelte support cannot detect template usage of variables, causing false positives. The following rules are disabled for `**/*.svelte`:

- `noUnusedVariables` — variables defined in `<script>` but used in template
- `noUnusedImports` — imports used in template only
- `useConst` — false positives for reactive declarations
- `useImportType` — type imports used in template

## Files Created

| File                                  | Purpose             |
| ------------------------------------- | ------------------- |
| `biome.json`                          | Biome configuration |
| `docs/BIOME_TRANSITION_2026-04-12.md` | This file           |

## Files Modified

| File                           | Change                                              |
| ------------------------------ | --------------------------------------------------- |
| `package.json`                 | Scripts updated, deps removed, biome added          |
| `.vscode/extensions.json`      | Swapped Prettier/ESLint extensions for Biome        |
| `.vscode/settings.json`        | Added Biome as default formatter + format on save   |
| `AGENTS.md`                    | Updated add-ons, added Linting & Formatting section |
| `src/routes/+layout.svelte`    | Reformat + added `type="button"` (a11y rule)        |
| `src/routes/auth/+page.svelte` | Reformat                                            |
| All other source files         | Minor formatting adjustments                        |

## Files Deleted

| File                       | Reason                                       |
| -------------------------- | -------------------------------------------- |
| `eslint.config.js`         | Replaced by biome.json                       |
| `.prettierrc`              | Replaced by biome.json                       |
| `.prettierignore`          | Replaced by VCS integration + files.includes |
| `src/lib/vitest-examples/` | Leftover scaffolding, removed during cleanup |

## Issues Found

1. **Svelte `<script>` indentation**: Biome's experimental formatter produced double-indented code inside `<script>` blocks. Fixed manually. This is a known Biome issue (experimental support).
2. **`useTemplate` rule**: Auto-fixed string concatenation to template literals in `vitest-examples` (then removed entirely).
3. **`useButtonType` rule**: Added `type="button"` to sign-out button in `+layout.svelte` (valid a11y catch).

## Rollback

```bash
git revert HEAD
```

Or manually:

1. Restore `eslint.config.js`, `.prettierrc`, `.prettierignore` from git
2. `pnpm remove @biomejs/biome`
3. `pnpm add -D eslint@10 @eslint/js@10 @eslint/compat@2 eslint-config-prettier@10 eslint-plugin-svelte@3 typescript-eslint@8 globals@17 prettier@3 prettier-plugin-svelte@3 prettier-plugin-tailwindcss@0.7`
4. Restore original scripts in `package.json`
5. Restore `.vscode/` configs
