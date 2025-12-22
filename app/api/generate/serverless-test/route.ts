import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  return NextResponse.json({ message: 'Serverless API test route is working!' });
}

export async function POST(req: NextRequest) {
  return NextResponse.json({ message: 'POST method is working!' });
}
