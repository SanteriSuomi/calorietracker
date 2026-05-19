#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ANSIBLE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ -z "${TS_AUTHKEY:-}" ]; then
  SECRETS_FILE="$ANSIBLE_DIR/../../secrets/terraform_secrets.env"
  ENCRYPTED_FILE="$ANSIBLE_DIR/../../secrets/terraform_secrets.env.encrypted"

  if [ -f "$SECRETS_FILE" ]; then
    export TS_AUTHKEY=$(grep '^TS_AUTHKEY=' "$SECRETS_FILE" | cut -d= -f2-)
  elif [ -f "$ENCRYPTED_FILE" ]; then
    export TS_AUTHKEY=$(sops -d --input-type dotenv --output-type dotenv "$ENCRYPTED_FILE" | grep '^TS_AUTHKEY=' | cut -d= -f2-)
  fi

  if [ -z "${TS_AUTHKEY:-}" ]; then
    echo "Error: TS_AUTHKEY not set. Export it or add to terraform_secrets.env"
    exit 1
  fi
fi

docker build -t ansible-dev "$ANSIBLE_DIR" -f "$ANSIBLE_DIR/Dockerfile" --quiet

docker run -it --rm \
  --cap-add=NET_ADMIN \
  --name ansible-dev \
  -e TS_AUTHKEY \
  -e "SOPS_AGE_KEY=${SOPS_AGE_KEY:-}" \
  -v "${SOPS_AGE_KEY_FILE:-$HOME/.config/sops/age/keys.txt}:/home/ansible/.config/sops/age/keys.txt:ro" \
  -v "$ANSIBLE_DIR":/ansible \
  ansible-dev
