/**
 * V1a Caption Formatter - Variable replacement and platform-specific formatting
 *
 * Supports variables like {{model_name}}, {{price}}, {{platform}} and applies
 * platform-specific formatting rules (character limits, hashtag limits, etc.)
 */

import { PlatformId, PLATFORM_SPECS } from './platform-specs';

/**
 * Supported caption variables
 */
export interface CaptionVariables {
  model_name?: string;
  price?: string | number;
  platform?: string;
  subscription_price?: string | number;
  bundle_price?: string | number;
  tip_amount?: string | number;
  username?: string;
  link?: string;
  date?: string;
  custom?: Record<string, string>;
}

/**
 * Caption formatting options
 */
export interface FormatOptions {
  /** Target platform for formatting rules */
  platform?: PlatformId;
  /** Whether to truncate to platform limits */
  truncate?: boolean;
  /** Whether to strip hashtags if over limit */
  enforceHashtagLimit?: boolean;
  /** Custom hashtags to append */
  appendHashtags?: string[];
  /** Whether to remove empty variable placeholders */
  removeEmptyVariables?: boolean;
}

/**
 * Result of formatting a caption
 */
export interface FormattedCaption {
  text: string;
  originalLength: number;
  finalLength: number;
  truncated: boolean;
  hashtagCount: number;
  hashtagsRemoved: number;
  warnings: string[];
}

/**
 * Variable pattern for matching {{variable_name}}
 */
const VARIABLE_PATTERN = /\{\{(\w+)\}\}/g;

/**
 * Hashtag pattern for counting
 */
const HASHTAG_PATTERN = /#[\w]+/g;

/**
 * Extract all variables used in a caption text
 */
export function extractVariables(text: string): string[] {
  const matches = text.matchAll(VARIABLE_PATTERN);
  return [...new Set([...matches].map(m => m[1]))];
}

/**
 * Check if caption contains any variables
 */
export function hasVariables(text: string): boolean {
  return VARIABLE_PATTERN.test(text);
}

/**
 * Replace variables in caption text
 */
export function replaceVariables(
  text: string,
  variables: CaptionVariables,
  removeEmpty: boolean = false
): string {
  return text.replace(VARIABLE_PATTERN, (match, varName) => {
    // Check standard variables
    if (varName in variables) {
      const value = variables[varName as keyof CaptionVariables];
      if (value !== undefined && value !== null && value !== '') {
        return String(value);
      }
    }

    // Check custom variables
    if (variables.custom && varName in variables.custom) {
      return variables.custom[varName];
    }

    // Return empty string or original placeholder
    return removeEmpty ? '' : match;
  });
}

/**
 * Count hashtags in text
 */
export function countHashtags(text: string): number {
  const matches = text.match(HASHTAG_PATTERN);
  return matches ? matches.length : 0;
}

/**
 * Extract all hashtags from text
 */
export function extractHashtags(text: string): string[] {
  const matches = text.match(HASHTAG_PATTERN);
  return matches || [];
}

/**
 * Remove excess hashtags to meet platform limit
 */
export function enforceHashtagLimit(text: string, limit: number): { text: string; removed: number } {
  const hashtags = extractHashtags(text);
  if (hashtags.length <= limit) {
    return { text, removed: 0 };
  }

  // Keep first N hashtags, remove the rest
  const hashtagsToRemove = hashtags.slice(limit);
  let newText = text;

  for (const hashtag of hashtagsToRemove) {
    // Remove hashtag and any trailing space
    newText = newText.replace(new RegExp(`${hashtag}\\s*`, 'g'), '');
  }

  return {
    text: newText.trim(),
    removed: hashtagsToRemove.length,
  };
}

/**
 * Truncate text to a maximum length, preserving word boundaries
 */
export function truncateText(text: string, maxLength: number): { text: string; truncated: boolean } {
  if (text.length <= maxLength) {
    return { text, truncated: false };
  }

  // Find the last space before the limit
  let truncateAt = maxLength;
  const lastSpace = text.lastIndexOf(' ', maxLength - 3); // -3 for "..."

  if (lastSpace > maxLength * 0.8) {
    truncateAt = lastSpace;
  }

  return {
    text: text.substring(0, truncateAt).trim() + '...',
    truncated: true,
  };
}

/**
 * Format caption for a specific platform with all rules applied
 */
export function formatCaption(
  text: string,
  variables: CaptionVariables,
  options: FormatOptions = {}
): FormattedCaption {
  const {
    platform,
    truncate = true,
    enforceHashtagLimit: enforceHashtags = true,
    appendHashtags = [],
    removeEmptyVariables = true,
  } = options;

  const warnings: string[] = [];
  const originalLength = text.length;

  // Step 1: Replace variables
  let formatted = replaceVariables(text, variables, removeEmptyVariables);

  // Step 2: Append any additional hashtags
  if (appendHashtags.length > 0) {
    const hashtagString = appendHashtags
      .map(h => (h.startsWith('#') ? h : `#${h}`))
      .join(' ');
    formatted = `${formatted}\n\n${hashtagString}`;
  }

  // Step 3: Apply platform-specific rules
  let hashtagsRemoved = 0;
  let truncated = false;

  if (platform) {
    const spec = PLATFORM_SPECS[platform];
    if (spec) {
      // Enforce hashtag limit
      if (enforceHashtags && spec.captionLimits.hashtagLimit) {
        const result = enforceHashtagLimit(formatted, spec.captionLimits.hashtagLimit);
        formatted = result.text;
        hashtagsRemoved = result.removed;
        if (hashtagsRemoved > 0) {
          warnings.push(`Removed ${hashtagsRemoved} hashtag(s) to meet ${platform} limit of ${spec.captionLimits.hashtagLimit}`);
        }
      }

      // Truncate to character limit
      if (truncate && formatted.length > spec.captionLimits.maxLength) {
        const result = truncateText(formatted, spec.captionLimits.maxLength);
        formatted = result.text;
        truncated = result.truncated;
        if (truncated) {
          warnings.push(`Caption truncated to ${spec.captionLimits.maxLength} characters for ${platform}`);
        }
      }
    }
  }

  return {
    text: formatted,
    originalLength,
    finalLength: formatted.length,
    truncated,
    hashtagCount: countHashtags(formatted),
    hashtagsRemoved,
    warnings,
  };
}

/**
 * Format caption for multiple platforms at once
 */
export function formatCaptionForPlatforms(
  text: string,
  variables: CaptionVariables,
  platforms: PlatformId[],
  baseOptions: Omit<FormatOptions, 'platform'> = {}
): Record<PlatformId, FormattedCaption> {
  const results: Partial<Record<PlatformId, FormattedCaption>> = {};

  for (const platform of platforms) {
    results[platform] = formatCaption(text, variables, {
      ...baseOptions,
      platform,
    });
  }

  return results as Record<PlatformId, FormattedCaption>;
}

/**
 * Generate caption.txt content for export
 */
export function generateCaptionFile(
  caption: string,
  variables: CaptionVariables,
  platform: PlatformId
): string {
  const formatted = formatCaption(caption, variables, { platform });

  const lines = [
    `Caption for ${PLATFORM_SPECS[platform]?.name || platform}`,
    '='.repeat(40),
    '',
    formatted.text,
  ];

  if (formatted.warnings.length > 0) {
    lines.push('', '---', 'Notes:', ...formatted.warnings.map(w => `- ${w}`));
  }

  return lines.join('\n');
}

/**
 * Validate caption before export
 */
export function validateCaption(text: string, platform: PlatformId): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const spec = PLATFORM_SPECS[platform];

  if (!spec) {
    errors.push(`Unknown platform: ${platform}`);
    return { valid: false, errors, warnings };
  }

  // Check for unreplaced variables
  const unreplacedVars = extractVariables(text);
  if (unreplacedVars.length > 0) {
    warnings.push(`Caption contains unreplaced variables: ${unreplacedVars.join(', ')}`);
  }

  // Check length
  if (text.length > spec.captionLimits.maxLength) {
    warnings.push(`Caption exceeds ${platform} limit (${text.length}/${spec.captionLimits.maxLength} chars)`);
  }

  // Check hashtag count
  const hashtagCount = countHashtags(text);
  if (spec.captionLimits.hashtagLimit && hashtagCount > spec.captionLimits.hashtagLimit) {
    warnings.push(`Too many hashtags for ${platform} (${hashtagCount}/${spec.captionLimits.hashtagLimit})`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Get a preview of how the caption will look with variables replaced
 */
export function previewCaption(
  text: string,
  variables: CaptionVariables,
  platform?: PlatformId
): string {
  const formatted = formatCaption(text, variables, {
    platform,
    truncate: false,
    enforceHashtagLimit: false,
    removeEmptyVariables: false,
  });
  return formatted.text;
}

/**
 * Sample variables for preview/testing
 */
export const SAMPLE_VARIABLES: CaptionVariables = {
  model_name: 'Jessica',
  price: '9.99',
  platform: 'OnlyFans',
  subscription_price: '9.99',
  bundle_price: '25',
  tip_amount: '10',
  username: '@jessica_model',
  link: 'onlyfans.com/jessica',
  date: new Date().toLocaleDateString(),
};
