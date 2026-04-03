'use client';

import { useState, useCallback, useMemo } from 'react';

type ReviewTrigger = 'caption' | 'paywallContent' | null;

// Shared fields that always need review regardless of trigger
const SHARED_REVIEW_FIELDS = [
  'price', 'contentPreview', 'contentFlyer', 'folderName', 'time', 'tag',
  'captionGuide',
  'postSchedule', 'subscriberPromoSchedule', 'storyPostSchedule',
];

const REVIEW_FIELDS_BY_TRIGGER: Record<string, string[]> = {
  // Caption changed → review everything except caption itself; paywallContent included
  caption: [...SHARED_REVIEW_FIELDS, 'paywallContent'],
  // Paywall content changed → review everything except paywallContent itself; caption included
  paywallContent: [...SHARED_REVIEW_FIELDS, 'caption'],
};

export function useFieldReview() {
  const [trigger, setTrigger] = useState<ReviewTrigger>(null);
  const [confirmedFields, setConfirmedFields] = useState<Set<string>>(new Set());
  const [visibleFields, setVisibleFields] = useState<string[]>([]);

  const allReviewFields = trigger ? REVIEW_FIELDS_BY_TRIGGER[trigger] ?? [] : [];
  // Only review fields that are actually rendered for this task type
  const reviewFields = visibleFields.length > 0
    ? allReviewFields.filter((f) => visibleFields.includes(f))
    : allReviewFields;
  const isReviewActive = trigger !== null;

  const activateReview = useCallback((t: ReviewTrigger, renderedFieldKeys: string[] = []) => {
    if (!t) return;
    setTrigger(t);
    setConfirmedFields(new Set());
    if (renderedFieldKeys.length > 0) setVisibleFields(renderedFieldKeys);
  }, []);

  const confirmField = useCallback((key: string) => {
    setConfirmedFields((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, []);

  const confirmFields = useCallback((keys: string[]) => {
    setConfirmedFields((prev) => {
      const next = new Set(prev);
      for (const k of keys) next.add(k);
      return next;
    });
  }, []);

  const needsReview = useCallback(
    (key: string) => isReviewActive && reviewFields.includes(key) && !confirmedFields.has(key),
    [isReviewActive, reviewFields, confirmedFields],
  );

  const unconfirmedFields = useMemo(
    () => reviewFields.filter((f) => !confirmedFields.has(f)),
    [reviewFields, confirmedFields],
  );

  const canSendToQA = !isReviewActive || unconfirmedFields.length === 0;

  const resetReview = useCallback(() => {
    setTrigger(null);
    setConfirmedFields(new Set());
    setVisibleFields([]);
  }, []);

  return {
    trigger,
    isReviewActive,
    confirmedFields,
    activateReview,
    confirmField,
    confirmFields,
    needsReview,
    canSendToQA,
    unconfirmedFields,
    resetReview,
  };
}
