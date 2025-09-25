#!/usr/bin/env node

const { PrismaClient } = require('./lib/generated/prisma');

const prisma = new PrismaClient();

async function testStyleTransferS3Optimization() {
    console.log('🧪 Testing Style Transfer S3 Optimization Fixes');
    console.log('================================================\n');

    try {
        // Check recent style transfer generations (IMAGE_TO_IMAGE type)
        const recentStyleTransfers = await prisma.generatedImage.findMany({
            where: {
                job: {
                    type: 'IMAGE_TO_IMAGE'
                }
            },
            include: {
                job: true
            },
            orderBy: {
                createdAt: 'desc'
            },
            take: 5
        });

        console.log(`📊 Found ${recentStyleTransfers.length} recent style transfer images\n`);

        let s3OptimizedCount = 0;
        let blobDataCount = 0;
        let totalSize = 0;

        for (const image of recentStyleTransfers) {
            const hasS3Key = !!image.s3Key;
            const hasBlobData = !!image.data;
            const fileSize = image.fileSize || 0;
            
            console.log(`🖼️  Image: ${image.filename}`);
            console.log(`   Created: ${image.createdAt.toISOString()}`);
            console.log(`   Job Type: ${image.job.type}`);
            console.log(`   S3 Key: ${hasS3Key ? '✅ YES' : '❌ NO'}`);
            console.log(`   Blob Data: ${hasBlobData ? '❌ YES (should be NO)' : '✅ NO'}`);
            console.log(`   File Size: ${(fileSize / (1024 * 1024)).toFixed(2)} MB`);
            
            if (hasS3Key && !hasBlobData) {
                console.log(`   ✅ OPTIMIZED: Using S3 storage`);
                s3OptimizedCount++;
            } else if (hasBlobData) {
                console.log(`   ❌ NOT OPTIMIZED: Using database blob storage`);
                blobDataCount++;
                totalSize += fileSize;
            }
            
            console.log('');
        }

        console.log('📈 OPTIMIZATION RESULTS:');
        console.log('=========================');
        console.log(`✅ S3 Optimized: ${s3OptimizedCount} images`);
        console.log(`❌ Blob Data: ${blobDataCount} images`);
        console.log(`💾 Database Storage Used: ${(totalSize / (1024 * 1024)).toFixed(2)} MB`);
        
        const optimizationRate = recentStyleTransfers.length > 0 
            ? (s3OptimizedCount / recentStyleTransfers.length * 100).toFixed(1)
            : 0;
        
        console.log(`📊 S3 Optimization Rate: ${optimizationRate}%`);

        if (optimizationRate == 100) {
            console.log('\n🎉 SUCCESS: All style transfer images are using S3 optimization!');
        } else if (optimizationRate > 0) {
            console.log('\n⚠️  PARTIAL: Some images are S3 optimized, but new generations should be 100% optimized');
        } else {
            console.log('\n❌ FAILED: No S3 optimization detected. Check handler deployment and webhook processing.');
        }

    } catch (error) {
        console.error('❌ Error testing S3 optimization:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Test API route availability
async function testApiRoutes() {
    console.log('\n🔗 Testing API Routes');
    console.log('=====================\n');

    const routes = [
        '/api/images/save',
        '/api/webhooks/generation/test-job-id'
    ];

    // Check if the files exist
    const fs = require('fs');
    const path = require('path');

    for (const route of routes) {
        const filePath = path.join(process.cwd(), 'app', route, 'route.ts');
        const exists = fs.existsSync(filePath);
        
        console.log(`${route}: ${exists ? '✅ EXISTS' : '❌ MISSING'}`);
    }
}

async function main() {
    await testStyleTransferS3Optimization();
    await testApiRoutes();
}

main().catch(console.error);