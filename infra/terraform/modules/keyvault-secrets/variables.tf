variable "key_vault_id" {
  type = string
}

variable "tenant_id" {
  type = string
}

variable "deployer_object_id" {
  type = string
}

variable "prod_database_url" {
  type      = string
  sensitive = true
}

variable "staging_database_url" {
  type      = string
  sensitive = true
}

variable "auth_secret" {
  type      = string
  sensitive = true
}

variable "staging_auth_secret" {
  type      = string
  sensitive = true
}

variable "encryption_secret" {
  type      = string
  sensitive = true
}

variable "staging_encryption_secret" {
  type      = string
  sensitive = true
}

variable "blob_connection_string" {
  type      = string
  sensitive = true
}

variable "grafana_prom_endpoint" {
  type = string
}

variable "grafana_prom_user_id" {
  type = string
}

variable "grafana_prom_password" {
  type      = string
  sensitive = true
}
