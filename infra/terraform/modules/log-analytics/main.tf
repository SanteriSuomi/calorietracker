terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }
}

resource "azurerm_log_analytics_workspace" "this" {
  name                = "law-calorietracker"
  location            = var.location
  resource_group_name = var.resource_group_name
  sku                 = "PerGB2018"
  tags                = var.tags
}
