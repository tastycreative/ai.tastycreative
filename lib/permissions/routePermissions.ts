import { Permissions } from '@/lib/hooks/usePermissions';

/**
 * Maps routes to the required permission to access them
 * Returns the permission key that must be true to access the route
 */
export function getRequiredPermission(pathname: string): keyof Permissions | null {
  // Always accessible routes (no permission required)
  const alwaysAccessible = [
    '/dashboard',
    '/settings',
    '/billing',
    '/team',
  ];

  if (alwaysAccessible.some(route => pathname.startsWith(route))) {
    return null;
  }

  // Generate Content routes
  if (pathname.startsWith('/workspace/generate-content')) {
    return 'hasGenerateTab';
  }

  // Training routes
  if (pathname.startsWith('/workspace/train-lora') ||
      pathname.startsWith('/workspace/training-jobs')) {
    return 'hasTrainingTab';
  }

  // AI Tools routes
  if (pathname.startsWith('/workspace/ai-tools')) {
    return 'hasGenerateTab'; // AI Tools requires generate tab
  }

  // AI Marketplace routes
  if (pathname.startsWith('/workspace/ai-marketplace')) {
    return 'hasMarketplaceTab';
  }

  // Content Studio routes (Instagram/Planning)
  if (pathname.startsWith('/workspace/content-studio') ||
      pathname.startsWith('/workspace/instagram-staging')) {
    return 'hasInstagramTab';
  }

  // Caption Banks routes
  if (pathname.startsWith('/workspace/caption-banks')) {
    return 'canCaptionBank';
  }

  // Vault routes
  if (pathname.startsWith('/workspace/vault')) {
    return 'hasVaultTab';
  }

  // User Feed routes
  if (pathname.startsWith('/workspace/user-feed') ||
      pathname.startsWith('/workspace/my-profile') ||
      pathname.startsWith('/workspace/friends') ||
      pathname.startsWith('/workspace/creators') ||
      pathname.startsWith('/workspace/bookmarks')) {
    return 'hasFeedTab';
  }

  // Admin routes
  if (pathname.startsWith('/manager') || pathname.startsWith('/admin')) {
    return null; // Handled by separate admin check
  }

  // Content Creator routes
  if (pathname.startsWith('/content-creator')) {
    return null; // Handled by separate role check
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
