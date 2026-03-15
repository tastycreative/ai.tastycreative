'use client';

import { useMutation } from '@tanstack/react-query';

export interface GrammarIssue {
  type: 'grammar' | 'spelling' | 'punctuation';
  original: string;
  suggestion: string;
  explanation: string;
  startIndex: number;
}

export interface GrammarCheckResult {
  issues: GrammarIssue[];
  overallScore: number;
  summary: string;
}

export function useGrammarCheck() {
  return useMutation({
    mutationFn: async (text: string): Promise<GrammarCheckResult> => {
      const res = await fetch('/api/captions/grammar-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? 'Grammar check failed');
      }
      return res.json();
    },
  });
}
