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
    const apiOrigin = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000")
      .replace(/\/+$/, "")
      .replace(/\/api\/v1\/?$/, "")
      .replace(/\/api\/?$/, "");
    return [
      {
        // Proxy API calls to the web app in local development.
        // In production, configure this at the infrastructure level (e.g. reverse proxy).
        source: "/api/:path*",
        destination: `${apiOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
