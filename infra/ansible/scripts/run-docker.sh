#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ANSIBLE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ -z "${TS_AUTHKEY:-}" ]; then
  source "$SCRIPT_DIR/ansible_env.sh"
fi

if [ -z "${TS_AUTHKEY:-}" ]; then
  echo "Error: TS_AUTHKEY not set. Export it or run: source infra/ansible/scripts/ansible_env.sh"
  exit 1
fi

docker build -t ansible-dev "$ANSIBLE_DIR" -f "$ANSIBLE_DIR/Dockerfile" --quiet

docker run -it --rm \
  --cap-add=NET_ADMIN \
  --device /dev/net/tun \
  --name ansible-dev \
  -e TS_AUTHKEY \
  -e "SOPS_AGE_KEY=${SOPS_AGE_KEY:-}" \
  -v "${SOPS_AGE_KEY_FILE:-$HOME/.config/sops/age/keys.txt}:/home/ansible/.config/sops/age/keys.txt:ro" \
  -v "$ANSIBLE_DIR":/ansible \
  ansible-dev
