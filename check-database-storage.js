#!/usr/bin/env node

/**
 * Database Storage Analysis Tool
 * Checks generated_images table to verify S3 optimization is working
 * Analyzes data types, sizes, and storage patterns
 */

const { PrismaClient } = require('./lib/generated/prisma');

const prisma = new PrismaClient();

async function analyzeGeneratedImages() {
    console.log('🔍 Analyzing generated_images table for storage optimization...\n');
    
    try {
        // Get recent records to analyze
        const recentImages = await prisma.generatedImage.findMany({
            orderBy: {
                createdAt: 'desc'
            },
            take: 20,
            select: {
                id: true,
                createdAt: true,
                data: true,          // This is the blob data field
                s3Key: true,
                networkVolumePath: true,
                filename: true,
                fileSize: true,
                format: true,
                jobId: true,
                clerkId: true,       // User ID field
                subfolder: true,
                type: true,
                width: true,
                height: true,
                metadata: true
            }
        });

        if (recentImages.length === 0) {
            console.log('❌ No images found in generated_images table');
            return;
        }

        console.log(`📊 Analyzing ${recentImages.length} recent images:\n`);

        let totalDbSize = 0;
        let imagesWithBlobs = 0;
        let imagesWithS3 = 0;
        let imagesWithNetworkVolume = 0;

        // Get job details to determine generation types
        const jobIds = [...new Set(recentImages.map(img => img.jobId))];
        const jobs = await prisma.generationJob.findMany({
            where: {
                id: { in: jobIds }
            },
            select: {
                id: true,
                type: true
            }
        });
        
        const jobTypeMap = {};
        jobs.forEach(job => {
            jobTypeMap[job.id] = job.type;
        });

        recentImages.forEach((image, index) => {
            const generationType = jobTypeMap[image.jobId] || 'unknown';
            
            console.log(`🖼️  Image ${index + 1}:`);
            console.log(`   ID: ${image.id}`);
            console.log(`   Type: ${generationType}`);
            console.log(`   Created: ${image.createdAt.toISOString()}`);
            console.log(`   User ID: ${image.clerkId || 'N/A'}`);
            console.log(`   Job ID: ${image.jobId || 'N/A'}`);
            console.log(`   Filename: ${image.filename || 'N/A'}`);
            console.log(`   File Size: ${image.fileSize ? `${(image.fileSize / 1024 / 1024).toFixed(2)} MB` : 'N/A'}`);
            console.log(`   Format: ${image.format || 'N/A'}`);
            console.log(`   Dimensions: ${image.width || 'N/A'} x ${image.height || 'N/A'}`);
            
            // Check storage types
            const hasImageData = image.data && image.data.length > 0;
            const hasS3Key = image.s3Key && image.s3Key.length > 0;
            const hasNetworkVolume = image.networkVolumePath && image.networkVolumePath.length > 0;
            
            console.log(`   📦 Storage Analysis:`);
            
            if (hasImageData) {
                const imageDataSize = image.data.length; // Bytes is already binary data
                totalDbSize += imageDataSize;
                imagesWithBlobs++;
                
                console.log(`      ❌ BLOB DATA: ${(imageDataSize / 1024 / 1024).toFixed(2)} MB in database`);
                console.log(`      ⚠️  This image data should be moved to S3!`);
            } else {
                console.log(`      ✅ NO BLOB: No image data in database`);
            }
            
            if (hasS3Key) {
                imagesWithS3++;
                console.log(`      📤 S3 Key: ${image.s3Key}`);
                
                // Check if S3 key uses user_id structure
                if (image.s3Key.includes('/user_')) {
                    console.log(`      ✅ User-organized S3 path detected`);
                } else if (image.s3Key.includes('/outputs/')) {
                    console.log(`      ⚠️  S3 path structure: ${image.s3Key.split('/').slice(0, 3).join('/')}/...`);
                }
            } else {
                console.log(`      ❌ NO S3: Missing S3 key`);
            }
            
            if (hasNetworkVolume) {
                imagesWithNetworkVolume++;
                console.log(`      📁 Network Volume: ${image.networkVolumePath}`);
            }
            
            if (image.metadata) {
                console.log(`      📋 Metadata: ${JSON.stringify(image.metadata).substring(0, 100)}...`);
            }
            
            console.log('');
        });

        // Summary
        console.log('📈 STORAGE OPTIMIZATION SUMMARY:');
        console.log('=====================================');
        console.log(`📊 Total images analyzed: ${recentImages.length}`);
        
        // Count by generation type
        const typeCount = {};
        recentImages.forEach(image => {
            const type = jobTypeMap[image.jobId] || 'unknown';
            typeCount[type] = (typeCount[type] || 0) + 1;
        });
        
        Object.entries(typeCount).forEach(([type, count]) => {
            console.log(`� ${type}: ${count}`);
        });
        
        console.log(`📦 Images with blob data: ${imagesWithBlobs}`);
        console.log(`📤 Images with S3 storage: ${imagesWithS3}`);
        console.log(`📁 Images with network volume: ${imagesWithNetworkVolume}`);
        console.log(`💾 Total database storage: ${(totalDbSize / 1024 / 1024).toFixed(2)} MB`);
        
        const optimizationRate = ((imagesWithS3 / recentImages.length) * 100).toFixed(1);
        console.log(`⚡ S3 optimization rate: ${optimizationRate}%`);
        
        if (imagesWithBlobs > 0) {
            console.log(`⚠️  ${imagesWithBlobs} images still have blob data in database`);
            console.log(`💡 These images are using ${(totalDbSize / 1024 / 1024).toFixed(2)} MB of database storage`);
        } else {
            console.log(`✅ All images are optimized (no blob data in database)`);
        }
        
        // Check recent by user
        console.log('\n👤 RECENT ACTIVITY BY USER:');
        const userActivity = {};
        recentImages.forEach(image => {
            const userId = image.clerkId || 'unknown';
            const type = jobTypeMap[image.jobId] || 'unknown';
            if (!userActivity[userId]) {
                userActivity[userId] = { count: 0, types: new Set() };
            }
            userActivity[userId].count++;
            userActivity[userId].types.add(type);
        });
        
        Object.entries(userActivity).forEach(([userId, data]) => {
            console.log(`   ${userId}: ${data.count} images (${Array.from(data.types).join(', ')})`);
        });

    } catch (error) {
        console.error('❌ Error analyzing database:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Run the analysis
analyzeGeneratedImages();