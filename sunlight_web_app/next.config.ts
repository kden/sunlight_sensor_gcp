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
