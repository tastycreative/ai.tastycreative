import { Permissions } from '@/lib/hooks/usePermissions.query';

/**
 * Strip the tenant prefix from the pathname.
 * Paths come in as "/my-org/workspace/vault" — we need "/workspace/vault".
 */
function stripTenantPrefix(pathname: string): string {
  // /<tenant>/<rest> → /<rest>
  const parts = pathname.split('/');
  // parts = ['', tenant, 'workspace', 'vault', ...]
  if (parts.length >= 3) {
    return '/' + parts.slice(2).join('/');
  }
  return pathname;
}

/**
 * Maps routes to the required permission to access them.
 * Returns the permission key that must be true to access the route.
 */
export function getRequiredPermission(pathname: string): keyof Permissions | null {
  // Strip the dynamic [tenant] segment so routes match
  const route = stripTenantPrefix(pathname);

  // Always accessible routes (no permission required)
  const alwaysAccessible = [
    '/dashboard',
    '/settings',
    '/billing',
    '/team',
    '/workspace/my-influencers',
  ];

  if (alwaysAccessible.some(r => route === r || route.startsWith(r + '/'))) {
    return null;
  }

  // ── Spaces ────────────────────────────────────────────────────────────────
  if (route.startsWith('/spaces')) {
    return 'hasSpacesTab';
  }

  // ── POD Tracker ──────────────────────────────────────────────────────────
  if (route.startsWith('/pod-tracker')) {
    return 'hasSchedulersTab';
  }

  // ── Schedulers Tracker ────────────────────────────────────────────────────
  if (route.startsWith('/page-tracker')) {
    return 'hasSchedulersTab';
  }

  // ── Content Ops ───────────────────────────────────────────────────────────
  if (route.startsWith('/of-models') ||
      route.startsWith('/gallery') ||
      route.startsWith('/gif-maker') ||
      route.startsWith('/submissions') ||
      route.startsWith('/workspace/caption-workspace')) {
    return 'hasContentTab';
  }

  // ── Vault ─────────────────────────────────────────────────────────────────
  if (route.startsWith('/workspace/vault')) {
    return 'hasVaultTab';
  }

  // ── Reference Bank ────────────────────────────────────────────────────────
  if (route.startsWith('/workspace/reference-bank')) {
    return 'hasReferenceBank';
  }

  // ── Caption Banks ─────────────────────────────────────────────────────────
  if (route.startsWith('/workspace/caption-banks')) {
    return 'canCaptionBank';
  }

  // ── Content Studio — specific sub-routes first, then parent ───────────────
  if (route === '/workspace/content-studio/pipeline') {
    return 'canContentPipeline';
  }
  if (route === '/workspace/content-studio/stories') {
    return 'canStoryPlanner';
  }
  if (route === '/workspace/content-studio/reels') {
    return 'canReelPlanner';
  }
  if (route === '/workspace/content-studio/feed-posts') {
    return 'canFeedPostPlanner';
  }
  if (route === '/workspace/content-studio/performance') {
    return 'canPerformanceMetrics';
  }
  if (route === '/workspace/content-studio/hashtags') {
    return 'canHashtagBank';
  }
  if (route.startsWith('/workspace/content-studio') ||
      route.startsWith('/workspace/instagram-staging')) {
    return 'hasInstagramTab';
  }

  // ── Generate Content — specific tools first, then parent ──────────────────
  if (route === '/workspace/generate-content/text-to-image') {
    return 'canTextToImage';
  }
  if (route === '/workspace/generate-content/style-transfer') {
    return 'canStyleTransfer';
  }
  if (route === '/workspace/generate-content/skin-enhancer') {
    return 'canSkinEnhancer';
  }
  if (route === '/workspace/generate-content/flux-kontext') {
    return 'canFluxKontext';
  }
  if (route === '/workspace/generate-content/text-to-video') {
    return 'canTextToVideo';
  }
  if (route === '/workspace/generate-content/image-to-video') {
    return 'canImageToVideo';
  }
  if (route === '/workspace/generate-content/face-swapping') {
    return 'canFaceSwap';
  }
  if (route === '/workspace/generate-content/image-to-image-skin-enhancer') {
    return 'canImageToImageSkinEnhancer';
  }
  if (route === '/workspace/generate-content/fps-boost') {
    return 'canVideoFpsBoost';
  }
  if (route === '/workspace/generate-content/ai-voice') {
    return 'canAIVoice';
  }
  if (route === '/workspace/generate-content/seedream-text-to-image') {
    return 'canSeeDreamTextToImage';
  }
  if (route === '/workspace/generate-content/seedream-image-to-image') {
    return 'canSeeDreamImageToImage';
  }
  if (route === '/workspace/generate-content/seedream-text-to-video') {
    return 'canSeeDreamTextToVideo';
  }
  if (route === '/workspace/generate-content/seedream-image-to-video') {
    return 'canSeeDreamImageToVideo';
  }
  if (route === '/workspace/generate-content/kling-text-to-video') {
    return 'canKlingTextToVideo';
  }
  if (route === '/workspace/generate-content/kling-image-to-video') {
    return 'canKlingImageToVideo';
  }
  if (route === '/workspace/generate-content/kling-multi-image-to-video') {
    return 'canKlingMultiImageToVideo';
  }
  if (route === '/workspace/generate-content/kling-motion-control') {
    return 'canKlingMotionControl';
  }
  // Catch-all for any other generate-content routes
  if (route.startsWith('/workspace/generate-content')) {
    return 'hasGenerateTab';
  }

  // ── Training ──────────────────────────────────────────────────────────────
  if (route.startsWith('/workspace/train-lora') ||
      route.startsWith('/workspace/training-jobs')) {
    return 'hasTrainingTab';
  }

  // ── AI Tools ──────────────────────────────────────────────────────────────
  if (route.startsWith('/workspace/ai-tools') ||
      route.startsWith('/workspace/my-lora-models')) {
    return 'hasAIToolsTab';
  }

  // ── AI Marketplace ────────────────────────────────────────────────────────
  if (route.startsWith('/workspace/ai-marketplace')) {
    return 'hasMarketplaceTab';
  }

  // ── Social Media / Feed ───────────────────────────────────────────────────
  if (route.startsWith('/workspace/user-feed') ||
      route.startsWith('/workspace/my-profile') ||
      route.startsWith('/workspace/friends') ||
      route.startsWith('/workspace/creators') ||
      route.startsWith('/workspace/bookmarks')) {
    return 'hasFeedTab';
  }

  // ── Admin / Content Creator — handled by separate role checks ─────────────
  if (route.startsWith('/manager') || route.startsWith('/admin')) {
    return null;
  }
  if (route.startsWith('/content-creator')) {
    return null;
  }

  // Default: no specific permission required
  return null;
}

/**
 * Checks if user has permission to access a route
 */
export function canAccessRoute(pathname: string, permissions: Permissions): boolean {
  const requiredPermission = getRequiredPermission(pathname);

  if (requiredPermission === null) {
    return true; // No permission required
  }

  return Boolean(permissions[requiredPermission]);
}
