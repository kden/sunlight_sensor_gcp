/*
daily_open_meteo/function.go

Collect daily weather data from Open-Meteo and store it in BigQuery.

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
	PrecipitationHours float64   `bigquery:"precipitation_hour"`
	DataSource         string    `bigquery:"data_source"`
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
	sensorSet := r.URL.Query().Get("sensor_set")
	startDate := r.URL.Query().Get("start_date")
	endDate := r.URL.Query().Get("end_date")

	log.Printf("INFO: Received request with parameters: sensor_set='%s', start_date='%s', end_date='%s'", sensorSet, startDate, endDate)

	if sensorSet == "" {
		log.Println("ERROR: Missing sensor_set parameter")
		http.Error(w, "Missing sensor_set parameter", http.StatusBadRequest)
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
		// Error is already logged in the getSensorSet function
		http.Error(w, fmt.Sprintf("Failed to get sensor set data: %v", err), http.StatusInternalServerError)
		return
	}

	// Get weather data from Open-Meteo
	weatherData, err := getWeatherData(sensorSetData, startDate, endDate)
	if err != nil {
		// Error is already logged in the getWeatherData function
		http.Error(w, fmt.Sprintf("Failed to get weather data: %v", err), http.StatusInternalServerError)
		return
	}

	// Insert weather data into BigQuery
	if err := insertWeatherData(ctx, client, projectID, weatherData); err != nil {
		log.Printf("ERROR: Failed to insert weather data: %v", err)
		http.Error(w, fmt.Sprintf("Failed to insert weather data: %v", err), http.StatusInternalServerError)
		return
	}

	log.Println("INFO: Successfully fetched and stored weather data.")
	fmt.Fprintln(w, "Successfully fetched and stored weather data.")
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
		// NEW: Specific error for when the sensor set is not found
		err := fmt.Errorf("sensor_set_id '%s' not found in BigQuery table", sensorSetID)
		log.Printf("ERROR: %v", err)
		return nil, err
	}
	if err != nil {
		log.Printf("ERROR: Failed to iterate BigQuery results: %v", err)
		return nil, err
	}

	// NEW: Log the data that was found
	log.Printf("INFO: Found sensor set data: Latitude=%f, Longitude=%f, Timezone=%s", ss.Latitude, ss.Longitude, ss.Timezone)
	return &ss, nil
}

func getWeatherData(sensorSet *SensorSet, startDate, endDate string) (*MeteoResponse, error) {
	url := fmt.Sprintf(
		"https://api.open-meteo.com/v1/forecast?latitude=%f&longitude=%f&daily=sunrise,sunset,daylight_duration,sunshine_duration,temperature_2m_max,temperature_2m_min,uv_index_max,uv_index_clear_sky_max,rain_sum,showers_sum,precipitation_sum,snowfall_sum,precipitation_hours&timezone=%s&start_date=%s&end_date=%s",
		sensorSet.Latitude, sensorSet.Longitude, sensorSet.Timezone, startDate, endDate,
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

	log.Printf("INFO: Successfully received and decoded data from Open-Meteo.")
	return &meteoResp, nil
}

func insertWeatherData(ctx context.Context, client *bigquery.Client, projectID string, weatherData *MeteoResponse) error {
	log.Printf("INFO: Preparing to insert %d weather records into BigQuery.", len(weatherData.Daily.Time))
	for i, t := range weatherData.Daily.Time {
		sunrise, _ := time.Parse("2006-01-02T15:04", weatherData.Daily.Sunrise[i])
		sunset, _ := time.Parse("2006-01-02T15:04", weatherData.Daily.Sunset[i])

		// Use a MERGE statement to insert or update the record.
		q := client.Query(fmt.Sprintf(`
			MERGE `+"`%s.sunlight_data.daily_historical_weather`"+` T
			USING (SELECT
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
				@precipitation_hour as precipitation_hour,
				@data_source as data_source
			) S
			ON T.date = S.date
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
					precipitation_hour = S.precipitation_hour,
					data_source = S.data_source
			WHEN NOT MATCHED THEN
				INSERT (date, sunrise, sunset, daylight_duration, sunshine_duration, temperature_2m_max, temperature_2m_min, uv_index_max, uv_index_clear_sky_max, rain_sum, showers_sum, precipitation_sum, snowfall_sum, precipitation_hour, data_source)
				VALUES(date, sunrise, sunset, daylight_duration, sunshine_duration, temperature_2m_max, temperature_2m_min, uv_index_max, uv_index_clear_sky_max, rain_sum, showers_sum, precipitation_sum, snowfall_sum, precipitation_hour, data_source)
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
			{Name: "precipitation_hour", Value: weatherData.Daily.PrecipitationHours[i]},
			{Name: "data_source", Value: "open-meteo"},
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
			log.Printf("BigQuery job failed: %v", err)
			return err
		}
	}

	return nil
}