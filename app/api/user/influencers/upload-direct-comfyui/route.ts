import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { addUserInfluencer } from "@/lib/database";

export async function POST(request: NextRequest) {
  try {
    console.log("🎯 === DIRECT COMFYUI UPLOAD ===");

    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      console.log("❌ No authentication found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("👤 User:", userId);

    // Parse the multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const displayName = formData.get("displayName") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    console.log(`📁 Processing file: ${file.name} (${Math.round(file.size / 1024 / 1024)}MB)`);

    // Generate unique filename
    const timestamp = Date.now();
    const uniqueFileName = `${userId}_${timestamp}_${file.name}`;
    
    console.log(`🆔 Generated unique filename: ${uniqueFileName}`);

    // Convert file to buffer for ComfyUI upload
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    console.log(`📦 File buffer created: ${fileBuffer.length} bytes`);

    // Upload directly to ComfyUI
    const comfyUIUrl = process.env.COMFYUI_URL;
    if (!comfyUIUrl) {
      throw new Error("ComfyUI URL not configured");
    }

    console.log("📤 Uploading directly to ComfyUI...");

    // Create FormData for ComfyUI upload
    const comfyFormData = new FormData();
    comfyFormData.append("image", new Blob([fileBuffer], { type: file.type || "application/octet-stream" }), uniqueFileName);
    comfyFormData.append("subfolder", "loras");

    // Upload to ComfyUI
    const comfyResponse = await fetch(`${comfyUIUrl}/upload/image`, {
      method: "POST",
      body: comfyFormData,
      headers: {
        // Don't set Content-Type - let browser set it for multipart/form-data
      },
    });

    if (!comfyResponse.ok) {
      const comfyError = await comfyResponse.text();
      console.error("❌ ComfyUI upload failed:", comfyError);
      throw new Error(`ComfyUI upload failed: ${comfyResponse.status} ${comfyResponse.statusText}`);
    }

    const comfyResult = await comfyResponse.json();
    console.log("✅ ComfyUI upload successful:", comfyResult);

    // Create database record
    console.log("💾 Creating database record...");
    const influencerData = {
      name: displayName || file.name.replace(/\.[^/.]+$/, ""), // Remove extension
      displayName: displayName || file.name.replace(/\.[^/.]+$/, ""), // Remove extension
      fileName: uniqueFileName,
      originalFileName: file.name,
      fileSize: file.size,
      uploadedAt: new Date().toISOString(),
      syncStatus: "synced" as const, // Already synced since we uploaded directly
      isActive: true, // Activate immediately
      usageCount: 0,
      comfyUIPath: `models/loras/${uniqueFileName}`, // Set the ComfyUI path
    };

    const dbResult = await addUserInfluencer(userId, influencerData);
    console.log("✅ Database record created:", dbResult?.id);

    return NextResponse.json({
      success: true,
      influencer: dbResult,
      message: "File uploaded directly to ComfyUI and database record created",
      uploadMethod: "direct-comfyui",
      comfyUIResponse: comfyResult,
    });

  } catch (error) {
    console.error("❌ Direct ComfyUI upload error:", error);
    return NextResponse.json(
      { 
        error: "Upload failed", 
        details: error instanceof Error ? error.message : String(error),
        uploadMethod: "direct-comfyui"
      },
      { status: 500 }
    );
  }
}
