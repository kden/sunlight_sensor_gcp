# Cloud Run Function process_sensor_status

The permissions and roles required by this function are defined in Terraform in [iam_deploy_cloud_run_functions.tf](/terraform/iam_deploy_cloud_run_functions.tf), and deployed by a [GitHub Action](/.github/workflows/deploy_sensor_monitor.yml).

It works with the configuration in the [Terraform monitoring definitions](/terraform/monitoring.tf) to set up alerts when the sensors go offline or have a significant system event.

This is a Cloud Run function that is triggered by a Pub/Sub subscription to the topic for incoming sensor data.

It generates 2 kinds of log messages: ping messages, to show that the sensor is alive, and status messages, for reporting things like a reset error reason or getting the current time from NTP.
