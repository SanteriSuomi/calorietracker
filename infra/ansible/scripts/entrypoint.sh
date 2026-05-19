#!/usr/bin/env bash
set -euo pipefail

if [ -z "${TS_AUTHKEY:-}" ]; then
  echo "Error: TS_AUTHKEY env var required"
  echo "Usage: docker run -e TS_AUTHKEY=tskey-auth-... ..."
  exit 1
fi

tailscaled --state=/tmp/tailscaled.state --socket=/tmp/tailscaled.sock &
sleep 2

tailscale up --authkey="${TS_AUTHKEY}" --ephemeral --accept-routes

echo ""
echo "Tailscale connected. Ready."
echo "Commands:"
echo "  ansible minipc -i inventory.yml -m ping"
echo "  ansible-playbook calorietracker.yml"
echo ""

exec "$@"
