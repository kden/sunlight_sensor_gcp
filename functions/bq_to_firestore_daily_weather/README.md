# Cloud Run Function export_weather_to_firestore

This function configuration is defined in Terraform as [bq_to_fs_weather_exporter](/terraform/bigquery_to_firebase_daily_historical_export.tf).

This is a Cloud Run function that is triggered on a schedule.  When it's triggered, it copies daily weather information from BigQuery to Firestore so that it can be easily read from the web app.