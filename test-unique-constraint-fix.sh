#!/bin/bash

echo "🧪 Testing Training Job Creation with Unique Filenames"
echo "====================================================="

echo "📋 Testing our fixes for the unique constraint error:"
echo ""

echo "1. ✅ Updated trainingJobsDB.ts:"
echo "   - Generate unique filenames using timestamp and index"
echo "   - Format: training_image_{index}_{timestamp}.{ext}"
echo "   - Added file metadata (size, width, height)"
echo ""

echo "2. ✅ Updated upload API response:"
echo "   - Added uniqueFilename field for database storage"
echo "   - Kept original filename for reference"
echo "   - Format: upload_{timestamp}_{index}_{originalName}"
echo ""

echo "3. 🔍 Database schema check:"
echo "   - Unique constraint: (trainingJobId, filename)"
echo "   - Our solution: Generate unique filename per training job"
echo ""

echo "🎯 Test steps:"
echo "1. Open browser: http://localhost:3000"
echo "2. Go to: /workspace/train-lora"
echo "3. Upload multiple images (even with same names like 'image.jpg')"
echo "4. Set job name and trigger word"
echo "5. Click 'Start Training'"
echo ""

echo "✅ Expected behavior:"
echo "   - No more 'Unique constraint failed' errors"
echo "   - Each training image gets unique filename in database"
echo "   - Training job creation should succeed"
echo ""

echo "🔧 If you still get errors, check:"
echo "   - Database connection"
echo "   - Prisma client generation: npx prisma generate"
echo "   - Database migrations: npx prisma db push"