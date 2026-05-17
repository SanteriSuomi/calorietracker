output "cname_record_id" {
  value = cloudflare_dns_record.root_cname.id
}

output "ruleset_id" {
  value = cloudflare_ruleset.rate_limit_api.id
}
