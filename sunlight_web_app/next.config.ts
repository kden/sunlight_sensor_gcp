import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Add this line to enable static exports.
  // This tells Next.js to build your app as a set of static HTML/CSS/JS files
  // in a directory named "out", which is what Firebase Hosting expects.
  output: 'export',

  // Your other Next.js config can go here if you have any.
};

export default nextConfig;
