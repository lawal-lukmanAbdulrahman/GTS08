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
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "**",
      },
    ],
  },
  async rewrites() {
    return [
      {
        // Proxy API calls to the web app in local development.
        // In production, configure this at the infrastructure level (e.g. reverse proxy).
        source: "/api/:path*",
        destination: "http://localhost:3000/api/:path*",
      },
    ];
  },
};

export default nextConfig;
