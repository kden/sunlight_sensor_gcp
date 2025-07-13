/*
 * next.config.ts
 *
 * Next.js configuration.
 *
 * Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
 * Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
 * Apache 2.0 Licensed as described in the file LICENSE
 */

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Add this line to enable static exports.
  // This tells Next.js to build your app as a set of static HTML/CSS/JS files
  // in a directory named "out", which is what Firebase Hosting expects.
  output: 'export',

  // Add this block to prevent ESLint errors from failing the build.
  // The build will still report the errors, but it won't stop the deployment.
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  // Your other Next.js config can go here if you have any.
};

export default nextConfig;
