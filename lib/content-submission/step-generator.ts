import type { FieldErrors } from 'react-hook-form';

export interface WizardStep {
  id: string;
  title: string;
}

/**
 * Dynamic wizard steps for content submissions.
 * Content Style step only shows for OTP_PTR submissions.
 */
export function generateSteps(submissionType?: string): WizardStep[] {
  const steps: WizardStep[] = [
    { id: 'space', title: 'Type & Spaces' },
  ];

  if (!submissionType || submissionType === 'OTP_PTR') {
    steps.push({ id: 'contentStyle', title: 'Content Style' });
  }

  steps.push(
    { id: 'details', title: 'Content Details' },
    { id: 'files', title: 'File Uploads' },
    { id: 'review', title: 'Review & Submit' },
  );

  return steps;
}

/**
 * Check if a step has validation errors
 */
export function stepHasErrors(stepId: string, errors: FieldErrors): boolean {
  const fieldMap: Record<string, string[]> = {
    space: ['workspaceId'],
    contentStyle: [],
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
