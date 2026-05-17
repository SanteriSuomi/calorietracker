output "server_fqdn" {
  value = azurerm_postgresql_flexible_server.this.fqdn
}

output "server_id" {
  value = azurerm_postgresql_flexible_server.this.id
}

output "prod_connection_string" {
  value     = "postgresql://${var.administrator_login}:${var.administrator_password}@${azurerm_postgresql_flexible_server.this.fqdn}:5432/${var.prod_db_name}?sslmode=require"
  sensitive = true
}

output "staging_connection_string" {
  value     = "postgresql://${var.administrator_login}:${var.administrator_password}@${azurerm_postgresql_flexible_server.this.fqdn}:5432/${var.staging_db_name}?sslmode=require"
  sensitive = true
}
