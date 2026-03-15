import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import OpenAI from 'openai';
import { z } from 'zod';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const GrammarIssueSchema = z.object({
  type: z.enum(['grammar', 'spelling', 'punctuation']),
  original: z.string(),
  suggestion: z.string(),
  explanation: z.string(),
  startIndex: z.number(),
});

const GrammarCheckSchema = z.object({
  issues: z.array(GrammarIssueSchema),
  overallScore: z.number().min(0).max(100),
  summary: z.string(),
});

const SYSTEM_PROMPT = `You are a grammar checker specialised in social media captions (Instagram / OnlyFans style).

You MUST be EXHAUSTIVE. Read the entire text word by word, verb by verb, and identify EVERY error before responding. Do not stop after finding the first issue — keep scanning until you have checked the whole text.

RULES — what to flag (ONLY these categories):
- "grammar": Subject-verb disagreement (e.g. "she don't" → "she doesn't", "people talks" → "people talk"), wrong tense, misused modifiers
- "spelling": Actual misspelled words (e.g. "recieve" → "receive"), wrong homophones (your/you're, their/there/they're, its/it's, to/too/two)
- "punctuation": Incorrect apostrophes (possessives vs. contractions), missing comma in a compound sentence where it causes real confusion

RULES — what NOT to flag (CRITICAL — do NOT suggest changes for any of these):
- Style preferences, rephrasing, or rewording — NEVER suggest alternative ways to say the same thing
- Intentional slang, informal register, dialectal speech
- Emojis or hashtags
- Sentences that end without a period
- ALL CAPS used for emphasis
- Ellipsis (...) used for style or trailing off
- Starting a sentence with "And", "But", or "Because"
- Sentence fragments used for stylistic effect
- Brand names or model names written in non-standard casing
- Text that is already grammatically correct — do NOT invent issues

IMPORTANT: If the text has no true grammar, spelling, or punctuation errors, you MUST return an empty issues array and overallScore of 100. Do NOT manufacture issues.

MERGING RULE: If multiple errors appear in the same clause or phrase (e.g. "she don't likes"), combine them into ONE issue with the full corrected phrase as the suggestion (e.g. original: "she don't likes", suggestion: "she doesn't like"). NEVER split overlapping errors into separate issues — the user should only need to click Apply once per phrase.

Return ONLY valid JSON matching this exact schema — no extra text:
{
  "issues": [
    {
      "type": "grammar" | "spelling" | "punctuation",
      "original": "<exact text segment with the error>",
      "suggestion": "<corrected version>",
      "explanation": "<brief plain-English explanation>",
      "startIndex": <zero-based character index, or -1 if not precisely locatable>
    }
  ],
  "overallScore": <0-100 integer>,
  "summary": "<one-sentence summary>"
}`;

async function runGrammarCheck(text: string): Promise<z.infer<typeof GrammarCheckSchema> | null> {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: text },
    ],
    response_format: { type: 'json_object' },
    temperature: 0,
  });

  const raw = completion.choices[0].message.content;
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  const validated = GrammarCheckSchema.safeParse(parsed);
  return validated.success ? validated.data : null;
}

/**
 * Apply a set of fixes to the text (descending by startIndex so positions
 * are never shifted by an earlier replacement).
 */
function applyFixes(text: string, issues: z.infer<typeof GrammarIssueSchema>[]): string {
  const sorted = [...issues].sort((a, b) => b.startIndex - a.startIndex);
  let result = text;
  for (const issue of sorted) {
    if (issue.startIndex >= 0 && result.slice(issue.startIndex, issue.startIndex + issue.original.length) === issue.original) {
      result = result.slice(0, issue.startIndex) + issue.suggestion + result.slice(issue.startIndex + issue.original.length);
    } else {
      result = result.replace(issue.original, issue.suggestion);
    }
  }
  return result;
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let text: string;
  try {
    const body = await req.json();
    text = body?.text;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!text || typeof text !== 'string') {
    return NextResponse.json({ error: 'Missing text field' }, { status: 400 });
  }

  // Enforce the same max length as the editor
  if (text.length > 2200) {
    return NextResponse.json({ error: 'Text exceeds maximum length of 2200 characters' }, { status: 400 });
  }

  // --- Multi-pass convergence loop ---
  // Keep scanning until no new issues are found, up to MAX_PASSES to cap cost.
  // Each pass applies all known fixes, then re-checks the corrected text.
  const MAX_PASSES = 4;
  const allIssues: z.infer<typeof GrammarIssueSchema>[] = [];
  let currentText = text;

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const result = await runGrammarCheck(currentText);
    if (!result) {
      if (pass === 0) {
        return NextResponse.json({ error: 'Failed to parse grammar check response' }, { status: 500 });
      }
      break; // earlier passes succeeded — use what we have
    }

    if (result.issues.length === 0) break; // converged — no more issues

    // Map issues back to the ORIGINAL text positions & deduplicate
    for (const issue of result.issues) {
      const idx = text.indexOf(issue.original);
      const mapped = { ...issue, startIndex: idx >= 0 ? idx : -1 };
      // Skip if we already have a fix covering the same original text
      if (!allIssues.some(existing => existing.original === mapped.original)) {
        allIssues.push(mapped);
      }
    }

    // Apply all known fixes so far and re-check the corrected text
    currentText = applyFixes(text, allIssues);
  }

  const totalIssues = allIssues.length;
  const overallScore = totalIssues === 0 ? 100 : Math.max(0, Math.round(100 - totalIssues * 15));
  const summary = totalIssues === 0
    ? 'No grammar issues found.'
    : `Found ${totalIssues} issue${totalIssues !== 1 ? 's' : ''} in your caption.`;

  return NextResponse.json({ issues: allIssues, overallScore, summary });
}
