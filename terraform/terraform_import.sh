#!/bin/bash

#
# terraform_import.sh
#
# This script imports existing Google Cloud resources into Terraform state.
#
# Some names have changed, and this script acts more as a scratch pad to update
# resources that have gotten out-of-sync with the Terraform state.
#
# Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
# Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
# Apache 2.0 Licensed as described in the file LICENSE
#


terraform import google_pubsub_topic.sun_sensor_ingest projects/sunlight-sensor/topics/sun-sensor-ingest-topic
terraform import google_pubsub_subscription.sun_sensor_ingest_test_sub projects/sunlight-sensor/subscriptions/sun-sensor-ingest-test-sub
terraform import google_storage_bucket.source_bucket sunlight-sensor-cloudrun-source
terraform import google_cloudfunctions2_function.proxy_function projects/sunlight-sensor/locations/us-central1/functions/rest-to-pubsub-proxy-function
terraform import google_cloud_run_service_iam_member.allow_public "projects/sunlight-sensor/locations/us-central1/services/rest-to-pubsub-proxy-function roles/run.invoker allUsers"
terraform import google_cloud_run_domain_mapping.custom_domain_map \
us-central1/sunlight-sensor/sensors.example.com
terraform import 'google_project_service.apis["cloudfunctions.googleapis.com"]' sunlight-sensor/cloudfunctions.googleapis.com
terraform import 'google_project_service.apis["pubsub.googleapis.com"]' sunlight-sensor/pubsub.googleapis.com
terraform import 'google_project_service.apis["cloudbuild.googleapis.com"]' sunlight-sensor/cloudbuild.googleapis.com
terraform import 'google_project_service.apis["run.googleapis.com"]' sunlight-sensor/run.googleapis.com
terraform import 'google_project_service.apis["iam.googleapis.com"]' sunlight-sensor/iam.googleapis.com
terraform import 'google_project_service.apis["storage.googleapis.com"]' sunlight-sensor/storage.googleapis.com
terraform import 'google_project_service.apis["artifactregistry.googleapis.com"]' sunlight-sensor/artifactregistry.googleapis.com

terraform import google_firestore_database.database projects/sunlight-sensor/databases/(default)
