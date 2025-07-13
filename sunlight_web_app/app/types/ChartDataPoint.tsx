/*
 * Represents a data point on the heatmap.
 *
 * Source code description.
 *
 * Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
 * Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
 * Apache 2.0 Licensed as described in the file LICENSE
 */

// --- Chart Data Point ---
export interface ChartDataPoint {
    x: number;
    y: number;
    z: number | undefined; // Light Intensity
}