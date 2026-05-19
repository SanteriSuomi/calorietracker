terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }
}

# PgBouncer not supported on Burstable SKU — re-enable after upgrading to GeneralPurpose
# resource "azurerm_postgresql_flexible_server_configuration" "pgbouncer" {
#   name      = "pgbouncer.enabled"
#   server_id = azurerm_postgresql_flexible_server.this.id
#   value     = "true"
# }

resource "azurerm_postgresql_flexible_server" "this" {
  name                          = "psql-calorietracker"
  resource_group_name           = var.resource_group_name
  location                      = var.location
  version                       = var.postgres_version
  sku_name                      = var.sku_name
  storage_mb                    = var.storage_mb
  administrator_login           = var.administrator_login
  administrator_password        = var.administrator_password
  backup_retention_days         = 14
  geo_redundant_backup_enabled  = false
  delegated_subnet_id           = var.subnet_id
  private_dns_zone_id           = var.private_dns_zone_id
  public_network_access_enabled = false
  tags                          = var.tags

  maintenance_window {
    day_of_week  = 0
    start_hour   = 3
    start_minute = 0
  }

  lifecycle {
    ignore_changes = [zone]
  }
}

resource "azurerm_postgresql_flexible_server_database" "prod" {
  name      = var.prod_db_name
  server_id = azurerm_postgresql_flexible_server.this.id
}

resource "azurerm_postgresql_flexible_server_database" "staging" {
  name      = var.staging_db_name
  server_id = azurerm_postgresql_flexible_server.this.id
}
