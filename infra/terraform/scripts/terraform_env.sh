#!/usr/bin/env bash
set -euo pipefail

SECRETS_FILE="$(cd "$(dirname "$0")" && pwd)/../../secrets/terraform_providers.env.encrypted"

if [ ! -f "$SECRETS_FILE" ]; then
  echo "Error: $SECRETS_FILE not found"
  echo "Create it with: sops infra/secrets/terraform_providers.env.encrypted"
  return 1 2>/dev/null || exit 1
fi

echo "Decrypting provider credentials..."
eval "$(sops -d "$SECRETS_FILE")"

echo "Exported: CLOUDFLARE_API_TOKEN, GITHUB_TOKEN, GRAFANA_AUTH"
echo "Azure auth: using az CLI (run 'az login' if not authenticated)"
