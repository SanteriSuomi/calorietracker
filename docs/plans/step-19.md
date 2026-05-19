# Step 19: CI/CD Pipeline

> Complete plan for GitHub Actions CI/CD pipeline — build, test, scan, and deploy to Azure (staging + prod) and MiniPC.

## Decisions

| Decision | Choice |
|----------|--------|
| CI/CD platform | GitHub Actions |
| Image registry | GHCR (ghcr.io/santerisuomi/calorietracker) |
| Code quality + SAST | SonarQube Cloud (free for public repos, under 50k LOC for private) |
| Dependency scanning | GitHub Dependabot (built-in, free for public repos) |
| Container scanning | Trivy (open-source, always free) |
| Secret protection | GitHub push protection (built-in, free for public repos) |
| AI PR review | Qodo free tier (250 credits/month) |
| Test coverage | Vitest coverage reporter with thresholds |
| Deploy trigger (staging) | Push to `develop` |
| Deploy trigger (prod) | Push to `main` |
| MiniPC deploy | GitHub-hosted runner + Tailscale GitHub Action (ephemeral node, `tag:ci`, SSH). Ansible handles initial provisioning (step 18); CI/CD deploys ongoing updates via SSH |
| Deploy method | `az containerapp update` + `az containerapp job start` (Terraform handles infra provisioning only, step 18) |
| Secret source | SOPS-encrypted files in repo. GitHub secrets store `SOPS_AGE_KEY` for in-workflow decryption + non-repo secrets (Azure credentials, Tailscale OAuth) |
| Cost | $0 (all tools free for solo dev) |

---

## Architecture

```
Pull Request (any branch → develop, develop → main)
  │
  ├── Typecheck (pnpm check)
  ├── Lint (pnpm lint)
  ├── Tests (pnpm test)
  ├── Coverage threshold (Vitest)
  ├── SonarQube Cloud analysis
  ├── Qodo AI PR review
  └── Branch protection: all must pass before merge (provisioned via step 18 Terraform)

Push to develop
  │
  ├── Same checks as PR
  ├── Docker build app → ghcr.io/santerisuomi/calorietracker:develop
  ├── Docker build migration → ghcr.io/santerisuomi/calorietracker:migrate-<sha>
  ├── Trivy container scan
  ├── Deploy: az containerapp update --image ...:develop calorietracker-staging
  └── Migrate: az containerapp job start --name calorietracker-migrate
        --image ...:migrate-<sha> --env-vars DATABASE_URL=$STAGING_DB_URL
      └── Poll until completion (blocking)

Push to main
  │
  ├── Same checks as PR
  ├── Docker build app → ghcr.io/santerisuomi/calorietracker:latest + :sha-<short>
  ├── Docker build migration → ghcr.io/santerisuomi/calorietracker:migrate-<sha>
  ├── Trivy container scan
  ├── Deploy Azure prod: az containerapp update --image ...:latest calorietracker
  ├── Migrate Azure prod: az containerapp job start --name calorietracker-migrate
  │   --image ...:migrate-<sha> --env-vars DATABASE_URL=$PROD_DB_URL
  │   └── Poll until completion (blocking)
  └── Deploy MiniPC: GitHub-hosted runner + Tailscale Action
      ├── tailscale/github-action (ephemeral node, tag:ci)
      ├── SSH to MiniPC via tailnet (tag:ci → tag:minipc:22)
      ├── docker pull ghcr.io/santerisuomi/calorietracker:latest
      └── docker compose -f ~/calorietracker/compose.yml up -d calorietracker
```

> **Note**: MiniPC CI/CD deploys only update the running container image. Initial provisioning (directories, config files, Caddyfile, Grafana Alloy config, cron, Tailscale Serve) is handled by Ansible in step 18. CI/CD does not manage host-level configuration.

---

## GitHub Actions Workflows

### Workflow 1: PR Checks (`.github/workflows/pr-checks.yml`)

**Triggers**: Pull requests to `develop` and `main`
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - Checkout
      - Setup pnpm + Node 22
      - Install deps (pnpm install --frozen-lockfile)
      - Typecheck (pnpm check)
      - Lint (pnpm lint)
      - Test with coverage (pnpm test --coverage)
      - Coverage threshold check
      - SonarQube Cloud analysis

  ai-review:
    runs-on: ubuntu-latest
    steps:
      - Qodo AI PR review (GitHub App, auto-triggered)
```

**Branch protection**: Require `check` job to pass before merge.

### Workflow 2: Build & Deploy Staging (`.github/workflows/deploy-staging.yml`)

**Trigger**: Push to `develop`

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - Checkout
      - Setup pnpm + Node 22 + Docker Buildx
      - Login GHCR (PAT)
      - Docker build app + push (tag: develop, sha-<short>)
      - Docker build migration image (infra/migration/Dockerfile) + push (tag: migrate-<sha>)
      - Trivy scan (app image)

  deploy-staging:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - Azure login (az cli, service principal or OIDC)
      - az containerapp update --name calorietracker-staging --image ghcr.io/santerisuomi/calorietracker:develop
      - az containerapp job start --name calorietracker-migrate --image ghcr.io/santerisuomi/calorietracker:migrate-${{ github.sha }} --env-vars DATABASE_URL="${{ secrets.STAGING_DB_URL }}"
      - Poll job execution status until completion (blocking)
```

### Workflow 3: Build & Deploy Production (`.github/workflows/deploy-prod.yml`)

**Trigger**: Push to `main`

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - Checkout
      - Setup pnpm + Node 22 + Docker Buildx
      - Login GHCR (PAT)
      - Docker build app + push (tags: latest, sha-<short>)
      - Docker build migration image (infra/migration/Dockerfile) + push (tag: migrate-<sha>)
      - Trivy scan (app image)

  deploy-azure:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - Azure login
      - az containerapp update --name calorietracker --image ghcr.io/santerisuomi/calorietracker:latest
      - az containerapp job start --name calorietracker-migrate --image ghcr.io/santerisuomi/calorietracker:migrate-${{ github.sha }} --env-vars DATABASE_URL="${{ secrets.PROD_DB_URL }}"
      - Poll job execution status until completion (blocking)

  deploy-minipc:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: tailscale/github-action@v3
        with:
          oauth-client-id: ${{ secrets.TS_OAUTH_CLIENT_ID }}
          oauth-secret: ${{ secrets.TS_OAUTH_SECRET }}
          tags: tag:ci
      - name: Deploy to MiniPC
        run: |
          ssh -o StrictHostKeyChecking=accept-new user@fedora "docker pull ghcr.io/santerisuomi/calorietracker:latest && \
            docker compose -f ~/calorietracker/compose.yml up -d calorietracker && \
            docker image prune -f"
```

---

## Security & Quality Tools

### Tool Stack

| Tool | Purpose | Config | Cost |
|------|---------|--------|------|
| **SonarQube Cloud** | Code quality + SAST + coverage gate | `sonar-project.properties` in repo root. Quality gate: coverage ≥ X%, no new critical vulnerabilities | $0 (public repo / under 50k LOC private) |
| **Dependabot** | Dependency CVE scanning | `.github/dependabot.yml` — npm ecosystem, daily checks, auto PRs for patch updates | $0 (public repo) |
| **Trivy** | Container image scanning | Run in CI after Docker build. Fail on CRITICAL vulnerabilities. SARIF output uploaded to GitHub Security tab | $0 |
| **GitHub push protection** | Prevent secret commits | Enable in repo Settings → Code security | $0 (public repo) |
| **Qodo** | AI PR review | Install GitHub App. Free tier: 250 credits/month | $0 |

### Dependabot Config (`.github/dependabot.yml`)

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: daily
    open-pull-requests-limit: 5
    labels:
      - dependencies
```

### SonarQube Cloud Config (`sonar-project.properties`)

```properties
sonar.projectKey=SanteriSuomi_CalorieTracker
sonar.organization=santerisuomi
sonar.sources=src
sonar.tests=tests
sonar.typescript.lcov.reportPaths=coverage/lcov.info
sonar.qualitygate.wait=true
```

### Trivy Config

Run in CI after Docker build:

```yaml
- name: Trivy scan
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: ghcr.io/santerisuomi/calorietracker:${{ github.sha }}
    severity: CRITICAL,HIGH
    exit-code: 1
    format: sarif
    output: trivy-results.sarif
- name: Upload Trivy results
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: trivy-results.sarif
```

---

## Test Coverage Threshold

Configure in `vite.config.ts` (Vitest):

```ts
test: {
  coverage: {
    thresholds: {
      lines: 60,
      branches: 50,
      functions: 50,
      statements: 60
    }
  }
}
```

CI fails if coverage drops below thresholds. SonarQube Cloud also enforces its own quality gate.

> **Note**: Calibrate threshold values against current coverage before enabling. Run `pnpm test --coverage` locally first — if current coverage is below the thresholds, CI fails immediately on first run. Set initial values slightly below current coverage, then raise over time.

---

## GitHub Secrets Required

Configure in repo Settings → Secrets and variables → Actions:

| Secret | Purpose |
|--------|---------|
| `GHCR_PAT` | GitHub PAT with `write:packages` + `read:packages` scope (push images in CI, pull on Container Apps). Same PAT used by step 18 deploy.sh for Container App registry secret |
| `AZURE_CREDENTIALS` | Azure service principal JSON (for `az login` in CI) |
| `PROD_DB_URL` | PostgreSQL connection string for prod migration job |
| `STAGING_DB_URL` | PostgreSQL connection string for staging migration job |
| `SONAR_TOKEN` | SonarQube Cloud authentication token |
| `TS_OAUTH_CLIENT_ID` | Tailscale OAuth client ID (for GitHub Action ephemeral node) |
| `TS_OAUTH_SECRET` | Tailscale OAuth client secret (for GitHub Action ephemeral node) |
| `SOPS_AGE_KEY` | Age private key for decrypting SOPS-encrypted secrets in CI workflows |

> **Secrets sourcing**: GitHub secrets that correspond to values in SOPS-encrypted files (e.g. `PROD_DB_URL`, `GHCR_PAT`) can be populated by decrypting in CI with `SOPS_AGE_KEY`. Secrets that don't live in the repo (e.g. `AZURE_CREDENTIALS`, `TS_OAUTH_*`) are set manually. Either approach works — the key question is whether you want CI to decrypt from repo files or read directly from GitHub secrets. For simplicity, set all secrets manually in GitHub and keep `SOPS_AGE_KEY` available for future workflows that need repo-based secret decryption.

---

## GHCR Image Retention

Add cleanup to prevent unbounded image storage. Two categories need cleanup:

```yaml
- name: Delete old untagged images
  run: |
    # App images: old versions lose tags when latest/develop is reassigned
    gh api user/packages/container/calorietracker/versions --paginate \
      | jq -r '.[] | select(.metadata.container.tags | length == 0) | .id' \
      | tail -n +11 \
      | xargs -I {} gh api -X DELETE user/packages/container/calorietracker/versions/{}

- name: Delete old migration images (keep last 5)
  run: |
    # Migration images keep unique migrate-<sha> tags forever — must be cleaned explicitly
    gh api user/packages/container/calorietracker/versions --paginate \
      | jq -r '[ .[] | select(.metadata.container.tags | any(startswith("migrate-"))) ] 
        | sort_by(.created_at) | reverse | .[5:] | .[].id' \
      | xargs -I {} gh api -X DELETE user/packages/container/calorietracker/versions/{}
```

> **Note**: Both cleanup steps require `GITHUB_TOKEN` with `packages:write` permission. Add `permissions: packages: write` to the workflow.

---

## Files to Create

| # | File | Purpose |
|---|------|---------|
| 1 | `.github/workflows/pr-checks.yml` | PR validation (typecheck, lint, test, coverage, SonarQube Cloud) |
| 2 | `.github/workflows/deploy-staging.yml` | Build + deploy staging Container App on develop push |
| 3 | `.github/workflows/deploy-prod.yml` | Build + deploy prod Container App + MiniPC on main push |
| 4 | `.github/dependabot.yml` | Dependabot config (npm, daily) |
| 5 | `sonar-project.properties` | SonarQube Cloud project config |

### Files to Modify

| # | File | Change |
|---|------|--------|
| 6 | `vite.config.ts` | Add coverage thresholds |
| 7 | `infra/terraform/modules/container-app/main.tf` | Add Loki env vars to Alloy sidecar, mount `config.alloy` |
| 8 | `infra/terraform/modules/container-app/variables.tf` | Add Loki secret name inputs |
| 9 | `infra/terraform/kv-secrets/main.tf` | Add 3 Loki KV secrets (endpoint, user, password) |
| 10 | `infra/terraform/kv-secrets/variables.tf` | Add Loki secret value inputs |
| 11 | `infra/terraform/main.tf` | Pass Loki secret names to container-app module |
| 12 | `infra/terraform/outputs.tf` | Add Loki outputs for deploy.sh |
| 13 | `infra/terraform/scripts/deploy.sh` | Pass Loki values to kv-secrets tfvars |

### Grafana Alloy Log Collection

Alloy sidecar currently only pushes metrics to Prometheus. Add Loki log collection:

1. **`infra/terraform/config/config.alloy`** — Alloy config file:
   - `discovery.docker` to discover the app container in the same pod
   - `loki.process` to tail app container stdout, parse Pino JSON, extract fields as labels
   - `loki.write` to push to Grafana Cloud Loki (using Loki env vars)
2. **Loki secrets in Key Vault** — `grafana-cloud-loki-endpoint`, `grafana-cloud-loki-user`, `grafana-cloud-loki-password` (same SA token as Prometheus, different user ID)
3. **Container app module** — mount `config.alloy` as a volume, add 3 Loki env vars to the Alloy sidecar
4. **Grafana dashboard** — create a log dashboard in the `CalorieTracker` folder (via grafana-stack state)

---

## Prerequisites (manual, before step 19)

1. **SonarQube Cloud**: Create account at sonarcloud.io, link GitHub repo, generate `SONAR_TOKEN`
2. **Azure service principal**: `az ad sp create-for-rbac --name calorietracker-ci --role contributor --scopes /subscriptions/<sub>/resourceGroups/rg-calorietracker` → save JSON as `AZURE_CREDENTIALS` secret
3. **GHCR PAT**: GitHub PAT with `write:packages` + `read:packages` scope → save as `GHCR_PAT` secret. Same PAT used by step 18 deploy.sh for Container App registry pull auth
4. **GitHub push protection**: Enable in repo Settings → Code security → Push protection
5. **Branch protection**: Already provisioned via step 18 Terraform (`github_branch_protection` for `develop` and `main`). No manual setup needed
6. **Qodo**: Install GitHub App from qodo.io, connect to repo
7. **Tailscale OAuth client**: Create in Tailscale admin → Settings → OAuth clients. Grant `tag:ci` tag capability. Store client ID + secret as GitHub secrets `TS_OAUTH_CLIENT_ID` / `TS_OAUTH_SECRET`
8. **Tailscale ACL**: Add rule: `tag:ci` → SSH only to `tag:minipc:22`. MiniPC must be tagged `tag:minipc` in Tailscale admin
9. **Tailscale SSH**: Ensure SSH is enabled on the MiniPC node in Tailscale ACLs
10. **SOPS_AGE_KEY**: Store the age private key content as `SOPS_AGE_KEY` GitHub secret (enables future in-workflow secret decryption)

---

## Implementation Phases

| Phase | Tasks |
|-------|-------|
| **Phase 1: Config files** | Write all workflow YAMLs, dependabot.yml, sonar-project.properties |
| **Phase 2: Coverage config** | Add Vitest coverage thresholds to vite.config.ts |
| **Phase 3: GitHub setup** | Configure secrets, push protection, Qodo (manual). Branch protection via step 18 Terraform |
| **Phase 4: Test** | Push to develop, verify staging deploy. Push to main, verify prod + MiniPC deploy |
| **Phase 5: Log collection** | Add Loki secrets to KV, create `config.alloy`, update container-app module to mount config + add Loki env vars, apply Terraform, add Grafana log dashboard |

---

## Cost

All $0 for a solo developer:

| Tool | Cost |
|------|------|
| GitHub Actions | 2,000 min/month free (self-hosted fallback: unlimited on MiniPC). Switch: `runs-on: ubuntu-latest` → `runs-on: self-hosted` in each workflow. Manual one-line change when GitHub warns about minute usage |
| GHCR | 500MB free storage. Retention cleanup job (keep last 10 tags) runs in CI to stay within limit. Two images per deploy (app + migration) fill this fast without cleanup |
| SonarQube Cloud | $0 (public repo / under 50k LOC private) |
| Dependabot | $0 (public repo — full alerts, version updates, secret scanning, CodeQL) |
| Trivy | $0 (open-source, always free regardless of repo visibility) |
| Qodo | $0 (250 credits/month) |
| GitHub push protection | $0 (public repo) |
| **Total** | **$0/month** |

> **Note**: Dependabot full features (secret scanning, push protection, CodeQL) and SonarQube Cloud unlimited are free for **public repos only**. While the repo is private, Dependabot covers basic dependency alerts and Trivy covers container/IaC scanning. Full coverage unlocks when the repo goes public after steps 18+19.

---

## Review Amendments

Changes applied after consistency review with step-18:

| # | Issue | Resolution |
|---|-------|-----------|
| 1 | Migration job name `calorietracker-migrate-staging` doesn't exist | Changed to `calorietracker-migrate` (single job, triggered twice with different DATABASE_URL — matches step-18 deploy.sh) |
| 2 | Migration image not updated before job trigger | Added `--image ghcr.io/.../calorietracker:migrate-<sha>` to `az containerapp job start` so job runs with freshly built image |
| 3 | DATABASE_URL not passed to migration job | Added `--env-vars DATABASE_URL="${{ secrets.STAGING_DB_URL }}"` / `"${{ secrets.PROD_DB_URL }}"` — matches step-18 pattern |
| 4 | Migration images never cleaned up (unique `migrate-<sha>` tags persist forever) | Added separate cleanup step for migration images (keep last 5) alongside untagged app image cleanup |
| 5 | Missing GitHub secrets for DB URLs | Added `PROD_DB_URL` and `STAGING_DB_URL` to secrets table |
| 6 | Coverage thresholds may fail immediately | Added calibration note — measure current coverage first, set thresholds below it, raise over time |
| 7 | MiniPC CI/CD vs Ansible scope unclear | Added note: Ansible provisions initial state (step 18), CI/CD deploys ongoing updates via SSH only. CI does not manage config files or host-level setup |
| 8 | Missing `SOPS_AGE_KEY` for CI secret decryption | Added `SOPS_AGE_KEY` to GitHub secrets table + prerequisites. Added note on secret sourcing strategy (manual vs SOPS-decrypted) |
