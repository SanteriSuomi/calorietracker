variable "resource_group_name" {
  type = string
}

variable "location" {
  type = string
}

variable "environment_name" {
  type = string

  validation {
    condition     = contains(["prod", "staging"], var.environment_name)
    error_message = "environment_name must be \"prod\" or \"staging\"."
  }
}

variable "container_app_env_id" {
  type = string
}

variable "container_app_env_default_domain" {
  type = string
}

variable "ghcr_image" {
  type = string
}

variable "key_vault_name" {
  type = string
}

variable "database_url_secret" {
  type = string
}

variable "auth_secret" {
  type = string
}

variable "encryption_secret" {
  type = string
}

variable "blob_connection_secret" {
  type = string
}

variable "grafana_prom_endpoint_secret" {
  type = string
}

variable "grafana_prom_user_secret" {
  type = string
}

variable "grafana_prom_password_secret" {
  type = string
}

variable "tags" {
  type    = map(string)
  default = {}
}
