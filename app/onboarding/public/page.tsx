"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Save,
  Send,
  User,
  FileText,
  DollarSign,
  Sparkles,
  Globe,
  CheckCircle2,
  Clock,
  Loader2,
  AlertCircle,
  Shield,
} from "lucide-react";
import { toast } from "sonner";
import {
  validateBasicInfo,
  validateContentTypes,
  isSectionValid,
} from "@/lib/validation/onboarding";
import BasicInfoSection from "@/app/[tenant]/admin/model-onboarding/components/BasicInfoSection";
import BackgroundPersonaSection from "@/app/[tenant]/admin/model-onboarding/components/BackgroundPersonaSection";
import ContentTypesSection from "@/app/[tenant]/admin/model-onboarding/components/ContentTypesSection";
import PricingSection from "@/app/[tenant]/admin/model-onboarding/components/PricingSection";
import ContentRestrictionsSection from "@/app/[tenant]/admin/model-onboarding/components/ContentRestrictionsSection";
import SocialAccountsSection from "@/app/[tenant]/admin/model-onboarding/components/SocialAccountsSection";
import ReviewSubmitSection from "@/app/[tenant]/admin/model-onboarding/components/ReviewSubmitSection";

// Section definitions
const SECTIONS = [
  {
    id: 1,
    title: "Basic Info",
    icon: User,
    description: "Model name, profile image, and basic details",
  },
  {
    id: 2,
    title: "Background & Persona",
    icon: FileText,
    description: "Age, backstory, interests, personality",
  },
  {
    id: 3,
    title: "Content Types",
    icon: Sparkles,
    description: "Content types offered",
  },
  {
    id: 4,
    title: "Pricing",
    icon: DollarSign,
    description: "Platform pricing and services",
  },
  {
    id: 5,
    title: "Content & Restrictions",
    icon: Shield,
    description: "Limits, schedule, and notes",
  },
  {
    id: 6,
    title: "Social Accounts",
    icon: Globe,
    description: "OnlyFans, Instagram, Twitter, etc.",
  },
  {
    id: 7,
    title: "Review & Submit",
    icon: CheckCircle2,
    description: "Review all details before submission",
  },
];

export default function PublicOnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get("token");

  const [validatingToken, setValidatingToken] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [invitationData, setInvitationData] = useState<any>(null);

  const [currentStep, setCurrentStep] = useState(1);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setValidatingToken(false);
      setTokenError("No invitation token provided");
      return;
    }

    validateToken();
  }, [token]);

  const validateToken = async () => {
    try {
      const response = await fetch(
        `/api/onboarding-invitations/validate?token=${token}`,
      );
      const data = await response.json();

      if (data.valid) {
        setTokenValid(true);
        setInvitationData(data.invitation);

        // Pre-fill form data from invitation
        if (data.invitation.modelName) {
          setFormData((prev: any) => ({
            ...prev,
            name: data.invitation.modelName,
          }));
        }
      } else {
        setTokenValid(false);
        setTokenError(data.reason || "Invalid invitation link");
      }
    } catch (error) {
      console.error("Error validating token:", error);
      setTokenError("Failed to validate invitation link");
    } finally {
      setValidatingToken(false);
    }
  };

  // Auto-save mechanism
  useEffect(() => {
    if (!draftId || Object.keys(formData).length === 0 || !tokenValid) return;

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(() => {
      handleAutoSave();
    }, 2000);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [formData, draftId, tokenValid]);

  const handleAutoSave = async () => {
    if (!draftId || !token) return;

    setAutoSaving(true);
    try {
      await fetch(`/api/onboarding-public/drafts/${draftId}?token=${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          currentStep,
          lastAutoSaveAt: new Date().toISOString(),
        }),
      });
      setLastSaved(new Date());
    } catch (error) {
      console.error("Auto-save failed:", error);
    } finally {
      setAutoSaving(false);
    }
  };

  const handleManualSave = async () => {
    if (!draftId) {
      // Create new draft
      try {
        const response = await fetch("/api/onboarding-public/drafts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            ...formData,
            currentStep,
            status: "DRAFT",
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to create draft");
        }

        const newDraft = await response.json();
        setDraftId(newDraft.id);
        toast.success("Draft created successfully");
      } catch (error) {
        toast.error("Failed to create draft");
      }
    } else {
      // Update existing draft
      try {
        await handleAutoSave();
        toast.success("Draft saved successfully");
      } catch (error) {
        toast.error("Failed to save draft");
      }
    }
  };

  const handleNext = () => {
    // Validate current step before allowing navigation
    let canProceed = true;
    let errorMessage = "";

    if (currentStep === 1) {
      const basicValidation = validateBasicInfo(formData);
      canProceed = isSectionValid(basicValidation);
      if (!canProceed) {
        errorMessage = "Please complete all required fields in Basic Info";
      }
    } else if (currentStep === 3) {
      const contentValidation = validateContentTypes({
        selectedContentTypes: formData.selectedContentTypes,
      });
      canProceed = isSectionValid(contentValidation);
      if (!canProceed) {
        errorMessage = "Please select at least one content type";
      }
    }

    if (!canProceed) {
      toast.error(errorMessage);
      return;
    }

    if (currentStep < SECTIONS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (!draftId || !token) {
      toast.error("Please save the draft first");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(
        `/api/onboarding-public/drafts/${draftId}/submit?token=${token}`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Submission failed");
      }

      const result = await response.json();
      toast.success("Application submitted for review!");

      // Show success page
      setCurrentStep(8); // Success state
    } catch (error: any) {
      console.error("Submission error:", error);
      toast.error(error.message || "Failed to submit onboarding");
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateFormData = (updates: any) => {
    setFormData((prev: any) => ({ ...prev, ...updates }));
  };

  const completionPercentage = Math.round(
    (currentStep / SECTIONS.length) * 100,
  );

  // Loading state
  if (validatingToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-brand-light-pink mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">
            Validating invitation...
          </p>
        </div>
      </div>
    );
  }

  // Invalid token state
  if (!tokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/20 mb-4">
              <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Invalid Invitation Link
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {tokenError}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              Please contact the person who sent you this link for assistance.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Success state - after submission
  if (currentStep === 8) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/20 mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Application Submitted!
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Thank you for completing your application. Your information has
              been submitted for review.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              Our team will review your submission and notify you once your
              profile is approved. This usually takes 1-2 business days.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Main onboarding form
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Model Onboarding
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Complete all sections to finish your profile
              </p>
            </div>
            <div className="flex items-center gap-3">
              {autoSaving && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </div>
              )}
              {lastSaved && !autoSaving && (
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <Clock className="w-4 h-4" />
                  <span>Saved {lastSaved.toLocaleTimeString()}</span>
                </div>
              )}
              <button
                onClick={handleManualSave}
                className="flex items-center gap-2 px-4 py-2 bg-brand-light-pink text-white rounded-lg hover:bg-brand-mid-pink transition-colors"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Progress
              </span>
              <span className="text-sm font-medium text-brand-light-pink">
                {completionPercentage}%
              </span>
            </div>
            <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-brand-light-pink to-brand-blue transition-all duration-300"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between overflow-x-auto py-4">
            {SECTIONS.map((section, index) => {
              const Icon = section.icon;
              const isActive = currentStep === section.id;
              const isCompleted = currentStep > section.id;

              return (
                <div
                  key={section.id}
                  className={`flex items-center ${
                    index < SECTIONS.length - 1 ? "flex-1" : ""
                  }`}
                >
                  <div className="flex flex-col items-center">
                    <div
                      className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all ${
                        isActive
                          ? "border-brand-light-pink bg-brand-light-pink text-white"
                          : isCompleted
                            ? "border-green-500 bg-green-500 text-white"
                            : "border-gray-300 dark:border-gray-600 text-gray-400"
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <Icon className="w-5 h-5" />
                      )}
                    </div>
                    <span
                      className={`text-xs mt-1 text-center whitespace-nowrap ${
                        isActive
                          ? "text-brand-light-pink font-semibold"
                          : isCompleted
                            ? "text-green-600 dark:text-green-400"
                            : "text-gray-500 dark:text-gray-400"
                      }`}
                    >
                      {section.title}
                    </span>
                  </div>
                  {index < SECTIONS.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-2 ${
                        isCompleted
                          ? "bg-green-500"
                          : "bg-gray-300 dark:bg-gray-600"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 md:p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {SECTIONS[currentStep - 1]?.title}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {SECTIONS[currentStep - 1]?.description}
            </p>
          </div>

          {/* Form Sections */}
          {currentStep === 1 && (
            <BasicInfoSection
              formData={formData}
              updateFormData={updateFormData}
              invitationToken={token || undefined}
            />
          )}
          {currentStep === 2 && (
            <BackgroundPersonaSection
              formData={formData}
              updateFormData={updateFormData}
            />
          )}
          {currentStep === 3 && (
            <ContentTypesSection
              formData={formData}
              updateFormData={updateFormData}
            />
          )}
          {currentStep === 4 && (
            <PricingSection
              formData={formData}
              updateFormData={updateFormData}
            />
          )}
          {currentStep === 5 && (
            <ContentRestrictionsSection
              formData={formData}
              updateFormData={updateFormData}
            />
          )}
          {currentStep === 6 && (
            <SocialAccountsSection
              formData={formData}
              updateFormData={updateFormData}
            />
          )}
          {currentStep === 7 && (
            <ReviewSubmitSection
              formData={formData}
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
            />
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handlePrevious}
              disabled={currentStep === 1}
              className="flex items-center gap-2 px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="w-4 h-4" />
              Previous
            </button>

            {currentStep < SECTIONS.length && (
              <button
                onClick={handleNext}
                className="flex items-center gap-2 px-6 py-3 bg-brand-light-pink text-white rounded-lg hover:bg-brand-mid-pink transition-colors"
              >
                Next
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
