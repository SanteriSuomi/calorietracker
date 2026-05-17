terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }
}

data "azurerm_key_vault_secret" "database_url" {
  name         = var.database_url_secret
  key_vault_id = var.key_vault_id
}

resource "azurerm_container_app_job" "migrate" {
  name                         = "calorietracker-migrate"
  resource_group_name          = var.resource_group_name
  location                     = var.location
  container_app_environment_id = var.container_app_env_id

  replica_timeout_in_seconds = 300
  replica_retry_limit        = 3

  secret {
    name  = "database-url"
    value = data.azurerm_key_vault_secret.database_url.value
  }

  template {
    container {
      name    = "migrate"
      image   = var.ghcr_image
      cpu     = 0.25
      memory  = "0.5Gi"

      env {
        name        = "DATABASE_URL"
        secret_name = "database-url"
      }

      env {
        name  = "DATABASE_PROVIDER"
        value = "pg"
      }

      command = ["/bin/sh", "-c", "npx drizzle-kit migrate --config=drizzle-pg.config.ts"]
    }
  }

  manual_trigger_config {
    parallelism            = 1
    replica_completion_count = 1
  }

  identity {
    type = "SystemAssigned"
  }

  tags = var.tags
}
