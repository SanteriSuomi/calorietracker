variable "stack_name" {
  type = string
}

variable "region_slug" {
  type    = string
  default = "prod_us_east_0"
}

variable "tags" {
  type    = map(string)
  default = {}
}
