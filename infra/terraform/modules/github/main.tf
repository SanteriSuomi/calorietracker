terraform {
  required_providers {
    github = {
      source  = "integrations/github"
      version = "~> 6.0"
    }
  }
}

resource "github_branch_protection" "develop" {
  repository_id = var.repository
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
}

resource "github_branch_protection" "main" {
  repository_id = var.repository
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
