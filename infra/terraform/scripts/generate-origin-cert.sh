#!/usr/bin/env bash
set -euo pipefail

echo "=== Generate Cloudflare Origin Certificate ==="

if [ $# -lt 1 ]; then
  echo "Usage: $0 <cloudflare-zone-id> [domain]"
  echo "Example: $0 abc123 calorietracker.example.com"
  exit 1
fi

ZONE_ID="$1"
DOMAIN="${2:-*.calorietracker.example.com calorietracker.example.com}"

echo "Generating origin certificate for: $DOMAIN"

RESPONSE=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/origin_certificates" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data "{
    \"hostnames\": [$(echo "$DOMAIN" | sed 's/ /\",\"/g' | sed 's/^/\"/' | sed 's/$/\"/')],
    \"requested_validity\": 5475,
    \"request_type\": \"origin-rsa\",
    \"csr\": \"\"
  }")

CERT=$(echo "$RESPONSE" | jq -r '.result.certificate')
KEY=$(echo "$RESPONSE" | jq -r '.result.private_key')

if [ "$CERT" = "null" ] || [ -z "$CERT" ]; then
  echo "Error generating certificate:"
  echo "$RESPONSE" | jq '.errors'
  exit 1
fi

echo "$CERT" > origin-cert.pem
echo "$KEY" > origin-key.pem

echo ""
echo "Certificate saved to:"
echo "  origin-cert.pem (public certificate)"
echo "  origin-key.pem (private key — keep secret!)"
echo ""
echo "Next: Upload to Azure Container App as custom domain certificate"
