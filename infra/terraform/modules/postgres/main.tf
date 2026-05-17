terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }
}

resource "azurerm_postgresql_flexible_server" "this" {
  name                          = "psql-calorietracker"
  resource_group_name           = var.resource_group_name
  location                      = var.location
  version                       = var.postgres_version
  sku_name                      = var.sku_name
  storage_mb                    = var.storage_mb
  administrator_login           = var.administrator_login
  administrator_password        = var.administrator_password
  geo_redundant_backup_enabled  = false
  delegated_subnet_id           = var.subnet_id
  private_dns_zone_id           = var.private_dns_zone_id
  tags                          = var.tags
}

resource "azurerm_postgresql_flexible_server_database" "prod" {
  name      = var.prod_db_name
  server_id = azurerm_postgresql_flexible_server.this.id
}

resource "azurerm_postgresql_flexible_server_database" "staging" {
  name      = var.staging_db_name
  server_id = azurerm_postgresql_flexible_server.this.id
}

resource "azurerm_postgresql_flexible_server_configuration" "pgbouncer" {
  name      = "pgbouncer.enabled"
  server_id = azurerm_postgresql_flexible_server.this.id
  value     = "1"
}
