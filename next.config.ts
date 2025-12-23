import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['prisma'],
  
  // Enable compression for better performance
  compress: true,
  
  // Configure allowed image domains for Next.js Image component
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'tastycreative.s3.amazonaws.com',
        port: '',
        pathname: '/outputs/**',
      },
      {
        protocol: 'https',
        hostname: '*.amazonaws.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  
  // Configure server actions with larger body size limit for file uploads
  // experimental: {
  //   serverActions: {
  //     bodySizeLimit: '50mb', // Allow up to 50MB uploads for videos
  //   },
  // },
  
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
