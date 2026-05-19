#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TF_MAIN="$SCRIPT_DIR/.."
TF_GRAFANA="$SCRIPT_DIR/../grafana-stack"

source "$SCRIPT_DIR/terraform_env.sh"

echo "=== Destroying grafana-stack Terraform state ==="
terraform -chdir="$TF_GRAFANA" destroy -auto-approve

echo ""
echo "=== Destroying main Terraform state ==="
terraform -chdir="$TF_MAIN" destroy -auto-approve

echo ""
echo "=== Done ==="
