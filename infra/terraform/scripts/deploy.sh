#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TF_MAIN="$SCRIPT_DIR/.."

source "$SCRIPT_DIR/terraform_env.sh"

echo "=== Applying main Terraform state ==="
terraform -chdir="$TF_MAIN" apply -auto-approve

echo ""
echo "=== Generating grafana-stack terraform.tfvars ==="
terraform -chdir="$TF_MAIN" output -json | bash "$SCRIPT_DIR/generate-grafana-tfvars.sh"

echo "=== Applying grafana-stack Terraform state ==="
terraform -chdir="$SCRIPT_DIR/../grafana-stack" init
terraform -chdir="$SCRIPT_DIR/../grafana-stack" apply -auto-approve

echo ""
echo "=== Done ==="
