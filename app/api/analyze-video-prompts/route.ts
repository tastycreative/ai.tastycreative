import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { optimizeBase64Image, formatBytes } from '@/lib/imageOptimization';
import { trackApiUsage } from '@/lib/bandwidthMonitor';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { image } = await request.json();

    if (!image) {
      return NextResponse.json(
        { error: 'No image provided' },
        { status: 400 }
      );
    }

    // Compress image for OpenAI to reduce bandwidth
    let compressedImage = image;
    try {
      // Convert base64 to buffer to check size
      const imageBuffer = Buffer.from(image, 'base64');
      const originalSize = imageBuffer.length;
      
      // If image is large, compress it
      if (originalSize > 512 * 1024) { // > 512KB
        console.log('🗜️ Compressing image for OpenAI analysis. Original size:', formatBytes(originalSize));
        
        compressedImage = await optimizeBase64Image(image, {
          quality: 60,
          maxWidth: 1024,
          maxHeight: 1024,
          format: 'jpeg'
        });
        
        const compressedSize = Buffer.from(compressedImage, 'base64').length;
        const reductionPercent = Math.round(((originalSize - compressedSize) / originalSize) * 100);
        
        console.log('✅ Image compressed:', formatBytes(originalSize), '→', formatBytes(compressedSize), `(${reductionPercent}% reduction)`);
      }
    } catch (compressionError) {
      console.warn('⚠️ Image compression failed, using original:', compressionError);
      // Continue with original image if compression fails
    }

    const openaiResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this image and create video movement prompts. Make the movement simple but sexy and seductive like onlyfans sexy and seductive.

Please provide a JSON response with the following structure:
{
  "currentPose": "description of the current pose in the image",
  "suggestedMovements": "specific movement sequences that are simple but captivating and alluring",
  "cameraAngle": "recommended camera angle and framing for the video",
  "duration": "suggested duration for the video sequence",
  "style": "overall style and mood for the movements",
  "transitions": "suggested transitions between movements"
}

Guidelines for each category:
• Current Pose: Describe the starting position accurately
• Suggested Movements: Create simple but alluring movements - hair flips, gentle body sways, seductive gestures, eye contact with camera, subtle clothing adjustments, etc.
• Camera Angle: Suggest flattering angles that enhance the appeal
• Duration: Keep it short and engaging (3-10 seconds typically)
• Style: Focus on elegant, seductive, and captivating movements
• Transitions: Smooth, flowing transitions that maintain engagement

Focus on:
• Simple yet captivating movements
• Seductive and alluring gestures
• Professional cinematography suggestions
• High-quality production values
• Maintaining viewer engagement`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${compressedImage}`,
                detail: "low" // Use low detail to reduce processing and bandwidth
              }
            }
          ]
        }
      ],
      max_tokens: 1000,
      temperature: 0.3,
    });

    const content = openaiResponse.choices[0].message.content;
    
    // Try to parse JSON response
    let analysisData;
    try {
      // Extract JSON from response if it's wrapped in other text
      const jsonMatch = content?.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      // Fallback: parse response manually if JSON parsing fails
      const fallbackData = {
        currentPose: extractField(content, 'current pose') || 'Standing with confident posture',
        suggestedMovements: extractField(content, 'suggested movements') || 'the woman is slowly running her fingers through her hair, then looking directly at the camera with a subtle smile, gently biting her lower lip',
        cameraAngle: extractField(content, 'camera angle') || 'phone camera held at chest level, slightly tilted up',
        duration: extractField(content, 'duration') || '5-7 seconds',
        style: extractField(content, 'style') || 'natural and seductive with authentic confidence',
        transitions: extractField(content, 'transitions') || 'smooth natural flow between movements'
      };
      analysisData = fallbackData;
    }

    // Track bandwidth usage
    try {
      const originalImageSize = Buffer.from(image, 'base64').length;
      const compressedImageSize = Buffer.from(compressedImage, 'base64').length;
      const compressionRatio = Math.round(((originalImageSize - compressedImageSize) / originalImageSize) * 100);
      
      trackApiUsage('/api/analyze-video-prompts', 
        { imageSize: compressedImageSize }, 
        analysisData,
        { compressionRatio }
      );
    } catch (trackingError) {
      console.warn('⚠️ Bandwidth tracking failed:', trackingError);
    }

    return NextResponse.json(analysisData);

  } catch (error: any) {
    console.error('OpenAI API Error:', error);
    
    if (error.code === 'invalid_api_key') {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }
    
    if (error.code === 'rate_limit_exceeded') {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to analyze image for video' },
      { status: 500 }
    );
  }
}

// Helper function to extract fields from text response
function extractField(content: string | null, fieldName: string): string | null {
  if (!content) return null;
  
  const patterns = [
    new RegExp(`"${fieldName}"[:\s]*"([^"]*)"`, 'i'),
    new RegExp(`${fieldName}[:\s]*([^\n\r,}]*)`,'i')
  ];
  
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      return match[1].trim().replace(/[",]/g, '');
    }
  }
  
  return null;
}
