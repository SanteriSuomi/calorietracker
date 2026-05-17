output "prod_url" {
  value = "https://${module.container_app_prod.app_fqdn}"
}

output "staging_url" {
  value = "https://${module.container_app_staging.app_fqdn}"
}

output "cloudflare_domain" {
  value = var.cloudflare_domain
}

output "keyvault_name" {
  value = module.keyvault.key_vault_name
}

output "postgres_fqdn" {
  value = module.postgres.server_fqdn
}

output "storage_account_name" {
  value = module.storage.storage_account_name
}

output "grafana_cloud_url" {
  value = "https://${var.grafana_cloud_stack_name}.grafana.net"
}
