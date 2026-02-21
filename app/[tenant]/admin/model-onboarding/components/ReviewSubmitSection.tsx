import { CheckCircle2, AlertCircle, Send } from "lucide-react";
import { ModelOnboardingDraft } from "@/lib/hooks/useModelOnboarding.query";
import {
  validateBasicInfo,
  validateBackground,
  validateContentTypes,
  isSectionValid,
} from "@/lib/validation/onboarding";

interface ReviewSubmitSectionProps {
  formData: Partial<ModelOnboardingDraft>;
  onSubmit: () => void;
  isSubmitting: boolean;
}

export default function ReviewSubmitSection({
  formData,
  onSubmit,
  isSubmitting,
}: ReviewSubmitSectionProps) {
  // Run validation
  const basicInfoValidation = validateBasicInfo(formData);
  const backgroundValidation = validateBackground(formData);
  const contentValidation = validateContentTypes(formData);

  const modelBible = (formData.modelBible as any) || {};
  const restrictions = modelBible.restrictions || {};
  const schedule = modelBible.schedule || {};

  // Check pricing per platform
  const platformPricing = (formData.platformPricing as any) || {};
  const platforms = (formData.platforms as any) || {};
  const socials = (formData.socials as any) || {};

  const hasPlatformAccount = (platformId: string) => {
    // Check if they have this platform account
    return !!(platforms[platformId] || socials[platformId]);
  };

  const hasPlatformPricing = (platformId: string) => {
    const pricing = platformPricing[platformId];
    if (!pricing) return false;
    // Check if any pricing data exists
    return !!(
      pricing.massMessage?.min ||
      pricing.massMessage?.general ||
      pricing.customVideo?.perMin ||
      pricing.videoCall?.perMin ||
      pricing.privateLive?.perMin ||
      Object.keys(pricing.contentMinimums || {}).length > 0 ||
      Object.keys(pricing.otherServices || {}).length > 0
    );
  };

  // Validation checks
  const checks = {
    basicInfo: {
      name: basicInfoValidation.name.isValid,
      profileImage: basicInfoValidation.profileImageUrl.isValid,
      instagramUsername: basicInfoValidation.instagramUsername.isValid,
      type: basicInfoValidation.type.isValid,
    },
    background: {
      hasBackstory: !!formData.backstory?.trim(),
      hasInterests: (modelBible.interests?.length || 0) > 0,
      backstoryValid: backgroundValidation.backstory.isValid,
    },
    content: {
      hasContentTypes: contentValidation.contentTypes.isValid,
      hasNiche: !!formData.primaryNiche?.trim(),
    },
    pricing: {
      of_free: hasPlatformPricing('of_free'),
      of_paid: hasPlatformPricing('of_paid'),
      oftv: hasPlatformPricing('oftv'),
      fansly: hasPlatformPricing('fansly'),
    },
    contentRestrictions: {
      hasRestrictions: !!(
        restrictions.contentLimitations ||
        restrictions.wallRestrictions ||
        restrictions.mmExclusions ||
        (restrictions.wordingToAvoid?.length || 0) > 0 ||
        restrictions.customsToAvoid
      ),
      hasSchedule: !!(
        (schedule.livestreamDays?.length || 0) > 0 ||
        (schedule.videoCallDays?.length || 0) > 0 ||
        schedule.videoCallPlatform ||
        schedule.bundleClipsOk
      ),
      hasInternalNotes: !!(modelBible.internalNotes?.trim()),
    },
    socials: {
      hasPlatforms: !!formData.platforms || !!formData.socials,
    },
  };

  const allBasicRequired = isSectionValid(basicInfoValidation);
  const hasContentTypes = checks.content.hasContentTypes;

  const canSubmit = allBasicRequired && hasContentTypes;

  const completionStats = {
    total: 0,
    completed: 0,
  };

  // Calculate completion
  Object.values(checks).forEach((section) => {
    Object.values(section).forEach((check) => {
      completionStats.total++;
      if (check) completionStats.completed++;
    });
  });

  const completionPercentage = Math.round(
    (completionStats.completed / completionStats.total) * 100,
  );

  return (
    <div className="space-y-6">
      {/* Completion Overview */}
      <div className="p-6 bg-gradient-to-br from-brand-light-pink/10 via-brand-blue/10 to-brand-dark-pink/10 rounded-lg border-2 border-brand-light-pink/30">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
            Onboarding Progress
          </h3>
          <div className="text-3xl font-bold text-brand-light-pink">
            {completionPercentage}%
          </div>
        </div>
        <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-brand-light-pink to-brand-blue transition-all duration-300"
            style={{ width: `${completionPercentage}%` }}
          />
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
          {completionStats.completed} of {completionStats.total} fields
          completed
        </p>
      </div>

      {/* Section Checklist */}
      <div className="space-y-4">
        {/* Basic Info */}
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-3">
            <div
              className={`flex items-center justify-center w-6 h-6 rounded-full ${
                allBasicRequired
                  ? "bg-green-500"
                  : "bg-gray-300 dark:bg-gray-600"
              }`}
            >
              {allBasicRequired && (
                <CheckCircle2 className="w-4 h-4 text-white" />
              )}
            </div>
            <h4 className="font-semibold text-gray-900 dark:text-white">
              1. Basic Info {allBasicRequired && "✓"}
            </h4>
          </div>
          <ul className="space-y-1 ml-9">
            <li
              className={`text-sm ${
                checks.basicInfo.name
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {checks.basicInfo.name ? "✓" : "✗"} Model Name
              {!checks.basicInfo.name && basicInfoValidation.name.error && (
                <span className="text-xs block ml-4 mt-0.5">
                  ({basicInfoValidation.name.error})
                </span>
              )}
            </li>
            <li
              className={`text-sm ${
                checks.basicInfo.profileImage
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {checks.basicInfo.profileImage ? "✓" : "✗"} Profile Image
            </li>
            <li
              className={`text-sm ${
                checks.basicInfo.instagramUsername
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {checks.basicInfo.instagramUsername ? "✓" : "✗"} Instagram
              Username
              {!checks.basicInfo.instagramUsername &&
                basicInfoValidation.instagramUsername.error && (
                  <span className="text-xs block ml-4 mt-0.5">
                    ({basicInfoValidation.instagramUsername.error})
                  </span>
                )}
            </li>
            <li
              className={`text-sm ${
                checks.basicInfo.type
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {checks.basicInfo.type ? "✓" : "✗"} Model Type
            </li>
          </ul>
        </div>

        {/* Background */}
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-3">
            <div
              className={`flex items-center justify-center w-6 h-6 rounded-full ${
                checks.background.hasBackstory && checks.background.hasInterests
                  ? "bg-green-500"
                  : "bg-yellow-500"
              }`}
            >
              {checks.background.hasBackstory &&
                checks.background.hasInterests && (
                  <CheckCircle2 className="w-4 h-4 text-white" />
                )}
            </div>
            <h4 className="font-semibold text-gray-900 dark:text-white">
              2. Background & Persona (Optional but Recommended)
            </h4>
          </div>
          <ul className="space-y-1 ml-9">
            <li
              className={`text-sm ${
                checks.background.hasBackstory
                  ? "text-green-600 dark:text-green-400"
                  : "text-gray-500"
              }`}
            >
              {checks.background.hasBackstory ? "✓" : "○"} Backstory
            </li>
            <li
              className={`text-sm ${
                checks.background.hasInterests
                  ? "text-green-600 dark:text-green-400"
                  : "text-gray-500"
              }`}
            >
              {checks.background.hasInterests ? "✓" : "○"} Interests (
              {modelBible.interests?.length || 0})
            </li>
          </ul>
        </div>

        {/* Content */}
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-3">
            <div
              className={`flex items-center justify-center w-6 h-6 rounded-full ${
                hasContentTypes
                  ? "bg-green-500"
                  : "bg-gray-300 dark:bg-gray-600"
              }`}
            >
              {hasContentTypes && (
                <CheckCircle2 className="w-4 h-4 text-white" />
              )}
            </div>
            <h4 className="font-semibold text-gray-900 dark:text-white">
              3. Content Types {hasContentTypes && "✓"}
            </h4>
          </div>
          <ul className="space-y-1 ml-9">
            <li
              className={`text-sm ${
                checks.content.hasContentTypes
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {checks.content.hasContentTypes ? "✓" : "✗"} Content Types (
              {formData.selectedContentTypes?.length || 0})
            </li>
            <li
              className={`text-sm ${
                checks.content.hasNiche
                  ? "text-green-600 dark:text-green-400"
                  : "text-gray-500"
              }`}
            >
              {checks.content.hasNiche ? "✓" : "○"} Primary Niche
            </li>
          </ul>
        </div>

        {/* Pricing */}
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-3">
            <div
              className={`flex items-center justify-center w-6 h-6 rounded-full ${
                Object.values(checks.pricing).some((v) => v)
                  ? "bg-green-500"
                  : "bg-yellow-500"
              }`}
            >
              {Object.values(checks.pricing).some((v) => v) && (
                <CheckCircle2 className="w-4 h-4 text-white" />
              )}
            </div>
            <h4 className="font-semibold text-gray-900 dark:text-white">
              4. Pricing (Optional)
            </h4>
          </div>
          <ul className="space-y-1 ml-9">
            <li
              className={`text-sm ${
                checks.pricing.of_free
                  ? "text-green-600 dark:text-green-400"
                  : "text-gray-500"
              }`}
            >
              {checks.pricing.of_free ? "✓" : "○"} OnlyFans Free
              {!hasPlatformAccount('of_free') && (
                <span className="text-xs text-gray-400 ml-1">
                  (no account linked)
                </span>
              )}
            </li>
            <li
              className={`text-sm ${
                checks.pricing.of_paid
                  ? "text-green-600 dark:text-green-400"
                  : "text-gray-500"
              }`}
            >
              {checks.pricing.of_paid ? "✓" : "○"} OnlyFans Paid
              {!hasPlatformAccount('of_paid') && (
                <span className="text-xs text-gray-400 ml-1">
                  (no account linked)
                </span>
              )}
            </li>
            <li
              className={`text-sm ${
                checks.pricing.oftv
                  ? "text-green-600 dark:text-green-400"
                  : "text-gray-500"
              }`}
            >
              {checks.pricing.oftv ? "✓" : "○"} OFTV
              {!hasPlatformAccount('oftv') && (
                <span className="text-xs text-gray-400 ml-1">
                  (no account linked)
                </span>
              )}
            </li>
            <li
              className={`text-sm ${
                checks.pricing.fansly
                  ? "text-green-600 dark:text-green-400"
                  : "text-gray-500"
              }`}
            >
              {checks.pricing.fansly ? "✓" : "○"} Fansly
              {!hasPlatformAccount('fansly') && (
                <span className="text-xs text-gray-400 ml-1">
                  (no account linked)
                </span>
              )}
            </li>
          </ul>
        </div>

        {/* Content & Restrictions */}
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-3">
            <div
              className={`flex items-center justify-center w-6 h-6 rounded-full ${
                checks.contentRestrictions.hasRestrictions ||
                checks.contentRestrictions.hasSchedule ||
                checks.contentRestrictions.hasInternalNotes
                  ? "bg-green-500"
                  : "bg-yellow-500"
              }`}
            >
              {(checks.contentRestrictions.hasRestrictions ||
                checks.contentRestrictions.hasSchedule ||
                checks.contentRestrictions.hasInternalNotes) && (
                <CheckCircle2 className="w-4 h-4 text-white" />
              )}
            </div>
            <h4 className="font-semibold text-gray-900 dark:text-white">
              5. Content & Restrictions (Optional)
            </h4>
          </div>
          <ul className="space-y-1 ml-9">
            <li
              className={`text-sm ${
                checks.contentRestrictions.hasRestrictions
                  ? "text-green-600 dark:text-green-400"
                  : "text-gray-500"
              }`}
            >
              {checks.contentRestrictions.hasRestrictions ? "✓" : "○"}{" "}
              Restrictions & Limits
            </li>
            <li
              className={`text-sm ${
                checks.contentRestrictions.hasSchedule
                  ? "text-green-600 dark:text-green-400"
                  : "text-gray-500"
              }`}
            >
              {checks.contentRestrictions.hasSchedule ? "✓" : "○"} Schedule &
              Availability
            </li>
            <li
              className={`text-sm ${
                checks.contentRestrictions.hasInternalNotes
                  ? "text-green-600 dark:text-green-400"
                  : "text-gray-500"
              }`}
            >
              {checks.contentRestrictions.hasInternalNotes ? "✓" : "○"}{" "}
              Internal Notes
            </li>
          </ul>
        </div>

        {/* Social Accounts */}
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-3">
            <div
              className={`flex items-center justify-center w-6 h-6 rounded-full ${
                checks.socials.hasPlatforms ? "bg-green-500" : "bg-yellow-500"
              }`}
            >
              {checks.socials.hasPlatforms && (
                <CheckCircle2 className="w-4 h-4 text-white" />
              )}
            </div>
            <h4 className="font-semibold text-gray-900 dark:text-white">
              6. Social Accounts (Optional)
            </h4>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 ml-9">
            {checks.socials.hasPlatforms
              ? "✓ Platform accounts configured"
              : "○ No accounts configured yet"}
          </p>
        </div>
      </div>

      {/* Submission Status */}
      {!canSubmit && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-red-900 dark:text-red-100 mb-1">
                Required Fields Missing
              </h4>
              <p className="text-sm text-red-800 dark:text-red-200">
                Please complete all required fields before submitting:
              </p>
              <ul className="list-disc list-inside text-sm text-red-800 dark:text-red-200 mt-2">
                {!checks.basicInfo.name && <li>Model Name</li>}
                {!checks.basicInfo.profileImage && <li>Profile Image</li>}
                {!checks.basicInfo.instagramUsername && (
                  <li>Instagram Username (valid format)</li>
                )}
                {!checks.basicInfo.type && <li>Model Type</li>}
                {!checks.content.hasContentTypes && (
                  <li>At least one Content Type</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <div className="flex items-center justify-center pt-6">
        <button
          onClick={onSubmit}
          disabled={!canSubmit || isSubmitting}
          className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-brand-light-pink to-brand-blue text-white rounded-lg font-semibold text-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
        >
          <Send className="w-5 h-5" />
          {isSubmitting ? "Creating Profile..." : "Submit & Create Profile"}
        </button>
      </div>

      {canSubmit && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-green-900 dark:text-green-100 mb-1">
                Ready to Submit!
              </h4>
              <p className="text-sm text-green-800 dark:text-green-200">
                All required fields are complete. Click the button above to
                create the model profile. You can still edit the profile after
                creation.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
