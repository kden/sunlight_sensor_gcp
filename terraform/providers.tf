# terraform/providers.tf

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
  }
}
