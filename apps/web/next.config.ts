import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
