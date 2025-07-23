# Cloud Run Function export_sensors_to_firestore

This function configuration is defined in Terraform as [bq_to_firestore_sensors_exporter](/terraform/bigquery_to_firebase_sensor_data_export.tf).

This is a Cloud Run function that is triggered on a schedule.  When it's triggered, it aggregates the light sensor data into 15 minute buckets, and sends that data to Firestore to be displayed in the web app.