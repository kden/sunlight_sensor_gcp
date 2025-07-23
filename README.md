# Sunlight Sensor GCP Components

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

## Licensing

Licensing information is in the [LICENSE](LICENSE) and [THIRD_PARTY_LICENSES](THIRD_PARTY_LICENSES) file.

## AI

This project was developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).