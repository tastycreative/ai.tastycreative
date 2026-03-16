import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import OpenAI from 'openai';
import { MODEL_BIBLE_FIELDS, VALID_PATHS } from '@/lib/model-bible-fields';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { fields } = (await request.json()) as {
      fields: Record<string, string>;
    };

    if (!fields || typeof fields !== 'object' || Object.keys(fields).length === 0) {
      return NextResponse.json({ error: 'No fields provided' }, { status: 400 });
    }

    // Build a summary of source form fields (truncated values)
    const sourceFieldSummary = Object.entries(fields)
      .map(([name, value]) => {
        const truncated = String(value ?? '').slice(0, 300);
        return `"${name}": "${truncated}"`;
      })
      .join('\n');

    // Build the target profile field list
    const targetFieldList = MODEL_BIBLE_FIELDS.map(
      (f) => `  "${f.path}" (${f.label}, type: ${f.type}, category: ${f.category})`
    ).join('\n');

    const prompt = `You are a data mapping assistant. You have a list of PROFILE FIELDS (the target model profile) and FORM DATA fields (source data from an onboarding form). Your job is to map each profile field to the best matching form data field.

PROFILE FIELDS (target):
${targetFieldList}

FORM DATA (source field name: sample value):
${sourceFieldSummary}

Instructions:
- For each profile field, find the best matching form data field based on the field name AND its value content.
- Only include mappings where you are at least 70% confident the match is correct.
- If a profile field doesn't clearly match any form data field, omit it.
- IMPORTANT: A single form data field CAN and SHOULD be mapped to MULTIPLE profile fields when the form data contains composite/combined data. For example:
  - A "Clothing Sizes" field with value "bra: 32B, shoes: 7, top: S/XS, bottoms: S" should be mapped to ALL of: clothingSizes.bra, clothingSizes.shoes, clothingSizes.top, clothingSizes.bottom
  - A "Location" field with value "Los Angeles, CA" could map to both "location" and "city"
  - A "Physical Description" field could map to hair, eyes, bodyType, etc.
  The user will be able to edit the extracted value for each profile field separately after mapping.
- Return a JSON object mapping profile field path → form data field name:
{
  "mappings": {
    "<profile_field_path>": "<form_data_field_name>",
    ...
  },
  "extractedValues": {
    "<profile_field_path>": "<extracted_specific_value_from_the_form_data>",
    ...
  }
}
- In "extractedValues", when a form field is mapped to multiple profile fields, extract ONLY the relevant portion for each. For example if "Clothing Sizes" = "bra: 32B, shoes: 7":
  - clothingSizes.bra → "32B"
  - clothingSizes.shoes → "7"
- If the form field value directly matches (no extraction needed), you can omit it from extractedValues.
- Only use profile field paths from the PROFILE FIELDS list above.
- Only use form data field names from the FORM DATA list above.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ mappings: {}, extractedValues: {} });
    }

    const parsed = JSON.parse(content) as {
      mappings?: Record<string, string>;
      extractedValues?: Record<string, string>;
    };
    const rawMappings = parsed.mappings ?? {};
    const rawExtracted = parsed.extractedValues ?? {};

    // Validate: target must be a known path, source must exist in fields
    // Allow multiple profile fields to map to the same source
    const validatedMappings: Record<string, string> = {};
    const validatedExtracted: Record<string, string> = {};

    for (const [targetPath, sourceField] of Object.entries(rawMappings)) {
      if (
        typeof sourceField === 'string' &&
        VALID_PATHS.has(targetPath) &&
        sourceField in fields
      ) {
        validatedMappings[targetPath] = sourceField;

        // Include extracted value if present and valid
        if (typeof rawExtracted[targetPath] === 'string' && rawExtracted[targetPath]) {
          validatedExtracted[targetPath] = rawExtracted[targetPath];
        }
      }
    }

    return NextResponse.json({
      mappings: validatedMappings,
      extractedValues: validatedExtracted,
    });
  } catch (error: unknown) {
    console.error('Field mapping suggestion error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
