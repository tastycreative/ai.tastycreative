import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['prisma'],
  serverActions: {
    bodySizeLimit: '50mb', // Increase from default 1MB to handle LoRA models
  },
};

export default nextConfig;
