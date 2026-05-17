variable "resource_group_name" {
  type = string
}

variable "location" {
  type = string
}

variable "subnet_id" {
  type = string
}

variable "private_dns_zone_id" {
  type = string
}

variable "administrator_login" {
  type = string
}

variable "administrator_password" {
  type      = string
  sensitive = true
}

variable "sku_name" {
  type    = string
  default = "B1ms"
}

variable "storage_mb" {
  type    = number
  default = 32768
}

variable "postgres_version" {
  type    = string
  default = "16"
}

variable "prod_db_name" {
  type    = string
  default = "calorietracker"
}

variable "staging_db_name" {
  type    = string
  default = "calorietracker_staging"
}

variable "tags" {
  type    = map(string)
  default = {}
}
