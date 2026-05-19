terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }
}

resource "azurerm_container_app_environment" "this" {
  name                       = "cae-calorietracker"
  location                   = var.location
  resource_group_name        = var.resource_group_name
  infrastructure_subnet_id   = var.subnet_id
  log_analytics_workspace_id = var.log_analytics_workspace_id

  workload_profile {
    name                  = "Consumption"
    maximum_count         = 0
    minimum_count         = 0
    workload_profile_type = "Consumption"
  }

  tags = var.tags
}
