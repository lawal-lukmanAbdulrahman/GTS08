import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false, // don't announce the framework to every visitor
  transpilePackages: ["@gts/ui", "@gts/utils", "@gts/types", "@gts/database"],
  onDemandEntries: {
    // Keep pages in memory for 60 seconds
    maxInactiveAge: 60 * 1000,
    // Buffer at most 3 pages in dev memory simultaneously
    pagesBufferLength: 3,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
