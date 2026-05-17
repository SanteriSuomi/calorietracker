variable "azure_location" {
  type    = string
  default = "swedencentral"
}

variable "azure_resource_group_name" {
  type    = string
  default = "rg-calorietracker"
}

variable "azure_vnet_address_space" {
  type    = string
  default = "10.0.0.0/16"
}

variable "azure_container_apps_subnet_cidr" {
  type    = string
  default = "10.0.0.0/23"
}

variable "azure_postgres_subnet_cidr" {
  type    = string
  default = "10.0.2.0/26"
}

variable "cloudflare_zone_id" {
  type = string
}

variable "cloudflare_domain" {
  type = string
}

variable "ghcr_image" {
  type    = string
  default = "ghcr.io/santerisuomi/calorietracker:placeholder"
}

variable "ghcr_username" {
  type    = string
  default = "SanteriSuomi"
}

variable "postgres_sku" {
  type    = string
  default = "B1ms"
}

variable "postgres_storage_mb" {
  type    = number
  default = 32768
}

variable "postgres_version" {
  type    = string
  default = "16"
}

variable "db_admin_username" {
  type    = string
  default = "ctadmin"
}

variable "db_admin_password" {
  type      = string
  sensitive = true
}

variable "staging_db_name" {
  type    = string
  default = "calorietracker_staging"
}

variable "prod_db_name" {
  type    = string
  default = "calorietracker"
}

variable "keyvault_sku" {
  type    = string
  default = "standard"
}

variable "github_repo" {
  type    = string
  default = "SanteriSuomi/calorietracker"
}

variable "grafana_cloud_stack_name" {
  type    = string
  default = "calorietracker"
}

variable "grafana_cloud_region_slug" {
  type    = string
  default = "prod_us_east_0"
}

variable "budget_amount" {
  type    = number
  default = 25
}

variable "budget_notification_emails" {
  type = list(string)
}

variable "tags" {
  type = map(string)
  default = {
    environment = "production"
    project     = "calorietracker"
  }
}
