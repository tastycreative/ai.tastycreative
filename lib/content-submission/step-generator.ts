import type { ComponentModule } from '../validations/content-submission';
import type { FieldErrors } from 'react-hook-form';

export interface WizardStep {
  id: string;
  title: string;
}

/**
 * Generate dynamic wizard steps based on selections
 */
export function generateSteps(
  submissionType: 'otp' | 'ptr',
  contentStyle: 'normal' | 'poll' | 'game' | 'ppv' | 'bundle',
  selectedComponents: ComponentModule[]
): WizardStep[] {
  const steps: WizardStep[] = [
    { id: 'platform-type', title: 'Select Platform' },
    { id: 'style-components', title: 'Style & Components' },
    { id: 'details', title: 'Content Details' },
    { id: 'files', title: 'File Uploads' },
    { id: 'review', title: 'Review & Submit' },
  ];

  return steps;
}

/**
 * Check if a step has validation errors
 */
export function stepHasErrors(stepId: string, errors: FieldErrors): boolean {
  const fieldMap: Record<string, string[]> = {
    'platform-type': ['platform'],
    'style-components': ['contentStyle', 'selectedComponents'],
    details: [
      'modelName',
      'modelId',
      'priority',
      'caption',
      'driveLink',
      'contentType',
      'contentLength',
      'contentCount',
      'externalCreatorTags',
      'internalModelTags',
      'pricingCategory',
      'releaseSchedule',
    ],
    schedule: ['releaseSchedule'],
    pricing: ['pricing'],
    files: ['files'],
    review: [],
  };

  const fieldsToCheck = fieldMap[stepId] || [];
  return fieldsToCheck.some((field) => {
    // Handle nested fields like 'releaseSchedule.releaseDate'
    const parts = field.split('.');
    let current: any = errors;

    for (const part of parts) {
      if (!current || !current[part]) return false;
      current = current[part];
    }

    return true;
  });
}

/**
 * Ensure current step is valid after step array changes
 */
export function ensureValidStep(
  currentStep: number,
  steps: WizardStep[]
): number {
  if (currentStep >= steps.length) {
    // If current step is beyond new length, go to last step
    return steps.length - 1;
  }
  return currentStep;
}
