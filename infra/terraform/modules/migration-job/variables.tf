variable "resource_group_name" {
  type = string
}

variable "location" {
  type = string
}

variable "container_app_env_id" {
  type = string
}

variable "ghcr_image" {
  type = string
}

variable "database_url_secret" {
  type = string
}

variable "key_vault_id" {
  type = string
}

variable "tags" {
  type    = map(string)
  default = {}
}
