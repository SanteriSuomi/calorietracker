terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
  }
}

resource "cloudflare_dns_record" "root_cname" {
  zone_id = var.zone_id
  name    = "@"
  content = var.container_app_fqdn
  type    = "CNAME"
  proxied = true
  ttl     = 1
}

resource "cloudflare_ruleset" "rate_limit_api" {
  zone_id = var.zone_id
  name    = "rate_limit_api"
  phase   = "http_ratelimit"
  kind    = "zone"
  rules = [
    {
      expression = "(http.request.uri.path contains \"/api/\")"
      action     = "block"
      ratelimit = {
        characteristics     = ["ip.src"]
        period              = 10
        requests_per_period = 100
        mitigation_timeout  = 10
      }
    }
  ]
}
