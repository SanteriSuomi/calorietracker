terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }
}

resource "azurerm_storage_account" "this" {
  name                     = "stcaltrack01"
  resource_group_name      = var.resource_group_name
  location                 = var.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  min_tls_version          = "TLS1_2"
  tags                     = var.tags
}

resource "azurerm_storage_container" "prod" {
  name                  = "calorietracker-images"
  storage_account_name  = azurerm_storage_account.this.name
  container_access_type = "private"
}

resource "azurerm_storage_container" "staging" {
  name                  = "calorietracker-staging-images"
  storage_account_name  = azurerm_storage_account.this.name
  container_access_type = "private"
}

resource "azurerm_storage_account_network_rules" "this" {
  storage_account_id         = azurerm_storage_account.this.id
  default_action             = "Deny"
  virtual_network_subnet_ids = [var.subnet_id]
}
