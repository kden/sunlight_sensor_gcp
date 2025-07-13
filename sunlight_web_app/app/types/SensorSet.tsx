/*
 * SensorSet.tsx
 *
 * Represents a set of sensors at a specific site.
 *
 * Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
 * Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
 * Apache 2.0 Licensed as described in the file LICENSE
 */

export interface SensorSet {
  id: string;
  name: string;
  timezone: string;
  latitude: number | null;
  longitude: number | null;
}