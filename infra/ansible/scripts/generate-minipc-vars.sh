#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ANSIBLE_DIR="$SCRIPT_DIR/.."
GROUP_VARS="$ANSIBLE_DIR/group_vars"
EXAMPLE="$GROUP_VARS/minipc.yml.example"
ENCRYPTED="$GROUP_VARS/minipc.yml.encrypted"
PLAINTEXT="$GROUP_VARS/minipc.yml"

if [ -z "${SOPS_AGE_KEY_FILE:-}" ] && [ -z "${SOPS_AGE_KEY:-}" ]; then
  _default_key="$HOME/.config/sops/age/keys.txt"
  if [ -f "$_default_key" ]; then
    export SOPS_AGE_KEY_FILE="$_default_key"
  fi
fi

if [ -t 0 ]; then
  OUTPUTS=$(terraform -chdir="$ANSIBLE_DIR/../terraform" output -json)
else
  OUTPUTS=$(cat)
fi

better_auth_secret=$(echo "$OUTPUTS" | jq -r '.better_auth_secret.value')
encryption_secret=$(echo "$OUTPUTS" | jq -r '.encryption_secret.value')
prom_endpoint=$(echo "$OUTPUTS" | jq -r '.grafana_prom_remote_endpoint.value')
prom_user=$(echo "$OUTPUTS" | jq -r '.grafana_prom_user_id.value')
prom_password=$(echo "$OUTPUTS" | jq -r '.grafana_prom_password.value')
loki_endpoint=$(echo "$OUTPUTS" | jq -r '.grafana_loki_url.value')
loki_user=$(echo "$OUTPUTS" | jq -r '.grafana_loki_user_id.value')

if [ -f "$ENCRYPTED" ]; then
  echo "Decrypting existing $ENCRYPTED..."
  sops -d --input-type yaml --output-type yaml "$ENCRYPTED" > "$PLAINTEXT"
elif [ -f "$EXAMPLE" ]; then
  echo "Starting from $EXAMPLE..."
  cp "$EXAMPLE" "$PLAINTEXT"
else
  echo "Error: No $ENCRYPTED or $EXAMPLE found"
  exit 1
fi

update_var() {
  local key="$1" value="$2"
  sed -i "s|^${key}:.*|${key}: \"${value}\"|" "$PLAINTEXT"
}

update_var "better_auth_secret" "$better_auth_secret"
update_var "encryption_secret" "$encryption_secret"
update_var "grafana_cloud_prom_endpoint" "$prom_endpoint"
update_var "grafana_cloud_prom_user" "$prom_user"
update_var "grafana_cloud_prom_password" "$prom_password"
update_var "grafana_cloud_loki_endpoint" "$loki_endpoint"
update_var "grafana_cloud_loki_user" "$loki_user"
update_var "grafana_cloud_loki_password" "$prom_password"

sops -e --input-type yaml --output-type yaml "$PLAINTEXT" > "$ENCRYPTED"
rm "$PLAINTEXT"

echo "Updated $ENCRYPTED with terraform outputs (plaintext removed)"
