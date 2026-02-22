import type { ComponentModule } from '../validations/content-submission';

type SubmissionType = 'OTP_PTR' | 'WALL_POST' | 'SEXTING_SETS';

/**
 * Get smart component recommendations based on submission type.
 * Kept for ClassicSubmissionForm backward compatibility.
 */
export function getRecommendations(
  submissionType: SubmissionType,
  contentStyle?: string
): ComponentModule[] {
  const recommendations: ComponentModule[] = [];

  switch (submissionType) {
    case 'OTP_PTR':
      recommendations.push('pricing', 'upload');
      break;
    case 'WALL_POST':
      recommendations.push('upload');
      break;
    case 'SEXTING_SETS':
      recommendations.push('upload');
      break;
  }

  return Array.from(new Set(recommendations));
}

/**
 * Check if a component is forced (cannot be disabled).
 * Kept for ClassicSubmissionForm backward compatibility.
 */
export function isComponentForced(
  component: ComponentModule,
  submissionType: SubmissionType
): boolean {
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
