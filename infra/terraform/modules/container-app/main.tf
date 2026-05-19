resource "azurerm_user_assigned_identity" "this" {
  name                = var.environment_name == "prod" ? "uid-calorietracker" : "uid-calorietracker-staging"
  resource_group_name = var.resource_group_name
  location            = var.location
  tags                = var.tags
}

resource "azurerm_container_app" "this" {
  name                         = var.environment_name == "prod" ? "calorietracker" : "calorietracker-staging"
  resource_group_name          = var.resource_group_name
  container_app_environment_id = var.container_app_env_id
  revision_mode                = "Single"
  workload_profile_name        = "Consumption"
  tags                         = var.tags

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.this.id]
  }

  secret {
    name                = "database-url"
    identity            = azurerm_user_assigned_identity.this.id
    key_vault_secret_id = "https://${var.key_vault_name}.vault.azure.net/secrets/${var.database_url_secret}"
  }

  secret {
    name                = "better-auth-secret"
    identity            = azurerm_user_assigned_identity.this.id
    key_vault_secret_id = "https://${var.key_vault_name}.vault.azure.net/secrets/${var.auth_secret}"
  }

  secret {
    name                = "encryption-secret"
    identity            = azurerm_user_assigned_identity.this.id
    key_vault_secret_id = "https://${var.key_vault_name}.vault.azure.net/secrets/${var.encryption_secret}"
  }

  secret {
    name                = "azure-blob-connection-string"
    identity            = azurerm_user_assigned_identity.this.id
    key_vault_secret_id = "https://${var.key_vault_name}.vault.azure.net/secrets/${var.blob_connection_secret}"
  }

  secret {
    name                = "grafana-prom-endpoint"
    identity            = azurerm_user_assigned_identity.this.id
    key_vault_secret_id = "https://${var.key_vault_name}.vault.azure.net/secrets/${var.grafana_prom_endpoint_secret}"
  }

  secret {
    name                = "grafana-prom-user"
    identity            = azurerm_user_assigned_identity.this.id
    key_vault_secret_id = "https://${var.key_vault_name}.vault.azure.net/secrets/${var.grafana_prom_user_secret}"
  }

  secret {
    name                = "grafana-prom-password"
    identity            = azurerm_user_assigned_identity.this.id
    key_vault_secret_id = "https://${var.key_vault_name}.vault.azure.net/secrets/${var.grafana_prom_password_secret}"
  }

  ingress {
    external_enabled = true
    target_port      = 3000
    transport        = "http"

    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }

  template {
    min_replicas = 0
    max_replicas = 3

    container {
      name   = "calorietracker"
      image  = var.ghcr_image
      cpu    = 0.5
      memory = "1Gi"

      env {
        name  = "AZURE_DEPLOYMENT"
        value = "true"
      }

      env {
        name  = "DATABASE_PROVIDER"
        value = "pg"
      }

      env {
        name        = "DATABASE_URL"
        secret_name = "database-url"
      }

      env {
        name  = "ORIGIN"
        value = "https://${var.environment_name == "prod" ? "calorietracker" : "calorietracker-staging"}.${var.container_app_env_default_domain}"
      }

      env {
        name        = "BETTER_AUTH_SECRET"
        secret_name = "better-auth-secret"
      }

      env {
        name        = "ENCRYPTION_SECRET"
        secret_name = "encryption-secret"
      }

      env {
        name  = "STORAGE_PROVIDER"
        value = "azure"
      }

      env {
        name        = "AZURE_BLOB_CONNECTION_STRING"
        secret_name = "azure-blob-connection-string"
      }

      readiness_probe {
        path                    = "/api/health"
        port                    = 3000
        transport               = "HTTP"
        interval_seconds        = 10
        timeout                 = 5
        failure_count_threshold = 3
      }

      liveness_probe {
        path                    = "/api/health"
        port                    = 3000
        transport               = "HTTP"
        interval_seconds        = 30
        timeout                 = 10
        failure_count_threshold = 3
      }
    }

    container {
      name   = "grafana-alloy"
      image  = "grafana/alloy:v1.16.1"
      cpu    = 0.25
      memory = "0.5Gi"

      env {
        name        = "GRAFANA_CLOUD_PROM_ENDPOINT"
        secret_name = "grafana-prom-endpoint"
      }

      env {
        name        = "GRAFANA_CLOUD_PROM_USER"
        secret_name = "grafana-prom-user"
      }

      env {
        name        = "GRAFANA_CLOUD_PROM_PASSWORD"
        secret_name = "grafana-prom-password"
      }
    }

    http_scale_rule {
      name                = "http-scaling"
      concurrent_requests = 100
    }
  }
}
