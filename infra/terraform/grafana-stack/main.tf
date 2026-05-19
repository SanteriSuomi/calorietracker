terraform {
  backend "azurerm" {
    resource_group_name  = "rg-calorietracker-tfstate"
    storage_account_name = "stcalorietrackertf"
    container_name       = "tfstate"
    key                  = "grafana-stack.tfstate"
  }

  required_version = ">= 1.9"

  required_providers {
    grafana = {
      source  = "grafana/grafana"
      version = "~> 3.0"
    }
  }
}

provider "grafana" {
  url  = var.grafana_stack_url
  auth = var.grafana_service_account_token
}

resource "grafana_data_source" "prometheus" {
  type = "prometheus"
  name = "prometheus"
  url  = var.prom_remote_endpoint

  basic_auth_enabled  = true
  basic_auth_username = "${var.prom_user_id}"

  secure_json_data_encoded = jsonencode({
    basicAuthPassword = var.prom_password
  })
}

resource "grafana_data_source" "loki" {
  type = "loki"
  name = "loki"
  url  = var.loki_url

  basic_auth_enabled  = true
  basic_auth_username = "${var.loki_user_id}"

  secure_json_data_encoded = jsonencode({
    basicAuthPassword = var.prom_password
  })
}

resource "grafana_folder" "calorietracker" {
  title = "CalorieTracker"
}
