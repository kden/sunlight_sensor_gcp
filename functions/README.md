# Cloud Run Functions

These subdirectories contain the source code for a number of Cloud Run Functions.

* [bq_to_firestore_daily_weather](bq_to_firestore_daily_weather/README.md): Copy daily weather information from BigQuery to Firestore.
* [bq_to_firestore_sensors](bq_to_firestore_sensors/README.md): Aggregate and copy sensor information from BigQuery to Firestore
* [daily_open_meteo](daily_open_meteo/README.md): Collect daily weather information from the Open-Meteo API.
* [generate_test_pattern](generate_test_pattern/README.md): Generate a day's worth of test data.
* [rest_sensor_api_to_pubsub](rest_sensor_api_to_pubsub/README.md): Proxy data coming from the sensors into Google Pub/Sub.
* [sensor_status_monitor](sensor_status_monitor/README.md): Generate log messages based on incoming sensor data that can be used for sensor monitoring.