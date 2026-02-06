export interface StickerPreset {
  id: string;
  label: string;
  src: string; // emoji char OR data:image/svg+xml URI
  isEmoji: boolean;
  category: string;
}

export interface StickerCategory {
  id: string;
  label: string;
  icon: string;
}

export const STICKER_CATEGORIES: StickerCategory[] = [
  { id: "popular", label: "Popular", icon: "⭐" },
  { id: "love", label: "Love", icon: "❤️" },
  { id: "reactions", label: "Reactions", icon: "😂" },
  { id: "hands", label: "Hands", icon: "👋" },
  { id: "arrows", label: "Arrows", icon: "→" },
  { id: "badges", label: "Badges", icon: "🏷️" },
  { id: "decorative", label: "Decorative", icon: "✨" },
  { id: "social", label: "Social", icon: "📱" },
];

// Helper to create inline SVG data URIs
function svg(content: string, size = 64): string {
  const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${content}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svgStr)}`;
}

export const STICKER_PRESETS: StickerPreset[] = [
  // ─── Popular ──────────────────────────────────────────
  { id: "p-fire", label: "Fire", src: "🔥", isEmoji: true, category: "popular" },
  { id: "p-100", label: "100", src: "💯", isEmoji: true, category: "popular" },
  { id: "p-heart", label: "Heart", src: "❤️", isEmoji: true, category: "popular" },
  { id: "p-star", label: "Star", src: "⭐", isEmoji: true, category: "popular" },
  { id: "p-sparkles", label: "Sparkles", src: "✨", isEmoji: true, category: "popular" },
  { id: "p-rocket", label: "Rocket", src: "🚀", isEmoji: true, category: "popular" },
  { id: "p-crown", label: "Crown", src: "👑", isEmoji: true, category: "popular" },
  { id: "p-thumbsup", label: "Thumbs Up", src: "👍", isEmoji: true, category: "popular" },
  { id: "p-clap", label: "Clapping", src: "👏", isEmoji: true, category: "popular" },
  { id: "p-party", label: "Party", src: "🎉", isEmoji: true, category: "popular" },
  { id: "p-diamond", label: "Diamond", src: "💎", isEmoji: true, category: "popular" },
  { id: "p-money", label: "Money", src: "💰", isEmoji: true, category: "popular" },
  { id: "p-eyes", label: "Eyes", src: "👀", isEmoji: true, category: "popular" },
  { id: "p-skull", label: "Skull", src: "💀", isEmoji: true, category: "popular" },
  { id: "p-target", label: "Target", src: "🎯", isEmoji: true, category: "popular" },
  { id: "p-trophy", label: "Trophy", src: "🏆", isEmoji: true, category: "popular" },
  { id: "p-lightning", label: "Lightning", src: "⚡", isEmoji: true, category: "popular" },
  { id: "p-check", label: "Check", src: "✅", isEmoji: true, category: "popular" },
  { id: "p-cross", label: "Cross", src: "❌", isEmoji: true, category: "popular" },
  { id: "p-clapper", label: "Clapper", src: "🎬", isEmoji: true, category: "popular" },

  // ─── Love ──────────────────────────────────────────
  { id: "l-red", label: "Red Heart", src: "❤️", isEmoji: true, category: "love" },
  { id: "l-orange", label: "Orange Heart", src: "🧡", isEmoji: true, category: "love" },
  { id: "l-yellow", label: "Yellow Heart", src: "💛", isEmoji: true, category: "love" },
  { id: "l-green", label: "Green Heart", src: "💚", isEmoji: true, category: "love" },
  { id: "l-blue", label: "Blue Heart", src: "💙", isEmoji: true, category: "love" },
  { id: "l-purple", label: "Purple Heart", src: "💜", isEmoji: true, category: "love" },
  { id: "l-pink", label: "Pink Heart", src: "🩷", isEmoji: true, category: "love" },
  { id: "l-broken", label: "Broken Heart", src: "💔", isEmoji: true, category: "love" },
  { id: "l-growing", label: "Growing Heart", src: "💗", isEmoji: true, category: "love" },
  { id: "l-sparkling", label: "Sparkling Heart", src: "💖", isEmoji: true, category: "love" },
  { id: "l-revolving", label: "Revolving Hearts", src: "💞", isEmoji: true, category: "love" },
  { id: "l-kiss", label: "Kiss", src: "💋", isEmoji: true, category: "love" },
  { id: "l-cupid", label: "Cupid", src: "💘", isEmoji: true, category: "love" },
  { id: "l-hearteyes", label: "Heart Eyes", src: "😍", isEmoji: true, category: "love" },
  { id: "l-ring", label: "Ring", src: "💍", isEmoji: true, category: "love" },

  // ─── Reactions ──────────────────────────────────────────
  { id: "r-laugh", label: "Laugh", src: "😂", isEmoji: true, category: "reactions" },
  { id: "r-rofl", label: "ROFL", src: "🤣", isEmoji: true, category: "reactions" },
  { id: "r-cry", label: "Cry", src: "😭", isEmoji: true, category: "reactions" },
  { id: "r-shock", label: "Shock", src: "😱", isEmoji: true, category: "reactions" },
  { id: "r-angry", label: "Angry", src: "😡", isEmoji: true, category: "reactions" },
  { id: "r-think", label: "Thinking", src: "🤔", isEmoji: true, category: "reactions" },
  { id: "r-clown", label: "Clown", src: "🤡", isEmoji: true, category: "reactions" },
  { id: "r-skull", label: "Skull", src: "💀", isEmoji: true, category: "reactions" },
  { id: "r-eyeroll", label: "Eye Roll", src: "🙄", isEmoji: true, category: "reactions" },
  { id: "r-mindblown", label: "Mind Blown", src: "🤯", isEmoji: true, category: "reactions" },
  { id: "r-cold", label: "Cold", src: "🥶", isEmoji: true, category: "reactions" },
  { id: "r-hot", label: "Hot", src: "🥵", isEmoji: true, category: "reactions" },
  { id: "r-nerd", label: "Nerd", src: "🤓", isEmoji: true, category: "reactions" },
  { id: "r-shush", label: "Shush", src: "🤫", isEmoji: true, category: "reactions" },
  { id: "r-scream", label: "Scream", src: "😱", isEmoji: true, category: "reactions" },
  { id: "r-sly", label: "Sly", src: "😏", isEmoji: true, category: "reactions" },
  { id: "r-cool", label: "Cool", src: "😎", isEmoji: true, category: "reactions" },
  { id: "r-sleep", label: "Sleep", src: "😴", isEmoji: true, category: "reactions" },
  { id: "r-sick", label: "Sick", src: "🤮", isEmoji: true, category: "reactions" },
  { id: "r-devil", label: "Devil", src: "😈", isEmoji: true, category: "reactions" },

  // ─── Hands ──────────────────────────────────────────
  { id: "h-wave", label: "Wave", src: "👋", isEmoji: true, category: "hands" },
  { id: "h-thumbsup", label: "Thumbs Up", src: "👍", isEmoji: true, category: "hands" },
  { id: "h-thumbsdown", label: "Thumbs Down", src: "👎", isEmoji: true, category: "hands" },
  { id: "h-clap", label: "Clapping", src: "👏", isEmoji: true, category: "hands" },
  { id: "h-pray", label: "Prayer", src: "🙏", isEmoji: true, category: "hands" },
  { id: "h-fist", label: "Fist", src: "✊", isEmoji: true, category: "hands" },
  { id: "h-point-up", label: "Point Up", src: "☝️", isEmoji: true, category: "hands" },
  { id: "h-point-right", label: "Point Right", src: "👉", isEmoji: true, category: "hands" },
  { id: "h-point-left", label: "Point Left", src: "👈", isEmoji: true, category: "hands" },
  { id: "h-peace", label: "Peace", src: "✌️", isEmoji: true, category: "hands" },
  { id: "h-ok", label: "OK", src: "👌", isEmoji: true, category: "hands" },
  { id: "h-callme", label: "Call Me", src: "🤙", isEmoji: true, category: "hands" },
  { id: "h-muscle", label: "Muscle", src: "💪", isEmoji: true, category: "hands" },
  { id: "h-raised", label: "Raised Hands", src: "🙌", isEmoji: true, category: "hands" },
  { id: "h-rock", label: "Rock On", src: "🤘", isEmoji: true, category: "hands" },

  // ─── Arrows & Pointers (SVG) ──────────────────────────────────────────
  { id: "a-right", label: "Arrow Right", src: svg(`<path d="M8 32h38l-12-12 4-4 20 16-20 16-4-4 12-12H8z" fill="#FF4444"/>`), isEmoji: false, category: "arrows" },
  { id: "a-left", label: "Arrow Left", src: svg(`<path d="M56 32H18l12-12-4-4L6 32l20 16 4-4-12-12h38z" fill="#FF4444"/>`), isEmoji: false, category: "arrows" },
  { id: "a-up", label: "Arrow Up", src: svg(`<path d="M32 8L16 28l4 4 8-8v32h8V24l8 8 4-4z" fill="#4488FF"/>`), isEmoji: false, category: "arrows" },
  { id: "a-down", label: "Arrow Down", src: svg(`<path d="M32 56L48 36l-4-4-8 8V8h-8v32l-8-8-4 4z" fill="#4488FF"/>`), isEmoji: false, category: "arrows" },
  { id: "a-curved-r", label: "Curved Arrow", src: svg(`<path d="M12 48C12 28 24 16 44 16V8l16 12-16 12v-8C28 24 20 32 20 48z" fill="#FFB800" stroke="#000" stroke-width="1"/>`), isEmoji: false, category: "arrows" },
  { id: "a-thick-r", label: "Thick Arrow", src: svg(`<rect x="4" y="24" width="32" height="16" rx="2" fill="#22CC66"/><polygon points="36,16 60,32 36,48" fill="#22CC66"/>`), isEmoji: false, category: "arrows" },
  { id: "a-circle", label: "Circle Arrow", src: svg(`<circle cx="32" cy="32" r="24" fill="none" stroke="#FF6B00" stroke-width="4" stroke-dasharray="110 40"/><polygon points="48,10 56,22 44,22" fill="#FF6B00"/>`), isEmoji: false, category: "arrows" },
  { id: "a-double", label: "Double Arrow", src: svg(`<path d="M4 32l16-12v8h24v-8l16 12-16 12v-8H20v8z" fill="#9B59B6"/>`), isEmoji: false, category: "arrows" },
  { id: "a-neon", label: "Neon Arrow", src: svg(`<path d="M8 32h38l-12-12 4-4 20 16-20 16-4-4 12-12H8z" fill="none" stroke="#39FF14" stroke-width="3"/><path d="M8 32h38l-12-12 4-4 20 16-20 16-4-4 12-12H8z" fill="none" stroke="#39FF14" stroke-width="1" opacity="0.4" filter="url(#g)"/><defs><filter id="g"><feGaussianBlur stdDeviation="3"/></filter></defs>`), isEmoji: false, category: "arrows" },
  { id: "a-finger", label: "Pointer", src: "👆", isEmoji: true, category: "arrows" },

  // ─── Badges & Labels (SVG) ──────────────────────────────────────────
  { id: "b-new", label: "NEW", src: svg(`<rect x="4" y="16" width="56" height="32" rx="6" fill="#FF3366"/><text x="32" y="38" text-anchor="middle" font-family="system-ui" font-weight="900" font-size="18" fill="#fff">NEW</text>`), isEmoji: false, category: "badges" },
  { id: "b-sale", label: "SALE", src: svg(`<rect x="4" y="16" width="56" height="32" rx="6" fill="#FF6600"/><text x="32" y="38" text-anchor="middle" font-family="system-ui" font-weight="900" font-size="18" fill="#fff">SALE</text>`), isEmoji: false, category: "badges" },
  { id: "b-hot", label: "HOT", src: svg(`<rect x="4" y="16" width="56" height="32" rx="6" fill="#EE0000"/><text x="32" y="38" text-anchor="middle" font-family="system-ui" font-weight="900" font-size="18" fill="#fff">HOT</text>`), isEmoji: false, category: "badges" },
  { id: "b-live", label: "LIVE", src: svg(`<rect x="4" y="16" width="56" height="32" rx="16" fill="#EE0000"/><circle cx="18" cy="32" r="4" fill="#fff"/><text x="40" y="38" text-anchor="middle" font-family="system-ui" font-weight="700" font-size="16" fill="#fff">LIVE</text>`), isEmoji: false, category: "badges" },
  { id: "b-star-burst", label: "Star Burst", src: svg(`<polygon points="32,2 38,22 58,22 42,34 48,54 32,42 16,54 22,34 6,22 26,22" fill="#FFD700" stroke="#FF8C00" stroke-width="1"/>`), isEmoji: false, category: "badges" },
  { id: "b-ribbon", label: "Ribbon", src: svg(`<path d="M12 4h40l-8 14 8 14H12l8-14z" fill="#3B82F6"/><text x="32" y="24" text-anchor="middle" font-family="system-ui" font-weight="700" font-size="11" fill="#fff">BEST</text>`), isEmoji: false, category: "badges" },
  { id: "b-circle", label: "Circle Badge", src: svg(`<circle cx="32" cy="32" r="26" fill="#8B5CF6" stroke="#fff" stroke-width="3"/><text x="32" y="37" text-anchor="middle" font-family="system-ui" font-weight="800" font-size="12" fill="#fff">TOP</text>`), isEmoji: false, category: "badges" },
  { id: "b-tag", label: "Tag", src: svg(`<path d="M8 12h32l16 20-16 20H8z" fill="#10B981"/><circle cx="14" cy="32" r="3" fill="#fff"/><text x="32" y="37" text-anchor="middle" font-family="system-ui" font-weight="700" font-size="12" fill="#fff">FREE</text>`), isEmoji: false, category: "badges" },

  // ─── Decorative (SVG) ──────────────────────────────────────────
  { id: "d-sparkle", label: "Sparkle Cluster", src: svg(`<polygon points="32,4 35,26 58,28 36,32 38,56 32,34 26,56 28,32 6,28 29,26" fill="#FFD700"/><polygon points="14,10 16,18 22,19 16,21 15,28 13,21 8,19 13,18" fill="#FFD700" opacity="0.7"/><polygon points="52,44 53,49 58,50 53,51 52,56 51,51 46,50 51,49" fill="#FFD700" opacity="0.7"/>`), isEmoji: false, category: "decorative" },
  { id: "d-starburst", label: "Star Burst", src: svg(`<g transform="translate(32,32)"><line x1="0" y1="-28" x2="0" y2="28" stroke="#FF6B6B" stroke-width="3"/><line x1="-28" y1="0" x2="28" y2="0" stroke="#FF6B6B" stroke-width="3"/><line x1="-20" y1="-20" x2="20" y2="20" stroke="#FF6B6B" stroke-width="3"/><line x1="20" y1="-20" x2="-20" y2="20" stroke="#FF6B6B" stroke-width="3"/><circle cx="0" cy="0" r="6" fill="#FF6B6B"/></g>`), isEmoji: false, category: "decorative" },
  { id: "d-heart-frame", label: "Heart Frame", src: svg(`<path d="M32 56 C16 44, 4 32, 4 20 C4 12, 10 6, 18 6 C24 6, 28 10, 32 14 C36 10, 40 6, 46 6 C54 6, 60 12, 60 20 C60 32, 48 44, 32 56z" fill="none" stroke="#FF69B4" stroke-width="3"/>`), isEmoji: false, category: "decorative" },
  { id: "d-swirl", label: "Swirl", src: svg(`<path d="M32 32 C32 24, 40 20, 44 24 C48 28, 40 36, 32 32 C24 28, 16 20, 24 12 C32 4, 48 12, 48 24 C48 40, 32 48, 20 44 C8 40, 4 24, 12 12" fill="none" stroke="#A855F7" stroke-width="2.5" stroke-linecap="round"/>`), isEmoji: false, category: "decorative" },
  { id: "d-confetti", label: "Confetti", src: svg(`<rect x="10" y="8" width="6" height="3" rx="1" fill="#FF4444" transform="rotate(30,13,9)"/><rect x="28" y="4" width="6" height="3" rx="1" fill="#44AAFF" transform="rotate(-15,31,5)"/><rect x="46" y="10" width="6" height="3" rx="1" fill="#44FF44" transform="rotate(45,49,11)"/><rect x="14" y="24" width="6" height="3" rx="1" fill="#FFAA00" transform="rotate(-30,17,25)"/><rect x="38" y="20" width="6" height="3" rx="1" fill="#FF44FF" transform="rotate(20,41,21)"/><rect x="22" y="40" width="6" height="3" rx="1" fill="#44FFFF" transform="rotate(-45,25,41)"/><rect x="42" y="38" width="6" height="3" rx="1" fill="#FF8800" transform="rotate(15,45,39)"/><rect x="8" y="48" width="6" height="3" rx="1" fill="#8844FF" transform="rotate(60,11,49)"/><rect x="50" y="50" width="6" height="3" rx="1" fill="#FF4488" transform="rotate(-25,53,51)"/>`), isEmoji: false, category: "decorative" },
  { id: "d-rays", label: "Light Rays", src: svg(`<g transform="translate(32,32)" opacity="0.8"><line x1="0" y1="-8" x2="0" y2="-28" stroke="#FFD700" stroke-width="2"/><line x1="0" y1="8" x2="0" y2="28" stroke="#FFD700" stroke-width="2"/><line x1="-8" y1="0" x2="-28" y2="0" stroke="#FFD700" stroke-width="2"/><line x1="8" y1="0" x2="28" y2="0" stroke="#FFD700" stroke-width="2"/><line x1="-6" y1="-6" x2="-20" y2="-20" stroke="#FFD700" stroke-width="1.5"/><line x1="6" y1="-6" x2="20" y2="-20" stroke="#FFD700" stroke-width="1.5"/><line x1="-6" y1="6" x2="-20" y2="20" stroke="#FFD700" stroke-width="1.5"/><line x1="6" y1="6" x2="20" y2="20" stroke="#FFD700" stroke-width="1.5"/></g>`), isEmoji: false, category: "decorative" },
  { id: "d-pow", label: "POW!", src: svg(`<polygon points="32,0 40,20 64,16 46,32 60,56 36,40 32,64 28,40 4,56 18,32 0,16 24,20" fill="#FFD700" stroke="#FF4444" stroke-width="2"/><text x="32" y="38" text-anchor="middle" font-family="Impact" font-size="16" fill="#FF0000">POW!</text>`), isEmoji: false, category: "decorative" },
  { id: "d-bam", label: "BAM!", src: svg(`<polygon points="32,0 40,20 64,16 46,32 60,56 36,40 32,64 28,40 4,56 18,32 0,16 24,20" fill="#FF4444" stroke="#FFD700" stroke-width="2"/><text x="32" y="38" text-anchor="middle" font-family="Impact" font-size="16" fill="#fff">BAM!</text>`), isEmoji: false, category: "decorative" },
  { id: "d-circle-dots", label: "Halftone", src: svg(`<circle cx="16" cy="16" r="4" fill="#000" opacity="0.8"/><circle cx="32" cy="16" r="3.5" fill="#000" opacity="0.6"/><circle cx="48" cy="16" r="3" fill="#000" opacity="0.4"/><circle cx="16" cy="32" r="3.5" fill="#000" opacity="0.6"/><circle cx="32" cy="32" r="3" fill="#000" opacity="0.4"/><circle cx="48" cy="32" r="2.5" fill="#000" opacity="0.3"/><circle cx="16" cy="48" r="3" fill="#000" opacity="0.4"/><circle cx="32" cy="48" r="2.5" fill="#000" opacity="0.3"/><circle cx="48" cy="48" r="2" fill="#000" opacity="0.2"/>`), isEmoji: false, category: "decorative" },
  { id: "d-zigzag", label: "Zigzag", src: svg(`<polyline points="4,48 12,16 20,48 28,16 36,48 44,16 52,48 60,16" fill="none" stroke="#FF6B6B" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`), isEmoji: false, category: "decorative" },
  { id: "d-wave", label: "Wave Line", src: svg(`<path d="M4 32 C12 16, 20 16, 28 32 C36 48, 44 48, 52 32 C56 24, 60 24, 64 32" fill="none" stroke="#3B82F6" stroke-width="3" stroke-linecap="round"/>`), isEmoji: false, category: "decorative" },
  { id: "d-speech", label: "Speech Bubble", src: svg(`<path d="M8 8h48v32H28l-10 12 2-12H8z" rx="6" fill="#fff" stroke="#333" stroke-width="2"/>`), isEmoji: false, category: "decorative" },

  // ─── Social (SVG) ──────────────────────────────────────────
  { id: "s-play", label: "Play Button", src: svg(`<circle cx="32" cy="32" r="26" fill="rgba(0,0,0,0.7)"/><polygon points="26,18 26,46 50,32" fill="#fff"/>`), isEmoji: false, category: "social" },
  { id: "s-like", label: "Like Heart", src: svg(`<path d="M32 52 C18 42, 8 32, 8 22 C8 14, 14 8, 22 8 C26 8, 30 10, 32 14 C34 10, 38 8, 42 8 C50 8, 56 14, 56 22 C56 32, 46 42, 32 52z" fill="#FF3040"/>`), isEmoji: false, category: "social" },
  { id: "s-share", label: "Share", src: svg(`<circle cx="48" cy="16" r="8" fill="#3B82F6"/><circle cx="16" cy="32" r="8" fill="#3B82F6"/><circle cx="48" cy="48" r="8" fill="#3B82F6"/><line x1="23" y1="28" x2="41" y2="20" stroke="#3B82F6" stroke-width="2.5"/><line x1="23" y1="36" x2="41" y2="44" stroke="#3B82F6" stroke-width="2.5"/>`), isEmoji: false, category: "social" },
  { id: "s-comment", label: "Comment", src: svg(`<path d="M8 8h48v32H28l-10 12v-12H8z" fill="#3B82F6" rx="4"/><circle cx="24" cy="24" r="3" fill="#fff"/><circle cx="36" cy="24" r="3" fill="#fff"/><circle cx="48" cy="24" r="3" fill="#fff"/>`), isEmoji: false, category: "social" },
  { id: "s-bell", label: "Bell", src: svg(`<path d="M32 8c-10 0-18 8-18 18v10l-4 6h44l-4-6V26c0-10-8-18-18-18z" fill="#FFB800"/><circle cx="32" cy="52" r="5" fill="#FFB800"/><circle cx="32" cy="8" r="3" fill="#FFB800"/>`), isEmoji: false, category: "social" },
  { id: "s-camera", label: "Camera", src: svg(`<rect x="8" y="18" width="48" height="36" rx="6" fill="#333"/><circle cx="32" cy="36" r="12" fill="#555"/><circle cx="32" cy="36" r="8" fill="#8B5CF6"/><circle cx="32" cy="36" r="3" fill="#C4B5FD"/><rect x="22" y="12" width="20" height="8" rx="2" fill="#333"/>`), isEmoji: false, category: "social" },
  { id: "s-music", label: "Music Note", src: svg(`<circle cx="20" cy="48" r="8" fill="#EC4899"/><circle cx="48" cy="42" r="8" fill="#EC4899"/><rect x="26" y="10" width="4" height="38" fill="#EC4899"/><rect x="54" y="4" width="4" height="38" fill="#EC4899"/><rect x="26" y="8" width="32" height="6" rx="2" fill="#EC4899"/>`), isEmoji: false, category: "social" },
  { id: "s-follow", label: "Follow", src: svg(`<circle cx="24" cy="20" r="10" fill="#10B981"/><path d="M8 52c0-10 8-18 16-18h0c8 0 16 8 16 18" fill="#10B981"/><line x1="48" y1="28" x2="48" y2="44" stroke="#10B981" stroke-width="4" stroke-linecap="round"/><line x1="40" y1="36" x2="56" y2="36" stroke="#10B981" stroke-width="4" stroke-linecap="round"/>`), isEmoji: false, category: "social" },
];
