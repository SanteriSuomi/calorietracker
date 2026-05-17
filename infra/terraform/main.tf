provider "azurerm" {
  features {}
}

provider "cloudflare" {}

provider "github" {
  owner = split("/", var.github_repo)[0]
}

provider "grafana" {}

data "azurerm_client_config" "current" {}

module "network" {
  source = "./modules/network"

  resource_group_name        = var.azure_resource_group_name
  location                   = var.azure_location
  vnet_address_space         = var.azure_vnet_address_space
  container_apps_subnet_cidr = var.azure_container_apps_subnet_cidr
  postgres_subnet_cidr       = var.azure_postgres_subnet_cidr
  tags                       = var.tags
}

module "log_analytics" {
  source = "./modules/log-analytics"

  resource_group_name = var.azure_resource_group_name
  location            = var.azure_location
  tags                = var.tags
}

module "container_app_env" {
  source = "./modules/container-app-env"

  resource_group_name         = var.azure_resource_group_name
  location                    = var.azure_location
  subnet_id                   = module.network.container_apps_subnet_id
  log_analytics_workspace_id  = module.log_analytics.workspace_id
  log_analytics_workspace_key = module.log_analytics.primary_shared_key
  tags                        = var.tags
}

module "postgres" {
  source = "./modules/postgres"

  resource_group_name    = var.azure_resource_group_name
  location               = var.azure_location
  subnet_id              = module.network.postgres_subnet_id
  private_dns_zone_id    = module.network.private_dns_zone_id
  administrator_login    = var.db_admin_username
  administrator_password = var.db_admin_password
  sku_name               = var.postgres_sku
  storage_mb             = var.postgres_storage_mb
  postgres_version       = var.postgres_version
  prod_db_name           = var.prod_db_name
  staging_db_name        = var.staging_db_name
  tags                   = var.tags
}

module "storage" {
  source = "./modules/storage"

  resource_group_name = var.azure_resource_group_name
  location            = var.azure_location
  subnet_id           = module.network.container_apps_subnet_id
  tags                = var.tags
}

module "keyvault" {
  source = "./modules/keyvault"

  resource_group_name = var.azure_resource_group_name
  location            = var.azure_location
  tenant_id           = data.azurerm_client_config.current.tenant_id
  tags                = var.tags
}

module "grafana_cloud" {
  source = "./modules/grafana-cloud"

  stack_name  = var.grafana_cloud_stack_name
  region_slug = var.grafana_cloud_region_slug
  tags        = var.tags
}

resource "azurerm_key_vault_secret" "grafana_prom_endpoint" {
  name         = "grafana-cloud-prom-endpoint"
  value        = module.grafana_cloud.prom_remote_write_endpoint
  key_vault_id = module.keyvault.key_vault_id
}

resource "azurerm_key_vault_secret" "grafana_prom_user" {
  name         = "grafana-cloud-prom-user"
  value        = "${module.grafana_cloud.prom_user_id}"
  key_vault_id = module.keyvault.key_vault_id
}

resource "azurerm_key_vault_secret" "grafana_prom_password" {
  name         = "grafana-cloud-prom-password"
  value        = module.grafana_cloud.prom_password
  key_vault_id = module.keyvault.key_vault_id
}

resource "azurerm_key_vault_access_policy" "prod" {
  key_vault_id = module.keyvault.key_vault_id
  tenant_id    = data.azurerm_client_config.current.tenant_id
  object_id    = module.container_app_prod.identity_principal_id

  secret_permissions = ["Get", "List"]
}

resource "azurerm_key_vault_access_policy" "staging" {
  key_vault_id = module.keyvault.key_vault_id
  tenant_id    = data.azurerm_client_config.current.tenant_id
  object_id    = module.container_app_staging.identity_principal_id

  secret_permissions = ["Get", "List"]
}

module "container_app_prod" {
  source = "./modules/container-app"

  environment_name                 = "prod"
  resource_group_name              = var.azure_resource_group_name
  container_app_env_id             = module.container_app_env.environment_id
  container_app_env_default_domain = module.container_app_env.default_domain
  ghcr_image                       = var.ghcr_image
  key_vault_id                     = module.keyvault.key_vault_id
  key_vault_name                   = module.keyvault.key_vault_name
  database_url_secret              = "database-url"
  auth_secret                      = "better-auth-secret"
  encryption_secret                = "encryption-secret"
  blob_connection_secret           = "azure-blob-connection-string"
  grafana_prom_endpoint_secret     = "grafana-cloud-prom-endpoint"
  grafana_prom_user_secret         = "grafana-cloud-prom-user"
  grafana_prom_password_secret     = "grafana-cloud-prom-password"
  tags                             = var.tags

  depends_on = [module.keyvault, azurerm_key_vault_secret.grafana_prom_endpoint]
}

module "container_app_staging" {
  source = "./modules/container-app"

  environment_name                 = "staging"
  resource_group_name              = var.azure_resource_group_name
  container_app_env_id             = module.container_app_env.environment_id
  container_app_env_default_domain = module.container_app_env.default_domain
  ghcr_image                       = var.ghcr_image
  key_vault_id                     = module.keyvault.key_vault_id
  key_vault_name                   = module.keyvault.key_vault_name
  database_url_secret              = "staging-database-url"
  auth_secret                      = "staging-better-auth-secret"
  encryption_secret                = "staging-encryption-secret"
  blob_connection_secret           = "staging-azure-blob-connection-string"
  grafana_prom_endpoint_secret     = "grafana-cloud-prom-endpoint"
  grafana_prom_user_secret         = "grafana-cloud-prom-user"
  grafana_prom_password_secret     = "grafana-cloud-prom-password"
  tags                             = var.tags

  depends_on = [module.keyvault, azurerm_key_vault_secret.grafana_prom_endpoint]
}

module "migration_job" {
  source = "./modules/migration-job"

  resource_group_name  = var.azure_resource_group_name
  location             = var.azure_location
  container_app_env_id = module.container_app_env.environment_id
  ghcr_image           = var.ghcr_image
  database_url_secret  = "database-url"
  key_vault_id         = module.keyvault.key_vault_id
  tags                 = var.tags
}

module "cloudflare" {
  source = "./modules/cloudflare"

  zone_id            = var.cloudflare_zone_id
  domain             = var.cloudflare_domain
  container_app_fqdn = module.container_app_prod.app_fqdn
}

module "github" {
  source = "./modules/github"

  repository = var.github_repo
}
