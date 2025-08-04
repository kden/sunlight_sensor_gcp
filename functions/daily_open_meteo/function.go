/*
daily_open_meteo/function.go

Collect daily and hourly weather data from Open-Meteo and store it in BigQuery.

Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
Apache 2.0 Licensed as described in the file LICENSE
*/

package weather_function

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"cloud.google.com/go/bigquery"
	"github.com/GoogleCloudPlatform/functions-framework-go/functions"
	"google.golang.org/api/iterator"
)

func init() {
	functions.HTTP("DailyWeatherer", DailyWeatherer)
}

// SensorSet represents the structure of the sensor_set metadata in BigQuery.
type SensorSet struct {
	Latitude  float64 `bigquery:"latitude"`
	Longitude float64 `bigquery:"longitude"`
	Timezone  string  `bigquery:"timezone"`
}

// MeteoResponse represents the structure of the JSON response from the Open-Meteo API.
type MeteoResponse struct {
	Daily struct {
		Time               []string  `json:"time"`
		Sunrise            []string  `json:"sunrise"`
		Sunset             []string  `json:"sunset"`
		DaylightDuration   []float64 `json:"daylight_duration"`
		SunshineDuration   []float64 `json:"sunshine_duration"`
		Temperature2mMax   []float64 `json:"temperature_2m_max"`
		Temperature2mMin   []float64 `json:"temperature_2m_min"`
		UvIndexMax         []float64 `json:"uv_index_max"`
		UvIndexClearSkyMax []float64 `json:"uv_index_clear_sky_max"`
		RainSum            []float64 `json:"rain_sum"`
		ShowersSum         []float64 `json:"showers_sum"`
		PrecipitationSum   []float64 `json:"precipitation_sum"`
		SnowfallSum        []float64 `json:"snowfall_sum"`
		PrecipitationHours []float64 `json:"precipitation_hours"`
	} `json:"daily"`
	Hourly struct {
		Time               []string  `json:"time"`
		Temperature2m      []float64 `json:"temperature_2m"`
		Precipitation      []float64 `json:"precipitation"`
		RelativeHumidity2m []float64 `json:"relative_humidity_2m"`
		CloudCover         []float64 `json:"cloud_cover"`
		Visibility         []float64 `json:"visibility"`
		SoilTemperature0cm []float64 `json:"soil_temperature_0cm"`
		SoilMoisture1To3cm []float64 `json:"soil_moisture_1_to_3cm"`
		UvIndex            []float64 `json:"uv_index"`
		UvIndexClearSky    []float64 `json:"uv_index_clear_sky"`
		ShortwaveRadiation []float64 `json:"shortwave_radiation"`
		DirectRadiation    []float64 `json:"direct_radiation"`
		WindSpeed10m       []float64 `json:"wind_speed_10m"`
	} `json:"hourly"`
}

// WeatherRecord represents a single row in the daily_historical_weather BigQuery table.
type WeatherRecord struct {
	Date               string    `bigquery:"date"`
	Sunrise            time.Time `bigquery:"sunrise"`
	Sunset             time.Time `bigquery:"sunset"`
	DaylightDuration   float64   `bigquery:"daylight_duration"`
	SunshineDuration   float64   `bigquery:"sunshine_duration"`
	Temperature2mMax   float64   `bigquery:"temperature_2m_max"`
	Temperature2mMin   float64   `bigquery:"temperature_2m_min"`
	UvIndexMax         float64   `bigquery:"uv_index_max"`
	UvIndexClearSkyMax float64   `bigquery:"uv_index_clear_sky_max"`
	RainSum            float64   `bigquery:"rain_sum"`
	ShowersSum         float64   `bigquery:"showers_sum"`
	PrecipitationSum   float64   `bigquery:"precipitation_sum"`
	SnowfallSum        float64   `bigquery:"snowfall_sum"`
	PrecipitationHours float64   `bigquery:"precipitation_hours"` // Fixed: was precipitation_hour
	DataSource         string    `bigquery:"data_source"`
	SensorSet          string    `bigquery:"sensor_set_id"`
	Timezone           string    `bigquery:"timezone"`
	Latitude           float64   `bigquery:"latitude"`
	Longitude          float64   `bigquery:"longitude"`
	LastUpdated        time.Time `bigquery:"last_updated"`
}

// HourlyWeatherRecord represents a single row in the hourly_historical_weather BigQuery table.
type HourlyWeatherRecord struct {
	Time               time.Time `bigquery:"time"`
	SensorSetID        string    `bigquery:"sensor_set_id"`
	Temperature2m      float64   `bigquery:"temperature_2m"`
	Precipitation      float64   `bigquery:"precipitation"`
	RelativeHumidity2m float64   `bigquery:"relative_humidity_2m"`
	CloudCover         float64   `bigquery:"cloud_cover"`
	Visibility         float64   `bigquery:"visibility"`
	SoilTemperature0cm float64   `bigquery:"soil_temperature_0cm"`
	SoilMoisture1To3cm float64   `bigquery:"soil_moisture_1_to_3cm"`
	UvIndex            float64   `bigquery:"uv_index"`
	UvIndexClearSky    float64   `bigquery:"uv_index_clear_sky"`
	ShortwaveRadiation float64   `bigquery:"shortwave_radiation"`
	DirectRadiation    float64   `bigquery:"direct_radiation"`
	WindSpeed10m       float64   `bigquery:"wind_speed_10m"`
	Timezone           string    `bigquery:"timezone"`
	Latitude           float64   `bigquery:"latitude"`
	Longitude          float64   `bigquery:"longitude"`
	DataSource         string    `bigquery:"data_source"`
	LastUpdated        time.Time `bigquery:"last_updated"`
}

// DailyWeatherer is the entry point for the Cloud Function.
func DailyWeatherer(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	projectID := os.Getenv("GCP_PROJECT")
	if projectID == "" {
		log.Println("ERROR: GCP_PROJECT environment variable not set")
		http.Error(w, "GCP_PROJECT environment variable not set", http.StatusInternalServerError)
		return
	}

	// Get query parameters
	sensorSet := r.URL.Query().Get("sensor_set_id")
	startDate := r.URL.Query().Get("start_date")
	endDate := r.URL.Query().Get("end_date")

	log.Printf("INFO: Received request with parameters: sensor_set_id='%s', start_date='%s', end_date='%s'", sensorSet, startDate, endDate)

	if sensorSet == "" {
		log.Println("ERROR: Missing sensor_set_id parameter")
		http.Error(w, "Missing sensor_set_id parameter", http.StatusBadRequest)
		return
	}

	if startDate == "" || endDate == "" {
		now := time.Now()
		endDate = now.Format("2006-01-02")
		startDate = now.AddDate(0, 0, -1).Format("2006-01-02")
		log.Printf("INFO: Defaulting to date range: start_date='%s', end_date='%s'", startDate, endDate)
	}

	// Create a BigQuery client
	client, err := bigquery.NewClient(ctx, projectID)
	if err != nil {
		log.Printf("ERROR: Failed to create BigQuery client: %v", err)
		http.Error(w, fmt.Sprintf("Failed to create BigQuery client: %v", err), http.StatusInternalServerError)
		return
	}
	defer client.Close()

	// Get sensor set metadata from BigQuery
	sensorSetData, err := getSensorSet(ctx, client, projectID, sensorSet)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to get sensor set data: %v", err), http.StatusInternalServerError)
		return
	}

	// Get weather data from Open-Meteo
	weatherData, err := getWeatherData(sensorSetData, startDate, endDate)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to get weather data: %v", err), http.StatusInternalServerError)
		return
	}

	// Use goroutines to insert daily and hourly data concurrently
	var wg sync.WaitGroup
	var dailyErr, hourlyErr error

	// Insert daily weather data
	wg.Add(1)
	go func() {
		defer wg.Done()
		dailyErr = insertDailyWeatherData(ctx, client, projectID, sensorSet, sensorSetData, weatherData)
	}()

	// Insert hourly weather data
	wg.Add(1)
	go func() {
		defer wg.Done()
		hourlyErr = insertHourlyWeatherData(ctx, client, projectID, sensorSet, sensorSetData, weatherData)
	}()

	// Wait for both goroutines to complete
	wg.Wait()

	// Check for errors
	if dailyErr != nil {
		log.Printf("ERROR: Failed to insert daily weather data: %v", dailyErr)
		http.Error(w, fmt.Sprintf("Failed to insert daily weather data: %v", dailyErr), http.StatusInternalServerError)
		return
	}

	if hourlyErr != nil {
		log.Printf("ERROR: Failed to insert hourly weather data: %v", hourlyErr)
		http.Error(w, fmt.Sprintf("Failed to insert hourly weather data: %v", hourlyErr), http.StatusInternalServerError)
		return
	}

	log.Println("INFO: Successfully fetched and stored daily and hourly weather data.")
	fmt.Fprintln(w, "Successfully fetched and stored daily and hourly weather data.")
}

func getSensorSet(ctx context.Context, client *bigquery.Client, projectID, sensorSetID string) (*SensorSet, error) {
	queryString := fmt.Sprintf(
		`SELECT latitude, longitude, timezone FROM `+"`%s.sunlight_data.sensor_set`"+` WHERE sensor_set_id = @sensor_set_id`,
		projectID,
	)
	log.Printf("INFO: Executing BigQuery query: %s with sensor_set_id: %s", queryString, sensorSetID)

	query := client.Query(queryString)
	query.Parameters = []bigquery.QueryParameter{
		{Name: "sensor_set_id", Value: sensorSetID},
	}

	it, err := query.Read(ctx)
	if err != nil {
		log.Printf("ERROR: BigQuery query failed: %v", err)
		return nil, err
	}

	var ss SensorSet
	err = it.Next(&ss)
	if err == iterator.Done {
		err := fmt.Errorf("sensor_set_id '%s' not found in BigQuery table", sensorSetID)
		log.Printf("ERROR: %v", err)
		return nil, err
	}
	if err != nil {
		log.Printf("ERROR: Failed to iterate BigQuery results: %v", err)
		return nil, err
	}

	log.Printf("INFO: Found sensor set data: Latitude=%f, Longitude=%f, Timezone=%s", ss.Latitude, ss.Longitude, ss.Timezone)
	return &ss, nil
}

func getWeatherData(sensorSet *SensorSet, startDate, endDate string) (*MeteoResponse, error) {
	// Updated URL to include hourly parameters
	url := fmt.Sprintf(
		"https://api.open-meteo.com/v1/forecast?latitude=%f&longitude=%f&daily=sunrise,sunset,daylight_duration,sunshine_duration,temperature_2m_max,temperature_2m_min,uv_index_max,uv_index_clear_sky_max,rain_sum,showers_sum,precipitation_sum,snowfall_sum,precipitation_hours&hourly=temperature_2m,precipitation,relative_humidity_2m,cloud_cover,visibility,soil_temperature_0cm,soil_moisture_1_to_3cm,uv_index,uv_index_clear_sky,shortwave_radiation,direct_radiation,wind_speed_10m&start_date=%s&end_date=%s",
		sensorSet.Latitude, sensorSet.Longitude, startDate, endDate,
	)
	log.Printf("INFO: Calling Open-Meteo API: %s", url)

	resp, err := http.Get(url)
	if err != nil {
		log.Printf("ERROR: Failed to call Open-Meteo API: %v", err)
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		err := fmt.Errorf("Open-Meteo API returned non-200 status: %d. Body: %s", resp.StatusCode, string(bodyBytes))
		log.Printf("ERROR: %v", err)
		return nil, err
	}

	var meteoResp MeteoResponse
	if err := json.NewDecoder(resp.Body).Decode(&meteoResp); err != nil {
		log.Printf("ERROR: Failed to decode Open-Meteo JSON response: %v", err)
		return nil, err
	}

	log.Printf("INFO: Successfully received and decoded data from Open-Meteo. Daily records: %d, Hourly records: %d",
		len(meteoResp.Daily.Time), len(meteoResp.Hourly.Time))
	return &meteoResp, nil
}

func insertDailyWeatherData(ctx context.Context, client *bigquery.Client, projectID, sensorSetID string, sensorSetData *SensorSet, weatherData *MeteoResponse) error {
	log.Printf("INFO: Preparing to insert %d daily weather records into BigQuery.", len(weatherData.Daily.Time))

	for i, t := range weatherData.Daily.Time {
		sunrise, _ := time.Parse("2006-01-02T15:04", weatherData.Daily.Sunrise[i])
		sunset, _ := time.Parse("2006-01-02T15:04", weatherData.Daily.Sunset[i])

		q := client.Query(fmt.Sprintf(`
			MERGE `+"`%s.sunlight_data.daily_historical_weather`"+` T
			USING (
				SELECT
					CAST(@date AS DATE) as date,
					@sunrise as sunrise,
					@sunset as sunset,
					@daylight_duration as daylight_duration,
					@sunshine_duration as sunshine_duration,
					@temperature_2m_max as temperature_2m_max,
					@temperature_2m_min as temperature_2m_min,
					@uv_index_max as uv_index_max,
					@uv_index_clear_sky_max as uv_index_clear_sky_max,
					@rain_sum as rain_sum,
					@showers_sum as showers_sum,
					@precipitation_sum as precipitation_sum,
					@snowfall_sum as snowfall_sum,
					@precipitation_hours as precipitation_hours,
					@data_source as data_source,
					@sensor_set_id as sensor_set_id,
					@timezone as timezone,
					@latitude as latitude,
					@longitude as longitude,
					@last_updated as last_updated
			) S
			ON T.date = S.date AND T.sensor_set_id = S.sensor_set_id
			WHEN MATCHED THEN
				UPDATE SET
					sunrise = S.sunrise,
					sunset = S.sunset,
					daylight_duration = S.daylight_duration,
					sunshine_duration = S.sunshine_duration,
					temperature_2m_max = S.temperature_2m_max,
					temperature_2m_min = S.temperature_2m_min,
					uv_index_max = S.uv_index_max,
					uv_index_clear_sky_max = S.uv_index_clear_sky_max,
					rain_sum = S.rain_sum,
					showers_sum = S.showers_sum,
					precipitation_sum = S.precipitation_sum,
					snowfall_sum = S.snowfall_sum,
					precipitation_hours = S.precipitation_hours,
					data_source = S.data_source,
					timezone = S.timezone,
					latitude = S.latitude,
					longitude = S.longitude,
					last_updated = S.last_updated
			WHEN NOT MATCHED THEN
				INSERT (date, sunrise, sunset, daylight_duration, sunshine_duration, temperature_2m_max, temperature_2m_min, uv_index_max, uv_index_clear_sky_max, rain_sum, showers_sum, precipitation_sum, snowfall_sum, precipitation_hours, data_source, sensor_set_id, timezone, latitude, longitude, last_updated)
				VALUES(date, sunrise, sunset, daylight_duration, sunshine_duration, temperature_2m_max, temperature_2m_min, uv_index_max, uv_index_clear_sky_max, rain_sum, showers_sum, precipitation_sum, snowfall_sum, precipitation_hours, data_source, sensor_set_id, timezone, latitude, longitude, last_updated)
		`, projectID))

		q.Parameters = []bigquery.QueryParameter{
			{Name: "date", Value: t},
			{Name: "sunrise", Value: sunrise},
			{Name: "sunset", Value: sunset},
			{Name: "daylight_duration", Value: weatherData.Daily.DaylightDuration[i]},
			{Name: "sunshine_duration", Value: weatherData.Daily.SunshineDuration[i]},
			{Name: "temperature_2m_max", Value: weatherData.Daily.Temperature2mMax[i]},
			{Name: "temperature_2m_min", Value: weatherData.Daily.Temperature2mMin[i]},
			{Name: "uv_index_max", Value: weatherData.Daily.UvIndexMax[i]},
			{Name: "uv_index_clear_sky_max", Value: weatherData.Daily.UvIndexClearSkyMax[i]},
			{Name: "rain_sum", Value: weatherData.Daily.RainSum[i]},
			{Name: "showers_sum", Value: weatherData.Daily.ShowersSum[i]},
			{Name: "precipitation_sum", Value: weatherData.Daily.PrecipitationSum[i]},
			{Name: "snowfall_sum", Value: weatherData.Daily.SnowfallSum[i]},
			{Name: "precipitation_hours", Value: weatherData.Daily.PrecipitationHours[i]}, // Fixed parameter name
			{Name: "data_source", Value: "open-meteo"},
			{Name: "sensor_set_id", Value: sensorSetID},
			{Name: "timezone", Value: sensorSetData.Timezone},
			{Name: "latitude", Value: sensorSetData.Latitude},
			{Name: "longitude", Value: sensorSetData.Longitude},
			{Name: "last_updated", Value: time.Now().UTC()},
		}

		job, err := q.Run(ctx)
		if err != nil {
			return err
		}
		status, err := job.Wait(ctx)
		if err != nil {
			return err
		}
		if err := status.Err(); err != nil {
			log.Printf("BigQuery daily job failed: %v", err)
			return err
		}
	}

	log.Printf("INFO: Successfully inserted %d daily weather records.", len(weatherData.Daily.Time))
	return nil
}

func insertHourlyWeatherData(ctx context.Context, client *bigquery.Client, projectID, sensorSetID string, sensorSetData *SensorSet, weatherData *MeteoResponse) error {
	log.Printf("INFO: Preparing to insert %d hourly weather records into BigQuery.", len(weatherData.Hourly.Time))

	for i, timeStr := range weatherData.Hourly.Time {
		// Parse the ISO 8601 timestamp
		hourlyTime, err := time.Parse("2006-01-02T15:04", timeStr)
		if err != nil {
			log.Printf("ERROR: Failed to parse hourly timestamp '%s': %v", timeStr, err)
			continue
		}

		q := client.Query(fmt.Sprintf(`
			MERGE `+"`%s.sunlight_data.hourly_historical_weather`"+` T
			USING (
				SELECT
					@time as time,
					@sensor_set_id as sensor_set_id,
					@temperature_2m as temperature_2m,
					@precipitation as precipitation,
					@relative_humidity_2m as relative_humidity_2m,
					@cloud_cover as cloud_cover,
					@visibility as visibility,
					@soil_temperature_0cm as soil_temperature_0cm,
					@soil_moisture_1_to_3cm as soil_moisture_1_to_3cm,
					@uv_index as uv_index,
					@uv_index_clear_sky as uv_index_clear_sky,
					@shortwave_radiation as shortwave_radiation,
					@direct_radiation as direct_radiation,
					@wind_speed_10m as wind_speed_10m,
					@timezone as timezone,
					@latitude as latitude,
					@longitude as longitude,
					@data_source as data_source,
					@last_updated as last_updated
			) S
			ON T.time = S.time AND T.sensor_set_id = S.sensor_set_id
			WHEN MATCHED THEN
				UPDATE SET
					temperature_2m = S.temperature_2m,
					precipitation = S.precipitation,
					relative_humidity_2m = S.relative_humidity_2m,
					cloud_cover = S.cloud_cover,
					visibility = S.visibility,
					soil_temperature_0cm = S.soil_temperature_0cm,
					soil_moisture_1_to_3cm = S.soil_moisture_1_to_3cm,
					uv_index = S.uv_index,
					uv_index_clear_sky = S.uv_index_clear_sky,
					shortwave_radiation = S.shortwave_radiation,
					direct_radiation = S.direct_radiation,
					wind_speed_10m = S.wind_speed_10m,
					timezone = S.timezone,
					latitude = S.latitude,
					longitude = S.longitude,
					data_source = S.data_source,
					last_updated = S.last_updated
			WHEN NOT MATCHED THEN
				INSERT (time, sensor_set_id, temperature_2m, precipitation, relative_humidity_2m, cloud_cover, visibility, soil_temperature_0cm, soil_moisture_1_to_3cm, uv_index, uv_index_clear_sky, shortwave_radiation, direct_radiation, wind_speed_10m, timezone, latitude, longitude, data_source, last_updated)
				VALUES(time, sensor_set_id, temperature_2m, precipitation, relative_humidity_2m, cloud_cover, visibility, soil_temperature_0cm, soil_moisture_1_to_3cm, uv_index, uv_index_clear_sky, shortwave_radiation, direct_radiation, wind_speed_10m, timezone, latitude, longitude, data_source, last_updated)
		`, projectID))

		// Helper function to safely get float value from slice
		getFloatValue := func(slice []float64, index int) float64 {
			if index < len(slice) {
				return slice[index]
			}
			return 0.0
		}

		q.Parameters = []bigquery.QueryParameter{
			{Name: "time", Value: hourlyTime},
			{Name: "sensor_set_id", Value: sensorSetID},
			{Name: "temperature_2m", Value: getFloatValue(weatherData.Hourly.Temperature2m, i)},
			{Name: "precipitation", Value: getFloatValue(weatherData.Hourly.Precipitation, i)},
			{Name: "relative_humidity_2m", Value: getFloatValue(weatherData.Hourly.RelativeHumidity2m, i)},
			{Name: "cloud_cover", Value: getFloatValue(weatherData.Hourly.CloudCover, i)},
			{Name: "visibility", Value: getFloatValue(weatherData.Hourly.Visibility, i)},
			{Name: "soil_temperature_0cm", Value: getFloatValue(weatherData.Hourly.SoilTemperature0cm, i)},
			{Name: "soil_moisture_1_to_3cm", Value: getFloatValue(weatherData.Hourly.SoilMoisture1To3cm, i)},
			{Name: "uv_index", Value: getFloatValue(weatherData.Hourly.UvIndex, i)},
			{Name: "uv_index_clear_sky", Value: getFloatValue(weatherData.Hourly.UvIndexClearSky, i)},
			{Name: "shortwave_radiation", Value: getFloatValue(weatherData.Hourly.ShortwaveRadiation, i)},
			{Name: "direct_radiation", Value: getFloatValue(weatherData.Hourly.DirectRadiation, i)},
			{Name: "wind_speed_10m", Value: getFloatValue(weatherData.Hourly.WindSpeed10m, i)},
			{Name: "timezone", Value: sensorSetData.Timezone},
			{Name: "latitude", Value: sensorSetData.Latitude},
			{Name: "longitude", Value: sensorSetData.Longitude},
			{Name: "data_source", Value: "open-meteo"},
			{Name: "last_updated", Value: time.Now().UTC()},
		}

		job, err := q.Run(ctx)
		if err != nil {
			return fmt.Errorf("failed to run hourly insert query: %v", err)
		}
		status, err := job.Wait(ctx)
		if err != nil {
			return fmt.Errorf("failed to wait for hourly insert job: %v", err)
		}
		if err := status.Err(); err != nil {
			log.Printf("BigQuery hourly job failed: %v", err)
			return fmt.Errorf("bigquery hourly job failed: %v", err)
		}
	}

	log.Printf("INFO: Successfully inserted %d hourly weather records.", len(weatherData.Hourly.Time))
	return nil
}
