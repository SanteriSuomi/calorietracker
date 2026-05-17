# Step 18: Production Infrastructure & Deployment Readiness

> Complete plan for deploying CalorieTracker to Azure (production + staging) and MiniPC (personal).
> Terraform manages Azure + Cloudflare + GitHub resources. Ansible provisions MiniPC. SOPS + age for secrets. Grafana Cloud Free for observability.

## Decisions

| Decision | Choice |
|----------|--------|
| Container registry | GHCR only (no ACR) |
| IaC tool (cloud) | Terraform (multi-provider: azurerm, cloudflare, github, grafana) |
| IaC tool (MiniPC) | Ansible (idempotent, rerunnable, drift-detecting) |
| Secrets management | SOPS + age — encrypted files committed to repo, decrypt to gitignored plaintext. One age keypair for all secrets |
| Azure region | Sweden Central |
| Edge gateway | Cloudflare Free — DNS proxy, DDoS, 1 WAF rate limiting rule, SSL |
| SSL (Azure) | Cloudflare Origin Certificate (15yr) + Full (strict) mode |
| Origin bypass protection | CF-Connecting-IP middleware rejects non-Cloudflare traffic on Azure |
| PostgreSQL networking | Private access via delegated subnet + Private DNS Zone |
| Storage VNet access | Service endpoint (free) |
| MiniPC deployment | Ansible playbook deploys compose at `~/calorietracker/compose.yml` |
| Local networking | Caddy reverse proxy + Tailscale Serve (tailnet HTTPS only, no Funnel) |
| CI runner | GitHub-hosted (free tier, 2,000 min/month). Fallback: self-hosted on MiniPC if exceeded |
| CI → MiniPC deploy | Tailscale GitHub Action (ephemeral node, `tag:ci`, SSH to MiniPC). ACL: `tag:ci` → SSH only to `tag:minipc` |
| AI for Azure | User-configured (no Azure OpenAI) |
| AI for MiniPC | Pre-configured via env vars → local llama-server (`Qwen3.6-35B-A3B-Q8_0.gguf`) |
| Auth for Azure | Required (BetterAuth) |
| Auth for MiniPC | `DISABLE_AUTH=true` (auto-login as default user, personal use only) |
| MiniPC access | Tailnet + LAN. No public access (no Funnel). LAN is second-class citizen |
| Branching | Any branch (PR) → develop (staging) → main (prod) |
| Deploy targets | `develop` → Azure staging, `main` → Azure prod + MiniPC |
| DB migrations | Container App Job runs `drizzle-kit migrate` inside VNet (versioned migrations; `drizzle-kit push:pg` for dev/scratch only) |
| GitHub username | `SanteriSuomi` |
| Tailnet | `taila9242b` |
| Tailscale URL | `https://fedora.taila9242b.ts.net` (Serve only, no Funnel) |
| GHCR image | `ghcr.io/santerisuomi/calorietracker` |
| Repo visibility | Private (PAT for GHCR pull). Switches to public after steps 18+19 |
| Logging (Azure) | Log Analytics Workspace (container stdout/stderr, system events) |
| Logging (MiniPC) | `docker compose logs` + Grafana Alloy ships to Grafana Cloud Loki |
| Observability | Grafana Cloud Free (Prometheus metrics + Loki logs). /metrics endpoint via prom-client. Grafana Alloy collector (not Agent — EOL) |
| GHCR pull auth | Container App registry secret (set via `deploy.sh`), Key Vault for runtime secrets only |
| Container Apps private endpoint | Not used (~$18/month saved). Public HTTPS + auth is the gatekeeper |
| Rate limiting (Azure) | Two layers: Cloudflare WAF rule (coarse, edge) + PostgreSQL upsert counters (fine-grained, app) |
| Rate limiting (MiniPC) | In-memory Map-with-TTL (single replica, sufficient) |
| Azure env detection | `AZURE_DEPLOYMENT=true` env var (set on Container Apps, used by DISABLE_AUTH guard) |
| GitHub branch protection | Provisioned via Terraform github provider |
| Terraform state | Azure Storage Account (separate RG, LRS, blob versioning, ~$0) |
| External services | Dependabot + Trivy + SonarQube Cloud (all $0 when repo goes public) |
| SOPS age key | `~/.config/sops/age/keys.txt` — backed up offline. One key for all secrets |

---

## Architecture

```
┌─ Cloudflare (Free) ───────────────────────────────────────┐
│  DNS proxy (orange cloud) → Azure Container Apps FQDN      │
│  SSL: Full (strict) + Origin Certificate (15yr)            │
│  DDoS protection (L3/L4/L7, unmetered)                     │
│  1 WAF rate limiting rule (10s window, IP-only, path-only) │
│  Bot fight mode (basic)                                     │
└──────────────────────────┬─────────────────────────────────┘
                           │
                           ▼
┌─ Azure (Sweden Central) ──────────────────────────────────┐
│  RG: rg-calorietracker                                     │
│  Budget Alert: $25/month threshold                          │
│  VNet: 10.0.0.0/16 (service endpoint: Microsoft.Storage)   │
│  ├── Subnet: container-apps (10.0.0.0/23)                  │
│  │   └── Container Apps Environment (VNet-injected,        │
│  │       Log Analytics integration)                         │
│  │       ├── Container App: calorietracker (prod)          │
│  │       │   ├── Image: ghcr.io/santerisuomi/calorietracker│
│  │       │   │   (placeholder initially, CI updates later)  │
│  │       │   ├── Custom domain: Cloudflare Origin Cert     │
│  │       │   ├── Auth: BetterAuth (required)               │
│  │       │   ├── CF-IP middleware (reject direct access)   │
│  │       │   ├── AI: User-configured                       │
│  │       │   ├── DB: PostgreSQL (private, via VNet)        │
│  │       │   ├── Images: Blob Storage (Key Vault secrets)  │
│  │       │   ├── ORIGIN: auto-constructed from FQDN        │
│  │       │   ├── Health probe: HTTP GET /api/health        │
│  │       │   ├── Metrics: /metrics (prom-client)           │
│  │       │   ├── Grafana Alloy sidecar (scrapes /metrics)  │
│  │       │   ├── Rate limiting: PG upsert counters         │
│  │       │   └── Scale: min 0, max 3                       │
│  │       ├── Container App: calorietracker-staging         │
│  │       │   └── Same config, separate DB + blob container │
│  │       └── Container App Job: calorietracker-migrate     │
│  │           └── Lightweight image, runs drizzle-kit migrate│
│  ├── Subnet: postgres (10.0.2.0/26)                        │
│  │   └── PostgreSQL Flexible Server (no public IP)         │
│  │       ├── PgBouncer enabled (built-in, connection pool) │
│  │       ├── DB: calorietracker (prod)                     │
│  │       │   └── Table: rate_limits (upsert rate counters) │
│  │       ├── DB: calorietracker_staging (staging)          │
│  │       │   └── Table: rate_limits (upsert rate counters) │
│  │       └── Private DNS Zone (hostname resolution in VNet)│
│  ├── Storage Account (Standard LRS)                        │
│  │   ├── Blob: calorietracker-images (prod)                │
│  │   └── Blob: calorietracker-staging-images (staging)     │
│  ├── Key Vault (Standard)                                   │
│  │   ├── Managed identity access policy for Container Apps │
│  │   ├── Prod secrets: database-url, better-auth-secret,   │
│  │   │   encryption-secret, azure-blob-connection-string   │
│  │   └── Staging secrets: staging-database-url, etc.       │
│  └── Log Analytics Workspace (container logs)              │
│                                                             │
│  RG: rg-calorietracker-tfstate (separate, for state)       │
│  └── Storage Account: tfstate (LRS, blob versioning)       │
└────────────────────────────────────────────────────────────┘

┌─ Grafana Cloud (Free) ───────────────────────────────────┐
│  Prometheus datasource (metrics from Azure + MiniPC)       │
│  Loki datasource (logs from MiniPC, future: Azure too)     │
│  Dashboards: request rate, latency, errors, AI usage       │
│  Terraform-provisioned: stack, datasources, folder         │
└───────────────────────────────────────────────────────────┘

┌─ MiniPC (Fedora 44, 192.168.1.233) ──────────────────────┐
│  Tailscale Serve → https://fedora.taila9242b.ts.net       │
│                   → localhost:8529 (tailnet only, no Funnel)│
│                                                             │
│  ~/calorietracker/compose.yml (deployed by Ansible):       │
│  ├── caddy (reverse proxy, :8529)                          │
│  │   └── Host: fedora.taila9242b.ts.net → calorietracker  │
│  │       else → redirect to https://fedora.taila9242b.ts.net│
│  ├── calorietracker (GHCR image, internal port only)       │
│  │   ├── Auth: DISABLE_AUTH=true (auto-login default user) │
│  │   ├── AI: AI_DEFAULT_* → host.docker.internal:8525      │
│  │   ├── DB: libsql (encrypted, volume-mounted)            │
│  │   ├── Images: local encrypted filesystem                 │
│  │   ├── Metrics: /metrics (prom-client)                   │
│  │   └── host.docker.internal reaches llama-server         │
│  └── grafana-alloy (scrapes /metrics + ships logs to Loki) │
│                                                             │
│  Provisioned by: ansible-playbook calorietracker.yml        │
│  CI/CD updates: GitHub-hosted runner connects via           │
│  Tailscale Action (ephemeral node, tag:ci) → SSH →         │
│  docker pull + compose up (step 19)                         │
│                                                             │
│  LAN note: http://192.168.1.233:8529 works with auth      │
│  disabled but redirects to tailnet URL. Non-tailnet LAN    │
│  devices cannot follow the redirect.                       │
└────────────────────────────────────────────────────────────┘

Branch Strategy:
  any branch (PR) ──→ develop ──→ main
                         │           │
                         ▼           ▼
              Azure staging    Azure production
            (calorietracker-  (calorietracker)
             staging)         + MiniPC production
```

---

## Part A: Code Changes

### 1. DISABLE_AUTH — Auto-login as Default User

**Files to modify**: `src/hooks.server.ts`, `src/lib/server/auth.ts`

When `DISABLE_AUTH=true`:
- `handleAuthGuard` skips auth checks
- Auto-creates a "default" user in DB if not exists (`default@local`, via BetterAuth API or direct DB insert matching BetterAuth's user schema)
- Sets `event.locals.user` and `event.locals.session` with the default user
- No login page, no session cookies — direct access
- **Hard failure**: `process.exit(1)` when `DISABLE_AUTH=true` AND `AZURE_DEPLOYMENT=true` — prevents accidental use on production/staging. `AZURE_DEPLOYMENT` is set on Container Apps but never on MiniPC
- Azure deployment: env var not set → normal auth flow unchanged

### 2. AI_DEFAULT_* — Environment Variable Fallbacks

**Files to modify**: `src/routes/api/ai/analyze/+server.ts`, Settings page/UI

New env vars (read via `$env/dynamic/private`):
- `AI_DEFAULT_ENDPOINT` — fallback for `userSettings.aiEndpointUrl`
- `AI_DEFAULT_API_KEY` — fallback for `userSettings.aiApiKey`
- `AI_DEFAULT_MODEL` — fallback for `userSettings.aiModel`

Logic: Insert fallback between DB read and null check. User settings take precedence. If null/empty, fall back to env var.

**Security**: AI_DEFAULT_API_KEY must NOT be exposed to the frontend. Settings UI shows "Using default endpoint" / "Using default model" but not the actual API key value.

### 3. /api/health Endpoint

**File to create**: `src/routes/api/health/+server.ts`

Unauthenticated health endpoint that returns 200. Bypassed by auth guard in `handleAuthGuard` (add path check before auth validation). Used by Docker healthcheck and Container Apps health probe.

### 4. Image Upload Size Limit

**File to modify**: `src/routes/api/images/upload/+server.ts` (or equivalent)

Add max file size validation (e.g., 10MB). Return 413 if exceeded.

### 5. Per-IP Rate Limiting on AI Endpoint

**Files to create/modify**: `src/lib/server/rate-limiter.ts`, `src/routes/api/ai/analyze/+server.ts`, `drizzle/pg/schema.ts`

Two layers protect Azure deployments — Cloudflare WAF rule (coarse, edge-level) and PostgreSQL rate limiter (fine-grained, per-endpoint):

**Abstraction** (`src/lib/server/rate-limiter.ts`):
- Factory function returns either `PgRateLimiter` or `InMemoryRateLimiter`
- Common interface: `checkRateLimit(ip: string): Promise<{ allowed: boolean; remaining: number }>`

**Azure — PostgreSQL upsert** (`DATABASE_PROVIDER=pg`):
- `rate_limits` table in `drizzle/pg/schema.ts`: `(ip TEXT, window_start TIMESTAMPTZ, count INTEGER, PRIMARY KEY (ip, window_start))`
- Upsert query: `INSERT ... ON CONFLICT (ip, window_start) DO UPDATE SET count = count + 1 RETURNING count`
- Fixed-window algorithm (1-minute windows per IP)
- Cleanup: `DELETE FROM rate_limits WHERE window_start < now() - interval '1 hour'` — runs on `setInterval` (every 10 min) and startup
- Atomic across replicas via PG. <2ms latency with PgBouncer. $0 extra cost
- Complements Cloudflare WAF rule: PG handles fine-grained per-endpoint limits (e.g. 30 AI calls/min), WAF handles blunt-force abuse (100+ req/10s)

**MiniPC — In-memory Map** (`DATABASE_PROVIDER=libsql`):
- Map-with-TTL, reset counters every minute. ~20 lines, no dependencies
- Single replica — no shared state needed
- No schema changes to SQLite

**Note**: In-memory approach is per-replica best-effort. With scale-to-zero, cold starts reset counters. Acceptable for MiniPC (single user). Azure uses PG-backed approach for correctness across replicas.

### 6. CF-Connecting-IP Middleware

**File to modify**: `src/hooks.server.ts`

On `AZURE_DEPLOYMENT=true`: check for `CF-Connecting-IP` header on all requests (except `/api/health`).
- If missing: return 403 with log warning (request bypassed Cloudflare by hitting ACA FQDN directly)
- On MiniPC (`AZURE_DEPLOYMENT` not set): skip check entirely
- ~20 lines in the existing `handle` function, before auth guard

### 7. /metrics Endpoint (prom-client)

**Files to create**: `src/routes/api/metrics/+server.ts`, `src/lib/server/metrics.ts`

- `src/lib/server/metrics.ts`: prom-client registry singleton + custom metrics (request counter, AI call counter, meal counter) + default metrics (CPU, memory, event loop lag)
- `src/routes/api/metrics/+server.ts`: Returns prom-client registry output (text/plain). Unauthenticated (scraped by Grafana Alloy sidecar locally within the Container App, or by Grafana Alloy container on MiniPC)
- ~50 lines total, zero external dependencies beyond `prom-client`

### 8. .env.example Update

Add all missing env vars:

```
DATABASE_PROVIDER=libsql
LOG_LEVEL=info
DISABLE_AUTH=false
AZURE_DEPLOYMENT=false
AI_DEFAULT_ENDPOINT=
AI_DEFAULT_API_KEY=
AI_DEFAULT_MODEL=
```

### 9. Dockerfile Healthcheck Update

Change healthcheck from `http://127.0.0.1:3000/` to `http://127.0.0.1:3000/api/health`.

---

## Part B: Terraform Infrastructure (`infra/terraform/`)

### File Structure

```
infra/
├── terraform/                          # Cloud provisioning
│   ├── main.tf                         # Root: provider config + module calls
│   ├── variables.tf                    # Input variables
│   ├── outputs.tf                      # Outputs (URLs, resource IDs)
│   ├── backend.tf                      # Azure Storage remote state config
│   ├── versions.tf                     # Required provider versions
│   ├── modules/
│   │   ├── network/                    # VNet + 2 subnets + service endpoint + Private DNS Zone
│   │   │   ├── main.tf
│   │   │   ├── variables.tf
│   │   │   └── outputs.tf
│   │   ├── log-analytics/              # Log Analytics Workspace
│   │   ├── container-app-env/          # Container Apps Environment (VNet-injected)
│   │   ├── postgres/                   # Flexible Server + 2 DBs + PgBouncer config
│   │   ├── storage/                    # Storage Account + 2 blob containers + VNet rule
│   │   ├── keyvault/                   # Key Vault + access policy
│   │   ├── container-app/              # Container App (parameterized for prod/staging)
│   │   ├── migration-job/              # Container App Job for drizzle-kit migrate
│   │   ├── cloudflare/                 # DNS CNAME (proxied) + WAF rate limit rule + SSL
│   │   ├── grafana-cloud/              # Grafana Cloud stack + datasources + dashboard folder
│   │   └── github/                     # Branch protection (develop + main)
│   └── scripts/
│       ├── deploy.sh                   # terraform init/plan/apply + post-apply tasks
│       ├── setup-backend.sh            # One-time: create tfstate RG + storage account
│       └── generate-origin-cert.sh     # Generate Cloudflare Origin Certificate
├── ansible/                            # MiniPC provisioning
│   ├── inventory.yml                   # MiniPC host config (Tailscale IP)
│   ├── calorietracker.yml              # Main playbook
│   ├── requirements.yml                # Ansible collections (community.sops, community.docker)
│   ├── group_vars/
│   │   └── minipc.yml                  # Variables (SOPS-encrypted in-place, read natively by community.sops)
│   └── roles/
│       └── calorietracker/
│           ├── tasks/main.yml          # All tasks (prereqs, dirs, secrets, files, deploy)
│           ├── templates/
│           │   ├── compose.yml.j2      # Docker Compose template
│           │   ├── Caddyfile.j2        # Caddy config template
│           │   └── config.alloy.j2     # Grafana Alloy config template
│           └── handlers/main.yml       # Restart caddy, restart grafana-alloy
├── secrets/                            # SOPS-encrypted files (committed to repo)
│   ├── .sops.yaml                      # SOPS config (which key for which paths)
│   ├── dev.env.encrypted               # → .env (gitignored)
│   └── terraform.tfvars.encrypted      # → terraform/terraform.tfvars (gitignored)
└── migration/
    └── Dockerfile                      # Lightweight image: node + drizzle + migration files only
```

### Providers

| Provider | Version | Purpose |
|----------|---------|---------|
| `hashicorp/azurerm` | ~> 4.0 | All Azure resources |
| `cloudflare/cloudflare` | ~> 5.0 | DNS proxy, WAF rate limiting rule, SSL settings |
| `integrations/github` | ~> 6.0 | Branch protection rules |
| `grafana/grafana` | ~> 3.0 | Grafana Cloud stack + datasources |

### Terraform Resources

| Resource | Terraform Resource | Notes |
|----------|-------------------|-------|
| Resource Group | `azurerm_resource_group` | rg-calorietracker |
| VNet + Subnets | `azurerm_virtual_network` + `azurerm_subnet` | Delegations + service endpoints |
| Private DNS Zone | `azurerm_private_dns_zone` + `azurerm_private_dns_zone_virtual_network_link` | privatelink.postgres.database.azure.com |
| Log Analytics | `azurerm_log_analytics_workspace` | Per-GB 2022 pricing |
| Container Apps Env | `azurerm_container_app_environment` | VNet-injected, Log Analytics integration |
| Container App | `azurerm_container_app` | Identity, KV refs, health probes, scale rules, Grafana Alloy sidecar |
| Container App Job | `azurerm_container_app_job` | Manual trigger, runs drizzle-kit migrate |
| PostgreSQL | `azurerm_postgresql_flexible_server` + `_database` + `_configuration` | PgBouncer via server configuration resource |
| Storage Account | `azurerm_storage_account` + `azurerm_storage_container` + network rules | VNet access via service endpoint |
| Key Vault | `azurerm_key_vault` + `azurerm_key_vault_access_policy` | Managed identity access for Container Apps |
| Budget Alert | `azurerm_consumption_budget_resource_group` | $25/month threshold, email notification |
| **Cloudflare DNS** | **`cloudflare_dns_record`** | **CNAME proxied (orange cloud) to ACA FQDN** |
| **Cloudflare WAF** | **`cloudflare_ruleset`** | **1 rate limiting rule: 100 req/10s/IP on /api/*, block 10s** |
| **Grafana Cloud stack** | **`grafana_cloud_stack`** | **Free tier (10K series, 50GB logs)** |
| **Grafana datasources** | **`grafana_data_source`** | **Prometheus + Loki auto-configured** |
| **GitHub branch protection** | **`github_branch_protection`** | **develop: status checks; main: status checks + 1 approval** |

### Key Vault Secrets

| Secret (Prod) | Secret (Staging) | Value |
|---------------|-------------------|-------|
| `database-url` | `staging-database-url` | PostgreSQL connection string |
| `better-auth-secret` | `staging-better-auth-secret` | BETTER_AUTH_SECRET |
| `encryption-secret` | `staging-encryption-secret` | ENCRYPTION_SECRET |
| `azure-blob-connection-string` | `staging-azure-blob-connection-string` | Blob Storage connection string |
| `grafana-cloud-prom-endpoint` | (shared) | Grafana Cloud Prometheus remote write endpoint |
| `grafana-cloud-prom-user` | (shared) | Grafana Cloud Prometheus username |
| `grafana-cloud-prom-password` | (shared) | Grafana Cloud Prometheus API key |

> **Note**: GHCR pull auth is configured directly on Container Apps via `az containerapp registry set` (see deploy.sh). Key Vault stores runtime secrets only.

### Container App Configuration (parameterized module)

- **Registry**: `ghcr.io`, username `SanteriSuomi`, password set via `az containerapp registry set` in deploy.sh (not in Key Vault)
- **Image**: `ghcr.io/santerisuomi/calorietracker:placeholder` (CI/CD updates in step 19)
- **Managed identity**: System-assigned, Key Vault access policy
- **Env vars**: `AZURE_DEPLOYMENT=true`, plus Key Vault secret references
- **ORIGIN**: Auto-constructed from `appName.environmentDefaultDomain`
- **Ingress**: External, target port 3000, HTTPS
- **Health probe**: HTTP GET on `/api/health`
- **Scale**: min 0, max 3 (HTTP trigger ~100 concurrent requests/replica)
- **Active revisions mode**: Single
- **Sidecar**: Grafana Alloy (scrapes localhost:3000/metrics, pushes to Grafana Cloud Prometheus)

### Cloudflare Module Details

```
DNS:
  - CNAME record: app domain → ACA FQDN (proxied/orange cloud)
  - SSL mode: Full (strict)

Rate Limiting Rule (1 rule, Free tier limits):
  - Expression: http.request.uri.path contains "/api/"
  - Threshold: 100 requests per 10s per IP
  - Action: Block for 10s
  - Note: Complements PG rate limiter. This is coarse edge-level protection.
    PG limiter handles fine-grained per-endpoint limits (e.g. 30 AI calls/min).

Origin Certificate:
  - Generated via scripts/generate-origin-cert.sh (Cloudflare API)
  - 15-year validity, uploaded to ACA as custom domain cert binding
  - Private key never stored in Terraform state — generated and uploaded separately
```

### GitHub Module Details

```
Branch protection for 'develop':
  - Required status checks: typecheck, lint, tests
  - No required reviews (develop is staging)

Branch protection for 'main':
  - Required status checks: typecheck, lint, tests
  - Required reviews: 1 approval
```

### Terraform State Backend

Remote state in Azure Storage Account (separate resource group):

```hcl
# backend.tf
terraform {
  backend "azurerm" {
    resource_group_name  = "rg-calorietracker-tfstate"
    storage_account_name = "stcalorietrackertf"
    container_name       = "tfstate"
    key                  = "terraform.tfstate"
  }
}
```

State tracks the mapping between Terraform configuration and real cloud resources (resource IDs, properties, dependencies). Enables `terraform plan` (diff before apply), `terraform apply` (create/update/delete), and state locking (prevents concurrent applies).

**One-time setup** (`scripts/setup-backend.sh`):
```bash
az group create --name rg-calorietracker-tfstate --location swedencentral
az storage account create --name stcalorietrackertf --resource-group rg-calorietracker-tfstate --sku Standard_LRS --min-tls-version TLS1_2
az storage container create --name tfstate --account-name stcalorietrackertf
az storage account blob-service-properties update --account-name stcalorietrackertf --enable-versioning true --delete-retention-policy --days 30
```

Blob versioning + soft delete for state recovery. Blob leases for locking.

### deploy.sh Flow

1. Verify `az` CLI auth + correct subscription (`az account show`)
2. Decrypt Terraform vars: `sops -d secrets/terraform.tfvars.encrypted > terraform/terraform.tfvars`
3. `terraform init -backend-config=...`
4. `terraform plan -var-file=terraform.tfvars -out=tfplan`
5. Review plan output, confirm
6. `terraform apply tfplan`
7. Set Key Vault secrets via `az keyvault secret set` (secrets not in tfstate)
8. Set GHCR registry credentials on Container Apps via `az containerapp registry set` (separate for prod + staging)
9. Generate + upload Cloudflare Origin Certificate: `scripts/generate-origin-cert.sh`
10. Build + push lightweight migration image to GHCR
11. Trigger Container App Job: `az containerapp job start --name calorietracker-migrate` (runs `drizzle-kit migrate` against both prod and staging PG inside VNet)
12. Poll job execution status until completion — fail deploy if migration fails
13. Output: prod URL, staging URL, Cloudflare domain, Key Vault name, Grafana Cloud URL

**Prerequisites**: Azure CLI installed, `az login`, Azure free account (may include 12 months free PG B1ms), Cloudflare account with domain, Grafana Cloud account (free), SOPS + age installed, age key at `~/.config/sops/age/keys.txt`.

> **Note**: `drizzle-kit generate:pg` produces versioned migration SQL files committed to the repo. `drizzle-kit push:pg` remains available for dev/scratch but prod/staging always uses versioned migrations via the job.

---

## Part C: Secrets Management (SOPS + age)

### Overview

All secret files are encrypted with SOPS using an age keypair and committed to the repo. Decrypted plaintext files are gitignored. One age private key decrypts everything.

### Setup (one-time)

```bash
# Generate age keypair
age-keygen -o ~/.config/sops/age/keys.txt

# Back up the private key somewhere safe (password manager, USB)
# The public key is printed during generation — used in .sops.yaml
```

### `.sops.yaml` (`infra/secrets/.sops.yaml`)

```yaml
keys:
  - &admin age1<your-public-key>

creation_rules:
  - path_regex: ^infra/secrets/.*\.encrypted$
    key_groups:
      - age:
          - *admin
  - path_regex: ^infra/ansible/group_vars/.*\.yml$
    key_groups:
      - age:
          - *admin
```

### Secret Files

| Encrypted (committed) | Decrypted (gitignored) | Used by |
|------------------------|------------------------|---------|
| `infra/secrets/dev.env.encrypted` | `.env` | Local development (Vite/tsx) |
| `infra/secrets/terraform.tfvars.encrypted` | `infra/terraform/terraform.tfvars` | Terraform |
| `infra/ansible/group_vars/minipc.yml` | Decrypted at runtime by `community.sops` | Ansible |

### Workflow

```bash
# Decrypt dev env
sops -d infra/secrets/dev.env.encrypted > .env

# Decrypt Terraform vars
sops -d infra/secrets/terraform.tfvars.encrypted > infra/terraform/terraform.tfvars

# Ansible vars — no manual decrypt needed, community.sops reads encrypted file natively
ansible-playbook infra/ansible/calorietracker.yml

# Edit secrets in-place (decrypts, opens editor, re-encrypts)
SOPS_EDITOR=code sops infra/secrets/dev.env.encrypted
```

### `.gitignore` additions

```
.env
infra/terraform/terraform.tfvars
```

### Key Management

- Age private key lives at `~/.config/sops/age/keys.txt`
- Back up offline (password manager, USB). Lose it = lose access to all encrypted secrets
- Optionally encrypt the age key itself with a passphrase — then "one password" is literally one passphrase
- For CI: `SOPS_AGE_KEY` environment variable (stored as GitHub secret) enables in-workflow decryption

---

## Part D: MiniPC Setup (Ansible)

### Ansible Role: `calorietracker`

Provisions CalorieTracker on the MiniPC. Replaces the former `setup.sh` with idempotent, rerunnable tasks.

### `infra/ansible/inventory.yml`

```yaml
all:
  hosts:
    minipc:
      ansible_host: 100.65.89.53    # Tailscale IP
      ansible_user: sants
      ansible_python_interpreter: /usr/bin/python3
```

### `infra/ansible/calorietracker.yml`

```yaml
---
- name: Deploy CalorieTracker to MiniPC
  hosts: minipc
  become: true
  roles:
    - calorietracker
```

### `infra/ansible/requirements.yml`

```yaml
---
collections:
  - name: community.sops
  - name: community.docker
```

Install: `ansible-galaxy collection install -r infra/ansible/requirements.yml`

### `infra/ansible/group_vars/minipc.yml`

SOPS-encrypted in-place. Ansible reads it natively via `community.sops`. Contents (when decrypted):

```yaml
tailscale_hostname: fedora
tailscale_tailnet: taila9242b
tailscale_url: "https://{{ tailscale_hostname }}.{{ tailscale_tailnet }}.ts.net"
ghcr_user: SanteriSuomi
ghcr_pat: ""
better_auth_secret: ""
encryption_secret: ""
grafana_cloud_prom_endpoint: ""
grafana_cloud_prom_user: ""
grafana_cloud_prom_password: ""
grafana_cloud_loki_endpoint: ""
grafana_cloud_loki_user: ""
grafana_cloud_loki_password: ""
ai_default_endpoint: "http://host.docker.internal:8525/v1"
ai_default_api_key: "sk-dummy"
ai_default_model: "Qwen3.6-35B-A3B-Q8_0.gguf"
```

### `roles/calorietracker/tasks/main.yml`

Task breakdown:

1. **Prerequisites check** — fail if Docker or Tailscale not installed/authenticated
2. **Directories** — `/opt/dockerdata/{calorietracker,caddy,grafana-alloy}`, `/opt/dockerdata/calorietracker/backups`
3. **Secrets** — generate `better_auth_secret` and `encryption_secret` if not provided in vars (using `openssl rand -hex 32`)
4. **Caddyfile** — template `Caddyfile.j2` to `/opt/dockerdata/caddy/Caddyfile` — notifies handler to restart caddy
5. **Grafana Alloy config** — template `config.alloy.j2` to `/opt/dockerdata/grafana-alloy/config.alloy` — notifies handler to restart grafana-alloy
6. **GHCR login** — `community.docker.docker_login` with `ghcr_pat` var
7. **compose.yml** — template `compose.yml.j2` to `~/calorietracker/compose.yml`
8. **Docker compose up** — `community.docker.docker_compose_v2: project_src=~/calorietracker state=present`
9. **Tailscale Serve** — `ansible.builtin.shell: tailscale serve --bg 8529` (with `creates` check so it's idempotent)
10. **SQLite backup cron** — `ansible.builtin.cron: name="sqlite-backup" hour=3 minute=0 job=...`

### `roles/calorietracker/handlers/main.yml`

- Restart Caddy container (when Caddyfile changes)
- Restart grafana-alloy container (when config.alloy changes)

### `roles/calorietracker/templates/compose.yml.j2`

Docker Compose template with Jinja2 variables from `group_vars/minipc.yml`:

```yaml
services:
  caddy:
    image: caddy:2
    container_name: caddy-ct
    ports:
      - "8529:8529"
    volumes:
      - /opt/dockerdata/caddy/Caddyfile:/etc/caddy/Caddyfile
    restart: unless-stopped

  calorietracker:
    image: ghcr.io/santerisuomi/calorietracker:latest
    container_name: calorietracker
    extra_hosts:
      - "host.docker.internal:host-gateway"
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=Europe/Helsinki
      - DISABLE_AUTH=true
      - DATABASE_URL=file:data/local.db
      - DATABASE_PROVIDER=libsql
      - STORAGE_PROVIDER=local
      - ORIGIN={{ tailscale_url }}
      - BETTER_AUTH_SECRET={{ better_auth_secret }}
      - ENCRYPTION_SECRET={{ encryption_secret }}
      - AI_DEFAULT_ENDPOINT={{ ai_default_endpoint }}
      - AI_DEFAULT_API_KEY={{ ai_default_api_key }}
      - AI_DEFAULT_MODEL={{ ai_default_model }}
    volumes:
      - /opt/dockerdata/calorietracker:/app/data
    expose:
      - "3000"
    restart: unless-stopped

  grafana-alloy:
    image: grafana/alloy:latest
    container_name: grafana-alloy
    volumes:
      - /opt/dockerdata/grafana-alloy/config.alloy:/etc/alloy/config.alloy
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - HOSTNAME=minipc
      - GRAFANA_CLOUD_PROM_ENDPOINT={{ grafana_cloud_prom_endpoint }}
      - GRAFANA_CLOUD_PROM_USER={{ grafana_cloud_prom_user }}
      - GRAFANA_CLOUD_PROM_PASSWORD={{ grafana_cloud_prom_password }}
      - GRAFANA_CLOUD_LOKI_ENDPOINT={{ grafana_cloud_loki_endpoint }}
      - GRAFANA_CLOUD_LOKI_USER={{ grafana_cloud_loki_user }}
      - GRAFANA_CLOUD_LOKI_PASSWORD={{ grafana_cloud_loki_password }}
    restart: unless-stopped
```

### `roles/calorietracker/templates/Caddyfile.j2`

```caddyfile
:8529 {
	@canonical host {{ tailscale_hostname }}.{{ tailscale_tailnet }}.ts.net
	handle @canonical {
		reverse_proxy calorietracker:3000
	}
	handle {
		redir {{ tailscale_url }}{uri} permanent
	}
}
```

### `roles/calorietracker/templates/config.alloy.j2`

Grafana Alloy config (HCL-like syntax, replaces the old YAML agent config):

```
prometheus.scrape "calorietracker" {
  targets = [{"__address__" = "calorietracker:3000"}]
  forward_to = [prometheus.remote_write.grafana_cloud.receiver]
  scrape_interval = "15s"
  metrics_path = "/metrics"
}

prometheus.remote_write "grafana_cloud" {
  endpoint {
    url = env("GRAFANA_CLOUD_PROM_ENDPOINT")
    basic_auth {
      username = env("GRAFANA_CLOUD_PROM_USER")
      password = env("GRAFANA_CLOUD_PROM_PASSWORD")
    }
  }
}

loki.source.docker "calorietracker" {
  host       = "unix:///var/run/docker.sock"
  targets    = discovery.docker.targets
  forward_to = [loki.write.grafana_cloud.receiver]
}

loki.write "grafana_cloud" {
  endpoint {
    url = env("GRAFANA_CLOUD_LOKI_ENDPOINT")
    basic_auth {
      username = env("GRAFANA_CLOUD_LOKI_USER")
      password = env("GRAFANA_CLOUD_LOKI_PASSWORD")
    }
  }
}
```

> **Note**: Grafana Alloy credentials are passed as environment variables in the compose template, sourced from `group_vars/minipc.yml`.

### Request Flow

```
Tailnet devices  ──→ Tailscale Serve (TLS)  ──→ localhost:8529 ──┐
LAN (http://192.168.1.233:8529) ─────────────────────────────── ──┤
                                                                     ▼
                                                            Caddy (HTTP :8529)
                                                            ├── Host: fedora.taila9242b.ts.net
                                                            │   → reverse_proxy calorietracker:3000
                                                            └── else
                                                                → 301 redirect to https://fedora.taila9242b.ts.net
```

ORIGIN = `https://fedora.taila9242b.ts.net`. All paths converge on one URL. No cookie/session issues.

No public access (no Funnel). LAN access redirects to tailnet URL — non-tailnet devices cannot follow the redirect (second-class citizen).

### Ansible vs CI/CD Split

- **Ansible** (step 18): provisions initial state — directories, config files, containers, cron, Tailscale Serve. Rerun anytime for drift detection
- **CI/CD** (step 19): deploys ongoing updates — SSH → `docker pull` + `docker compose up`. Does not manage config files or host-level setup

### Tailscale ACL Requirements

In Tailscale admin → Access Controls, add:

```jsonc
{
  "action": "accept",
  "src": ["tag:ci"],
  "dst": ["tag:minipc:22"]
}
```

- MiniPC must be tagged `tag:minipc` in Tailscale admin
- Ephemeral CI node uses `tag:ci`
- Limits CI to SSH only — no other tailnet access

---

## Part E: Branching Setup

### Git Flow

```bash
git checkout main
git checkout -b develop
git push -u origin develop
```

Set `develop` as default branch in GitHub repo settings.

### Workflow

- Any branch can PR to `develop`
- `develop` PRs to `main` for releases
- `develop` push triggers staging deploy (step 19)
- `main` push triggers prod deploy + MiniPC deploy (step 19)

### Branch Protection Rules

Provisioned via Terraform `github` provider (step 18 infra):
- **PRs to `develop`**: Require typecheck + lint + tests to pass
- **PRs to `main`**: Same checks + 1 manual approval

### Note on GHCR PAT

Fine-grained PAT with `read:packages` + `write:packages` scopes. Used for Container App image pull (read) and CI/CD push (write). Max expiry 1 year. Add rotation reminder in deploy.sh comments.

---

## Part F: Risk Mitigations

| Risk | Mitigation |
|------|-----------|
| DISABLE_AUTH accidentally enabled on Azure | **Hard failure** (`process.exit(1)`) when `DISABLE_AUTH=true` AND `AZURE_DEPLOYMENT=true`. Impossible to run without auth on Azure |
| GHCR PAT expires, deploys break | Use long-lived fine-grained PAT (1 year max). Rotation reminder in deploy.sh |
| Container App first deploy — image doesn't exist yet | Use `mcr.microsoft.com/aci/helloworld` as placeholder image. CI/CD updates with real image in step 19 |
| Container Apps endpoint is public | Auth required on all routes (except /api/health, /metrics). No private endpoint — saves ~$18/month fixed cost |
| ACA origin bypass (attacker hits ACA FQDN directly) | CF-Connecting-IP middleware rejects requests without the header on Azure. Prevents skipping Cloudflare DDoS/WAF/rate limiting |
| Cloudflare Origin Cert expires | 15-year validity — effectively a non-issue. Regenerate via script if needed |
| Rate limiting is per-replica (MiniPC only) | MiniPC is single-user, single replica — in-memory is sufficient. Azure uses PostgreSQL-backed rate limiting (shared across replicas) + Cloudflare WAF rule |
| LAN access breaks for non-tailnet devices | Accepted trade-off. LAN redirects to tailnet URL (`https://fedora.taila9242b.ts.net`). Non-tailnet LAN devices can't follow the redirect |
| GitHub-hosted runner free minutes exceeded | Fallback: switch to self-hosted runner on MiniPC. One-line change in each workflow |
| Terraform state corruption | Blob versioning + soft delete on state container. `terraform force-unlock` for stuck locks |
| Terraform provider drift | `versions.tf` pins exact major versions. `.terraform.lock.hcl` committed for reproducibility |
| PostgreSQL roles not manageable in Terraform | Use local exec provisioner or handle in deploy.sh. Terraform `azurerm` provider tracks issue #24990 |
| Age key lost | Back up `~/.config/sops/age/keys.txt` to password manager + offline storage. Without it, all encrypted secrets are unrecoverable |

---

## Part G: Files to Create / Modify

### New Files

| # | File | Purpose |
|---|------|---------|
| 1 | `src/routes/api/health/+server.ts` | Unauthenticated health endpoint |
| 2 | `src/lib/server/rate-limiter.ts` | Rate limiter abstraction (factory: PG or in-memory) |
| 3 | `src/routes/api/metrics/+server.ts` | Prometheus metrics endpoint |
| 4 | `src/lib/server/metrics.ts` | prom-client registry + custom metrics |
| 5 | `infra/terraform/main.tf` | Root module, provider config, module calls |
| 6 | `infra/terraform/variables.tf` | Input variables |
| 7 | `infra/terraform/outputs.tf` | Outputs (URLs, resource IDs) |
| 8 | `infra/terraform/backend.tf` | Remote state backend config |
| 9 | `infra/terraform/versions.tf` | Provider version constraints |
| 10 | `infra/terraform/modules/network/` (3 files) | VNet + subnets + Private DNS Zone |
| 11 | `infra/terraform/modules/log-analytics/` | Log Analytics Workspace |
| 12 | `infra/terraform/modules/container-app-env/` | Container Apps Environment |
| 13 | `infra/terraform/modules/postgres/` | PostgreSQL Flexible Server + DBs + PgBouncer |
| 14 | `infra/terraform/modules/storage/` | Storage Account + blob containers + VNet rule |
| 15 | `infra/terraform/modules/keyvault/` | Key Vault + access policy |
| 16 | `infra/terraform/modules/container-app/` | Container App (prod/staging, parameterized) |
| 17 | `infra/terraform/modules/migration-job/` | Container App Job for drizzle-kit migrate |
| 18 | `infra/terraform/modules/cloudflare/` | DNS CNAME + WAF rate limiting rule |
| 19 | `infra/terraform/modules/grafana-cloud/` | Grafana Cloud stack + datasources |
| 20 | `infra/terraform/modules/github/` | Branch protection rules (develop + main) |
| 21 | `infra/migration/Dockerfile` | Lightweight migration image |
| 22 | `infra/terraform/scripts/deploy.sh` | Terraform apply + post-apply tasks |
| 23 | `infra/terraform/scripts/setup-backend.sh` | One-time state storage setup |
| 24 | `infra/terraform/scripts/generate-origin-cert.sh` | Cloudflare Origin Certificate generation |
| 25 | `infra/ansible/inventory.yml` | MiniPC host config |
| 26 | `infra/ansible/calorietracker.yml` | Main playbook |
| 27 | `infra/ansible/requirements.yml` | Ansible collections (community.sops, community.docker) |
| 28 | `infra/ansible/group_vars/minipc.yml` | Variables (SOPS-encrypted in-place) |
| 29 | `infra/ansible/roles/calorietracker/tasks/main.yml` | All tasks |
| 30 | `infra/ansible/roles/calorietracker/templates/compose.yml.j2` | Docker Compose template |
| 31 | `infra/ansible/roles/calorietracker/templates/Caddyfile.j2` | Caddy config template |
| 32 | `infra/ansible/roles/calorietracker/templates/config.alloy.j2` | Grafana Alloy config template |
| 33 | `infra/ansible/roles/calorietracker/handlers/main.yml` | Service restart handlers |
| 34 | `infra/secrets/.sops.yaml` | SOPS encryption config |
| 35 | `infra/secrets/dev.env.encrypted` | Dev environment secrets |
| 36 | `infra/secrets/terraform.tfvars.encrypted` | Terraform variable secrets |

### Modified Files (code changes + docs)

| # | File | Change |
|---|------|--------|
| 37 | `src/hooks.server.ts` | DISABLE_AUTH + CF-IP middleware + /api/health bypass + hard fail if AZURE_DEPLOYMENT=true |
| 38 | `src/lib/server/auth.ts` | Helper to get/create default user |
| 39 | `src/routes/api/ai/analyze/+server.ts` | AI_DEFAULT_* fallback, rate limiter integration |
| 40 | `src/routes/api/images/upload/+server.ts` | Image upload size limit (10MB) |
| 41 | `drizzle/pg/schema.ts` | Add `rate_limits` table |
| 42 | Settings page/UI | Show default AI values when not configured (hide API key) |
| 43 | `.env.example` | Add all missing env vars (including AZURE_DEPLOYMENT) |
| 44 | `Dockerfile` | Update healthcheck to `/api/health` |
| 45 | `package.json` | Add `prom-client` dependency |
| 46 | `.gitignore` | Add `.env`, `infra/terraform/terraform.tfvars` |
| 47 | `docs/PLAN.md` | Mark step 18 complete |
| 48 | `docs/SCHEMA.md` | Update with rate_limits table |
| 49 | `README.md` | Tech stack, architecture overview, badges |
| 50 | `docs/ARCHITECTURE.md` | Deep architectural writeup (design decisions) |

---

## Part H: External Services

Enabled after repo goes public (post steps 18+19). All $0.

| Service | What | Setup effort | Overlap? |
|---------|------|-------------|----------|
| **GitHub Dependabot** | Dependency vulnerability alerts, auto-PRs for version updates, secret scanning, push protection, CodeQL | ~5 min (enable in repo settings) | Trivy scans containers/IaC (Dependabot doesn't) |
| **Trivy** | Container image + IaC misconfig scanning in CI | ~15 min (add `trivy-action` to CI workflow, step 19) | Dependabot auto-fixes deps (Trivy only detects) |
| **SonarQube Cloud** | SAST code quality, security hotspots, PR decoration, quality gates | ~30 min (sign up at sonarcloud.io, connect repo) | Neither Dependabot nor Trivy do SAST |

All three are complementary — no overlap, each covers a gap the others leave:
- **Dependabot**: dependency management + secret scanning + auto-fix PRs
- **Trivy**: container image CVEs + IaC misconfigs
- **SonarQube Cloud**: SAST code quality + security hotspots

Snyk is not needed — the trio covers Snyk's full capability set at $0 with no test limits (Snyk free tier: 200 SCA tests/month).

---

## Costs

### Azure (Sweden Central)

| Resource | Monthly |
|----------|---------|
| Container Apps (2 apps, ~0 replicas) | ~$0-5 |
| PostgreSQL Flexible Server B1ms | ~$12 (free first 12 months with Azure free account) |
| Blob Storage (<1GB) | < $1 |
| Key Vault | < $1 |
| Log Analytics (first 5GB free) | $0 |
| Terraform state storage | ~$0 |
| **Total** | **~$13-18/month** (or ~$1-6/month first year) |

> **Note**: Azure free account includes 12 months free PG B1ms. After expiry, budget increases from ~$1-6/month to ~$13-18/month. Budget alert at $25/month catches any overruns.

### Cloudflare

| Resource | Monthly |
|----------|---------|
| Cloudflare Free plan | $0 |

### Grafana Cloud

| Resource | Monthly |
|----------|---------|
| Grafana Cloud Free | $0 (10K metric series, 50GB logs) |

### MiniPC

| Resource | Monthly |
|----------|---------|
| All containers + Tailscale | $0 |
| GitHub-hosted runner | $0 (within 2,000 min/month) |
| **Total** | **$0** |

> **Note**: GHCR free tier includes 500MB storage. With two images (app + migration) and multiple tags per deploy, retention cleanup in step 19 CI workflow is essential to stay within the limit.

### External Services (after repo goes public)

| Service | Monthly |
|----------|---------|
| Dependabot + Secret Scanning + CodeQL | $0 (public repo) |
| Trivy | $0 (open source) |
| SonarQube Cloud | $0 (public repo) |

### Total: ~$13-18/month (no change from pre-Terraform plan)

---

## Implementation Phases

Execute in order. Code changes first (automated by agent), then infra files, then manual deployment.

| Phase | Tasks | Who |
|-------|-------|-----|
| **Phase 1: Code Changes** | DISABLE_AUTH, AI_DEFAULT_*, /api/health, image upload limit, rate limiting, CF-IP middleware, /metrics endpoint, .env.example, Dockerfile | Agent |
| **Phase 2: Terraform Infra** | Write all 10 modules + root configs + scripts + migration Dockerfile | Agent |
| **Phase 3: Ansible Role + SOPS** | Write Ansible role (playbook, tasks, templates, handlers, requirements), SOPS config + encrypted secret files | Agent |
| **Phase 4: Branching** | Create `develop` branch, push, set as default in GitHub | Agent |
| **Phase 5: Docs** | README.md, ARCHITECTURE.md, step-18.md, PLAN.md, SCHEMA.md | Agent |
| **Phase 6: Typecheck + Lint + Test** | Run pnpm check, pnpm lint, pnpm test | Agent |
| **Phase 7: Commit + PR** | Squash all work into one commit, create PR to main | Agent |
| **Phase 8: MiniPC Deployment** | Install collections (`ansible-galaxy install`), decrypt secrets (age key), run `ansible-playbook calorietracker.yml` | **Manual (user)** |
| **Phase 9: Azure Provisioning** | Decrypt secrets (`sops -d`), run setup-backend.sh (one-time), generate-origin-cert.sh (one-time), deploy.sh | **Manual (user)** |
| **Phase 10: Verify** | Test both environments | **Manual (user)** |
| **Phase 11: External Services** | Enable Dependabot, Trivy in CI (step 19), SonarQube Cloud — after repo goes public | **Manual (user)** |

---

## Future Steps (noted, not in step 18)

- **Load testing (k6)** — half a day, concrete performance numbers for CV ("optimized to handle X req/sec"). Scripts committed to repo, run in CI or ad-hoc. Results feed into Grafana for visual comparison over time
- **OAuth providers (Google/GitHub)** — BetterAuth supports social login out of the box. 1 day. Users expect it, shows auth breadth beyond email/password
- **Redis caching** — cache food database lookups, user settings, frequent queries. Appears in ~70% of backend job listings. Add when query latency becomes measurable
- **PWA (service worker + offline + installable)** — mobile-first app benefits directly. Service worker caches static assets, background sync for offline meal logging
- **Feature flags** — simple env-based or LaunchDarkly free tier. Gradual rollout of new features (e.g. AI photo analysis) without branching. Shows release management maturity
- **Cloudflare Pro upgrade** — WAF managed rules (OWASP), 2 rate limiting rules with 1-min windows, Super Bot Fight Mode. $20/month. Consider if abuse becomes a problem
- **Cloudflare Workers rate limiting** — custom edge-level per-endpoint rate limiting via Workers Rate Limiting binding. More flexible than WAF rules. Add if fine-grained edge rate limiting needed
- **Grafana Cloud Loki for Azure** — ship Pino JSON logs from Azure Container Apps to Grafana Cloud Loki via Grafana Alloy. Single pane of glass for both environments' logs. Natural follow-up to step 18 metrics setup
- **Full MiniPC Ansible playbook** — expand beyond CalorieTracker to cover the entire media server stack (arr stack, download stack, AI stack, OpenClaw, utilities). One playbook for full bare-metal recovery
- Async AI jobs (fire-and-forget background promise + polling endpoint)
- GitHub Issues + Projects + MCP server migration (after steps 18+19)
- Robot Framework E2E testing
- Testing improvements (API tests, coverage)
- Caddy + Tailscale auto-HTTPS for *.ts.net
- **Secret rotation** — monthly CI workflow generates new values and updates live systems in-place (GitHub secrets via `gh secret set`, Key Vault via `az keyvault secret set`, MiniPC via Ansible rerun). No git commits. Requires careful per-secret lifecycle planning: `BETTER_AUTH_SECRET` and Grafana API keys are straightforward; `ENCRYPTION_SECRET` needs a decrypt-old/re-encrypt-new migration; `GHCR_PAT` and `AZURE_CREDENTIALS` are manual (can't be auto-generated). Deferred until each secret's rotation strategy is thought through
- **Multi-region** — duplicate Terraform infra in a second Azure region, geo-routing via Cloudflare or Azure Front Door, PostgreSQL read replicas. Justified when latency requirements demand it (global SaaS). Not needed for single-country solo app
- **Microservice extraction + Kubernetes** (if app grows) — k3s on MiniPC (replaces Compose), AKS on Azure (replaces Container Apps), Kustomize for manifest management. Same container images, same health endpoint. Natural trigger: splitting into 2+ services (e.g. AI service extracted)
- **OpenTelemetry + distributed tracing** (Jaeger/Tempo) — follows requests across services. Essential after microservice split. Tempo integrates with existing Grafana stack
