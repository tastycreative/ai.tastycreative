'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertTriangle, Loader2, X, Wand2, ChevronRight } from 'lucide-react';
import type { GrammarCheckResult, GrammarIssue } from '@/lib/hooks/useGrammarCheck.query';

interface GrammarCheckPanelProps {
  result: GrammarCheckResult;
  isLoading: boolean;
  error: string | null;
  caption: string;
  onApply: (original: string, suggestion: string, startIndex: number) => void;
  onApplyAll: (issues: GrammarIssue[]) => void;
  onDismiss: () => void;
}

const TYPE_LABEL: Record<GrammarIssue['type'], string> = {
  grammar: 'Grammar',
  spelling: 'Spelling',
  punctuation: 'Punctuation',
};

const TYPE_COLOR: Record<GrammarIssue['type'], string> = {
  grammar: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800/40',
  spelling: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800/40',
  punctuation: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800/40',
};

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 85
      ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40'
      : score >= 60
      ? 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800/40'
      : 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/40';

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${color}`}>
      {score}/100
    </span>
  );
}

export default function GrammarCheckPanel({
  result,
  isLoading,
  error,
  caption,
  onApply,
  onApplyAll,
  onDismiss,
}: GrammarCheckPanelProps) {
  const [appliedIndices, setAppliedIndices] = useState<Set<number>>(new Set());

  // Reset applied indices whenever the result changes (new check run)
  useEffect(() => {
    setAppliedIndices(new Set());
  }, [result]);

  // Auto-dismiss issues whose `original` text no longer exists in the caption
  // (happens when applying one fix makes an overlapping fix stale)
  useEffect(() => {
    if (!result.issues.length || isLoading) return;
    const stale = new Set(appliedIndices);
    let changed = false;
    result.issues.forEach((issue, i) => {
      if (stale.has(i)) return;
      if (!caption.includes(issue.original)) {
        stale.add(i);
        changed = true;
      }
    });
    if (changed) setAppliedIndices(stale);
  }, [caption, result.issues, appliedIndices, isLoading]);

  const pendingIssues = result.issues.filter((_, i) => !appliedIndices.has(i));

  const handleApply = useCallback(
    (issue: GrammarIssue, index: number) => {
      onApply(issue.original, issue.suggestion, issue.startIndex);
      setAppliedIndices(prev => {
        const next = new Set(prev);
        next.add(index);
        return next;
      });
    },
    [onApply]
  );

  // Auto-close when all issues have been applied
  useEffect(() => {
    if (!isLoading && !error && result.issues.length > 0 && pendingIssues.length === 0) {
      onDismiss();
    }
  }, [pendingIssues.length, isLoading, error, result.issues.length, onDismiss]);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onDismiss]);

  const modal = (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onDismiss(); }}
    >
      {/* Blurred dark overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />

      {/* Modal card */}
      <div
        className="relative z-10 w-full max-w-md max-h-[80vh] flex flex-col rounded-2xl border border-brand-mid-pink/20 bg-white dark:bg-gray-900 shadow-2xl shadow-black/40 overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Grammar Check"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-brand-mid-pink/10 bg-brand-mid-pink/5 dark:bg-brand-mid-pink/10 shrink-0">
          <div className="flex items-center gap-2">
            <Wand2 size={14} className="text-brand-mid-pink" />
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Grammar Check</span>
            {!isLoading && !error && <ScoreBadge score={result.overallScore} />}
          </div>
          <div className="flex items-center gap-2">
            {!isLoading && !error && pendingIssues.length > 1 && (
              <button
                onClick={() => { onApplyAll(pendingIssues); onDismiss(); }}
                className="flex items-center gap-1.5 px-3 py-1 bg-brand-mid-pink hover:bg-brand-dark-pink text-white rounded-lg text-[11px] font-semibold transition-colors"
              >
                <CheckCircle2 size={11} />
                Apply All
              </button>
            )}
            <button
              onClick={onDismiss}
              className="p-1.5 rounded-lg hover:bg-brand-mid-pink/10 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              aria-label="Close grammar check"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-400 dark:text-gray-500">
              <Loader2 size={16} className="animate-spin text-brand-mid-pink" />
              <span>Checking grammar…</span>
            </div>
          )}

          {/* Error state */}
          {!isLoading && error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-xl">
              <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
              <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
            </div>
          )}

          {/* No issues (or all applied) */}
          {!isLoading && !error && result.issues.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 py-8">
              <CheckCircle2 size={32} className="text-emerald-500 dark:text-emerald-400" />
              <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Looks great! No grammar issues found.</span>
            </div>
          )}

          {/* Summary when there are pending issues */}
          {!isLoading && !error && pendingIssues.length > 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              {result.summary}
            </p>
          )}

          {/* Issue cards */}
          {!isLoading &&
            !error &&
            result.issues.map((issue, i) =>
              appliedIndices.has(i) ? null : (
              <div
                key={i}
                className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40 p-3.5"
              >
                <div className="flex items-start justify-between gap-2 mb-2.5">
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${TYPE_COLOR[issue.type]}`}
                  >
                    {TYPE_LABEL[issue.type]}
                  </span>
                  <button
                    onClick={() => handleApply(issue, i)}
                    className="shrink-0 flex items-center gap-1 px-2.5 py-1 bg-brand-mid-pink/10 hover:bg-brand-mid-pink/20 border border-brand-mid-pink/20 hover:border-brand-mid-pink/40 text-brand-mid-pink rounded-lg text-[11px] font-semibold transition-colors"
                  >
                    Apply
                    <ChevronRight size={10} />
                  </button>
                </div>

                {/* Before → After */}
                <div className="flex items-center gap-2 text-xs mb-2 flex-wrap">
                  <span className="line-through text-gray-400 dark:text-gray-500 bg-red-50 dark:bg-red-950/30 px-1.5 py-0.5 rounded">
                    {issue.original}
                  </span>
                  <ChevronRight size={10} className="text-gray-400 shrink-0" />
                  <span className="text-gray-800 dark:text-gray-200 bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded font-medium">
                    {issue.suggestion}
                  </span>
                </div>

                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                  {issue.explanation}
                </p>
              </div>
            ))}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
