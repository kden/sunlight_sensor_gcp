
# Configure the Google Cloud provider
terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 6.42.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = ">= 6.42.0"
    }
    astra = {
      source  = "datastax/astra"
      version = "~> 2.3.18"
    }
  }
}


provider "astra" {
  # Authentication token from Astra
  # Get this from: https://astra.datastax.com/settings/tokens
  token = var.astra_token
}

