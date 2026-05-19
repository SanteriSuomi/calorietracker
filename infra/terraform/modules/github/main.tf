terraform {
  required_providers {
    github = {
      source  = "integrations/github"
      version = "~> 6.0"
    }
  }
}

data "github_repository" "this" {
  full_name = var.repository
}

resource "github_branch" "develop" {
  repository    = split("/", var.repository)[1]
  branch        = "develop"
  source_branch = "main"
}

resource "github_branch_protection" "develop" {
  repository_id = data.github_repository.this.node_id
  pattern       = "develop"
  enforce_admins = false

  required_status_checks {
    strict   = false
    contexts = ["typecheck", "lint", "tests"]
  }

  required_pull_request_reviews {
    dismiss_stale_reviews      = true
    required_approving_review_count = 0
  }

  depends_on = [github_branch.develop]
}

resource "github_branch_protection" "main" {
  repository_id = data.github_repository.this.node_id
  pattern       = "main"
  enforce_admins = true

  required_status_checks {
    strict   = true
    contexts = ["typecheck", "lint", "tests"]
  }

  required_pull_request_reviews {
    dismiss_stale_reviews      = true
    required_approving_review_count = 1
  }
}
