import type { FieldErrors } from 'react-hook-form';

export interface WizardStep {
  id: string;
  title: string;
}

/**
 * Fixed 4-step wizard for content submissions.
 * Space is selected first, which determines the submission type.
 */
export function generateSteps(): WizardStep[] {
  return [
    { id: 'space', title: 'Select Space' },
    { id: 'details', title: 'Content Details' },
    { id: 'files', title: 'File Uploads' },
    { id: 'review', title: 'Review & Submit' },
  ];
}

/**
 * Check if a step has validation errors
 */
export function stepHasErrors(stepId: string, errors: FieldErrors): boolean {
  const fieldMap: Record<string, string[]> = {
    space: ['workspaceId'],
    details: [
      'submissionType',
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
      'metadata',
    ],
    files: ['files'],
    review: [],
  };

  const fieldsToCheck = fieldMap[stepId] || [];
  return fieldsToCheck.some((field) => {
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
    return steps.length - 1;
  }
  return currentStep;
}
