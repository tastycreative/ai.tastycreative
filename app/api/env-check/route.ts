// app/api/env-check/route.ts - Environment validation for deployment
import { NextResponse } from 'next/server';

export async function GET() {
  const requiredEnvVars = [
    'DATABASE_URL',
    'BLOB_READ_WRITE_TOKEN',
    'CLERK_SECRET_KEY',
    'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
    'COMFYUI_URL'
  ];

  const missingVars: string[] = [];
  const presentVars: string[] = [];

  requiredEnvVars.forEach(varName => {
    if (process.env[varName]) {
      presentVars.push(varName);
    } else {
      missingVars.push(varName);
    }
  });

  const isProduction = process.env.NODE_ENV === 'production';

  return NextResponse.json({
    environment: process.env.NODE_ENV,
    isProduction,
    deploymentReady: missingVars.length === 0,
    presentVars,
    missingVars,
    timestamp: new Date().toISOString(),
    // Don't expose sensitive values, just indicate they exist
    envStatus: {
      database: !!process.env.DATABASE_URL,
      blob: !!process.env.BLOB_READ_WRITE_TOKEN,
      clerk: !!process.env.CLERK_SECRET_KEY && !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
      comfyui: !!process.env.COMFYUI_URL
    }
  });
}
