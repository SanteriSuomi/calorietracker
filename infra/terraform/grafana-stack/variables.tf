variable "grafana_stack_url" {
  type = string
}

variable "grafana_service_account_token" {
  type      = string
  sensitive = true
}

variable "prom_remote_endpoint" {
  type = string
}

variable "prom_user_id" {
  type = string
}

variable "prom_password" {
  type      = string
  sensitive = true
}

variable "loki_url" {
  type = string
}

variable "loki_user_id" {
  type = string
}
