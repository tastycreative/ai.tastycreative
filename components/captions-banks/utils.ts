import type { Caption, CaptionStats, DuplicateGroup } from '@/lib/hooks/useCaptions.query';

// ── Category Styling ───────────────────────────────────────────────

const CATEGORY_VARIANTS = [
  { bg: 'bg-brand-light-pink/10 dark:bg-brand-light-pink/15', text: 'text-brand-light-pink', border: 'border-brand-light-pink/25' },
  { bg: 'bg-brand-blue/10 dark:bg-brand-blue/15', text: 'text-brand-blue', border: 'border-brand-blue/25' },
  { bg: 'bg-brand-mid-pink/10 dark:bg-brand-mid-pink/15', text: 'text-brand-mid-pink', border: 'border-brand-mid-pink/25' },
  { bg: 'bg-brand-dark-pink/10 dark:bg-brand-dark-pink/15', text: 'text-brand-dark-pink', border: 'border-brand-dark-pink/25' },
  { bg: 'bg-emerald-500/10 dark:bg-emerald-500/15', text: 'text-emerald-500 dark:text-emerald-400', border: 'border-emerald-500/25' },
  { bg: 'bg-amber-500/10 dark:bg-amber-500/15', text: 'text-amber-500 dark:text-amber-400', border: 'border-amber-500/25' },
];

export function getCategoryStyle(category: string) {
  const hash = category.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  return CATEGORY_VARIANTS[hash % CATEGORY_VARIANTS.length];
}

// ── Text Utilities ─────────────────────────────────────────────────

export function isLongCaption(text: string): boolean {
  return text.length > 220 || text.split('\n').length > 4;
}

// ── Similarity / Duplicates ────────────────────────────────────────

export function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  if (s1 === s2) return 100;
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  if (longer.length === 0) return 100;
  const costs: number[] = [];
  for (let i = 0; i <= shorter.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= longer.length; j++) {
      if (i === 0) costs[j] = j;
      else if (j > 0) {
        let newValue = costs[j - 1];
        if (shorter.charAt(i - 1) !== longer.charAt(j - 1))
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[longer.length] = lastValue;
  }
  return Math.round(((longer.length - costs[longer.length]) / longer.length) * 100);
}

export function findDuplicates(captions: Caption[]): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const processed = new Set<string>();
  for (let i = 0; i < captions.length; i++) {
    if (processed.has(captions[i].id)) continue;
    const duplicates: Caption[] = [];
    let maxSimilarity = 0;
    for (let j = i + 1; j < captions.length; j++) {
      if (processed.has(captions[j].id)) continue;
      const similarity = calculateSimilarity(captions[i].caption, captions[j].caption);
      if (similarity >= 70) {
        duplicates.push(captions[j]);
        maxSimilarity = Math.max(maxSimilarity, similarity);
        processed.add(captions[j].id);
      }
    }
    if (duplicates.length > 0) {
      processed.add(captions[i].id);
      groups.push({ original: captions[i], duplicates, similarity: maxSimilarity });
    }
  }
  return groups;
}

// ── Stats Computation ──────────────────────────────────────────────

export function computeStats(captions: Caption[]): CaptionStats {
  const categoryStats = Object.entries(
    captions.reduce((acc, c) => {
      const cat = c.captionCategory || 'Unknown';
      if (!acc[cat]) acc[cat] = { count: 0, totalUsage: 0 };
      acc[cat].count++;
      acc[cat].totalUsage += c.usageCount;
      return acc;
    }, {} as Record<string, { count: number; totalUsage: number }>)
  ).map(([category, data]) => ({ category, ...data }));

  return {
    totalCaptions: captions.length,
    favoriteCaptions: captions.filter((c) => c.isFavorite).length,
    totalUsage: captions.reduce((acc, c) => acc + c.usageCount, 0),
    mostUsed: [...captions].sort((a, b) => b.usageCount - a.usageCount).slice(0, 5),
    recentlyUsed: [...captions]
      .filter((c): c is Caption & { lastUsedAt: string } => !!c.lastUsedAt)
      .sort((a, b) => new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime())
      .slice(0, 5),
    captionsInCooldown: [],
    categoryStats,
  };
}

// ── Top Performers ─────────────────────────────────────────────────

export function computeTopPerformerIds(captions: Caption[]): Set<string> {
  const withSales = captions.filter((c) => c.usageCount > 0);
  if (withSales.length < 3) return new Set();
  const sorted = [...withSales].sort((a, b) => b.usageCount - a.usageCount);
  const top10Percent = Math.max(1, Math.ceil(sorted.length * 0.1));
  return new Set(sorted.slice(0, top10Percent).map((c) => c.id));
}

export function computeCategoryRank(caption: Caption, captions: Caption[]): number | null {
  const sameCategory = captions
    .filter((c) => c.captionCategory === caption.captionCategory && c.usageCount > 0)
    .sort((a, b) => b.usageCount - a.usageCount);
  if (sameCategory.length < 2) return null;
  const idx = sameCategory.findIndex((c) => c.id === caption.id);
  return idx >= 0 ? idx + 1 : null;
}

// ── Search Highlighting ────────────────────────────────────────────

export function highlightText(text: string, query: string): Array<{ text: string; highlighted: boolean }> {
  if (!query.trim()) return [{ text, highlighted: false }];
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);
  const lowerQuery = query.toLowerCase();
  return parts.map((part) => ({
    text: part,
    highlighted: part.toLowerCase() === lowerQuery,
  }));
}

// ── Filter Chip Helpers ────────────────────────────────────────────

export function getTopContentTypes(captions: Caption[], limit = 8): string[] {
  const counts = captions.reduce((acc, c) => {
    const cat = c.captionCategory;
    if (cat && cat !== 'Uncategorized') {
      acc[cat] = (acc[cat] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name]) => name);
}

// ── Sort ───────────────────────────────────────────────────────────

export function performerScore(caption: Caption): number {
  return caption.usageCount * 0.7 + (caption.isFavorite ? 1 : 0) * 0.3;
}

// ── Constants ──────────────────────────────────────────────────────

export const CAPTION_CATEGORIES = [
  'Dick rating', 'Solo DILDO', 'Solo FINGERS', 'Solo VIBRATOR', 'JOI',
  'Squirting', 'Cream Pie', 'BG', 'BJ', 'GG', 'GGG', 'BGG', 'BBG',
  'ORGY', 'ANAL butt plug', 'Anal SOLO', 'Anal BG', 'Lives',
];

export const CAPTION_TYPES = [
  'Bundle Unlocks', 'Tip Me', 'BIO', 'VIP GIFT', 'Short Unlocks',
  'Solo Unlocks', 'Follow up Normal', 'Mass Message Bumps', 'Wall Bumps',
  'DM Funnels', 'GIF Bumps', 'Renew On', 'VIP Post', 'Link Drop',
  'Live Streams', 'Live Mass Message', 'Holiday Unlocks', 'Live Preview',
  'Games', 'New Sub Promo', 'Winner Unlocks', 'Descriptive', 'OTP Style',
  'List Unlocks', 'Model Specific', 'SOP', 'Holiday Non-PPV', 'Timebound',
  'Follow Up Incentives', 'Collab', 'Tip Me Post', 'Tip Me CTA',
  'MM Renew', 'Renew Post', 'Porn Post', '1 Person Tip Campaign',
  'VIP Membership', 'DM Funnel (GF)', 'Expired Sub Promo',
];

export const CAPTION_BANKS = [
  'Main Porn Caption Bank', 'Post Generation Caption Bank',
  'High Sales Caption', 'Better Bump Bank', 'Custom',
  'Borrowed Captions', 'CST - Post Generation Harvest Caption Bank',
];

export const IMPORTED_SHEETS = [
  'Short', 'Descriptive', 'Bundle', 'Winner', 'List', 'Holiday',
  'Short (GF)', 'Descriptive (GF)', 'Bundle (GF)', 'List (GF)', 'Winner (GF)',
  'Tip Me CTA', 'Tip Me Post', 'New Sub', 'Expired Sub',
  'Livestream', 'VIP Membership', 'Holiday Non-PPV', '1 Fan Tip Campaign', 'Games',
  'DM Funnel', 'GIF Bumps', 'Renew Post',
  'Holiday (GF)', 'Tip Me Post (GF)', 'Tip Me CTA (GF)', 'Livestream (GF)',
  'GIF Bump (GF)', 'Holiday Non-PPV (GF)', 'Renew Post (GF)',
  'New Sub (GF)', 'Expired Sub (GF)',
  'GF Non-Explicit', 'Public Captions', 'Timebound', 'SOP Captions',
];

export const PAGE_SIZE = 30;
