export type PrizeTier = 'bonus' | 'premium' | 'standard' | 'teaser' | 'bundle' | 'custom';

export interface Prize {
  id: string;
  label: string;
  tier: PrizeTier;
  enabled: boolean;
  /** Content type value from ContentTypeOption, used for auto-fill mapping */
  contentTypeValue?: string;
}

export type ThemeKey = 'st-patricks' | 'valentines' | 'halloween' | 'birthday' | 'christmas';

export interface WheelTheme {
  name: string;
  displayName: string;
  colors: string[];
  background: string;
  accent: string;
  titleLine1: string;
  titleLine2: string;
}

export interface TierMeta {
  label: string;
  color: string;
  emoji: string;
}

export interface FlyerLayout {
  width: number;
  height: number;
  wheel: { cx: number; cy: number; radius: number };
  modelPhoto: { x: number; y: number; width: number; height: number };
  title: { x: number; y: number };
  cta: { x: number; y: number; width: number; height: number };
}
