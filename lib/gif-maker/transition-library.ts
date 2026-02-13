/**
 * Advanced Transition Library for GIF Maker
 *
 * Collection of pre-built transitions with visual previews
 * and customization options
 */

export type TransitionType =
  | "crossfade"
  | "slide-left"
  | "slide-right"
  | "slide-up"
  | "slide-down"
  | "zoom-in"
  | "zoom-out"
  | "wipe-left"
  | "wipe-right"
  | "wipe-up"
  | "wipe-down"
  | "blur"
  | "fade-to-black"
  | "fade-to-white"
  | "fade-to-color";

export interface TransitionDefinition {
  id: TransitionType;
  name: string;
  description: string;
  category: TransitionCategory;
  duration: {
    min: number;
    max: number;
    default: number;
  };
  icon: string;
  previewGradient: string;
  customizable: {
    duration: boolean;
    easing: boolean;
    color?: boolean;
    blur?: boolean;
  };
}

export type TransitionCategory = "fade" | "slide" | "zoom" | "wipe" | "special";

// ═══════════════════════════════════════════════════════
// TRANSITION DEFINITIONS
// ═══════════════════════════════════════════════════════

export const TRANSITIONS: Record<TransitionType, TransitionDefinition> = {
  // ─────────────────────────────────────────────────────
  // FADE TRANSITIONS
  // ─────────────────────────────────────────────────────
  crossfade: {
    id: "crossfade",
    name: "Crossfade",
    description: "Smooth opacity blend between clips",
    category: "fade",
    duration: { min: 10, max: 90, default: 30 },
    icon: "⬤→⬤",
    previewGradient: "linear-gradient(90deg, rgba(0,0,0,1) 0%, rgba(0,0,0,0.5) 50%, rgba(255,255,255,1) 100%)",
    customizable: {
      duration: true,
      easing: true,
    },
  },
  "fade-to-black": {
    id: "fade-to-black",
    name: "Fade to Black",
    description: "Fade out to black, then fade in",
    category: "fade",
    duration: { min: 10, max: 60, default: 24 },
    icon: "⬤→■→⬤",
    previewGradient: "linear-gradient(90deg, #ffffff 0%, #000000 50%, #ffffff 100%)",
    customizable: {
      duration: true,
      easing: true,
    },
  },
  "fade-to-white": {
    id: "fade-to-white",
    name: "Fade to White",
    description: "Fade out to white, then fade in",
    category: "fade",
    duration: { min: 10, max: 60, default: 24 },
    icon: "■→⬤→■",
    previewGradient: "linear-gradient(90deg, #000000 0%, #ffffff 50%, #000000 100%)",
    customizable: {
      duration: true,
      easing: true,
    },
  },
  "fade-to-color": {
    id: "fade-to-color",
    name: "Fade to Color",
    description: "Fade through custom color",
    category: "fade",
    duration: { min: 10, max: 60, default: 24 },
    icon: "⬤→🎨→⬤",
    previewGradient: "linear-gradient(90deg, #000000 0%, #F774B9 50%, #000000 100%)",
    customizable: {
      duration: true,
      easing: true,
      color: true,
    },
  },

  // ─────────────────────────────────────────────────────
  // SLIDE TRANSITIONS
  // ─────────────────────────────────────────────────────
  "slide-left": {
    id: "slide-left",
    name: "Slide Left",
    description: "Next clip slides in from right",
    category: "slide",
    duration: { min: 10, max: 60, default: 20 },
    icon: "→",
    previewGradient: "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,1) 100%)",
    customizable: {
      duration: true,
      easing: true,
    },
  },
  "slide-right": {
    id: "slide-right",
    name: "Slide Right",
    description: "Next clip slides in from left",
    category: "slide",
    duration: { min: 10, max: 60, default: 20 },
    icon: "←",
    previewGradient: "linear-gradient(90deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 100%)",
    customizable: {
      duration: true,
      easing: true,
    },
  },
  "slide-up": {
    id: "slide-up",
    name: "Slide Up",
    description: "Next clip slides in from bottom",
    category: "slide",
    duration: { min: 10, max: 60, default: 20 },
    icon: "↑",
    previewGradient: "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,1) 100%)",
    customizable: {
      duration: true,
      easing: true,
    },
  },
  "slide-down": {
    id: "slide-down",
    name: "Slide Down",
    description: "Next clip slides in from top",
    category: "slide",
    duration: { min: 10, max: 60, default: 20 },
    icon: "↓",
    previewGradient: "linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 100%)",
    customizable: {
      duration: true,
      easing: true,
    },
  },

  // ─────────────────────────────────────────────────────
  // ZOOM TRANSITIONS
  // ─────────────────────────────────────────────────────
  "zoom-in": {
    id: "zoom-in",
    name: "Zoom In",
    description: "Next clip zooms in from center",
    category: "zoom",
    duration: { min: 10, max: 60, default: 24 },
    icon: "🔍+",
    previewGradient: "radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 100%)",
    customizable: {
      duration: true,
      easing: true,
    },
  },
  "zoom-out": {
    id: "zoom-out",
    name: "Zoom Out",
    description: "Current clip zooms out, revealing next",
    category: "zoom",
    duration: { min: 10, max: 60, default: 24 },
    icon: "🔍-",
    previewGradient: "radial-gradient(circle, rgba(255,255,255,0) 0%, rgba(255,255,255,1) 100%)",
    customizable: {
      duration: true,
      easing: true,
    },
  },

  // ─────────────────────────────────────────────────────
  // WIPE TRANSITIONS
  // ─────────────────────────────────────────────────────
  "wipe-left": {
    id: "wipe-left",
    name: "Wipe Left",
    description: "Hard edge wipe from right to left",
    category: "wipe",
    duration: { min: 10, max: 60, default: 20 },
    icon: "║→",
    previewGradient: "linear-gradient(90deg, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 49%, rgba(255,255,255,1) 51%, rgba(255,255,255,1) 100%)",
    customizable: {
      duration: true,
      easing: false,
    },
  },
  "wipe-right": {
    id: "wipe-right",
    name: "Wipe Right",
    description: "Hard edge wipe from left to right",
    category: "wipe",
    duration: { min: 10, max: 60, default: 20 },
    icon: "←║",
    previewGradient: "linear-gradient(90deg, rgba(255,255,255,1) 0%, rgba(255,255,255,1) 49%, rgba(0,0,0,1) 51%, rgba(0,0,0,1) 100%)",
    customizable: {
      duration: true,
      easing: false,
    },
  },
  "wipe-up": {
    id: "wipe-up",
    name: "Wipe Up",
    description: "Hard edge wipe from bottom to top",
    category: "wipe",
    duration: { min: 10, max: 60, default: 20 },
    icon: "═↑",
    previewGradient: "linear-gradient(180deg, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 49%, rgba(255,255,255,1) 51%, rgba(255,255,255,1) 100%)",
    customizable: {
      duration: true,
      easing: false,
    },
  },
  "wipe-down": {
    id: "wipe-down",
    name: "Wipe Down",
    description: "Hard edge wipe from top to bottom",
    category: "wipe",
    duration: { min: 10, max: 60, default: 20 },
    icon: "↓═",
    previewGradient: "linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(255,255,255,1) 49%, rgba(0,0,0,1) 51%, rgba(0,0,0,1) 100%)",
    customizable: {
      duration: true,
      easing: false,
    },
  },

  // ─────────────────────────────────────────────────────
  // SPECIAL TRANSITIONS
  // ─────────────────────────────────────────────────────
  blur: {
    id: "blur",
    name: "Blur",
    description: "Blur out, then blur in",
    category: "special",
    duration: { min: 10, max: 60, default: 24 },
    icon: "●○●",
    previewGradient: "radial-gradient(circle, rgba(150,150,150,0.2) 0%, rgba(150,150,150,0.8) 50%, rgba(150,150,150,0.2) 100%)",
    customizable: {
      duration: true,
      easing: true,
      blur: true,
    },
  },
};

// ═══════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════

/**
 * Get all transitions
 */
export function getAllTransitions(): TransitionDefinition[] {
  return Object.values(TRANSITIONS);
}

/**
 * Get transitions by category
 */
export function getTransitionsByCategory(
  category: TransitionCategory
): TransitionDefinition[] {
  return Object.values(TRANSITIONS).filter((t) => t.category === category);
}

/**
 * Get transition by ID
 */
export function getTransitionById(id: TransitionType): TransitionDefinition | undefined {
  return TRANSITIONS[id];
}

/**
 * Get transition categories
 */
export function getTransitionCategories(): {
  id: TransitionCategory;
  name: string;
  count: number;
}[] {
  const categories: TransitionCategory[] = ["fade", "slide", "zoom", "wipe", "special"];

  return categories.map((cat) => ({
    id: cat,
    name: cat.charAt(0).toUpperCase() + cat.slice(1),
    count: getTransitionsByCategory(cat).length,
  }));
}

/**
 * Calculate transition duration in frames
 */
export function transitionFrames(durationSeconds: number, fps: number): number {
  return Math.round(durationSeconds * fps);
}
