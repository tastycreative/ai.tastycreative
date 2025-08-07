// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Image configuration to fix Next.js external hostname errors
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: '209.53.88.242',
        port: '14967',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: '211.21.50.84',
        port: '15833',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: '211.21.50.84',
        port: '15279',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**', // Allow all HTTPS hostnames
      }
    ],
    // Alternative: if you want to be more permissive during development
    unoptimized: process.env.NODE_ENV === 'development',
  },

  // Increase API route timeout for large file uploads
  experimental: {
    // Increase serverComponentsExternalPackages if needed
  },
  
  // Configure API routes
  api: {
    // Increase body size limit for file uploads (default is 1mb)
    bodyParser: {
      sizeLimit: '500mb', // Match your file size limit
    },
    
    // Increase response timeout (default is 10s in some environments)
    responseLimit: false,
  },
  
  // If using Vercel, you might need these settings in vercel.json instead
  serverRuntimeConfig: {
    // Increase timeout for API routes
    apiTimeout: 600000, // 10 minutes
  },
};

module.exports = nextConfig;