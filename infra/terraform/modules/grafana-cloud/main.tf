terraform {
  required_providers {
    grafana = {
      source                = "grafana/grafana"
      version               = "~> 3.0"
      configuration_aliases = [grafana.cloud]
    }
  }
}

resource "grafana_cloud_stack" "this" {
  provider    = grafana.cloud
  name        = var.stack_name
  slug        = var.stack_name
  region_slug = var.region_slug
}

resource "grafana_cloud_stack_service_account" "metrics" {
  provider   = grafana.cloud
  stack_slug = grafana_cloud_stack.this.slug
  name       = "metrics-publisher"
  role       = "Admin"
}
resource "grafana_cloud_stack_service_account_token" "metrics" {
  provider           = grafana.cloud
  name               = "metrics-publisher-token"
  stack_slug         = grafana_cloud_stack.this.slug
  service_account_id = grafana_cloud_stack_service_account.metrics.id
}
