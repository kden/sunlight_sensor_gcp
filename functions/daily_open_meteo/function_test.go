/*
daily_open_meteo/function_test.go

Tests for the DailyWeatherer function.

Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
Apache 2.0 Licensed as described in the file LICENSE
*/

package weather_function

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// TestWeatherer_MissingSensorSet tests that the function returns a
// Bad Request error when the sensor_set parameter is missing.
func TestWeatherer_MissingSensorSet(t *testing.T) {
	// Set a temporary environment variable for the GCP_PROJECT.
	// t.Setenv automatically restores the original value after the test.
	t.Setenv("GCP_PROJECT", "test-project")

	// Create a request that is missing the 'sensor_set' parameter.
	req := httptest.NewRequest("GET", "/", nil)

	// Create a ResponseRecorder to capture the response.
	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(DailyWeatherer)

	// Call the handler.
	handler.ServeHTTP(rr, req)

	// Check that the status code is Bad Request (400).
	if status := rr.Code; status != http.StatusBadRequest {
		t.Errorf("handler returned wrong status code: got %v want %v",
			status, http.StatusBadRequest)
	}

	// Check that the response body is correct.
	expected := "Missing sensor_set parameter\n"
	if rr.Body.String() != expected {
		t.Errorf("handler returned unexpected body: got %v want %v",
			rr.Body.String(), expected)
	}
}
