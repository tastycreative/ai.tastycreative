import { useState, useMemo } from "react";
import { Plus, X, AlertCircle, CheckCircle2 } from "lucide-react";
import { ModelOnboardingDraft } from "@/lib/hooks/useModelOnboarding.query";
import { validateBackground } from "@/lib/validation/onboarding";

interface BackgroundPersonaSectionProps {
  formData: Partial<ModelOnboardingDraft>;
  updateFormData: (updates: Partial<ModelOnboardingDraft>) => void;
}

export default function BackgroundPersonaSection({
  formData,
  updateFormData,
}: BackgroundPersonaSectionProps) {
  const [interestInput, setInterestInput] = useState("");
  const [colorInput, setColorInput] = useState("");
  const [lingoInput, setLingoInput] = useState("");
  const [emojiInput, setEmojiInput] = useState("");
  const [touched, setTouched] = useState({
    backstory: false,
  });

  // Validate fields
  const validation = useMemo(() => validateBackground(formData), [formData]);

  const markTouched = (field: keyof typeof touched) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  // Helper to update modelBible
  const modelBible = (formData.modelBible as any) || {};
  const updateModelBible = (updates: any) => {
    updateFormData({
      modelBible: {
        ...modelBible,
        ...updates,
      },
    });
  };

  const addInterest = () => {
    if (interestInput.trim()) {
      const current = modelBible.interests || [];
      updateModelBible({ interests: [...current, interestInput.trim()] });
      setInterestInput("");
    }
  };

  const removeInterest = (index: number) => {
    const current = modelBible.interests || [];
    updateModelBible({
      interests: current.filter((_: any, i: number) => i !== index),
    });
  };

  const addColor = () => {
    if (colorInput.trim()) {
      const current = modelBible.favoriteColors || [];
      updateModelBible({ favoriteColors: [...current, colorInput.trim()] });
      setColorInput("");
    }
  };

  const removeColor = (index: number) => {
    const current = modelBible.favoriteColors || [];
    updateModelBible({
      favoriteColors: current.filter((_: any, i: number) => i !== index),
    });
  };

  const addLingo = () => {
    if (lingoInput.trim()) {
      const current = modelBible.lingoKeywords || [];
      updateModelBible({ lingoKeywords: [...current, lingoInput.trim()] });
      setLingoInput("");
    }
  };

  const removeLingo = (index: number) => {
    const current = modelBible.lingoKeywords || [];
    updateModelBible({
      lingoKeywords: current.filter((_: any, i: number) => i !== index),
    });
  };

  const addEmoji = () => {
    if (emojiInput.trim()) {
      const current = modelBible.preferredEmojis || [];
      updateModelBible({ preferredEmojis: [...current, emojiInput.trim()] });
      setEmojiInput("");
    }
  };

  const removeEmoji = (index: number) => {
    const current = modelBible.preferredEmojis || [];
    updateModelBible({
      preferredEmojis: current.filter((_: any, i: number) => i !== index),
    });
  };

  return (
    <div className="space-y-6">
      {/* Backstory */}
      <div>
        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
          Background Story
        </label>
        <div className="relative">
          <textarea
            value={formData.backstory || ""}
            onChange={(e) => {
              updateFormData({ backstory: e.target.value });
              markTouched("backstory");
            }}
            onBlur={() => markTouched("backstory")}
            placeholder="Tell us about this model's background, how they got started in content creation, and what makes them unique..."
            rows={5}
            className={`w-full px-4 py-3 bg-white dark:bg-gray-700 border rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 resize-none ${
              touched.backstory &&
              formData.backstory &&
              !validation.backstory.isValid
                ? "border-red-500 focus:ring-red-500"
                : touched.backstory &&
                    formData.backstory &&
                    validation.backstory.isValid
                  ? "border-green-500 focus:ring-green-500"
                  : "border-gray-300 dark:border-gray-600 focus:ring-brand-light-pink"
            }`}
          />
        </div>
        {touched.backstory &&
        formData.backstory &&
        !validation.backstory.isValid ? (
          <p className="text-sm text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            {validation.backstory.error}
          </p>
        ) : (
          <div className="flex items-center justify-between mt-1">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              This helps chatters build authentic conversations
            </p>
            {formData.backstory && (
              <p
                className={`text-sm ${
                  formData.backstory.length >= 20
                    ? "text-green-600 dark:text-green-400"
                    : "text-gray-500 dark:text-gray-400"
                }`}
              >
                {formData.backstory.length} characters{" "}
                {formData.backstory.length >= 20 && "✓"}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Interests & Hobbies */}
      <div>
        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
          Interests & Hobbies
        </label>
        <div className="space-y-3">
          {/* Add Interest Input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={interestInput}
              onChange={(e) => setInterestInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && addInterest()}
              placeholder="e.g., Yoga, Gaming, Travel"
              className="flex-1 px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-light-pink"
            />
            <button
              type="button"
              onClick={addInterest}
              className="px-4 py-3 bg-brand-light-pink text-white rounded-lg hover:bg-brand-mid-pink transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>

          {/* Interest Tags */}
          {modelBible.interests && modelBible.interests.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {modelBible.interests.map((interest: string, index: number) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-brand-light-pink/10 text-brand-dark-pink dark:text-brand-light-pink rounded-lg text-sm"
                >
                  {interest}
                  <button
                    type="button"
                    onClick={() => removeInterest(index)}
                    className="hover:text-red-500 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Add the model's interests to help personalize conversations
        </p>
      </div>

      {/* Personality Description */}
      <div>
        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
          Personality Type
        </label>
        <input
          type="text"
          value={modelBible.personalityDescription || ""}
          onChange={(e) =>
            updateModelBible({ personalityDescription: e.target.value })
          }
          placeholder="e.g., Switch, Flirty, Girl-next-door, Domme"
          className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-light-pink"
        />
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Describe the model's personality or persona type
        </p>
      </div>

      {/* Personality Insight: Dom/Sub */}
      <div>
        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
          Personality Insight
        </label>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          Would you describe yourself as more submissive or dominant?
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { value: "Submissive", label: "Submissive", emoji: "🩷" },
            { value: "Dominant", label: "Dominant", emoji: "👑" },
            { value: "Switch", label: "Switch", emoji: "⚡" },
            { value: "Not sure", label: "Not sure", emoji: "🤔" },
          ].map((option) => {
            const isSelected = modelBible.personalityInsight === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  updateModelBible({ personalityInsight: option.value })
                }
                className={`p-3 rounded-lg border-2 text-center transition-all ${
                  isSelected
                    ? "border-brand-light-pink bg-brand-light-pink/10 text-brand-dark-pink dark:text-brand-light-pink"
                    : "border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-brand-light-pink/50 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                <div className="text-lg mb-0.5">{option.emoji}</div>
                <div className="text-sm font-medium">{option.label}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Favorite Colors */}
      <div>
        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
          Favorite Colors
        </label>
        <div className="space-y-3">
          {/* Add Color Input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={colorInput}
              onChange={(e) => setColorInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && addColor()}
              placeholder="e.g., Pink, Black, White"
              className="flex-1 px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-light-pink"
            />
            <button
              type="button"
              onClick={addColor}
              className="px-4 py-3 bg-brand-light-pink text-white rounded-lg hover:bg-brand-mid-pink transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>

          {/* Color Tags */}
          {modelBible.favoriteColors &&
            modelBible.favoriteColors.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {modelBible.favoriteColors.map(
                  (color: string, index: number) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-brand-light-pink/10 text-brand-dark-pink dark:text-brand-light-pink rounded-lg text-sm"
                    >
                      {color}
                      <button
                        type="button"
                        onClick={() => removeColor(index)}
                        className="hover:text-red-500 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ),
                )}
              </div>
            )}
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Colors the model frequently wears or prefers
        </p>
      </div>

      {/* Lingo & Keywords */}
      <div>
        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
          Lingo & Keywords
        </label>
        <div className="space-y-3">
          {/* Add Lingo Input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={lingoInput}
              onChange={(e) => setLingoInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && addLingo()}
              placeholder="e.g., babe, hun, omg, literally"
              className="flex-1 px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-light-pink"
            />
            <button
              type="button"
              onClick={addLingo}
              className="px-4 py-3 bg-brand-light-pink text-white rounded-lg hover:bg-brand-mid-pink transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>

          {/* Lingo Tags */}
          {modelBible.lingoKeywords && modelBible.lingoKeywords.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {modelBible.lingoKeywords.map(
                (keyword: string, index: number) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-brand-light-pink/10 text-brand-dark-pink dark:text-brand-light-pink rounded-lg text-sm"
                  >
                    {keyword}
                    <button
                      type="button"
                      onClick={() => removeLingo(index)}
                      className="hover:text-red-500 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ),
              )}
            </div>
          )}
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Common words or phrases the model uses
        </p>
      </div>

      {/* Preferred Emojis */}
      <div>
        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
          Preferred Emojis
        </label>
        <div className="space-y-3">
          {/* Add Emoji Input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={emojiInput}
              onChange={(e) => setEmojiInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && addEmoji()}
              placeholder="e.g., 💕 🥰 😘 ✨ 🔥"
              className="flex-1 px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-light-pink"
            />
            <button
              type="button"
              onClick={addEmoji}
              className="px-4 py-3 bg-brand-light-pink text-white rounded-lg hover:bg-brand-mid-pink transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>

          {/* Emoji Tags */}
          {modelBible.preferredEmojis &&
            modelBible.preferredEmojis.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {modelBible.preferredEmojis.map(
                  (emoji: string, index: number) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-2 px-3 py-2 bg-brand-light-pink/10 text-2xl rounded-lg"
                    >
                      {emoji}
                      <button
                        type="button"
                        onClick={() => removeEmoji(index)}
                        className="hover:text-red-500 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ),
                )}
              </div>
            )}
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Emojis the model frequently uses in messages
        </p>
      </div>

      {/* Info Box */}
      <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center text-white text-xs font-bold mt-0.5">
            💡
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-purple-900 dark:text-purple-100 mb-1">
              Persona Tips
            </h4>
            <p className="text-sm text-purple-800 dark:text-purple-200">
              The more detailed the backstory and persona elements, the more
              authentic conversations will be. Include specific details about
              interests, personality, communication style, and preferences.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
