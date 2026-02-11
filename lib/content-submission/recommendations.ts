import type { ComponentModule } from '../validations/content-submission';

/**
 * Get smart component recommendations based on submission type and content style
 */
export function getRecommendations(
  submissionType: 'otp' | 'ptr',
  contentStyle: 'normal' | 'poll' | 'game' | 'ppv' | 'bundle'
): ComponentModule[] {
  const recommendations: ComponentModule[] = [];

  // PTR always needs release schedule
  if (submissionType === 'ptr') {
    recommendations.push('release');
  }

  // Content style specific recommendations
  switch (contentStyle) {
    case 'game':
    case 'ppv':
    case 'bundle':
      // Monetized content needs pricing and upload
      recommendations.push('pricing', 'upload');
      break;

    case 'poll':
    case 'normal':
      // Standard content just needs upload
      recommendations.push('upload');
      break;
  }

  // Remove duplicates and return
  return Array.from(new Set(recommendations));
}

/**
 * Check if a component is forced (cannot be disabled)
 */
export function isComponentForced(
  component: ComponentModule,
  submissionType: 'otp' | 'ptr'
): boolean {
  // PTR submissions must have release component
  if (submissionType === 'ptr' && component === 'release') {
    return true;
  }

  return false;
}

/**
 * Get estimated time added by a component (in minutes)
 */
export function getComponentTime(component: ComponentModule): number {
  switch (component) {
    case 'pricing':
      return 1;
    case 'release':
      return 0.5;
    case 'upload':
      return 2;
    default:
      return 0;
  }
}
