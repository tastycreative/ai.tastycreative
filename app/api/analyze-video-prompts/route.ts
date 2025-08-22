import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

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

    const response = await openai.chat.completions.create({
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
  "suggestedMovements": "specific movement sequences that are simple but captivating and alluring - describe what the woman is doing",
  "cameraAngle": "simple camera positioning (no professional cinematography)",
  "duration": "suggested duration for the video sequence",
  "style": "overall style and mood for the movements",
  "transitions": "simple natural transitions between movements"
}

Guidelines for each category:
• Current Pose: Describe the starting position accurately
• Suggested Movements: Start with "the woman is" and describe natural, sexy movements - hair touching, lip biting, slow body movements, eye contact, gentle stretching, etc. Keep it natural and seductive, no professional poses
• Camera Angle: Simple positioning like "phone camera at chest level" or "slightly above" - no professional cinematography terms
• Duration: Keep it short and engaging (3-10 seconds typically)
• Style: Focus on natural, sexy, and seductive movements
• Transitions: Simple, natural flowing movements

Focus on:
• Natural but captivating movements
• Seductive and alluring gestures
• Simple camera work (like selfie/phone camera style)
• Authentic, candid feel
• Describing what "the woman is" doing`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${image}`,
                detail: "high"
              }
            }
          ]
        }
      ],
      max_tokens: 1000,
      temperature: 0.7,
    });

    const content = response.choices[0].message.content;
    
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