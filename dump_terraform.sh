#!/bin/bash

shopt -s globstar

for file in terraform/terraform.tfvars_example terraform/**/*.tf; do
  if [ -f "$file" ]; then
    echo "----------"
    echo "$file"
    echo "----------"
    cat "$file"
    echo ""
    echo ""
  fi
done