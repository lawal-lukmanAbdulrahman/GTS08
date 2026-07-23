import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@gts/ui", "@gts/utils", "@gts/types", "@gts/database"],
};

export default nextConfig;
