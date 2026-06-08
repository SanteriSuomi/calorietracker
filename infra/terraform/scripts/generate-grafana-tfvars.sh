#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TF_GRAFANA="$SCRIPT_DIR/../grafana-stack"

if [ -t 0 ]; then
  OUTPUTS=$(terraform -chdir="$SCRIPT_DIR/.." output -json)
else
  OUTPUTS=$(cat)
fi

grafana_stack_url=$(echo "$OUTPUTS" | jq -r '.grafana_cloud_url.value')
grafana_service_account_token=$(echo "$OUTPUTS" | jq -r '.grafana_service_account_token.value')
prom_remote_endpoint=$(echo "$OUTPUTS" | jq -r '.grafana_prom_remote_endpoint.value')
prom_user_id=$(echo "$OUTPUTS" | jq -r '.grafana_prom_user_id.value')
prom_password=$(echo "$OUTPUTS" | jq -r '.grafana_prom_password.value')
loki_url=$(echo "$OUTPUTS" | jq -r '.grafana_loki_url.value')
loki_user_id=$(echo "$OUTPUTS" | jq -r '.grafana_loki_user_id.value')

PLAINTEXT="$TF_GRAFANA/terraform.tfvars"
ENCRYPTED="$TF_GRAFANA/terraform.tfvars.encrypted"

cat > "$PLAINTEXT" <<EOF
grafana_stack_url             = "${grafana_stack_url}"
grafana_service_account_token = "${grafana_service_account_token}"
prom_remote_endpoint          = "${prom_remote_endpoint}"
prom_user_id                  = "${prom_user_id}"
prom_password                 = "${prom_password}"
loki_url                      = "${loki_url}"
loki_user_id                  = "${loki_user_id}"
EOF

echo "Generated $PLAINTEXT"

sops -e --input-type binary --output-type binary "$PLAINTEXT" > "$ENCRYPTED"
rm "$PLAINTEXT"
echo "Encrypted $ENCRYPTED (plaintext removed)"
