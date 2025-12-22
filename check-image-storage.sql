-- SQL query to check GeneratedImage storage patterns
-- This will help distinguish between old database-stored images and new S3-stored images

-- Check recent images to see S3 vs database storage patterns
SELECT 
    id,
    filename,
    CASE 
        WHEN data IS NOT NULL THEN 'DATABASE_BLOB'
        WHEN s3Key IS NOT NULL THEN 'S3_STORAGE'
        WHEN networkVolumePath IS NOT NULL THEN 'NETWORK_VOLUME'
        ELSE 'UNKNOWN'
    END as storage_type,
    fileSize,
    CASE WHEN data IS NOT NULL THEN length(data) ELSE NULL END as actual_blob_size,
    s3Key,
    networkVolumePath,
    createdAt
FROM "generated_images" 
ORDER BY createdAt DESC 
LIMIT 20;

-- Summary of storage types
SELECT 
    CASE 
        WHEN data IS NOT NULL THEN 'DATABASE_BLOB'
        WHEN s3Key IS NOT NULL THEN 'S3_STORAGE'
        WHEN networkVolumePath IS NOT NULL THEN 'NETWORK_VOLUME'
        ELSE 'UNKNOWN'
    END as storage_type,
    COUNT(*) as count,
    AVG(CASE WHEN data IS NOT NULL THEN length(data) ELSE NULL END) as avg_blob_size,
    SUM(CASE WHEN data IS NOT NULL THEN length(data) ELSE 0 END) as total_blob_storage
FROM "generated_images" 
GROUP BY storage_type
ORDER BY count DESC;

-- Check images created in the last hour (should be S3)
SELECT 
    id,
    filename,
    CASE 
        WHEN data IS NOT NULL THEN 'HAS_BLOB_DATA'
        ELSE 'NO_BLOB_DATA'
    END as blob_status,
    s3Key,
    fileSize,
    createdAt
FROM "generated_images" 
WHERE createdAt > NOW() - INTERVAL '1 hour'
ORDER BY createdAt DESC;