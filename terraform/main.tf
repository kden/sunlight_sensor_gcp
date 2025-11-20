/**
 * @file main.tf
 *
 * Root module orchestration for sunlight sensor infrastructure
 *
 * Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
 *
 * Developed with assistance from ChatGPT 4o (2025), Google Gemini 2.5 Pro (2025) and Claude Sonnet 4 (2025).
 *
 * Apache 2.0 Licensed as described in the file LICENSE
 */

# Foundation - GCP APIs and project setup
module "foundation" {
  source = "./modules/foundation"

  gcp_project_id   = var.gcp_project_id
  gcp_service_list = var.gcp_service_list
}

# Messaging - Pub/Sub topics (no dependencies on other modules)
module "messaging" {
  source = "./modules/messaging"

  gcp_project_id = var.gcp_project_id

  depends_on = [module.foundation]
}

# Database infrastructure - Astra, BigQuery, Firestore
module "database" {
  source = "./modules/database"

  gcp_project_id                = var.gcp_project_id
  sunlight_dataset_id                    = var.dataset_id
  region                        = var.region
  sensor_metadata_filename      = var.sensor_metadata_filename
  sensor_set_metadata_filename  = var.sensor_set_metadata_filename
  pubsub_topic_name             = module.messaging.pubsub_topic_name

  depends_on = [module.foundation, module.messaging]
}

# Data pipeline - transforms, scheduled queries, metadata storage
module "data_pipeline" {
  source = "./modules/data-pipeline"

  gcp_project_id                = var.gcp_project_id
  region                        = var.region
  sensor_metadata_filename      = var.sensor_metadata_filename
  sensor_set_metadata_filename  = var.sensor_set_metadata_filename
  sunlight_dataset_id = module.database.sunlight_dataset_id
  raw_sensor_data_table_id = module.database.raw_sensor_data_table_id
  function_deployer_email =  module.iam.cloud_run_deployer_sa_email

  depends_on = [module.database]
}

# Compute services - Cloud Run functions
module "compute" {
  source = "./modules/compute"

  gcp_project_id                 = var.gcp_project_id
  region                         = var.region
  sensor_target_api_domain_name  = var.sensor_target_api_domain_name
    function_deployer_email =  module.iam.cloud_run_deployer_sa_email


  depends_on = [module.data_pipeline, module.iam]
}

# Frontend - Firebase web application
module "frontend" {
  source = "./modules/frontend"

  gcp_project_id             = var.gcp_project_id
  sunlight_app_domain_name   = var.sunlight_app_domain_name

  depends_on = [module.database, module.iam]
}

# IAM - Service accounts, workload identity, permissions
module "iam" {
  source = "./modules/iam"

  gcp_project_id  = var.gcp_project_id
  github_org      = var.github_org
  github_repo     = var.github_repo

  depends_on = [module.foundation]
}

# Monitoring - Alerts and logging metrics
module "monitoring" {
  source = "./modules/monitoring"

  gcp_project_id      = var.gcp_project_id
  alert_email_address = var.alert_email_address
  alert_phone_number  = var.alert_phone_number

  depends_on = [module.compute]
}
