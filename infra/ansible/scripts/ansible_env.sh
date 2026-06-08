#!/usr/bin/env bash

SECRETS_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../../secrets/ansible_secrets.env.encrypted"

if [ ! -f "$SECRETS_FILE" ]; then
  echo "Error: $SECRETS_FILE not found"
  echo "Pull the latest from git — the encrypted file should be at infra/secrets/ansible_secrets.env.encrypted"
  echo "To edit values: sops infra/secrets/ansible_secrets.env.encrypted"
  return 1 2>/dev/null || exit 1
fi

if [ -z "${SOPS_AGE_KEY_FILE:-}" ] && [ -z "${SOPS_AGE_KEY:-}" ]; then
  _default_key="$HOME/.config/sops/age/keys.txt"
  if [ -f "$_default_key" ]; then
    export SOPS_AGE_KEY_FILE="$_default_key"
    echo "Auto-detected SOPS_AGE_KEY_FILE=$_default_key"
  fi
fi

if [ -z "${SOPS_AGE_KEY_FILE:-}" ] && [ -z "${SOPS_AGE_KEY:-}" ]; then
  echo "Error: SOPS_AGE_KEY_FILE or SOPS_AGE_KEY must be set"
  echo "Either: export SOPS_AGE_KEY_FILE=<path-to-keys.txt>"
  echo "    or: place your age key at ~/.config/sops/age/keys.txt"
  return 1 2>/dev/null || exit 1
fi

echo "Decrypting Ansible secrets..."
while IFS= read -r line; do
  [[ -z "$line" || "$line" == \#* ]] && continue
  key="${line%%=*}"
  value="${line#*=}"
  export "$key=$value"
done < <(sops -d --input-type dotenv --output-type dotenv "$SECRETS_FILE")

echo "Exported: TS_AUTHKEY"
