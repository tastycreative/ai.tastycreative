import { useState, useMemo } from "react";
import {
  Eye,
  EyeOff,
  Lock,
  Globe,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { ModelOnboardingDraft } from "@/lib/hooks/useModelOnboarding.query";
import {
  validateUrl,
  validateInstagramUsername,
  validateTwitterUsername,
  validateTikTokUsername,
  validateRedditUsername,
} from "@/lib/validation/onboarding";

interface SocialAccountsSectionProps {
  formData: Partial<ModelOnboardingDraft>;
  updateFormData: (updates: Partial<ModelOnboardingDraft>) => void;
}

const SOCIAL_PLATFORMS = [
  { id: "instagram", label: "Instagram", icon: "📷" },
  { id: "twitter", label: "Twitter/X", icon: "🐦" },
  { id: "tiktok", label: "TikTok", icon: "🎵" },
  { id: "reddit", label: "Reddit", icon: "🤖" },
  { id: "snapchat", label: "Snapchat", icon: "👻" },
  { id: "facebook", label: "Facebook", icon: "📘" },
];

const TWITTER_CONTENT_CATEGORIES = [
  "Fully Nude",
  "Dick Rating",
  "JOI",
  "Solo",
  "Squirting",
  "Anal",
  "BG",
  "BGG",
  "GG",
  "Oral",
  "Lifestyle",
  "Fitness",
  "SFW Only",
];

const ONLYFANS_PLATFORMS = [
  { id: "onlyFansFree", label: "OnlyFans Free", icon: "🆓" },
  { id: "onlyFansPaid", label: "OnlyFans Paid", icon: "💎" },
  { id: "oftv", label: "OFTV", icon: "📺" },
  { id: "fansly", label: "Fansly", icon: "💫" },
];

export default function SocialAccountsSection({
  formData,
  updateFormData,
}: SocialAccountsSectionProps) {
  const [showPasswords, setShowPasswords] = useState<{
    [key: string]: boolean;
  }>({});
  const [touched, setTouched] = useState<{
    [key: string]: boolean;
  }>({});

  const platforms = (formData.platforms as any) || {};
  const socials = (formData.socials as any) || {};
  const oftvInterest = platforms.oftvInterest || "";

  // Validation helpers
  const getValidationForPlatform = (platformId: string, value: string) => {
    if (!value || !touched[`platform-${platformId}`]) return { isValid: true };

    const platformMapping: Record<string, string> = {
      onlyFansFree: "onlyfans",
      onlyFansPaid: "onlyfans",
      oftv: "onlyfans",
      fansly: "fansly",
    };

    return validateUrl(value, platformMapping[platformId]);
  };

  const getValidationForSocial = (platformId: string, handle: string) => {
    if (!handle || !touched[`social-${platformId}`]) return { isValid: true };

    const validators: Record<string, Function> = {
      instagram: validateInstagramUsername,
      twitter: validateTwitterUsername,
      tiktok: validateTikTokUsername,
      reddit: validateRedditUsername,
    };

    const validator = validators[platformId];
    return validator ? validator(handle) : { isValid: true };
  };

  const markTouched = (key: string) => {
    setTouched((prev) => ({ ...prev, [key]: true }));
  };

  const updatePlatform = (platformId: string, value: string) => {
    markTouched(`platform-${platformId}`);
    updateFormData({
      platforms: {
        ...platforms,
        [platformId]: value,
      },
    });
  };

  const updateOftvInterest = (interested: boolean) => {
    updateFormData({
      platforms: {
        ...platforms,
        oftvInterest: interested ? "need_info" : "",
      },
    });
  };

  const updateSocial = (
    platformId: string,
    field: string,
    value: string | boolean | string[],
  ) => {
    if (field === "handle") {
      markTouched(`social-${platformId}`);
    }
    const current = socials[platformId] || {
      handle: "",
      managed: false,
      contentLevel: [],
    };
    updateFormData({
      socials: {
        ...socials,
        [platformId]: {
          ...current,
          [field]: value,
        },
      },
    });
  };

  const togglePasswordVisibility = (platformId: string) => {
    setShowPasswords((prev) => ({
      ...prev,
      [platformId]: !prev[platformId],
    }));
  };

  return (
    <div className="space-y-8">
      {/* OnlyFans & Content Platforms */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Lock className="w-5 h-5 text-brand-light-pink" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Content Platforms
          </h3>
        </div>

        <div className="space-y-4">
          {ONLYFANS_PLATFORMS.map((platform) => {
            const value = platforms[platform.id] || "";
            const validation = getValidationForPlatform(platform.id, value);
            const isTouched = touched[`platform-${platform.id}`];

            return (
              <div
                key={platform.id}
                className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">{platform.icon}</span>
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    {platform.label}
                  </h4>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={value}
                    onChange={(e) =>
                      updatePlatform(platform.id, e.target.value)
                    }
                    onBlur={() => markTouched(`platform-${platform.id}`)}
                    placeholder={`${platform.label} profile URL`}
                    className={`w-full px-4 py-2 pr-12 bg-white dark:bg-gray-700 border rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 ${
                      isTouched && !validation.isValid
                        ? "border-red-500 focus:ring-red-500"
                        : isTouched && validation.isValid && value
                          ? "border-green-500 focus:ring-green-500"
                          : "border-gray-300 dark:border-gray-600 focus:ring-brand-light-pink"
                    }`}
                  />
                  {/* Validation Icon */}
                  {value && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {isTouched && !validation.isValid ? (
                        <AlertCircle className="w-5 h-5 text-red-500" />
                      ) : isTouched && validation.isValid ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      ) : null}
                    </div>
                  )}
                </div>
                {isTouched && !validation.isValid && validation.error && (
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {validation.error}
                  </p>
                )}

                {/* OFTV Interest Checkbox */}
                {platform.id === "oftv" && (
                  <div className="mt-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={oftvInterest === "need_info"}
                        onChange={(e) => updateOftvInterest(e.target.checked)}
                        className="w-4 h-4 text-brand-light-pink bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-brand-light-pink"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Interested in OFTV but needs more information
                      </span>
                    </label>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* OFTV Interest Notice */}
        {oftvInterest === "need_info" && !platforms.oftv && (
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 text-2xl">📺</div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">
                  OFTV Interest
                </h4>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Model is interested in OFTV and needs more information about
                  the platform.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* OFTV Ideas */}
        {(oftvInterest === "need_info" || platforms.oftvIdeas) && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              📺 What OFTV ideas would you be interested in filming?
            </label>
            <textarea
              value={platforms.oftvIdeas || ""}
              onChange={(e) =>
                updateFormData({
                  platforms: { ...platforms, oftvIdeas: e.target.value },
                })
              }
              placeholder="Describe the type of content or ideas you'd like to create for OFTV..."
              rows={3}
              className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-light-pink resize-none"
            />
          </div>
        )}
      </div>

      {/* Social Media Accounts */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-5 h-5 text-brand-blue" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Social Media Accounts
          </h3>
        </div>

        <div className="space-y-4">
          {SOCIAL_PLATFORMS.map((platform) => {
            const social = socials[platform.id] || {
              handle: "",
              managed: false,
              contentLevel: [],
            };
            const handleValidation = getValidationForSocial(
              platform.id,
              social.handle || "",
            );
            const isHandleTouched = touched[`social-${platform.id}`];

            return (
              <div
                key={platform.id}
                className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">{platform.icon}</span>
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    {platform.label}
                  </h4>
                </div>

                <div className="space-y-3">
                  {/* Handle/Username */}
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                      Username/Handle
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 z-10">
                        @
                      </span>
                      <input
                        type="text"
                        value={social.handle || ""}
                        onChange={(e) =>
                          updateSocial(platform.id, "handle", e.target.value)
                        }
                        onBlur={() => markTouched(`social-${platform.id}`)}
                        placeholder="username"
                        className={`w-full pl-8 pr-12 py-2 bg-white dark:bg-gray-700 border rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 ${
                          isHandleTouched &&
                          social.handle &&
                          !handleValidation.isValid
                            ? "border-red-500 focus:ring-red-500"
                            : isHandleTouched &&
                                social.handle &&
                                handleValidation.isValid
                              ? "border-green-500 focus:ring-green-500"
                              : "border-gray-300 dark:border-gray-600 focus:ring-brand-light-pink"
                        }`}
                      />
                      {/* Validation Icon */}
                      {social.handle && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          {isHandleTouched && !handleValidation.isValid ? (
                            <AlertCircle className="w-5 h-5 text-red-500" />
                          ) : isHandleTouched && handleValidation.isValid ? (
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                          ) : null}
                        </div>
                      )}
                    </div>
                    {isHandleTouched &&
                      social.handle &&
                      !handleValidation.isValid &&
                      handleValidation.error && (
                        <p className="text-sm text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-4 h-4" />
                          {handleValidation.error}
                        </p>
                      )}
                  </div>

                  {/* Managed Toggle */}
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id={`${platform.id}-managed`}
                      checked={social.managed || false}
                      onChange={(e) =>
                        updateSocial(platform.id, "managed", e.target.checked)
                      }
                      className="w-4 h-4 text-brand-light-pink bg-gray-100 border-gray-300 rounded focus:ring-brand-light-pink"
                    />
                    <label
                      htmlFor={`${platform.id}-managed`}
                      className="text-sm font-medium text-gray-900 dark:text-white"
                    >
                      We manage this account
                    </label>
                  </div>

                  {/* Content Level (only if managed) */}
                  {social.managed && (
                    <div>
                      <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                        Content Level
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {["SFW", "Suggestive", "NSFW"].map((level) => {
                          const isSelected =
                            social.contentLevel?.includes(level) || false;
                          return (
                            <button
                              key={level}
                              type="button"
                              onClick={() => {
                                const current = social.contentLevel || [];
                                const updated = isSelected
                                  ? current.filter((l: string) => l !== level)
                                  : [...current, level];
                                updateSocial(
                                  platform.id,
                                  "contentLevel",
                                  updated,
                                );
                              }}
                              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                                isSelected
                                  ? "bg-brand-light-pink text-white"
                                  : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                              }`}
                            >
                              {level}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Twitter Content Categories (only for Twitter when handle is present) */}
                  {platform.id === "twitter" && social.handle && (
                    <div>
                      <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                        Twitter Content Categories{" "}
                        <span className="text-gray-400">(select all that apply)</span>
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {TWITTER_CONTENT_CATEGORIES.map((category) => {
                          const currentCategories: string[] =
                            social.contentCategories || [];
                          const isSelected = currentCategories.includes(category);
                          return (
                            <button
                              key={category}
                              type="button"
                              onClick={() => {
                                const updated = isSelected
                                  ? currentCategories.filter(
                                      (c: string) => c !== category,
                                    )
                                  : [...currentCategories, category];
                                updateSocial(
                                  platform.id,
                                  "contentCategories",
                                  updated,
                                );
                              }}
                              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                                isSelected
                                  ? "bg-brand-dark-pink text-white"
                                  : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                              }`}
                            >
                              {category}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Other Social Media */}
        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            🌐 Other Social Media Accounts
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Any other platforms not listed above (e.g. Pinterest, YouTube,
            Twitch, etc.)
          </p>
          <textarea
            value={socials.otherSocials || ""}
            onChange={(e) =>
              updateFormData({
                socials: { ...socials, otherSocials: e.target.value },
              })
            }
            placeholder="List any other social media accounts (platform + handle, one per line)..."
            rows={3}
            className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue resize-none"
          />
        </div>
      </div>

      {/* Security Notice */}
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <div className="flex items-start gap-3">
          <Lock className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-red-900 dark:text-red-100 mb-1">
              Security Notice
            </h4>
            <p className="text-sm text-red-800 dark:text-red-200">
              All account credentials are encrypted and stored securely. Only
              authorized team members with proper permissions can access this
              information. Never share credentials outside of this secure
              system.
            </p>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 text-2xl">🔐</div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">
              Account Access
            </h4>
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Fill in the accounts that are relevant to this model's presence.
              Mark accounts as "managed" if your team has posting access.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
