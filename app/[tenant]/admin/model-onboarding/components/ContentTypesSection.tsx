import { useState, useMemo, useEffect } from "react";
import { Plus, X, Check, AlertCircle, ShieldAlert, ShieldCheck } from "lucide-react";
import { ModelOnboardingDraft } from "@/lib/hooks/useModelOnboarding.query";
import { validateContentTypes } from "@/lib/validation/onboarding";

interface ContentTypesSectionProps {
  formData: Partial<ModelOnboardingDraft>;
  updateFormData: (updates: Partial<ModelOnboardingDraft>) => void;
}

const DEFAULT_CONTENT_TYPES = [
  "Fully Nude",
  "Dick Rating",
  "JOI",
  "Solo",
  "Squirting",
  "Anal",
  "Cream Pie",
  "BG",
  "BGG",
  "GG",
  "GGG",
  "BBG",
  "Orgy",
  "Livestream",
];

export default function ContentTypesSection({
  formData,
  updateFormData,
}: ContentTypesSectionProps) {
  const [customTypeInput, setCustomTypeInput] = useState("");
  const [touched, setTouched] = useState(false);

  // modelBible helpers
  const modelBible = (formData.modelBible as any) || {};
  const explicitContentOk: boolean | undefined = modelBible.explicitContentOk;
  const updateModelBible = (updates: any) => {
    updateFormData({ modelBible: { ...modelBible, ...updates } });
  };

  // Set default value to true if undefined (on first load)
  useEffect(() => {
    if (explicitContentOk === undefined) {
      updateModelBible({ explicitContentOk: true });
    }
  }, []);

  // Validate fields
  const validation = useMemo(() => validateContentTypes(formData), [formData]);
  const selectedTypes = formData.selectedContentTypes || [];

  const toggleContentType = (type: string) => {
    setTouched(true);
    const current = formData.selectedContentTypes || [];
    if (current.includes(type)) {
      updateFormData({
        selectedContentTypes: current.filter((t) => t !== type),
      });
    } else {
      updateFormData({ selectedContentTypes: [...current, type] });
    }
  };

  const addCustomType = () => {
    if (customTypeInput.trim()) {
      setTouched(true);
      const current = formData.customContentTypes || [];
      if (!current.includes(customTypeInput.trim())) {
        updateFormData({
          customContentTypes: [...current, customTypeInput.trim()],
        });
        // Also auto-select it
        const selected = formData.selectedContentTypes || [];
        updateFormData({
          selectedContentTypes: [...selected, customTypeInput.trim()],
        });
      }
      setCustomTypeInput("");
    }
  };

  const removeCustomType = (type: string) => {
    const custom = formData.customContentTypes || [];
    const selected = formData.selectedContentTypes || [];
    updateFormData({
      customContentTypes: custom.filter((t) => t !== type),
      selectedContentTypes: selected.filter((t) => t !== type),
    });
  };

  const allTypes = [
    ...DEFAULT_CONTENT_TYPES,
    ...(formData.customContentTypes || []),
  ];

  return (
    <div className="space-y-6">
      {/* Explicit Content Comfort Toggle */}
      <div>
        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
          Explicit Content Comfort <span className="text-red-500">*</span>
        </label>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          Are you comfortable creating explicit content for OnlyFans?
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => {
              updateModelBible({ explicitContentOk: true });
              setTouched(true);
            }}
            className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
              explicitContentOk === true
                ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                : "border-gray-200 dark:border-gray-600 hover:border-green-400"
            }`}
          >
            <ShieldCheck
              className={`w-5 h-5 flex-shrink-0 ${
                explicitContentOk === true
                  ? "text-green-600 dark:text-green-400"
                  : "text-gray-400"
              }`}
            />
            <div className="text-left">
              <div
                className={`text-sm font-semibold ${
                  explicitContentOk === true
                    ? "text-green-800 dark:text-green-100"
                    : "text-gray-700 dark:text-gray-300"
                }`}
              >
                Yes, I’m comfortable
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Show all explicit content types
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              updateModelBible({ explicitContentOk: false });
              setTouched(true);
              
              // Auto-deselect default explicit content types when switching to SFW
              const currentSelected = formData.selectedContentTypes || [];
              const nonExplicitTypes = currentSelected.filter(
                type => !DEFAULT_CONTENT_TYPES.includes(type)
              );
              updateFormData({ selectedContentTypes: nonExplicitTypes });
            }}
            className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
              explicitContentOk === false
                ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20"
                : "border-gray-200 dark:border-gray-600 hover:border-amber-400"
            }`}
          >
            <ShieldAlert
              className={`w-5 h-5 flex-shrink-0 ${
                explicitContentOk === false
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-gray-400"
              }`}
            />
            <div className="text-left">
              <div
                className={`text-sm font-semibold ${
                  explicitContentOk === false
                    ? "text-amber-800 dark:text-amber-100"
                    : "text-gray-700 dark:text-gray-300"
                }`}
              >
                No, SFW only
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Lifestyle / non-explicit content
              </div>
            </div>
          </button>
        </div>

        {explicitContentOk === false && (
          <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              ⚠️ You’ve selected SFW only. You can still select lifestyle content types below. Explicit categories are hidden.
            </p>
          </div>
        )}
      </div>

      {/* Content Types Selection */}
      {explicitContentOk !== false && (
      <>
      <div>
        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-3">
          Content Types Offered <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {DEFAULT_CONTENT_TYPES.map((type) => {
            const isSelected = selectedTypes.includes(type);
            return (
              <button
                key={type}
                type="button"
                onClick={() => toggleContentType(type)}
                className={`relative p-3 rounded-lg border-2 transition-all text-left ${
                  isSelected
                    ? "border-brand-light-pink bg-brand-light-pink/10"
                    : "border-gray-300 dark:border-gray-600 hover:border-brand-light-pink/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {type}
                  </span>
                  {isSelected && (
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-light-pink flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Content Types */}
      <div>
        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
          Custom Content Types
        </label>
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={customTypeInput}
              onChange={(e) => setCustomTypeInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && addCustomType()}
              placeholder="Add custom content type..."
              className="flex-1 px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-light-pink"
            />
            <button
              type="button"
              onClick={addCustomType}
              className="px-4 py-3 bg-brand-light-pink text-white rounded-lg hover:bg-brand-mid-pink transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>

          {/* Custom Type Tags */}
          {formData.customContentTypes &&
            formData.customContentTypes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.customContentTypes.map((type) => (
                  <span
                    key={type}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-brand-blue/10 text-brand-blue rounded-lg text-sm"
                  >
                    {type}
                    <button
                      type="button"
                      onClick={() => removeCustomType(type)}
                      className="hover:text-red-500 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          Add any specialized content types not listed above
        </p>
      </div>
      </> )} {/* end explicitContentOk !== false */}

      {/* SFW Only - Custom Content Types */}
      {explicitContentOk === false && (
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
            SFW / Lifestyle Content Types
          </label>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Add custom content types (e.g., fitness, lifestyle, travel, cooking, fashion, etc.)
          </p>
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={customTypeInput}
                onChange={(e) => setCustomTypeInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && addCustomType()}
                placeholder="e.g., Fitness & Wellness, Travel Vlogs, Fashion..."
                className="flex-1 px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-light-pink"
              />
              <button
                type="button"
                onClick={addCustomType}
                className="px-4 py-3 bg-brand-light-pink text-white rounded-lg hover:bg-brand-mid-pink transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>

            {/* Custom Type Tags */}
            {formData.customContentTypes &&
              formData.customContentTypes.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.customContentTypes.map((type) => {
                    const isSelected = selectedTypes.includes(type);
                    return (
                      <div
                        key={type}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all cursor-pointer ${
                          isSelected
                            ? "bg-brand-light-pink/20 text-brand-light-pink border-2 border-brand-light-pink"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-2 border-transparent"
                        }`}
                      >
                        <span 
                          onClick={() => toggleContentType(type)}
                          className="inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          {isSelected && <Check className="w-3 h-3" />}
                          {type}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeCustomType(type);
                          }}
                          className="hover:text-red-500 transition-colors"
                          aria-label={`Remove ${type}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Click on a type to select/deselect it. Custom types are automatically selected when added.
          </p>
        </div>
      )}

      {/* Summary Box */}
      <div
        className={`p-4 border rounded-lg ${
          validation.contentTypes.isValid
            ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
            : touched && !validation.contentTypes.isValid
              ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
              : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 text-2xl">
            {validation.contentTypes.isValid
              ? "✅"
              : touched && !validation.contentTypes.isValid
                ? "⚠️"
                : "✨"}
          </div>
          <div className="flex-1">
            <h4
              className={`text-sm font-semibold mb-1 ${
                validation.contentTypes.isValid
                  ? "text-green-900 dark:text-green-100"
                  : touched && !validation.contentTypes.isValid
                    ? "text-red-900 dark:text-red-100"
                    : "text-blue-900 dark:text-blue-100"
              }`}
            >
              Content Types Selected: {selectedTypes.length}
            </h4>
            {touched && !validation.contentTypes.isValid ? (
              <p className="text-sm text-red-800 dark:text-red-200 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {validation.contentTypes.error}
              </p>
            ) : (
              <p
                className={`text-sm ${
                  validation.contentTypes.isValid
                    ? "text-green-800 dark:text-green-200"
                    : "text-blue-800 dark:text-blue-200"
                }`}
              >
                {selectedTypes.length > 0
                  ? `Selected: ${selectedTypes.slice(0, 5).join(", ")}${
                      selectedTypes.length > 5
                        ? ` and ${selectedTypes.length - 5} more`
                        : ""
                    }`
                  : "Select at least one content type to continue"}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center text-white text-xs font-bold mt-0.5">
            💡
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-100 mb-1">
              About Content Types
            </h4>
            <p className="text-sm text-amber-800 dark:text-amber-200">
              These content types determine what services this model offers and
              help filter relevant captions and gallery content. Select all that
              apply.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
