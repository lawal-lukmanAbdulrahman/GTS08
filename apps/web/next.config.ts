import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false, // don't announce the framework to every visitor
  transpilePackages: ["@gts/ui", "@gts/utils", "@gts/types", "@gts/database"],
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
