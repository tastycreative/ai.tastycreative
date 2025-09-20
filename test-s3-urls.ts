// Test script to verify S3 image URL generation
import { getImageUrl } from '@/lib/imageStorage';

// Test with S3 key
const s3Image = {
  id: 'test-1',
  clerkId: 'user_123',
  jobId: 'job_456',
  filename: 'test.png',
  subfolder: 'outputs',
  type: 'output',
  s3Key: 'outputs/user_123/test.png',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

// Test with network volume path
const networkVolumeImage = {
  id: 'test-2',
  clerkId: 'user_123',
  jobId: 'job_456',
  filename: 'test2.png',
  subfolder: 'outputs',
  type: 'output',
  networkVolumePath: '/runpod-volume/outputs/user_123/test2.png',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

console.log('S3 Image URL:', getImageUrl(s3Image));
console.log('Network Volume Image URL:', getImageUrl(networkVolumeImage));