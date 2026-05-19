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
  value = module.grafana_cloud.stack_url
}

output "grafana_service_account_id" {
  value = module.grafana_cloud.service_account_id
}

output "grafana_prom_remote_endpoint" {
  value = module.grafana_cloud.prom_remote_write_endpoint
}

output "grafana_prom_user_id" {
  value = module.grafana_cloud.prom_user_id
}

output "grafana_prom_password" {
  value     = module.grafana_cloud.prom_password
  sensitive = true
}

output "grafana_service_account_token" {
  value     = module.grafana_cloud.prom_password
  sensitive = true
}

output "grafana_loki_url" {
  value = module.grafana_cloud.loki_url
}

output "grafana_loki_user_id" {
  value = module.grafana_cloud.loki_user_id
}
