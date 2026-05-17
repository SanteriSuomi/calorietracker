terraform {
  required_providers {
    grafana = {
      source  = "grafana/grafana"
      version = "~> 3.0"
    }
  }
}

provider "grafana" {
  url = "https://grafana.com"
}

resource "grafana_cloud_stack" "this" {
  name        = var.stack_name
  slug        = var.stack_name
  region_slug = var.region_slug
}

resource "grafana_cloud_stack_service_account" "metrics" {
  stack_slug = grafana_cloud_stack.this.slug
  name       = "metrics-publisher"
  role       = "Viewer"
}

resource "grafana_cloud_stack_service_account_token" "metrics" {
  name               = "metrics-publisher-token"
  stack_slug         = grafana_cloud_stack.this.slug
  service_account_id = grafana_cloud_stack_service_account.metrics.id
}

resource "grafana_data_source" "prometheus" {
  type = "prometheus"
  name = "prometheus"
  url  = grafana_cloud_stack.this.prometheus_remote_endpoint

  basic_auth_enabled  = true
  basic_auth_username = tostring(grafana_cloud_stack.this.prometheus_user_id)

  secure_json_data_encoded = jsonencode({
    basicAuthPassword = grafana_cloud_stack_service_account_token.metrics.key
  })
}

resource "grafana_data_source" "loki" {
  type = "loki"
  name = "loki"
  url  = grafana_cloud_stack.this.logs_url

  basic_auth_enabled  = true
  basic_auth_username = tostring(grafana_cloud_stack.this.logs_user_id)

  secure_json_data_encoded = jsonencode({
    basicAuthPassword = grafana_cloud_stack_service_account_token.metrics.key
  })
}

resource "grafana_folder" "calorietracker" {
  title = "CalorieTracker"
}
