import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@phala/dcap-qvl-node"],
  devIndicators: false,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
