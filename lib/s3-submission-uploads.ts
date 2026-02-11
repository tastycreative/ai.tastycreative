import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-west-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'tastycreative-uploads';
const UPLOAD_PREFIX = 'content-submissions/';

export interface PresignedUrlData {
  uploadUrl: string;
  fileUrl: string;
  s3Key: string;
  expiresIn: number;
}

/**
 * Generate presigned URL for direct S3 upload
 */
export async function generatePresignedUploadUrl(
  fileName: string,
  fileType: string,
  organizationId: string,
  submissionId?: string
): Promise<PresignedUrlData> {
  try {
    // Generate unique file key
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(7);
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');

    // Structure: content-submissions/{organizationId}/{submissionId}/{timestamp}-{random}-{filename}
    const s3Key = submissionId
      ? `${UPLOAD_PREFIX}${organizationId}/${submissionId}/${timestamp}-${randomString}-${sanitizedFileName}`
      : `${UPLOAD_PREFIX}${organizationId}/temp/${timestamp}-${randomString}-${sanitizedFileName}`;

    // Create presigned URL
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      ContentType: fileType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 3600, // 1 hour
    });

    const fileUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-west-2'}.amazonaws.com/${s3Key}`;

    return {
      uploadUrl,
      fileUrl,
      s3Key,
      expiresIn: 3600,
    };
  } catch (error) {
    console.error('Failed to generate presigned URL:', error);
    throw new Error('Failed to generate upload URL');
  }
}

/**
 * Extract file info from S3 key
 */
export function parseS3Key(s3Key: string) {
  const parts = s3Key.split('/');
  return {
    organizationId: parts[1],
    submissionId: parts[2] !== 'temp' ? parts[2] : null,
    fileName: parts[parts.length - 1],
  };
}
