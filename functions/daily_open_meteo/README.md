# Cloud Run Function daily Open-Meteo

This function configuration is defined in Terraform as [open_meteo_daily_importer_function](/terraform/cloudrun_open_meteo_functions.tf).

This is a Cloud Run function that is triggered on a schedule.  When it's triggered, it connects to the (free) [Open-Meteo API](https://open-meteo.com/) and collects some daily weather information. This is what is used to display sunrise and sunset in the web app.

There is a minimal unit test that you can run with the command:

```shell
go test
```