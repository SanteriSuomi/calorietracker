output "app_name" {
  value = azurerm_container_app.this.name
}

output "app_fqdn" {
  value = "${azurerm_container_app.this.name}.${var.container_app_env_default_domain}"
}

output "identity_principal_id" {
  value = azurerm_container_app.this.identity[0].principal_id
}
