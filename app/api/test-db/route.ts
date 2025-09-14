import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Testing database connection...');
    
    // Simple database query to test connection
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    
    console.log('✅ Database connection successful!', result);
    
    return NextResponse.json({
      success: true,
      message: 'Database connection successful',
      result
    });
    
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Database connection failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}