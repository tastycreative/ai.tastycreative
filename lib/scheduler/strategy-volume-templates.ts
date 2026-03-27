/**
 * Per-strategy volume templates.
 * Each template maps platform → taskType → daily count.
 */

export type VolumeSettings = Record<string, Record<string, number>>;

export const PLATFORMS = ['free', 'paid', 'oftv', 'fansly'] as const;
export const TASK_TYPES = ['MM', 'WP', 'ST', 'SP'] as const;

/**
 * Built-in strategy volume templates.
 * Values are daily counts per platform per task type.
 */
export const STRATEGY_VOLUME_TEMPLATES: Record<string, VolumeSettings> = {
  gf_experience: {
    // High MM, moderate WP, good ST, low SP (personal/intimate)
    free:   { MM: 5, WP: 3, ST: 4, SP: 1 },
    paid:   { MM: 8, WP: 4, ST: 5, SP: 2 },
    oftv:   { MM: 3, WP: 2, ST: 3, SP: 1 },
    fansly: { MM: 6, WP: 3, ST: 4, SP: 2 },
  },
  porn_accurate: {
    // High WP/SP, moderate MM, lower ST (content-heavy)
    free:   { MM: 3, WP: 5, ST: 2, SP: 4 },
    paid:   { MM: 5, WP: 8, ST: 3, SP: 6 },
    oftv:   { MM: 3, WP: 5, ST: 2, SP: 4 },
    fansly: { MM: 4, WP: 6, ST: 2, SP: 5 },
  },
  tease_denial: {
    // High ST, moderate MM, low WP/SP (anticipation/scarcity)
    free:   { MM: 4, WP: 2, ST: 6, SP: 1 },
    paid:   { MM: 6, WP: 3, ST: 8, SP: 2 },
    oftv:   { MM: 3, WP: 1, ST: 5, SP: 1 },
    fansly: { MM: 5, WP: 2, ST: 6, SP: 1 },
  },
  premium_exclusive: {
    // Lower overall, higher SP (quality over quantity)
    free:   { MM: 2, WP: 2, ST: 2, SP: 3 },
    paid:   { MM: 4, WP: 3, ST: 3, SP: 5 },
    oftv:   { MM: 2, WP: 2, ST: 2, SP: 3 },
    fansly: { MM: 3, WP: 2, ST: 2, SP: 4 },
  },
  girl_next_door: {
    // High MM/ST, good WP, moderate SP (chatty/casual)
    free:   { MM: 6, WP: 3, ST: 5, SP: 2 },
    paid:   { MM: 8, WP: 5, ST: 6, SP: 3 },
    oftv:   { MM: 4, WP: 3, ST: 4, SP: 2 },
    fansly: { MM: 6, WP: 4, ST: 5, SP: 2 },
  },
  domme: {
    // Moderate MM, high SP, moderate WP/ST (fans earn attention)
    free:   { MM: 3, WP: 3, ST: 3, SP: 5 },
    paid:   { MM: 5, WP: 4, ST: 4, SP: 7 },
    oftv:   { MM: 2, WP: 3, ST: 3, SP: 4 },
    fansly: { MM: 4, WP: 3, ST: 3, SP: 6 },
  },
};

/** Returns the volume template for a built-in strategy, or null for custom strategies. */
export function getStrategyVolumeTemplate(strategyId: string): VolumeSettings | null {
  return STRATEGY_VOLUME_TEMPLATES[strategyId] ?? null;
}

/** Deep-compare two VolumeSettings objects. */
export function volumeSettingsEqual(a: VolumeSettings | null, b: VolumeSettings | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  for (const platform of PLATFORMS) {
    for (const type of TASK_TYPES) {
      if ((a[platform]?.[type] ?? 0) !== (b[platform]?.[type] ?? 0)) return false;
    }
  }
  return true;
}
