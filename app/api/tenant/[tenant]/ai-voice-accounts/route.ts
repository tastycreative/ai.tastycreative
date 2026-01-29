import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";
import { requireOrganizationAdmin } from "@/lib/organizationAuth";

// Force Node.js runtime
export const runtime = 'nodejs';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_API_BASE = "https://api.elevenlabs.io";

// GET - List all AI Voice Accounts for organization
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tenant } = await params;

    // Check organization admin access
    await requireOrganizationAdmin(tenant);

    // Get organization
    const organization = await prisma.organization.findUnique({
      where: { slug: tenant },
    });

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Get all organization member clerkIds
    const members = await prisma.teamMember.findMany({
      where: { organizationId: organization.id },
      include: { user: { select: { clerkId: true } } },
    });

    const memberClerkIds = members.map(m => m.user.clerkId);

    // Fetch voices created by organization members
    const voices = await prisma.ai_voice_accounts.findMany({
      where: {
        createdBy: { in: memberClerkIds },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ voices });
  } catch (error: any) {
    console.error("Error fetching AI voice accounts:", error);

    if (error.message.includes('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to fetch AI voice accounts" },
      { status: 500 }
    );
  }
}

// POST - Add new AI Voice Account
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tenant } = await params;

    // Check organization admin access
    await requireOrganizationAdmin(tenant);

    const body = await req.json();
    const { elevenlabsVoiceId, name, description, customApiKey } = body;

    if (!elevenlabsVoiceId) {
      return NextResponse.json(
        { error: "ElevenLabs Voice ID is required" },
        { status: 400 }
      );
    }

    // Check if voice already exists
    const existingVoice = await prisma.ai_voice_accounts.findUnique({
      where: { elevenlabsVoiceId },
    });

    if (existingVoice) {
      return NextResponse.json(
        { error: "Voice account already exists" },
        { status: 400 }
      );
    }

    // Fetch voice details from ElevenLabs API
    const apiKey = customApiKey || ELEVENLABS_API_KEY;
    const voiceResponse = await fetch(
      `${ELEVENLABS_API_BASE}/v1/voices/${elevenlabsVoiceId}`,
      {
        headers: {
          "xi-api-key": apiKey || "",
        },
      }
    );

    if (!voiceResponse.ok) {
      const errorData = await voiceResponse.json().catch(() => ({}));
      console.error("ElevenLabs API error:", errorData);
      return NextResponse.json(
        { error: "Failed to fetch voice from ElevenLabs. Please check the Voice ID." },
        { status: 400 }
      );
    }

    const voiceData = await voiceResponse.json();

    // Create the voice account
    const voice = await prisma.ai_voice_accounts.create({
      data: {
        id: crypto.randomUUID(),
        name: name || voiceData.name || "Unnamed Voice",
        description: description || voiceData.description,
        elevenlabsVoiceId,
        elevenlabsApiKey: customApiKey || null,
        previewUrl: voiceData.preview_url,
        category: voiceData.category,
        gender: voiceData.labels?.gender,
        age: voiceData.labels?.age,
        accent: voiceData.labels?.accent,
        language: voiceData.labels?.language,
        labels: voiceData.labels,
        settings: voiceData.settings,
        createdBy: userId,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ voice });
  } catch (error: any) {
    console.error("Error creating AI voice account:", error);

    if (error.message.includes('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to create AI voice account" },
      { status: 500 }
    );
  }
}

// DELETE - Remove AI Voice Account
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tenant } = await params;

    // Check organization admin access
    await requireOrganizationAdmin(tenant);

    // Get organization
    const organization = await prisma.organization.findUnique({
      where: { slug: tenant },
    });

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Voice account ID is required" },
        { status: 400 }
      );
    }

    // Verify the voice was created by an organization member
    const voice = await prisma.ai_voice_accounts.findFirst({
      where: {
        id,
        createdBy: {
          in: await prisma.teamMember.findMany({
            where: { organizationId: organization.id },
            select: { user: { select: { clerkId: true } } },
          }).then(members => members.map(m => m.user.clerkId)),
        },
      },
    });

    if (!voice) {
      return NextResponse.json(
        { error: "Voice account not found or access denied" },
        { status: 404 }
      );
    }

    await prisma.ai_voice_accounts.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting AI voice account:", error);

    if (error.message.includes('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to delete AI voice account" },
      { status: 500 }
    );
  }
}

// PATCH - Update AI Voice Account
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tenant } = await params;

    // Check organization admin access
    await requireOrganizationAdmin(tenant);

    // Get organization
    const organization = await prisma.organization.findUnique({
      where: { slug: tenant },
    });

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const body = await req.json();
    const { id, name, description, isActive, settings } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Voice account ID is required" },
        { status: 400 }
      );
    }

    // Verify the voice was created by an organization member
    const voice = await prisma.ai_voice_accounts.findFirst({
      where: {
        id,
        createdBy: {
          in: await prisma.teamMember.findMany({
            where: { organizationId: organization.id },
            select: { user: { select: { clerkId: true } } },
          }).then(members => members.map(m => m.user.clerkId)),
        },
      },
    });

    if (!voice) {
      return NextResponse.json(
        { error: "Voice account not found or access denied" },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (settings !== undefined) updateData.settings = settings;

    const updatedVoice = await prisma.ai_voice_accounts.update({
      where: { id },
      data: { ...updateData, updatedAt: new Date() },
    });

    return NextResponse.json({ voice: updatedVoice });
  } catch (error: any) {
    console.error("Error updating AI voice account:", error);

    if (error.message.includes('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to update AI voice account" },
      { status: 500 }
    );
  }
}
