// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
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