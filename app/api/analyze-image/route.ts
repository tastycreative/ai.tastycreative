import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { image, triggerWord } = await request.json();

    if (!image) {
      return NextResponse.json(
        { error: 'No image provided' },
        { status: 400 }
      );
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // Using GPT-4 Vision for image analysis
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this image and create a flux dev prompt focusing on generating natural and real looking background. Don't want any professional like set.

Please provide a JSON response with the following structure:
{
  "cameraDistance": "description of camera distance (close-up, medium shot, wide shot, etc.)",
  "pose": "detailed description of the person's pose and body position",
  "location": "description of a natural, casual location/background (avoid professional studio descriptions)",
  "outfit": "description of clothing and style",
  "facialExpression": "description of facial expression and emotion",
  "hairColor": "specific hair color description"
}

Focus on:
• Natural and authentic settings
• Casual, real-world locations
• Avoid professional studio setups
• Emphasize candid, organic moments`
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
        cameraDistance: extractField(content, 'camera distance') || 'half body',
        pose: extractField(content, 'pose') || 'standing pose',
        location: extractField(content, 'location') || 'modern bedroom',
        outfit: extractField(content, 'outfit') || 'casual white top',
        facialExpression: extractField(content, 'facial expression') || 'smiling',
        hairColor: extractField(content, 'hair color') || 'brown hair'
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
      { error: 'Failed to analyze image' },
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
