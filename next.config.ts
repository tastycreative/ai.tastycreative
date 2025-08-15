import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['prisma'],
  // Note: Body size limit is now configured in route handlers directly
  // or through middleware, not in next.config
  
  // Turbopack configuration to handle @vercel/blob properly
  turbopack: {
    resolveAlias: {
      '@vercel/blob/client': '@vercel/blob/client',
    },
  },
  
  // Webpack configuration for non-Turbopack builds
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Ensure proper chunking for client-side bundles
      config.optimization.splitChunks = {
        ...config.optimization.splitChunks,
        cacheGroups: {
          ...config.optimization.splitChunks?.cacheGroups,
          vercelBlob: {
            test: /[\\/]node_modules[\\/]@vercel[\\/]blob[\\/]/,
            name: 'vercel-blob',
            chunks: 'all',
            priority: 10,
          },
        },
      };
    }
    return config;
  },
};

export default nextConfig;
