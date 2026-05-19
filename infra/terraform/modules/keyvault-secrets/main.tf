resource "azurerm_key_vault_access_policy" "deployer" {
  key_vault_id = var.key_vault_id
  tenant_id    = var.tenant_id
  object_id    = var.deployer_object_id

  secret_permissions = ["Get", "List", "Set", "Delete", "Recover", "Purge"]
}

resource "azurerm_key_vault_secret" "grafana_prom_endpoint" {
  name         = "grafana-cloud-prom-endpoint"
  value        = var.grafana_prom_endpoint
  key_vault_id = var.key_vault_id

  depends_on = [azurerm_key_vault_access_policy.deployer]
}

resource "azurerm_key_vault_secret" "grafana_prom_user" {
  name         = "grafana-cloud-prom-user"
  value        = var.grafana_prom_user_id
  key_vault_id = var.key_vault_id

  depends_on = [azurerm_key_vault_access_policy.deployer]
}

resource "azurerm_key_vault_secret" "grafana_prom_password" {
  name         = "grafana-cloud-prom-password"
  value        = var.grafana_prom_password
  key_vault_id = var.key_vault_id

  depends_on = [azurerm_key_vault_access_policy.deployer]
}

resource "azurerm_key_vault_secret" "database_url" {
  name         = "database-url"
  value        = var.prod_database_url
  key_vault_id = var.key_vault_id

  depends_on = [azurerm_key_vault_access_policy.deployer]
}

resource "azurerm_key_vault_secret" "staging_database_url" {
  name         = "staging-database-url"
  value        = var.staging_database_url
  key_vault_id = var.key_vault_id

  depends_on = [azurerm_key_vault_access_policy.deployer]
}

resource "azurerm_key_vault_secret" "auth_secret" {
  name         = "better-auth-secret"
  value        = var.auth_secret
  key_vault_id = var.key_vault_id

  depends_on = [azurerm_key_vault_access_policy.deployer]
}

resource "azurerm_key_vault_secret" "staging_auth_secret" {
  name         = "staging-better-auth-secret"
  value        = var.staging_auth_secret
  key_vault_id = var.key_vault_id

  depends_on = [azurerm_key_vault_access_policy.deployer]
}

resource "azurerm_key_vault_secret" "encryption_secret" {
  name         = "encryption-secret"
  value        = var.encryption_secret
  key_vault_id = var.key_vault_id

  depends_on = [azurerm_key_vault_access_policy.deployer]
}

resource "azurerm_key_vault_secret" "staging_encryption_secret" {
  name         = "staging-encryption-secret"
  value        = var.staging_encryption_secret
  key_vault_id = var.key_vault_id

  depends_on = [azurerm_key_vault_access_policy.deployer]
}

resource "azurerm_key_vault_secret" "blob_connection" {
  name         = "azure-blob-connection-string"
  value        = var.blob_connection_string
  key_vault_id = var.key_vault_id

  depends_on = [azurerm_key_vault_access_policy.deployer]
}

resource "azurerm_key_vault_secret" "staging_blob_connection" {
  name         = "staging-azure-blob-connection-string"
  value        = var.blob_connection_string
  key_vault_id = var.key_vault_id

  depends_on = [azurerm_key_vault_access_policy.deployer]
}
