import { prisma } from '@/lib/database';

/**
 * Deduct credits from an organization for using a specific feature
 * @param organizationId - The organization ID
 * @param featureKey - The feature key (e.g., 'seedream_text_to_image')
 * @param userId - Optional user ID for tracking who used the feature
 * @returns Object with success status and remaining credits
 */
export async function deductCredits(
  organizationId: string,
  featureKey: string,
  userId?: string
): Promise<{
  success: boolean;
  remainingCredits?: number;
  error?: string;
  creditsDeducted?: number;
}> {
  try {
    // Get the feature pricing
    const featurePricing = await prisma.featureCreditPricing.findUnique({
      where: {
        featureKey,
        isActive: true,
      },
    });

    if (!featurePricing) {
      return {
        success: false,
        error: `Feature pricing not found for: ${featureKey}`,
      };
    }

    // Get the organization's current credits
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { availableCredits: true },
    });

    if (!organization) {
      return {
        success: false,
        error: 'Organization not found',
      };
    }

    // Check if organization has enough credits
    if (organization.availableCredits < featurePricing.credits) {
      return {
        success: false,
        error: `Insufficient credits. Required: ${featurePricing.credits}, Available: ${organization.availableCredits}`,
      };
    }

    // Deduct credits and track usage
    const updatedOrg = await prisma.organization.update({
      where: { id: organizationId },
      data: {
        availableCredits: {
          decrement: featurePricing.credits,
        },
        creditsUsedThisMonth: {
          increment: featurePricing.credits,
        },
      },
      select: { availableCredits: true },
    });

    // Log the usage
    await prisma.creditUsageLog.create({
      data: {
        organizationId,
        userId: userId || null,
        action: 'FEATURE_USAGE',
        resource: featureKey,
        creditsUsed: featurePricing.credits,
        metadata: {
          featureKey,
          featureName: featurePricing.featureName,
          creditsDeducted: featurePricing.credits,
        },
      },
    });

    return {
      success: true,
      remainingCredits: updatedOrg.availableCredits,
      creditsDeducted: featurePricing.credits,
    };
  } catch (error) {
    console.error('Error deducting credits:', error);
    return {
      success: false,
      error: 'Failed to deduct credits',
    };
  }
}

/**
 * Check if an organization has enough credits for a feature
 * @param organizationId - The organization ID
 * @param featureKey - The feature key
 * @returns Object with check result and required credits
 */
export async function checkCredits(
  organizationId: string,
  featureKey: string
): Promise<{
  hasEnough: boolean;
  required: number;
  available: number;
  error?: string;
}> {
  try {
    const featurePricing = await prisma.featureCreditPricing.findUnique({
      where: {
        featureKey,
        isActive: true,
      },
    });

    if (!featurePricing) {
      return {
        hasEnough: false,
        required: 0,
        available: 0,
        error: `Feature pricing not found for: ${featureKey}`,
      };
    }

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { availableCredits: true },
    });

    if (!organization) {
      return {
        hasEnough: false,
        required: featurePricing.credits,
        available: 0,
        error: 'Organization not found',
      };
    }

    return {
      hasEnough: organization.availableCredits >= featurePricing.credits,
      required: featurePricing.credits,
      available: organization.availableCredits,
    };
  } catch (error) {
    console.error('Error checking credits:', error);
    return {
      hasEnough: false,
      required: 0,
      available: 0,
      error: 'Failed to check credits',
    };
  }
}

/**
 * Get feature pricing information
 * @param featureKey - The feature key
 * @returns Feature pricing details or null
 */
export async function getFeaturePricing(featureKey: string) {
  try {
    return await prisma.featureCreditPricing.findUnique({
      where: {
        featureKey,
        isActive: true,
      },
    });
  } catch (error) {
    console.error('Error getting feature pricing:', error);
    return null;
  }
}
