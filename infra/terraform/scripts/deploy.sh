#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TF_DIR="$(dirname "$SCRIPT_DIR")"
SECRETS_DIR="$(dirname "$TF_DIR")/secrets"

echo "=== CalorieTracker Deploy ==="

echo "Checking Azure CLI auth..."
az account show > /dev/null || { echo "Run 'az login' first"; exit 1; }

echo "Decrypting Terraform vars..."
sops -d "$SECRETS_DIR/terraform.tfvars.encrypted" > "$TF_DIR/terraform.tfvars"

echo "Running terraform init..."
terraform -chdir="$TF_DIR" init -backend-config="resource_group_name=rg-calorietracker-tfstate" \
  -backend-config="storage_account_name=stcalorietrackertf" \
  -backend-config="container_name=tfstate" \
  -backend-config="key=terraform.tfstate"

echo "Running terraform plan..."
terraform -chdir="$TF_DIR" plan -var-file="terraform.tfvars" -out=tfplan

echo ""
echo "Review the plan above. Press Enter to apply, Ctrl+C to cancel."
read -r

echo "Running terraform apply..."
terraform -chdir="$TF_DIR" apply tfplan

echo ""
echo "=== Deploy Complete ==="
terraform -chdir="$TF_DIR" output
echo ""
echo "Next steps:"
echo "  1. Set Key Vault secrets: az keyvault secret set --vault-name <kv> --name <secret> --value <value>"
echo "  2. Set GHCR registry: az containerapp registry set --name <app> --resource-group rg-calorietracker --server ghcr.io --username SanteriSuomi --password <PAT>"
echo "  3. Run migration: az containerapp job start --name calorietracker-migrate --resource-group rg-calorietracker"
echo "  4. Generate origin cert: $SCRIPT_DIR/generate-origin-cert.sh"
