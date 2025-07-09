
variable "sunlight_app_domain_name" {
  description = "The custom domain to associate with Firebase Hosting."
  type        = string
}

# This resource ensures the GCP project is configured as a Firebase project.
# It's a good practice to include it explicitly.
resource "google_firebase_project" "default" {
  provider = google-beta
  project = var.gcp_project_id

  depends_on = [
    google_project_service.apis
  ]
}

# Create the Firebase Hosting site where your React app will be deployed.
# The site_id is often the same as the project_id.
resource "google_firebase_hosting_site" "default" {
  provider = google-beta
  project = var.gcp_project_id
  site_id = var.gcp_project_id # You can customize this if needed

  depends_on = [
    google_firebase_project.default,
    google_project_service.apis,
  ]
}

# Associate the custom domain with your Firebase Hosting site.
# This starts the verification process and prepares the DNS records.
resource "google_firebase_hosting_custom_domain" "default" {
  # This resource is in the beta provider.
  provider      = google-beta
  project       = var.gcp_project_id
  site_id       = google_firebase_hosting_site.default.site_id
  custom_domain = var.sunlight_app_domain_name

  # Wait until the site is fully provisioned.
  depends_on = [
    google_firebase_hosting_site.default
  ]
}

# Output the DNS records required to verify domain ownership and
# point the domain to Firebase.
# If this is an empty list, it may mean that the domain is still being created.
# You can check the Firebase console for the status of the domain
# at
output "firebase_hosting_dns_info" {
  value = google_firebase_hosting_custom_domain.default.required_dns_updates
  description = "DNS records to create at your domain registrar. You will typically see a TXT record for verification and one or more A records to point to Firebase."
}

# This new output provides the default URL for the hosting site.
output "firebase_default_url" {
  value       = google_firebase_hosting_site.default.default_url
  description = "The default, auto-generated URL for the Firebase Hosting site (e.g., project-id.web.app)."
}