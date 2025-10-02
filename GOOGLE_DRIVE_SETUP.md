# Google Drive Upload Integration

This feature allows users to upload their generated content (images and videos) directly to specific Google Drive folders.

## Setup Instructions

### 1. Create a Google Cloud Service Account

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Select or create a project
3. Enable the Google Drive API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Drive API"
   - Click "Enable"

4. Create a service account:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "Service Account"
   - Give it a name like "ai-content-uploader"
   - Download the JSON key file

### 2. Configure Google Drive Folders

1. Create 4 folders in your Google Drive:
   - "All Generations"
   - "IG Posts"
   - "IG Reels"
   - "Misc"

2. Get the folder IDs:
   - Open each folder in Google Drive
   - Copy the folder ID from the URL
   - Example: `https://drive.google.com/drive/folders/1ABCDEFGHijklmnopqrstuv`
   - The folder ID is: `1ABCDEFGHijklmnopqrstuv`

3. Share each folder with your service account:
   - Right-click the folder > "Share"
   - Add your service account email (from the JSON file)
   - Give it "Editor" permissions

### 3. Configure Environment Variables

Add these variables to your `.env.local` file:

```bash
# Google Cloud Service Account Configuration
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_PRIVATE_KEY_ID=your-private-key-id
GOOGLE_CLOUD_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour-private-key-here\n-----END PRIVATE KEY-----\n"
GOOGLE_CLOUD_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_CLOUD_CLIENT_ID=your-client-id

# Google Drive Folder IDs
GOOGLE_DRIVE_ALL_GENERATIONS_FOLDER_ID=your-all-generations-folder-id
GOOGLE_DRIVE_IG_POSTS_FOLDER_ID=your-ig-posts-folder-id
GOOGLE_DRIVE_IG_REELS_FOLDER_ID=your-ig-reels-folder-id
GOOGLE_DRIVE_MISC_FOLDER_ID=your-misc-folder-id
```

### 4. Extract Values from Service Account JSON

From your downloaded JSON file, extract these values:
- `project_id` → `GOOGLE_CLOUD_PROJECT_ID`
- `private_key_id` → `GOOGLE_CLOUD_PRIVATE_KEY_ID`
- `private_key` → `GOOGLE_CLOUD_PRIVATE_KEY`
- `client_email` → `GOOGLE_CLOUD_CLIENT_EMAIL`
- `client_id` → `GOOGLE_CLOUD_CLIENT_ID`

## Features

### Upload Button
- Each generated image/video has an upload button in the hover overlay
- Click the blue upload button to open the folder selection modal

### Folder Selection
- Choose from 4 predefined folders:
  - **All Generations**: General storage for all content
  - **IG Posts**: Instagram post content
  - **IG Reels**: Instagram reel content
  - **Misc**: Miscellaneous content

### Upload Progress
- Real-time upload progress indicator
- Visual feedback with colored badges:
  - 🔵 Blue: Uploading with progress percentage
  - 🟢 Green: Successfully uploaded
  - 🔴 Red: Upload failed

### File Handling
- Supports both images and videos
- Automatically detects MIME types
- Preserves original filenames
- Files are made publicly accessible (configurable)

## API Endpoint

The upload functionality uses the `/api/google-drive/upload` endpoint:

- **Method**: POST
- **Content-Type**: multipart/form-data
- **Parameters**:
  - `file`: The media file to upload
  - `folder`: Target folder name
  - `filename`: Original filename
  - `itemType`: "image" or "video"

## Error Handling

The system handles various error scenarios:
- Missing environment variables
- Invalid folder selection
- Network connectivity issues
- Google Drive API errors
- File upload failures

## Security Considerations

- Service account credentials are stored securely as environment variables
- Files can be made private by modifying the permissions in the API route
- All uploads are logged for audit purposes

## Troubleshooting

### Common Issues

1. **"Google Drive not configured" error**
   - Check that all required environment variables are set
   - Verify the service account JSON values are correct

2. **"Permission denied" error**
   - Ensure the Google Drive folders are shared with the service account email
   - Verify the service account has "Editor" permissions

3. **"Folder ID not configured" error**
   - Check that the folder ID environment variables are set
   - Verify the folder IDs are correct (copied from Google Drive URLs)

4. **Upload fails silently**
   - Check the browser console for detailed error messages
   - Verify the Google Drive API is enabled in Google Cloud Console

### Debug Mode

Enable debug logging by checking the browser console and server logs for detailed error information during uploads.