# Terraform definitions

These files define Google Cloud Platform resources with Terraform.

The variables that can be set exist in terraform.tfvars.  There is a terraform.tfvars_example file you can use to create your own.

Make sure to make a note of the output variables, as you may need them local testing and development.  For example, the 
`github_actions_service_account_key` variables will be used in some GitHub configuration, and the `firebase_web_app_config` variables will be used in your `.env.local` file in the web app.  The `dns_records_for_domain_mapping` output will be used at your DNS provider to point your custom domain to the web app and sensor API.

Typical install:
```shell
terraform init
terraform plan
terraform apply
```
Then to get these secure variables that are redacted by default:
```shell
terraform output -raw github_actions_service_account_key
terraform output -raw firebase_web_app_config
```

## Cassandra/Datastax/Astra

The [Terraform provider for Astra](https://github.com/datastax/terraform-provider-astra/blob/main/internal/provider/resource_table.go) currently does not support clustering column sort during table creation.  I wanted to sort the data timestamps descending, so although we have a terraform definition here for documentation, I decided to recreate the table manually to get the sort order I wanted.