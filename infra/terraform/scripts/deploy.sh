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

echo ""
echo "=== Generating Ansible minipc vars ==="
terraform -chdir="$TF_MAIN" output -json | bash "$SCRIPT_DIR/../../ansible/scripts/generate-minipc-vars.sh"

echo "=== Applying grafana-stack Terraform state ==="
TF_GRAFANA="$SCRIPT_DIR/../grafana-stack"
if [ -f "$TF_GRAFANA/terraform.tfvars.encrypted" ]; then
  sops -d --input-type binary --output-type binary "$TF_GRAFANA/terraform.tfvars.encrypted" > "$TF_GRAFANA/terraform.tfvars"
fi
terraform -chdir="$TF_GRAFANA" init
terraform -chdir="$TF_GRAFANA" apply -auto-approve
rm -f "$TF_GRAFANA/terraform.tfvars"

echo ""
echo "=== Done ==="
