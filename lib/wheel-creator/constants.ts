import type { Prize, WheelTheme, ThemeKey, TierMeta, PrizeTier, FlyerLayout } from './types';

export const TIER_ORDER: PrizeTier[] = ['bonus', 'premium', 'standard', 'teaser', 'bundle', 'custom'];

export const TIER_META: Record<PrizeTier, TierMeta> = {
  bonus:    { label: 'Bonus',    color: '#ffd700', emoji: '🏆' },
  premium:  { label: 'Premium',  color: '#ce93d8', emoji: '💎' },
  standard: { label: 'Standard', color: '#4fc3f7', emoji: '⭐' },
  teaser:   { label: 'Teaser',   color: '#f48fb1', emoji: '🍑' },
  bundle:   { label: 'Bundle',   color: '#ffb74d', emoji: '📦' },
  custom:   { label: 'Custom',   color: '#90a4ae', emoji: '✏️' },
};

export const DEFAULT_PRIZES: Omit<Prize, 'enabled'>[] = [
  // Bonus
  { id: 'lifetime-vip', label: 'LIFETIME VIP',   tier: 'bonus' },
  { id: 'free-ppv',     label: 'FREE PPV',       tier: 'bonus' },
  // Premium
  { id: 'fully-nude',   label: 'FULLY NUDE PICS', tier: 'premium', contentTypeValue: 'fully_nude' },
  { id: 'squirting',    label: 'SQUIRT VIDEO',    tier: 'premium', contentTypeValue: 'squirting' },
  { id: 'anal',         label: 'ANAL VID',        tier: 'premium', contentTypeValue: 'anal' },
  { id: 'cream-pie',    label: 'CREAM PIE VID',   tier: 'premium', contentTypeValue: 'cream_pie' },
  { id: 'bg',           label: 'BG VIDEO',        tier: 'premium', contentTypeValue: 'bg' },
  { id: 'bgg',          label: 'BGG VIDEO',       tier: 'premium', contentTypeValue: 'bgg' },
  { id: 'gg',           label: 'G/G FUN SHOW',    tier: 'premium', contentTypeValue: 'gg' },
  { id: 'ggg',          label: 'GGG VIDEO',       tier: 'premium', contentTypeValue: 'ggg' },
  { id: 'bbg',          label: 'BBG VIDEO',       tier: 'premium', contentTypeValue: 'bbg' },
  { id: 'orgy',         label: 'ORGY VID',        tier: 'premium', contentTypeValue: 'orgy' },
  // Standard
  { id: 'joi',          label: 'JOI VIDEO',       tier: 'standard', contentTypeValue: 'joi' },
  { id: 'dick-rating',  label: 'DICK RATING',     tier: 'standard', contentTypeValue: 'dick_rating' },
  { id: 'solo',         label: 'SOLO VID',        tier: 'standard', contentTypeValue: 'solo' },
  { id: 'livestream',   label: 'LIVE SHOW',       tier: 'standard', contentTypeValue: 'livestream' },
  { id: 'finger-play',  label: 'FINGER PLAY',     tier: 'standard' },
  // Teaser
  { id: 'booty-pics',   label: 'BOOTY PICS',      tier: 'teaser' },
  { id: 'pussy-pics',   label: 'PUSSY PICS',      tier: 'teaser' },
  { id: 'boobie-vids',  label: 'BOOBIE VIDS',     tier: 'teaser' },
  { id: 'butt-vids',    label: 'BUTT VIDS',       tier: 'teaser' },
  { id: 'pool-fun',     label: 'POOL FUN',        tier: 'teaser' },
  { id: 'pussy-vids',   label: 'PUSSY VIDS',      tier: 'teaser' },
  // Bundle
  { id: 'solo-bundle',  label: 'SOLO BUNDLE',     tier: 'bundle' },
  { id: 'anal-bundle',  label: 'ANAL BUNDLE',     tier: 'bundle' },
  { id: 'bg-bundle',    label: 'BG BUNDLE',       tier: 'bundle' },
  { id: 'cheap-bundle', label: 'STARTER BUNDLE',  tier: 'bundle' },
];

export const THEMES: Record<ThemeKey, WheelTheme> = {
  'st-patricks': {
    name: 'st-patricks',
    displayName: '☘️ St. Patty\'s',
    colors: ['#1b5e20', '#2e7d32', '#388e3c', '#4caf50', '#66bb6a', '#f9d71c'],
    background: 'radial-gradient(ellipse at 25% 20%, #1a5c0a 0%, #0d2906 55%, #060f03 100%)',
    accent: '#f9d71c',
    titleLine1: 'ST PATRICK',
    titleLine2: 'Wheel',
  },
  valentines: {
    name: 'valentines',
    displayName: '💕 Valentine\'s',
    colors: ['#880e4f', '#ad1457', '#c2185b', '#e91e63', '#f06292', '#ff80ab'],
    background: 'radial-gradient(ellipse at 25% 20%, #5c0a2a 0%, #300618 55%, #130008 100%)',
    accent: '#ff80ab',
    titleLine1: 'VALENTINE',
    titleLine2: 'Wheel',
  },
  halloween: {
    name: 'halloween',
    displayName: '🎃 Halloween',
    colors: ['#bf360c', '#d84315', '#e64a19', '#ff6d00', '#212121', '#546e7a'],
    background: 'radial-gradient(ellipse at 25% 20%, #3d1800 0%, #1f0a00 55%, #0a0300 100%)',
    accent: '#ff9800',
    titleLine1: 'HALLOWEEN',
    titleLine2: 'Wheel',
  },
  birthday: {
    name: 'birthday',
    displayName: '🎂 Birthday',
    colors: ['#4a148c', '#7b1fa2', '#9c27b0', '#ba68c8', '#f48fb1', '#ff80ab'],
    background: 'radial-gradient(ellipse at 25% 20%, #1a0040 0%, #0d0020 55%, #050010 100%)',
    accent: '#e040fb',
    titleLine1: 'BIRTHDAY',
    titleLine2: 'Wheel',
  },
  christmas: {
    name: 'christmas',
    displayName: '🎄 Christmas',
    colors: ['#b71c1c', '#c62828', '#1b5e20', '#2e7d32', '#388e3c', '#c62828'],
    background: 'radial-gradient(ellipse at 25% 20%, #1a0505 0%, #0a0202 55%, #030101 100%)',
    accent: '#ffd54f',
    titleLine1: 'CHRISTMAS',
    titleLine2: 'Wheel',
  },
};

export const FLYER_LAYOUT: FlyerLayout = {
  width: 1080,
  height: 1080,
  wheel: { cx: 700, cy: 580, radius: 340 },
  modelPhoto: { x: 0, y: 0, width: 540, height: 1080 },
  title: { x: 540, y: 80 },
  cta: { x: 340, y: 960, width: 400, height: 70 },
};
