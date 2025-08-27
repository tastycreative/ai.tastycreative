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
  const comfyuiUrl = process.env.COMFYUI_URL || 'http://localhost:8188';

  // Test ComfyUI connection
  let comfyuiStatus = 'unknown';
  try {
    const response = await fetch(`${comfyuiUrl}/system_stats`, { 
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        ...(process.env.RUNPOD_API_KEY ? { 'Authorization': `Bearer ${process.env.RUNPOD_API_KEY}` } : {})
      }
    });
    comfyuiStatus = response.ok ? 'connected' : `error-${response.status}`;
  } catch (error) {
    comfyuiStatus = 'connection-failed';
  }

  return NextResponse.json({
    environment: process.env.NODE_ENV,
    isProduction,
    deploymentReady: missingVars.length === 0,
    presentVars,
    missingVars,
    timestamp: new Date().toISOString(),
    // ComfyUI connection info
    comfyuiUrl,
    comfyuiStatus,
    // Don't expose sensitive values, just indicate they exist
    envStatus: {
      database: !!process.env.DATABASE_URL,
      blob: !!process.env.BLOB_READ_WRITE_TOKEN,
      clerk: !!process.env.CLERK_SECRET_KEY && !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
      comfyui: !!process.env.COMFYUI_URL,
      runpodAuth: !!process.env.RUNPOD_API_KEY
    }
  });
}
