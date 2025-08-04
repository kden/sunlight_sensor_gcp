/*
daily_open_meteo/function.go

Collects daily and hourly weather data from Open-Meteo and stores it in BigQuery.

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
	"cloud.google.com/go/civil"
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
// It now includes both daily and hourly data.
type MeteoResponse struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Timezone  string  `json:"timezone"`
	Daily     struct {
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
		SoilMoisture1to3cm []float64 `json:"soil_moisture_1_to_3cm"`
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
	PrecipitationHours float64   `bigquery:"precipitation_hours"`
	SensorSetID        string    `bigquery:"sensor_set_id"`
	Timezone           string    `bigquery:"timezone"`
	Latitude           float64   `bigquery:"latitude"`
	Longitude          float64   `bigquery:"longitude"`
	DataSource         string    `bigquery:"data_source"`
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
	SoilMoisture1to3cm float64   `bigquery:"soil_moisture_1_to_3cm"`
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
		log.Println("GCP_PROJECT environment variable not set.")
		http.Error(w, "Server configuration error", http.StatusInternalServerError)
		return
	}

	client, err := bigquery.NewClient(ctx, projectID)
	if err != nil {
		log.Printf("bigquery.NewClient: %v", err)
		http.Error(w, "Failed to create BigQuery client", http.StatusInternalServerError)
		return
	}
	defer client.Close()

	sensorSetID := r.URL.Query().Get("sensor_set_id")
	if sensorSetID == "" {
		http.Error(w, "Missing sensor_set_id parameter", http.StatusBadRequest)
		return
	}

	sensorSet, err := getSensorSet(ctx, client, sensorSetID)
	if err != nil {
		log.Printf("getSensorSet: %v", err)
		http.Error(w, "Failed to get sensor set metadata", http.StatusInternalServerError)
		return
	}

	// Use the default HTTP client for production, but allow injection for tests.
	meteoData, err := fetchWeatherData(http.DefaultClient, sensorSet)
	if err != nil {
		log.Printf("fetchWeatherData: %v", err)
		http.Error(w, "Failed to fetch weather data", http.StatusInternalServerError)
		return
	}

	// Use a WaitGroup to run insertions concurrently and an error channel to collect errors.
	var wg sync.WaitGroup
	errs := make(chan error, 2)

	wg.Add(1)
	go func() {
		defer wg.Done()
		if err := insertDailyData(ctx, client, meteoData, sensorSetID); err != nil {
			errs <- fmt.Errorf("failed to insert daily data: %w", err)
		}
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		if err := insertHourlyData(ctx, client, meteoData, sensorSetID); err != nil {
			errs <- fmt.Errorf("failed to insert hourly data: %w", err)
		}
	}()

	wg.Wait()
	close(errs)

	// Check if any of the concurrent operations failed.
	for err := range errs {
		if err != nil {
			log.Printf("Data insertion failed: %v", err)
			http.Error(w, fmt.Sprintf("Data insertion failed: %v", err), http.StatusInternalServerError)
			return
		}
	}

	fmt.Fprintln(w, "Successfully fetched and stored daily and hourly weather data.")
}

// getSensorSet retrieves the latitude, longitude, and timezone for a given sensor set.
func getSensorSet(ctx context.Context, client *bigquery.Client, sensorSetID string) (*SensorSet, error) {
	query := client.Query(
		`SELECT latitude, longitude, timezone FROM sunlight_data.sensor_set WHERE sensor_set_id = @sensorSetID`,
	)
	query.Parameters = []bigquery.QueryParameter{
		{Name: "sensorSetID", Value: sensorSetID},
	}

	it, err := query.Read(ctx)
	if err != nil {
		return nil, fmt.Errorf("query.Read: %w", err)
	}

	var ss SensorSet
	err = it.Next(&ss)
	if err == iterator.Done {
		return nil, fmt.Errorf("no sensor set found with ID: %s", sensorSetID)
	}
	if err != nil {
		return nil, fmt.Errorf("it.Next: %w", err)
	}

	return &ss, nil
}

// fetchWeatherData calls the Open-Meteo API to get daily and hourly weather data.
func fetchWeatherData(client *http.Client, ss *SensorSet) (*MeteoResponse, error) {
	// Fetch data for yesterday.
	yesterday := time.Now().AddDate(0, 0, -1).Format("2006-01-02")
	apiURL := fmt.Sprintf(
		"https://api.open-meteo.com/v1/forecast?latitude=%f&longitude=%f&start_date=%s&end_date=%s&timezone=%s&daily=sunrise,sunset,daylight_duration,sunshine_duration,temperature_2m_max,temperature_2m_min,uv_index_max,uv_index_clear_sky_max,rain_sum,showers_sum,precipitation_sum,snowfall_sum,precipitation_hours&hourly=temperature_2m,precipitation,relative_humidity_2m,cloud_cover,visibility,soil_temperature_0cm,soil_moisture_1_to_3cm,uv_index,uv_index_clear_sky,shortwave_radiation,direct_radiation,wind_speed_10m",
		ss.Latitude, ss.Longitude, yesterday, yesterday, ss.Timezone,
	)

	resp, err := client.Get(apiURL)
	if err != nil {
		return nil, fmt.Errorf("http.Get: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("Open-Meteo API returned status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var meteoData MeteoResponse
	if err := json.NewDecoder(resp.Body).Decode(&meteoData); err != nil {
		return nil, fmt.Errorf("json.Decode: %w", err)
	}

	return &meteoData, nil
}

// insertDailyData upserts the daily weather data into BigQuery.
func insertDailyData(ctx context.Context, client *bigquery.Client, data *MeteoResponse, sensorSetID string) error {
	if len(data.Daily.Time) == 0 {
		log.Println("No daily data to insert.")
		return nil
	}

	// Using MERGE for an "upsert" operation on the daily data.
	mergeSQL := `
	MERGE sunlight_data.daily_historical_weather T
	USING (SELECT @date as date, @sensor_set_id as sensor_set_id) S
	ON T.date = S.date AND T.sensor_set_id = S.sensor_set_id
	WHEN MATCHED THEN
		UPDATE SET
			sunrise = @sunrise, sunset = @sunset, daylight_duration = @daylight_duration,
			sunshine_duration = @sunshine_duration, temperature_2m_max = @temperature_2m_max,
			temperature_2m_min = @temperature_2m_min, uv_index_max = @uv_index_max,
			uv_index_clear_sky_max = @uv_index_clear_sky_max, rain_sum = @rain_sum,
			showers_sum = @showers_sum, precipitation_sum = @precipitation_sum,
			snowfall_sum = @snowfall_sum, precipitation_hours = @precipitation_hours,
			last_updated = @last_updated
	WHEN NOT MATCHED THEN
		INSERT (date, sunrise, sunset, daylight_duration, sunshine_duration, temperature_2m_max, temperature_2m_min, uv_index_max, uv_index_clear_sky_max, rain_sum, showers_sum, precipitation_sum, snowfall_sum, precipitation_hours, sensor_set_id, timezone, latitude, longitude, data_source, last_updated)
		VALUES (@date, @sunrise, @sunset, @daylight_duration, @sunshine_duration, @temperature_2m_max, @temperature_2m_min, @uv_index_max, @uv_index_clear_sky_max, @rain_sum, @showers_sum, @precipitation_sum, @snowfall_sum, @precipitation_hours, @sensor_set_id, @timezone, @latitude, @longitude, @data_source, @last_updated)
	`
	q := client.Query(mergeSQL)

	// The date from the API is a string "YYYY-MM-DD", but the BigQuery column is a DATE.
	// We must parse it to a civil.Date object for the client library to handle it correctly.
	parsedDate, err := civil.ParseDate(data.Daily.Time[0])
	if err != nil {
		return fmt.Errorf("parsing date string '%s': %w", data.Daily.Time[0], err)
	}

	// The API returns sunrise/sunset in "YYYY-MM-DDTHH:MM" format, which is not RFC3339.
	// We must provide a matching layout string to parse it correctly.
	const timeLayout = "2006-01-02T15:04"
	sunrise, err := time.Parse(timeLayout, data.Daily.Sunrise[0])
	if err != nil {
		return fmt.Errorf("parsing sunrise: %w", err)
	}
	sunset, err := time.Parse(timeLayout, data.Daily.Sunset[0])
	if err != nil {
		return fmt.Errorf("parsing sunset: %w", err)
	}

	q.Parameters = []bigquery.QueryParameter{
		{Name: "date", Value: parsedDate},
		{Name: "sunrise", Value: sunrise},
		{Name: "sunset", Value: sunset},
		{Name: "daylight_duration", Value: data.Daily.DaylightDuration[0]},
		{Name: "sunshine_duration", Value: data.Daily.SunshineDuration[0]},
		{Name: "temperature_2m_max", Value: data.Daily.Temperature2mMax[0]},
		{Name: "temperature_2m_min", Value: data.Daily.Temperature2mMin[0]},
		{Name: "uv_index_max", Value: data.Daily.UvIndexMax[0]},
		{Name: "uv_index_clear_sky_max", Value: data.Daily.UvIndexClearSkyMax[0]},
		{Name: "rain_sum", Value: data.Daily.RainSum[0]},
		{Name: "showers_sum", Value: data.Daily.ShowersSum[0]},
		{Name: "precipitation_sum", Value: data.Daily.PrecipitationSum[0]},
		{Name: "snowfall_sum", Value: data.Daily.SnowfallSum[0]},
		{Name: "precipitation_hours", Value: data.Daily.PrecipitationHours[0]},
		{Name: "sensor_set_id", Value: sensorSetID},
		{Name: "timezone", Value: data.Timezone},
		{Name: "latitude", Value: data.Latitude},
		{Name: "longitude", Value: data.Longitude},
		{Name: "data_source", Value: "open-meteo"},
		{Name: "last_updated", Value: time.Now().UTC()},
	}

	job, err := q.Run(ctx)
	if err != nil {
		return fmt.Errorf("query.Run: %w", err)
	}
	status, err := job.Wait(ctx)
	if err != nil {
		return fmt.Errorf("job.Wait: %w", err)
	}
	if err := status.Err(); err != nil {
		return fmt.Errorf("job failed: %w", err)
	}

	log.Println("Successfully upserted daily weather data.")
	return nil
}

// insertHourlyData uses a streaming inserter to efficiently add hourly records to BigQuery.
func insertHourlyData(ctx context.Context, client *bigquery.Client, data *MeteoResponse, sensorSetID string) error {
	if len(data.Hourly.Time) == 0 {
		log.Println("No hourly data to insert.")
		return nil
	}

	inserter := client.Dataset("sunlight_data").Table("hourly_historical_weather").Inserter()
	var records []*HourlyWeatherRecord

	for i := range data.Hourly.Time {
		ts, err := time.Parse("2006-01-02T15:04", data.Hourly.Time[i])
		if err != nil {
			log.Printf("Skipping hourly record due to parse error: %v", err)
			continue
		}

		record := &HourlyWeatherRecord{
			Time:               ts,
			SensorSetID:        sensorSetID,
			Temperature2m:      data.Hourly.Temperature2m[i],
			Precipitation:      data.Hourly.Precipitation[i],
			RelativeHumidity2m: data.Hourly.RelativeHumidity2m[i],
			CloudCover:         data.Hourly.CloudCover[i],
			Visibility:         data.Hourly.Visibility[i],
			SoilTemperature0cm: data.Hourly.SoilTemperature0cm[i],
			SoilMoisture1to3cm: data.Hourly.SoilMoisture1to3cm[i],
			UvIndex:            data.Hourly.UvIndex[i],
			UvIndexClearSky:    data.Hourly.UvIndexClearSky[i],
			ShortwaveRadiation: data.Hourly.ShortwaveRadiation[i],
			DirectRadiation:    data.Hourly.DirectRadiation[i],
			WindSpeed10m:       data.Hourly.WindSpeed10m[i],
			Timezone:           data.Timezone,
			Latitude:           data.Latitude,
			Longitude:          data.Longitude,
			DataSource:         "open-meteo",
			LastUpdated:        time.Now().UTC(),
		}
		records = append(records, record)
	}

	if err := inserter.Put(ctx, records); err != nil {
		return fmt.Errorf("inserter.Put: %w", err)
	}

	log.Printf("Successfully inserted %d hourly weather records.", len(records))
	return nil
}