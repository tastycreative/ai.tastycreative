import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { auth } from '@clerk/nextjs/server';

// Helper function to get user's subfolder ID
async function getUserSubfolderId(drive: any, parentFolderId: string, userId: string): Promise<string | null> {
  try {
    const searchResponse = await drive.files.list({
      q: `name='${userId}' and '${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      pageSize: 1,
    });

    if (searchResponse.data.files && searchResponse.data.files.length > 0) {
      return searchResponse.data.files[0].id as string;
    }

    return null; // User folder doesn't exist yet
  } catch (error) {
    console.error('Error finding user subfolder:', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get('folderId');
    const accessToken = searchParams.get('accessToken');

    if (!folderId || !accessToken) {
      return NextResponse.json(
        { error: 'Missing folderId or accessToken' },
        { status: 400 }
      );
    }

    // Get authenticated user ID from Clerk
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized - user not authenticated' },
        { status: 401 }
      );
    }

    console.log(`📁 Fetching files from Google Drive folder: ${folderId} for user: ${userId}`);

    // Initialize Google Drive client with OAuth2
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_OAUTH_CLIENT_ID,
      process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      process.env.GOOGLE_OAUTH_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: accessToken,
    });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // Get user's subfolder within the main folder
    const userSubfolderId = await getUserSubfolderId(drive, folderId, userId);
    
    if (!userSubfolderId) {
      console.log(`📂 No user folder found yet for ${userId} in folder ${folderId}`);
      return NextResponse.json({
        success: true,
        files: [],
        total: 0,
        message: 'No files yet - folder will be created when you upload your first file'
      });
    }

    console.log(`👤 Found user folder: ${userSubfolderId}`);

    // List files in the user's subfolder
    const response = await drive.files.list({
      q: `'${userSubfolderId}' in parents and trashed = false`,
      fields: 'files(id,name,mimeType,size,modifiedTime,webViewLink,webContentLink,thumbnailLink)',
      orderBy: 'modifiedTime desc',
      pageSize: 100, // Limit to 100 files per folder
    });

    const files = response.data.files || [];
    
    console.log(`✅ Found ${files.length} files in user folder ${userSubfolderId}`);
    
    // Log each file for debugging
    files.forEach((file, index) => {
      console.log(`  ${index + 1}. ${file.name} (${file.mimeType}) - ID: ${file.id}`);
    });

    return NextResponse.json({
      success: true,
      files: files,
      total: files.length,
    });

  } catch (error) {
    console.error('❌ Google Drive files fetch error:', error);
    
    // Check if it's an authentication error
    const isAuthError = error instanceof Error && 
      (error.message.includes('authentication') || 
       error.message.includes('OAuth') ||
       error.message.includes('credentials'));
    
    return NextResponse.json(
      { 
        error: isAuthError 
          ? 'Authentication expired. Please reconnect to Google Drive.'
          : error instanceof Error ? error.message : 'Failed to fetch files from Google Drive',
        details: error instanceof Error ? error.stack : undefined,
        authError: isAuthError
      },
      { status: isAuthError ? 401 : 500 }
    );
  }
}