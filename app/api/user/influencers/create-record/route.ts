// app/api/user/influencers/create-record/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { addUserInfluencer } from "@/lib/database";

export async function POST(request: NextRequest) {
  try {
    console.log("💾 === CREATE DATABASE RECORD ===");

    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      console.log("❌ No authentication found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("👤 User:", userId);

    // Parse the JSON data (no file, just metadata)
    const influencerData = await request.json();
    
    console.log("📝 Creating database record for:", influencerData.fileName);

    // Validate required fields
    if (!influencerData.fileName || !influencerData.originalFileName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Create database record
    const dbResult = await addUserInfluencer(userId, influencerData);
    console.log("✅ Database record created:", dbResult?.id);

    return NextResponse.json({
      success: true,
      influencer: dbResult,
      message: "Database record created successfully",
    });

  } catch (error) {
    console.error("❌ Database record creation error:", error);
    return NextResponse.json(
      { 
        error: "Failed to create database record", 
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}