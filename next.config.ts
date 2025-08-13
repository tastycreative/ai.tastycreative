import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['prisma'],
  experimental: {
    serverComponentsExternalPackages: ['prisma'],
  },
  // Note: Body size limit is now configured in route handlers directly
  // or through middleware, not in next.config
};

export default nextConfig;
