#!/bin/bash

shopt -s globstar

for file in .github/workflows/deploy_webapp.yml .github/workflows/deploy/workflows/deploy_cassandra_latest_readings.yml functions/cassandra_latest_readings/src/main.py terraform/terraform.tfvars_example terraform/**/*.tf; do
  if [ -f "$file" ]; then
    echo "----------"
    echo "File path: $file"
    echo "----------"
    cat "$file"
    echo ""
    echo ""
  fi
done