import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { auth } from '@clerk/nextjs/server';

// Google Drive folder mapping
const DRIVE_FOLDERS = {
  'All Generations': process.env.GOOGLE_DRIVE_ALL_GENERATIONS_FOLDER_ID,
  'IG Posts': process.env.GOOGLE_DRIVE_IG_POSTS_FOLDER_ID,
  'IG Reels': process.env.GOOGLE_DRIVE_IG_REELS_FOLDER_ID,
  'Misc': process.env.GOOGLE_DRIVE_MISC_FOLDER_ID,
};

// Initialize Google Drive API with OAuth2
function getDriveClient(accessToken: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    access_token: accessToken,
  });

  return google.drive({ version: 'v3', auth: oauth2Client });
}

// Get or create user-specific subfolder within a parent folder
async function getUserSubfolder(drive: any, parentFolderId: string, userId: string): Promise<string> {
  try {
    // Check if user subfolder already exists
    const searchResponse = await drive.files.list({
      q: `name='${userId}' and '${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      pageSize: 1,
    });

    if (searchResponse.data.files && searchResponse.data.files.length > 0) {
      const existingFolder = searchResponse.data.files[0];
      console.log(`📁 Found existing user folder: ${existingFolder.id}`);
      return existingFolder.id as string;
    }

    // Create new subfolder for user
    console.log(`📁 Creating new user folder for: ${userId}`);
    const createResponse = await drive.files.create({
      requestBody: {
        name: userId,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId],
      },
      fields: 'id',
    });

    const newFolderId = createResponse.data.id as string;
    console.log(`✅ Created user folder: ${newFolderId}`);
    return newFolderId;
  } catch (error) {
    console.error('❌ Error getting/creating user subfolder:', error);
    throw error;
  }
}

// Handle CORS preflight requests
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    console.log('📤 Google Drive upload request received');

    // Get authenticated user ID from Clerk
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized - user not authenticated' },
        { status: 401 }
      );
    }

    console.log(`👤 User ID: ${userId}`);

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const folder = formData.get('folder') as string;
    const filename = formData.get('filename') as string;
    const itemType = formData.get('itemType') as string;
    const accessToken = formData.get('accessToken') as string;

    if (!file || !folder || !filename || !accessToken) {
      return NextResponse.json(
        { error: 'Missing required fields: file, folder, filename, or accessToken' },
        { status: 400 }
      );
    }

    // Validate folder
    if (!DRIVE_FOLDERS[folder as keyof typeof DRIVE_FOLDERS]) {
      return NextResponse.json(
        { error: `Invalid folder: ${folder}. Must be one of: ${Object.keys(DRIVE_FOLDERS).join(', ')}` },
        { status: 400 }
      );
    }

    // Check environment variables
    const requiredEnvVars = [
      'GOOGLE_OAUTH_CLIENT_ID',
      'GOOGLE_OAUTH_CLIENT_SECRET',
      'GOOGLE_OAUTH_REDIRECT_URI',
    ];

    const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingEnvVars.length > 0) {
      console.error('❌ Missing environment variables:', missingEnvVars);
      return NextResponse.json(
        { error: `Google Drive OAuth not configured. Missing environment variables: ${missingEnvVars.join(', ')}` },
        { status: 500 }
      );
    }

    const parentFolderId = DRIVE_FOLDERS[folder as keyof typeof DRIVE_FOLDERS];
    if (!parentFolderId) {
      return NextResponse.json(
        { error: `Folder ID not configured for: ${folder}` },
        { status: 500 }
      );
    }

    console.log(`📂 Uploading ${filename} to Google Drive folder: ${folder} (${parentFolderId})`);

    // Initialize Google Drive client with OAuth2
    const drive = getDriveClient(accessToken);

    // Get or create user-specific subfolder
    const userFolderId = await getUserSubfolder(drive, parentFolderId, userId);
    console.log(`👤 Using user folder: ${userFolderId}`);

    // Convert file to buffer
    const buffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(buffer);

    // Determine MIME type
    const mimeType = file.type || (itemType === 'video' ? 'video/mp4' : 'image/jpeg');

    console.log(`📄 File details: ${filename}, size: ${fileBuffer.length} bytes, type: ${mimeType}`);

    // Create a readable stream from the buffer
    const { Readable } = require('stream');
    const fileStream = new Readable({
      read() {
        this.push(fileBuffer);
        this.push(null); // End of stream
      }
    });

    // Upload file to Google Drive (in user's subfolder)
    const response = await drive.files.create({
      requestBody: {
        name: filename,
        parents: [userFolderId],
      },
      media: {
        mimeType,
        body: fileStream,
      },
    });

    const fileId = response.data.id;
    if (!fileId) {
      throw new Error('Failed to get file ID from Google Drive response');
    }

    // Make the file publicly viewable (optional - remove if you want private files)
    try {
      await drive.permissions.create({
        fileId,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
      });
      console.log('✅ File made publicly accessible');
    } catch (permissionError) {
      console.warn('⚠️ Could not make file public:', permissionError);
      // Continue anyway - file was uploaded successfully
    }

    const driveFileUrl = `https://drive.google.com/file/d/${fileId}/view`;

    console.log(`✅ Successfully uploaded ${filename} to Google Drive`);
    console.log(`🔗 File URL: ${driveFileUrl}`);

    const responseData = {
      success: true,
      message: `Successfully uploaded ${filename} to ${folder}`,
      fileId,
      driveFileUrl,
      folder,
      filename,
    };

    console.log('📤 Sending response:', responseData);

    return NextResponse.json(responseData, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });

  } catch (error) {
    console.error('❌ Google Drive upload error:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to upload to Google Drive',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}