# Terraform definitions

These files define Google Cloud Platform resources with Terraform.

The variables that can be set exist in terraform.tfvars.  There is a terraform.tfvars_example file you can use to create your own.

## Cloud Run Functions

Currently, most of the Cloud Run Functions deploy source code via Terraform, which is not a best practice.  The more CICD route would be to use something like a GitHub action, which is how the [web app](/.github/workflows/deploy_webapp.yml) and [sensor status monitor function](/.github/workflows/deploy_sensor_monitor.yml) are configured.