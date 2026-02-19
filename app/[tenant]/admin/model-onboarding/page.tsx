"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
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
  Shield,
} from "lucide-react";
import { toast } from "sonner";
import {
  useOnboardingDraft,
  useCreateOnboardingDraft,
  useUpdateOnboardingDraft,
  useSubmitOnboardingDraft,
  useOnboardingDrafts,
  ModelOnboardingDraft,
} from "@/lib/hooks/useModelOnboarding.query";
import {
  validateBasicInfo,
  validateContentTypes,
  isSectionValid,
} from "@/lib/validation/onboarding";
import BasicInfoSection from "./components/BasicInfoSection";
import BackgroundPersonaSection from "./components/BackgroundPersonaSection";
import ContentTypesSection from "./components/ContentTypesSection";
import PricingSection from "./components/PricingSection";
import ContentRestrictionsSection from "./components/ContentRestrictionsSection";
import SocialAccountsSection from "./components/SocialAccountsSection";
import ReviewSubmitSection from "./components/ReviewSubmitSection";

// Section definitions matching Google Form structure
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

export default function ModelOnboardingPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { user } = useUser();

  const tenant = params.tenant as string;
  const draftIdFromUrl = searchParams?.get("draftId");

  const [currentStep, setCurrentStep] = useState(1);
  const [draftId, setDraftId] = useState<string | null>(draftIdFromUrl);
  const [formData, setFormData] = useState<Partial<ModelOnboardingDraft>>({});
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { data: draft, isLoading: loadingDraft } = useOnboardingDraft(draftId);
  const { data: drafts } = useOnboardingDrafts();
  const createDraft = useCreateOnboardingDraft();
  const updateDraft = useUpdateOnboardingDraft();
  const submitDraft = useSubmitOnboardingDraft();

  // Load draft data when available
  useEffect(() => {
    if (draft) {
      setFormData(draft);
      setCurrentStep(draft.currentStep || 1);
    }
  }, [draft]);

  // Auto-save mechanism - saves 2 seconds after last change
  useEffect(() => {
    if (!draftId || Object.keys(formData).length === 0) return;

    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Set new timeout for auto-save
    autoSaveTimeoutRef.current = setTimeout(() => {
      handleAutoSave();
    }, 2000);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [formData]);

  const handleAutoSave = async () => {
    if (!draftId) return;

    setAutoSaving(true);
    try {
      await updateDraft.mutateAsync({
        draftId,
        data: {
          ...formData,
          currentStep,
          lastAutoSaveAt: new Date().toISOString(),
        },
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
        const newDraft = await createDraft.mutateAsync({
          ...formData,
          currentStep,
          status: "DRAFT",
        });
        setDraftId(newDraft.id);
        router.push(`/${tenant}/admin/model-onboarding?draftId=${newDraft.id}`);
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
      // Validate basic info
      const basicValidation = validateBasicInfo(formData);
      canProceed = isSectionValid(basicValidation);
      if (!canProceed) {
        errorMessage =
          "Please complete all required fields in Basic Info (Name, Profile Image, Instagram Username, Model Type)";
      }
    } else if (currentStep === 3) {
      // Validate content types
      const contentValidation = validateContentTypes(formData);
      canProceed = isSectionValid(contentValidation);
      if (!canProceed) {
        errorMessage = "Please select at least one content type";
      }
    }
    // Steps 2, 4, 5 are optional, always allow proceeding

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
    if (!draftId) {
      toast.error("Please save the draft first");
      return;
    }

    try {
      const result = await submitDraft.mutateAsync(draftId);
      toast.success("Model onboarded successfully!");
      router.push(`/${tenant}/workspace/my-influencers/${result.profileId}`);
    } catch (error) {
      toast.error("Failed to submit onboarding");
    }
  };

  const updateFormData = (updates: Partial<ModelOnboardingDraft>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const completionPercentage = Math.round(
    (currentStep / SECTIONS.length) * 100,
  );

  if (loadingDraft) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-light-pink" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={() => router.push(`/${tenant}/admin`)}
                className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-brand-light-pink transition-colors mb-3"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Admin</span>
              </button>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Model Onboarding
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Complete all sections to onboard a new model
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
                disabled={createDraft.isPending || updateDraft.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                Save Draft
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

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-12 gap-8">
          {/* Sidebar - Section Navigation */}
          <div className="col-span-3">
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 sticky top-8">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                Sections
              </h3>
              <div className="space-y-2">
                {SECTIONS.map((section) => {
                  const Icon = section.icon;
                  const isActive = section.id === currentStep;
                  const isCompleted = section.id < currentStep;

                  return (
                    <button
                      key={section.id}
                      onClick={() => setCurrentStep(section.id)}
                      className={`w-full flex items-start gap-3 p-3 rounded-lg text-left transition-colors ${
                        isActive
                          ? "bg-brand-light-pink text-white"
                          : isCompleted
                            ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                            : "hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">
                          {section.title}
                        </div>
                        <div
                          className={`text-xs mt-0.5 ${
                            isActive ? "text-white/80" : "text-gray-500"
                          }`}
                        >
                          {section.description}
                        </div>
                      </div>
                      {isCompleted && (
                        <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Form Content */}
          <div className="col-span-9">
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8">
              {/* Section Content based on currentStep */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  {SECTIONS[currentStep - 1].title}
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  {SECTIONS[currentStep - 1].description}
                </p>
              </div>

              {/* Dynamic Form Sections */}
              <div className="space-y-6">
                {currentStep === 1 && (
                  <BasicInfoSection
                    formData={formData}
                    updateFormData={updateFormData}
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
                    isSubmitting={submitDraft.isPending}
                  />
                )}
              </div>

              {/* Navigation Buttons */}
              <div className="flex items-center justify-between mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={handlePrevious}
                  disabled={currentStep === 1}
                  className="flex items-center gap-2 px-6 py-3 text-gray-700 dark:text-gray-300 hover:text-brand-light-pink transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Previous
                </button>

                <div className="flex items-center gap-3">
                  {currentStep === SECTIONS.length ? (
                    <button
                      onClick={handleSubmit}
                      disabled={submitDraft.isPending}
                      className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-brand-light-pink to-brand-blue text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                      Submit & Create Profile
                    </button>
                  ) : (
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
        </div>
      </div>
    </div>
  );
}
