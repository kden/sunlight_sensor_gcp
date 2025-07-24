/*
 * app/help/page.tsx
 *
 * Help page for the Sunlight Sensor Dashboard.
 *
 * Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
 * Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
 * Apache 2.0 Licensed as described in the file LICENSE
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Help - Sunlight Sensor Dashboard",
  description: "Help and information about the sunlight sensor dashboard.",
};

export default function HelpPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 text-amber-300">Help</h1>
      <div className="space-y-4 text-white">
        <p>
          This dashboard provides tools to monitor and visualize data from various
          sunlight sensors.
        </p>
        <h2 className="text-2xl font-semibold mt-6 mb-2 text-amber-200">
          Navigation
        </h2>
        <ul className="list-disc list-inside space-y-2">
          <li>
            <strong>Sensor Levels:</strong> The main dashboard view, showing
            recent sunlight levels from all active sensors.
          </li>
          <li>
            <strong>Sensor Heatmap:</strong> A visual representation of sensor
            data over a geographical area, showing variations in sunlight
            intensity.  "Heatmap" refers to the type of chart; the sensors are measuring light, not heat.
          </li>
          <li>
            <strong>Sensor Details:</strong> Details about each sensor.
          </li>
        </ul>
        <h2 className="text-2xl font-semibold mt-6 mb-2 text-amber-200">
          Frequently Asked Questions
        </h2>

             <dl>
          <dt className="mt-6 font-semibold text-amber-200">
            Q: How granular is the data?
          </dt>
          <dd className="mt-2 pl-2 text-white">
            Sunlight intensity data is averaged over 15 minute blocks.
          </dd>

          <dt className="mt-6 font-semibold text-amber-200">
            Q: How frequently is the data updated?
          </dt>
          <dd className="mt-2 pl-2 text-white">
            The data will be somewhere between 20-50 minutes behind. This is because:
            <ol className="list-disc list-inside space-y-2 mt-2 pl-4">
              <li>Every 5 minutes, the sensor sends a buffered list of readings that were taken every 5 minutes.</li>
              <li>The data then travels through a REST proxy and Google Pub/Sub to BigQuery.</li>
              <li>BigQuery then runs 2 scheduled queries, that run every 15 minutes to go through two data processing steps.</li>
              <li>Finally, every 15 minutes a scheduled function downsamples and transfers that data to Firestore where it is used by the web app.</li>
            </ol>
          </dd>
        </dl>
      </div>
    </div>
  );
}