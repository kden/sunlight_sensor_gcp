#!/bin/sh

#
# dump.sh
#
# Source code description.
#
# Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
# Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
# Apache 2.0 Licensed as described in the file LICENSE
#

# This script is used to make one file containing all of the terraform files and related scripts for upload to AI tools
# Run this in the terraform directory

#for file in api/build.gradle.kts settings.gradle.kts gradle.properties $(find api/src -type f -name '*.java') resources/application.properties ; do

for file in functions/rest_sensor_api_to_pubsub/* functions/rest_sensor_api_to_pubsub/src/* functions/rest_sensor_api_to_pubsub/test/* terraform/apis.tf terraform/cloudrun_sensor_rest_proxy.tf terraform/pubsub.tf terraform/sensor_set_metadata.json_example terraform/sensor_metadata.json_example terraform/iam_deploy_cloud_run_functions.tf terraform/iam_workload_identity_pool.tf terraform/github_cicd.tf .github/workflows/deploy_rest_sensor_api.yml; do
  if [ -f "$file" ]; then
    echo "----------"
    echo "SUNLIGHT PROJECT $file"
    echo "----------"
    cat "$file"
    printf "\n"
  fi
done
