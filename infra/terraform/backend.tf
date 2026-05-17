terraform {
  backend "azurerm" {
    resource_group_name  = "rg-calorietracker-tfstate"
    storage_account_name = "stcalorietrackertf"
    container_name       = "tfstate"
    key                  = "terraform.tfstate"
  }
}
