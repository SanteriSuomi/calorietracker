output "develop_protection_id" {
  value = github_branch_protection.develop.id
}

output "main_protection_id" {
  value = github_branch_protection.main.id
}
