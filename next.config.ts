import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['prisma'],

  // Enable compression for better performance
  compress: true,

  // AWSAmplify SSR Fix: Embed environment variables during build
  // This is required because Amplify doesn't pass env vars to Lambda runtime properly
  env: {
    // Database
    DATABASE_URL: process.env.DATABASE_URL || '',

    // AWS S3 Configuration
    S3_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID || '',
    S3_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY || '',
    S3_REGION: process.env.AWS_REGION || process.env.S3_REGION || '',
    S3_BUCKET: process.env.AWS_S3_BUCKET || process.env.S3_BUCKET || '',

    // Clerk Authentication
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '',
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY || '',

    // ComfyUI Configuration
    COMFYUI_URL: process.env.COMFYUI_URL || '',
    NEXT_PUBLIC_COMFYUI_URL: process.env.NEXT_PUBLIC_COMFYUI_URL || '',

    // RunPod Configuration
    RUNPOD_SERVERLESS: process.env.RUNPOD_SERVERLESS || '',
    NEXT_PUBLIC_RUNPOD_SERVERLESS: process.env.NEXT_PUBLIC_RUNPOD_SERVERLESS || '',
    RUNPOD_API_KEY: process.env.RUNPOD_API_KEY || '',
    RUNPOD_API_URL: process.env.RUNPOD_API_URL || '',
    RUNPOD_TEXT_TO_IMAGE_API_URL: process.env.RUNPOD_TEXT_TO_IMAGE_API_URL || '',
    RUNPOD_TEXT_TO_IMAGE_ENDPOINT_URL: process.env.RUNPOD_TEXT_TO_IMAGE_ENDPOINT_URL || '',
    RUNPOD_TEXT_TO_IMAGE_ENDPOINT_ID: process.env.RUNPOD_TEXT_TO_IMAGE_ENDPOINT_ID || '',
    RUNPOD_IMAGE_TO_VIDEO_ENDPOINT_ID: process.env.RUNPOD_IMAGE_TO_VIDEO_ENDPOINT_ID || '',
    RUNPOD_IMAGE_TO_VIDEO_ENDPOINT_URL: process.env.RUNPOD_IMAGE_TO_VIDEO_ENDPOINT_URL || '',
    RUNPOD_SKIN_ENHANCER_ENDPOINT_ID: process.env.RUNPOD_SKIN_ENHANCER_ENDPOINT_ID || '',
    RUNPOD_FACE_SWAP_ENDPOINT_ID: process.env.RUNPOD_FACE_SWAP_ENDPOINT_ID || '',
    RUNPOD_FACE_SWAP_ENDPOINT_URL: process.env.RUNPOD_FACE_SWAP_ENDPOINT_URL || '',
    RUNPOD_STYLE_TRANSFER_ENDPOINT_ID: process.env.RUNPOD_STYLE_TRANSFER_ENDPOINT_ID || '',
    RUNPOD_STYLE_TRANSFER_ENDPOINT_URL: process.env.RUNPOD_STYLE_TRANSFER_ENDPOINT_URL || '',
    RUNPOD_FPS_BOOST_ENDPOINT_ID: process.env.RUNPOD_FPS_BOOST_ENDPOINT_ID || '',
    RUNPOD_FPS_BOOST_ENDPOINT_URL: process.env.RUNPOD_FPS_BOOST_ENDPOINT_URL || '',
    RUNPOD_IMAGE_TO_IMAGE_SKIN_ENHANCER_ENDPOINT_ID: process.env.RUNPOD_IMAGE_TO_IMAGE_SKIN_ENHANCER_ENDPOINT_ID || '',
    RUNPOD_IMAGE_TO_IMAGE_SKIN_ENHANCER_ENDPOINT_URL: process.env.RUNPOD_IMAGE_TO_IMAGE_SKIN_ENHANCER_ENDPOINT_URL || '',
    RUNPOD_FLUX_KONTEXT_ENDPOINT_ID: process.env.RUNPOD_FLUX_KONTEXT_ENDPOINT_ID || '',
    RUNPOD_FLUX_KONTEXT_ENDPOINT_URL: process.env.RUNPOD_FLUX_KONTEXT_ENDPOINT_URL || '',
    RUNPOD_TEXT_TO_VIDEO_ENDPOINT_ID: process.env.RUNPOD_TEXT_TO_VIDEO_ENDPOINT_ID || '',
    RUNPOD_TEXT_TO_VIDEO_ENDPOINT_URL: process.env.RUNPOD_TEXT_TO_VIDEO_ENDPOINT_URL || '',

    // RunPod S3 Credentials
    RUNPOD_S3_ACCESS_KEY: process.env.RUNPOD_S3_ACCESS_KEY || '',
    RUNPOD_S3_SECRET_KEY: process.env.RUNPOD_S3_SECRET_KEY || '',
    RUNPOD_S3_BUCKET_NAME: process.env.RUNPOD_S3_BUCKET_NAME || '',

    // Cloudinary
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '',
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || '',

    // Vercel Blob
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN || '',

    // Training Upload
    TRAINING_UPLOAD_KEY: process.env.TRAINING_UPLOAD_KEY || '',

    // Base URLs
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL || '',
    BASE_URL: process.env.BASE_URL || '',
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || '',
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || '',

    // Apify
    APIFY_API_TOKEN: process.env.APIFY_API_TOKEN || '',

    // OpenAI
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',

    // Google Cloud Service Account
    GOOGLE_CLOUD_PROJECT_ID: process.env.GOOGLE_CLOUD_PROJECT_ID || '',
    GOOGLE_CLOUD_PRIVATE_KEY_ID: process.env.GOOGLE_CLOUD_PRIVATE_KEY_ID || '',
    GOOGLE_CLOUD_PRIVATE_KEY: process.env.GOOGLE_CLOUD_PRIVATE_KEY || '',
    GOOGLE_CLOUD_CLIENT_EMAIL: process.env.GOOGLE_CLOUD_CLIENT_EMAIL || '',
    GOOGLE_CLOUD_CLIENT_ID: process.env.GOOGLE_CLOUD_CLIENT_ID || '',

    // Google OAuth
    GOOGLE_OAUTH_CLIENT_ID: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
    GOOGLE_OAUTH_CLIENT_SECRET: process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
    GOOGLE_OAUTH_REDIRECT_URI: process.env.GOOGLE_OAUTH_REDIRECT_URI || '',

    // Google Drive Folder IDs
    GOOGLE_DRIVE_ALL_GENERATIONS_FOLDER_ID: process.env.GOOGLE_DRIVE_ALL_GENERATIONS_FOLDER_ID || '',
    GOOGLE_DRIVE_IG_POSTS_FOLDER_ID: process.env.GOOGLE_DRIVE_IG_POSTS_FOLDER_ID || '',
    GOOGLE_DRIVE_IG_REELS_FOLDER_ID: process.env.GOOGLE_DRIVE_IG_REELS_FOLDER_ID || '',
    GOOGLE_DRIVE_MISC_FOLDER_ID: process.env.GOOGLE_DRIVE_MISC_FOLDER_ID || '',
    NEXT_PUBLIC_GOOGLE_DRIVE_ALL_GENERATIONS_FOLDER_ID: process.env.NEXT_PUBLIC_GOOGLE_DRIVE_ALL_GENERATIONS_FOLDER_ID || '',
    NEXT_PUBLIC_GOOGLE_DRIVE_IG_POSTS_FOLDER_ID: process.env.NEXT_PUBLIC_GOOGLE_DRIVE_IG_POSTS_FOLDER_ID || '',
    NEXT_PUBLIC_GOOGLE_DRIVE_IG_REELS_FOLDER_ID: process.env.NEXT_PUBLIC_GOOGLE_DRIVE_IG_REELS_FOLDER_ID || '',
    NEXT_PUBLIC_GOOGLE_DRIVE_MISC_FOLDER_ID: process.env.NEXT_PUBLIC_GOOGLE_DRIVE_MISC_FOLDER_ID || '',

    // Resend Email
    RESEND_API_KEY: process.env.RESEND_API_KEY || '',

    // Cron Secret
    CRON_SECRET: process.env.CRON_SECRET || '',

    // SeeDream API Key
    ARK_API_KEY: process.env.ARK_API_KEY || '',
  },

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
