<div style="display: flex; align-items: center;">
  <h1><img src="/doc_images/sunlight-sensor-128-trans-bg.png" style="height: 1em; vertical-align: -0.15em;" alt="logo">
  Sunlight Sensor GCP Components</h1>
</div>

This project contains the Google Cloud Platform components of the Sunlight Sensor project, [which is described in more detail in my portfolio](https://kden.github.io/sunlight-sensor/).

## Technologies used

- [Terraform, for managing GCP resources](/terraform/README.md)
- React, Next.js in the [web app](/sunlight_web_app/README.md)
- Python, in a number of utility scripts and [Cloud Run Functions](/functions/README.md)
- Go, in the daily [Open-Meteo weather information retrieval function](/functions/daily_open_meteo/README.md)

## Top-level commands

To test all of the Python-based subprojects, like rest_sensor_api_to_pubsub
pytest from the root directory:

```shell
pytest
```

## GitHub Configuration

In order to configure your GitHub actions, you will need to create some GitHub Actions secrets in your repo.

<table>
<thead>
<tr><th>GitHub Secret Name</th><th>Terraform Output or Source</th><th>Purpose</th></tr>
</thead>
<tbody>
<tr><td><code>GCP_PROJECT_ID</code></td><td><code>gcp_project_id</code> in <code>terraform.tfvars</code></td><td>The Google Cloud Project ID.</td></tr>
<tr><td><code>GCP_SERVICE_ACCOUNT_EMAIL_BQ_TO_FS_SENSORS_RUNTIME</code></td><td><code>bq_to_firestore_sensors_sa_email</code></td><td>The runtime service account for the <code>bq-to-fs-sensor-data-exporter</code> function.</td></tr>
<tr><td><code>GCP_SERVICE_ACCOUNT_EMAIL_BQ_TO_FS_WEATHER_RUNTIME</code></td><td><code>bq_to_fs_weather_sa_email</code></td><td>The runtime service account for the <code>bq-to-fs-weather-exporter</code> function.</td></tr>
<tr><td><code>GCP_SERVICE_ACCOUNT_EMAIL_FUNCTIONS</code></td><td><code>function_deployer_email</code></td><td>The email of the primary service account that GitHub Actions uses to deploy all functions.</td></tr>
<tr><td><code>GCP_SERVICE_ACCOUNT_EMAIL_OPEN_METEO_RUNTIME</code></td><td><code>open_meteo_runtime_sa_email</code></td><td>The runtime service account for the <code>daily-open-meteo-importer</code> function.</td></tr>
<tr><td><code>GCP_SERVICE_ACCOUNT_EMAIL_RUNTIME</code></td><td><code>function_runtime_email</code></td><td>A general-purpose or legacy runtime service account. Newer functions use dedicated SAs.</td></tr>
<tr><td><code>GCP_SERVICE_ACCOUNT_EMAIL_SENSOR_PROXY_RUNTIME</code></td><td><code>rest_proxy_runtime_sa_email</code></td><td>The runtime service account for the <code>rest-to-pubsub-proxy-function</code>.</td></tr>
<tr><td><code>GCP_SERVICE_ACCOUNT_EMAIL_TEST_PATTERN_RUNTIME</code></td><td><code>test_pattern_runtime_sa_email</code></td><td>The runtime service account for the <code>daily-test-pattern-generator</code> function.</td></tr>
<tr><td><code>GCP_SERVICE_ACCOUNT_EMAIL_WEBAPP</code></td><td><code>webapp_deployer_email</code></td><td>The service account used by the Next.js web application's backend (defined in webapp-specific Terraform).</td></tr>
<tr><td><code>GCP_WORKLOAD_IDENTITY_PROVIDER</code></td><td><code>workload_identity_provider</code></td><td>The full resource name of the Workload Identity Provider for OIDC.</td></tr>
<tr><td><code>REACT_APP_FIREBASE_CONFIG</code></td><td><code>firebase_web_app_config</code></td><td>The JSON configuration object for connecting the frontend React app to Firebase (from Firebase Console or Terraform).</td></tr>
<tr><td><code>SENSOR_API_BEARER_TOKEN</code></td><td>Manual Entry</td><td>The secret token used by sensors and the test pattern generator to authenticate with the REST API proxy.</td></tr>
<tr><td><code>SENSOR_API_DOMAIN_NAME</code></td><td><code>sensor_target_api_domain_name</code> in <code>terraform.tfvars</code></td><td>The custom domain for the sensor API (e.g., <code>sensors.example.com</code>).</td></tr>
</tbody>
</table>

## Licensing

Licensing information is in the [LICENSE](LICENSE) and [THIRD_PARTY_LICENSES](THIRD_PARTY_LICENSES) file.

## AI

This project was developed with assistance from ChatGPT 4o (2025), Google Gemini 2.5 Pro (2025), and Claude Sonnet 4 (2025).