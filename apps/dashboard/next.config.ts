import type { NextConfig } from "next";
import { apiProxyTarget } from "./app/lib/api-base";

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
        // Every API call from the browser goes through the dashboard's own origin (see app/lib/api-base.ts),
        // so it is same-origin and CORS never applies. NEXT_PUBLIC_API_URL must be set when this is built.
        source: "/api/:path*",
        destination: `${apiProxyTarget(process.env.NEXT_PUBLIC_API_URL)}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
