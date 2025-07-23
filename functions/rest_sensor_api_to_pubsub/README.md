# Cloud Run Function proxy_to_pubsub

This function configuration is defined in Terraform as [proxy_function](/terraform/cloudrun_sensor_rest_proxy.tf).

This is a Cloud Run function that is triggered by REST API calls.  It acts as a bridge between the sensors and Google Pub/Sub.  Google Pub/Sub authentication can get a little bit involved, so one of the main functions of the proxy is to accept a Bearer authentication and then use the more secure credentials of the runtime service account to send the sensor data to Google Pub/Sub.

Right now, a single bearer token is passed in via configuration that doesn't change as long as the proxy function is running.  One planned update is to make the REST API authentication more secure.