#!/usr/bin/env bash
set -euo pipefail

echo "=== One-time Terraform state backend setup ==="

RG_NAME="rg-calorietracker-tfstate"
LOCATION="swedencentral"
SA_NAME="stcalorietrackertf"
CONTAINER_NAME="tfstate"

echo "Creating resource group..."
az group create --name "$RG_NAME" --location "$LOCATION"

echo "Creating storage account..."
az storage account create \
  --name "$SA_NAME" \
  --resource-group "$RG_NAME" \
  --location "$LOCATION" \
  --sku Standard_LRS \
  --min-tls-version TLS1_2 \
  --allow-blob-public-access false

echo "Creating blob container..."
az storage container create \
  --name "$CONTAINER_NAME" \
  --account-name "$SA_NAME"

echo "Enabling versioning + soft delete..."
az storage account blob-service-properties update \
  --account-name "$SA_NAME" \
  --enable-versioning true \
  --enable-delete-retention true \
  --delete-retention-days 30 \
  --enable-container-delete-retention true \
  --container-delete-retention-days 30

echo "=== Done ==="
echo "Storage account: $SA_NAME"
echo "Container: $CONTAINER_NAME"
