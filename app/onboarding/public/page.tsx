"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
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

// Inline styles for the redesigned multi-step form
const FORM_STYLES = `
  .ob-root {
    min-height: 100vh;
    background: linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: system-ui, -apple-system, sans-serif;
    padding: 24px;
    position: relative;
    overflow: hidden;
  }

  .ob-root::before {
    content: '';
    position: absolute;
    top: -200px; right: -200px;
    width: 600px; height: 600px;
    background: radial-gradient(circle, rgba(247,116,185,0.08) 0%, transparent 70%);
    pointer-events: none;
  }

  .ob-root::after {
    content: '';
    position: absolute;
    bottom: -200px; left: -200px;
    width: 500px; height: 500px;
    background: radial-gradient(circle, rgba(93,195,248,0.06) 0%, transparent 70%);
    pointer-events: none;
  }

  .ob-card {
    background: rgba(255, 255, 255, 0.02);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(247, 116, 185, 0.1);
    border-radius: 16px;
    width: 100%;
    max-width: 680px;
    position: relative;
    overflow: hidden;
    box-shadow: 0 24px 48px rgba(0, 0, 0, 0.4);
  }

  .ob-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent, #F774B9, #5DC3F8, transparent);
  }

  .ob-progress-bar {
    height: 3px;
    background: rgba(255, 255, 255, 0.05);
    position: relative;
    overflow: hidden;
  }

  .ob-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #F774B9, #EC67A1, #5DC3F8);
    transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 0 20px rgba(247, 116, 185, 0.5);
  }

  .ob-steps {
    display: flex;
    justify-content: space-between;
    padding: 28px 40px 0;
    gap: 12px;
  }

  .ob-step-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    opacity: 0.4;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(248, 248, 248, 0.5);
    flex: 1;
    min-width: 0;
  }

  .ob-step-item.active {
    opacity: 1;
    color: #F774B9;
    transform: scale(1.05);
  }

  .ob-step-item.done {
    opacity: 0.8;
    color: #5DC3F8;
  }

  .ob-step-icon {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .ob-step-item.active .ob-step-icon {
    background: rgba(247, 116, 185, 0.15);
    border-color: #F774B9;
    box-shadow: 0 0 20px rgba(247, 116, 185, 0.3);
  }

  .ob-step-item.done .ob-step-icon {
    background: rgba(93, 195, 248, 0.15);
    border-color: #5DC3F8;
  }

  .ob-step-label {
    text-align: center;
    word-break: break-word;
  }

  .ob-body {
    padding: 40px;
    min-height: 500px;
  }

  .ob-header {
    margin-bottom: 32px;
  }

  .ob-eyebrow {
    font-size: 11px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: #F774B9;
    margin-bottom: 12px;
    font-weight: 600;
  }

  .ob-title {
    font-size: 32px;
    font-weight: 600;
    color: #F8F8F8;
    line-height: 1.2;
    margin-bottom: 8px;
    letter-spacing: -0.02em;
  }

  .ob-subtitle {
    font-size: 15px;
    color: rgba(248, 248, 248, 0.6);
    font-weight: 400;
    line-height: 1.6;
  }

  .ob-content {
    animation: obFadeUp 0.4s ease both;
  }

  .ob-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 40px;
    padding-top: 24px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
  }

  .ob-btn {
    background: none;
    border: none;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 14px;
    cursor: pointer;
    padding: 12px 24px;
    border-radius: 8px;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .ob-btn-back {
    color: rgba(248, 248, 248, 0.6);
  }

  .ob-btn-back:hover {
    color: #F8F8F8;
    background: rgba(255, 255, 255, 0.05);
  }

  .ob-btn-next {
    background: linear-gradient(135deg, #F774B9, #EC67A1);
    color: white;
    box-shadow: 0 4px 16px rgba(247, 116, 185, 0.3);
  }

  .ob-btn-next:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 24px rgba(247, 116, 185, 0.4);
  }

  .ob-btn-next:active {
    transform: translateY(0);
  }

  .ob-save-status {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    padding: 8px 16px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.03);
  }

  .ob-save-status.saving { color: rgba(248, 248, 248, 0.6); }
  .ob-save-status.saved { color: #5DC3F8; }

  .ob-save-wrapper {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 12px;
    padding: 12px 40px 0;
  }

  .ob-done {
    text-align: center;
    padding: 40px 0;
  }

  .ob-done-icon {
    width: 80px;
    height: 80px;
    border: 2px solid #5DC3F8;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 24px;
    position: relative;
    background: rgba(93, 195, 248, 0.1);
  }

  .ob-done-icon::before {
    content: '';
    position: absolute;
    inset: -8px;
    border-radius: 50%;
    border: 1px solid rgba(93, 195, 248, 0.2);
  }

  .ob-check {
    width: 32px;
    height: 32px;
    color: #5DC3F8;
  }

  @keyframes obFadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @media (max-width: 768px) {
    .ob-root { padding: 16px; }
    .ob-card { max-width: 100%; }
    .ob-body { padding: 24px; min-height: 400px; }
    .ob-steps { padding: 20px 24px 0; gap: 8px; }
    .ob-step-item { font-size: 9px; }
    .ob-step-icon { width: 28px; height: 28px; }
    .ob-title { font-size: 24px; }
    .ob-footer { flex-direction: column; gap: 12px; }
    .ob-btn-back { order: 2; }
    .ob-btn-next { order: 1; width: 100%; justify-content: center; }
    .ob-save-wrapper { padding: 12px 24px 0; }
    .ob-save-status { font-size: 11px; padding: 6px 12px; }
  }
`;

// Section definitions
const SECTIONS = [
  {
    id: 1,
    title: "Basic Info",
    label: "Basic",
    icon: User,
    eyebrow: "Step 1 of 7",
    description: "Model name, profile image, and basic details",
  },
  {
    id: 2,
    title: "Background & Persona",
    label: "Persona",
    icon: FileText,
    eyebrow: "Step 2 of 7",
    description: "Age, backstory, interests, personality",
  },
  {
    id: 3,
    title: "Content Types",
    label: "Content",
    icon: Sparkles,
    eyebrow: "Step 3 of 7",
    description: "Content types offered",
  },
  {
    id: 4,
    title: "Pricing",
    label: "Pricing",
    icon: DollarSign,
    eyebrow: "Step 4 of 7",
    description: "Platform pricing and services",
  },
  {
    id: 5,
    title: "Content & Restrictions",
    label: "Limits",
    icon: Shield,
    eyebrow: "Step 5 of 7",
    description: "Limits, schedule, and notes",
  },
  {
    id: 6,
    title: "Social Accounts",
    label: "Socials",
    icon: Globe,
    eyebrow: "Step 6 of 7",
    description: "OnlyFans, Instagram, Twitter, etc.",
  },
  {
    id: 7,
    title: "Review & Submit",
    label: "Review",
    icon: CheckCircle2,
    eyebrow: "Final Step",
    description: "Review all details before submission",
  },
];

function PublicOnboardingContent() {
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

        // Check if there's an existing draft for this token
        const draftLoaded = await loadExistingDraft();

        // Pre-fill form data from invitation (only if no draft loaded)
        if (data.invitation.modelName && !draftLoaded) {
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

  const loadExistingDraft = async (): Promise<boolean> => {
    try {
      const response = await fetch(
        `/api/onboarding-public/drafts?token=${token}`,
      );

      if (response.ok) {
        const draft = await response.json();
        if (draft && draft.id) {
          // Load the saved draft data
          setDraftId(draft.id);
          setCurrentStep(draft.currentStep || 1);
          
          // Remove all metadata fields and load only form data
          const {
            id,
            clerkId,
            createdByClerkId,
            organizationId,
            status,
            currentStep,
            completionPercentage,
            invitationId,
            isPublicSubmission,
            submitterIp,
            createdAt,
            updatedAt,
            submittedAt,
            completedAt,
            lastAutoSaveAt,
            reviewStatus,
            reviewedBy,
            reviewedAt,
            rejectionReason,
            createdProfileId,
            ...savedFormData
          } = draft;
          
          setFormData(savedFormData);
          
          toast.success("Previous draft loaded");
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error("Error loading draft:", error);
      // Don't show error to user - it's ok if no draft exists
      return false;
    }
  };

  // Auto-save mechanism
  useEffect(() => {
    if (Object.keys(formData).length === 0 || !tokenValid) return;

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
    if (!token) return;

    setAutoSaving(true);
    try {
      if (!draftId) {
        // Create new draft if it doesn't exist
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

        if (response.ok) {
          const newDraft = await response.json();
          setDraftId(newDraft.id);
          setLastSaved(new Date());
        }
      } else {
        // Update existing draft
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
      }
    } catch (error) {
      console.error("Auto-save failed:", error);
    } finally {
      setAutoSaving(false);
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
      toast.error("Please wait for your progress to be saved");
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

  const currentSection = SECTIONS.find((s) => s.id === currentStep);

  // Loading state
  if (validatingToken) {
    return (
      <>
        <style>{FORM_STYLES}</style>
        <div className="ob-root">
          <div className="ob-card" style={{ maxWidth: "400px" }}>
            <div className="ob-body" style={{ minHeight: "auto", textAlign: "center" }}>
              <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" style={{ color: "#F774B9" }} />
              <p style={{ color: "rgba(248, 248, 248, 0.6)" }}>
                Validating invitation...
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Invalid token state
  if (!tokenValid) {
    return (
      <>
        <style>{FORM_STYLES}</style>
        <div className="ob-root">
          <div className="ob-card" style={{ maxWidth: "480px" }}>
            <div className="ob-body" style={{ minHeight: "auto", textAlign: "center" }}>
              <div className="ob-done-icon" style={{ borderColor: "#E1518E" }}>
                <AlertCircle className="h-8 w-8" style={{ color: "#E1518E" }} />
              </div>
              <h1 className="ob-title">Invalid Invitation Link</h1>
              <p className="ob-subtitle" style={{ marginTop: "16px", marginBottom: "24px" }}>
                {tokenError}
              </p>
              <p style={{ fontSize: "13px", color: "rgba(248, 248, 248, 0.4)" }}>
                Please contact the person who sent you this link for assistance.
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Success state - after submission
  if (currentStep === 8) {
    return (
      <>
        <style>{FORM_STYLES}</style>
        <div className="ob-root">
          <div className="ob-card" style={{ maxWidth: "520px" }}>
            <div className="ob-body ob-done" style={{ minHeight: "auto" }}>
              <div className="ob-done-icon">
                <CheckCircle2 className="ob-check" />
              </div>
              <p className="ob-eyebrow">All set</p>
              <h1 className="ob-title">Application Submitted!</h1>
              <p className="ob-subtitle" style={{ marginTop: "16px", maxWidth: "400px", margin: "16px auto 0" }}>
                Thank you for completing your application. Your information has
                been submitted for review.
              </p>
              <p style={{ fontSize: "13px", color: "rgba(248, 248, 248, 0.4)", marginTop: "24px" }}>
                Our team will review your submission and notify you once your
                profile is approved. This usually takes 1-2 business days.
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Main onboarding form
  return (
    <>
      <style>{FORM_STYLES}</style>
      <div className="ob-root">
        <div className="ob-card">
          {/* Progress Bar */}
          <div className="ob-progress-bar">
            <div
              className="ob-progress-fill"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>

          {/* Step Indicator */}
          <div className="ob-steps">
            {SECTIONS.map((section, index) => {
              const Icon = section.icon;
              const isActive = currentStep === section.id;
              const isCompleted = currentStep > section.id;

              return (
                <div
                  key={section.id}
                  className={`ob-step-item ${
                    isActive ? "active" : isCompleted ? "done" : ""
                  }`}
                >
                  <div className="ob-step-icon">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="ob-step-label">{section.label}</span>
                </div>
              );
            })}
          </div>

          {/* Save Status - Below Steps */}
          <div className="ob-save-wrapper">
            {autoSaving && (
              <div className="ob-save-status saving">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving...</span>
              </div>
            )}
            {lastSaved && !autoSaving && (
              <div className="ob-save-status saved">
                <Clock className="w-4 h-4" />
                <span>Saved {lastSaved.toLocaleTimeString()}</span>
              </div>
            )}
          </div>

          {/* Main Content */}
          <div className="ob-body">
            <div className="ob-header">
              <p className="ob-eyebrow">{currentSection?.eyebrow}</p>
              <h1 className="ob-title">{currentSection?.title}</h1>
              <p className="ob-subtitle">{currentSection?.description}</p>
            </div>

            <div className="ob-content">
              {/* Form Sections */}
              {currentStep === 1 && (
                <BasicInfoSection
                  formData={formData}
                  updateFormData={updateFormData}
                  invitationToken={token || undefined}
                  isPublic={true}
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
            </div>

            {/* Navigation Buttons */}
            <div className="ob-footer">
              <button
                onClick={handlePrevious}
                disabled={currentStep === 1}
                className="ob-btn ob-btn-back"
                style={{
                  opacity: currentStep === 1 ? 0 : 1,
                  pointerEvents: currentStep === 1 ? "none" : "auto"
                }}
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>

              {currentStep < SECTIONS.length && (
                <button onClick={handleNext} className="ob-btn ob-btn-next">
                  {currentStep === SECTIONS.length - 1 ? (
                    <>
                      Submit
                      <Send className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function PublicOnboardingPage() {
  return (
    <Suspense
      fallback={
        <>
          <style>{FORM_STYLES}</style>
          <div className="ob-root">
            <div className="ob-card" style={{ maxWidth: "400px" }}>
              <div className="ob-body" style={{ minHeight: "auto", textAlign: "center" }}>
                <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" style={{ color: "#F774B9" }} />
                <p style={{ color: "rgba(248, 248, 248, 0.6)" }}>Loading...</p>
              </div>
            </div>
          </div>
        </>
      }
    >
      <PublicOnboardingContent />
    </Suspense>
  );
}
