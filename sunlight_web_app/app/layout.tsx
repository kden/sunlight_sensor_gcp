/*
 * layout.tsx
 *
 * Page layout for entire app.
 *
 * Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
 * Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
 * Apache 2.0 Licensed as described in the file LICENSE
 */

import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import ErrorBoundary from "@/app/components/ErrorBoundary";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sunlight Sensor Dashboard",
  description: "A dashboard for monitoring sunlight sensors.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased h-full`}
      >
        <div className="flex flex-col md:flex-row min-h-screen w-full">
          <aside className="w-full md:w-64 bg-gray-800 text-white p-4 flex-shrink-0">
            <h1 className="text-2xl font-bold mb-4 text-amber-300">Sunlight Dashboard</h1>
            <nav>
              <ul>
                <li className="mb-2">
                  <Link href="/" className="hover:text-amber-300 block py-2">
                    Sensor Levels
                  </Link>
                </li>
                <li className="mb-2">
                  <Link href="/heatmap" className="hover:text-amber-300 block py-2">
                    Sensor Heatmap
                  </Link>
                </li>
                <li className="mb-2">
                  <Link href="/details" className="hover:text-amber-300 block py-2">
                    Sensor Details
                  </Link>
                </li>
                <li>
                  <Link href="/help" className="hover:text-amber-300 block py-2">
                    Help
                  </Link>
                </li>
              </ul>
            </nav>
          </aside>
            <main className="flex-1 bg-gray-900 text-white p-4 md:p-8 overflow-y-auto">
                {/* Comment out error boundary to surface errors. */}
                {/* <ErrorBoundary> */}
                {children}
                {/* </ErrorBoundary> */}
            </main>
        </div>
      </body>
    </html>
  );
}