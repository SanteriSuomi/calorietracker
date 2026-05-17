output "stack_id" {
  value = grafana_cloud_stack.this.id
}

output "stack_url" {
  value = grafana_cloud_stack.this.url
}

output "prom_remote_write_endpoint" {
  value = grafana_cloud_stack.this.prometheus_remote_endpoint
}

output "prom_user_id" {
  value = grafana_cloud_stack.this.prometheus_user_id
}

output "prom_password" {
  value     = grafana_cloud_stack_service_account_token.metrics.key
  sensitive = true
}

output "loki_url" {
  value = grafana_cloud_stack.this.logs_url
}

output "loki_user_id" {
  value = grafana_cloud_stack.this.logs_user_id
}

output "prom_datasource_uid" {
  value = grafana_data_source.prometheus.uid
}

output "loki_datasource_uid" {
  value = grafana_data_source.loki.uid
}
