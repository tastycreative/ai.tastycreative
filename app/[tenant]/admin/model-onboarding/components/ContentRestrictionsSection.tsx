import { useState } from "react";
import { Shield, Calendar, Clock, X, Plus } from "lucide-react";
import { ModelOnboardingDraft } from "@/lib/hooks/useModelOnboarding.query";

interface ContentRestrictionsSectionProps {
  formData: Partial<ModelOnboardingDraft>;
  updateFormData: (updates: Partial<ModelOnboardingDraft>) => void;
}

interface RestrictionsData {
  contentLimitations?: string;
  wallRestrictions?: string;
  mmExclusions?: string;
  wordingToAvoid?: string[];
  customsToAvoid?: string;
}

interface ScheduleData {
  livestreamSchedule?: string;
  livestreamDays?: string[];
  livestreamTimes?: { [day: string]: { from: string; to: string } };
  videoCallSchedule?: string;
  videoCallDays?: string[];
  videoCallTimes?: { [day: string]: { from: string; to: string } };
  videoCallPlatform?: string;
  bundleClipsOk?: boolean;
}

export default function ContentRestrictionsSection({
  formData,
  updateFormData,
}: ContentRestrictionsSectionProps) {
  const [newWordingItem, setNewWordingItem] = useState("");

  // Get modelBible data or initialize
  const modelBible = (formData.modelBible as any) || {};
  const restrictions: RestrictionsData = modelBible.restrictions || {};
  const schedule: ScheduleData = modelBible.schedule || {};
  const internalNotes = modelBible.internalNotes || "";

  const updateRestrictions = (updates: Partial<RestrictionsData>) => {
    updateFormData({
      modelBible: {
        ...modelBible,
        restrictions: { ...restrictions, ...updates },
      },
    });
  };

  const updateSchedule = (updates: Partial<ScheduleData>) => {
    updateFormData({
      modelBible: {
        ...modelBible,
        schedule: { ...schedule, ...updates },
      },
    });
  };

  const updateInternalNotes = (notes: string) => {
    updateFormData({
      modelBible: {
        ...modelBible,
        internalNotes: notes,
      },
    });
  };

  const addWordingToAvoid = () => {
    if (!newWordingItem.trim()) return;
    const currentWording = restrictions.wordingToAvoid || [];
    if (!currentWording.includes(newWordingItem.trim())) {
      updateRestrictions({
        wordingToAvoid: [...currentWording, newWordingItem.trim()],
      });
    }
    setNewWordingItem("");
  };

  const removeWordingToAvoid = (word: string) => {
    const currentWording = restrictions.wordingToAvoid || [];
    updateRestrictions({
      wordingToAvoid: currentWording.filter((w) => w !== word),
    });
  };

  return (
    <div className="space-y-6">
      {/* Restrictions & Limits Card */}
      <div className="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-red-500" />
          Restrictions & Limits
        </h3>

        <div className="space-y-5">
          {/* Content Limitations */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Content Limitations
            </label>
            <textarea
              value={restrictions.contentLimitations || ""}
              onChange={(e) =>
                updateRestrictions({ contentLimitations: e.target.value })
              }
              placeholder="e.g., No face in BG content. No anal."
              rows={2}
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white resize-none"
            />
          </div>

          {/* Wall Restrictions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Wall Restrictions
            </label>
            <textarea
              value={restrictions.wallRestrictions || ""}
              onChange={(e) =>
                updateRestrictions({ wallRestrictions: e.target.value })
              }
              placeholder="e.g., No full nudes on wall. Lingerie/implied only."
              rows={2}
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white resize-none"
            />
          </div>

          {/* Mass Message Exclusions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Mass Message Exclusions
            </label>
            <textarea
              value={restrictions.mmExclusions || ""}
              onChange={(e) =>
                updateRestrictions({ mmExclusions: e.target.value })
              }
              placeholder="e.g., No dick pics in mass messages"
              rows={2}
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white resize-none"
            />
          </div>

          {/* Wording to Avoid */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Wording to Avoid
            </label>

            {/* Display existing words */}
            {(restrictions.wordingToAvoid || []).length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {restrictions.wordingToAvoid?.map((word) => (
                  <span
                    key={word}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded text-sm"
                  >
                    {word}
                    <button
                      type="button"
                      onClick={() => removeWordingToAvoid(word)}
                      className="ml-1 hover:text-red-900 dark:hover:text-red-100"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Add new word input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newWordingItem}
                onChange={(e) => setNewWordingItem(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && (e.preventDefault(), addWordingToAvoid())
                }
                placeholder="Add word or phrase to avoid..."
                className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white"
              />
              <button
                type="button"
                onClick={addWordingToAvoid}
                className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Press Enter or click + to add
            </p>
          </div>

          {/* Customs to Avoid */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Customs to Avoid
            </label>
            <textarea
              value={restrictions.customsToAvoid || ""}
              onChange={(e) =>
                updateRestrictions({ customsToAvoid: e.target.value })
              }
              placeholder="e.g., No race play, no degradation, no family roleplay"
              rows={2}
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white resize-none"
            />
          </div>
        </div>
      </div>

      {/* Schedule & Availability Card */}
      <div className="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-brand-blue" />
          Schedule &amp; Availability
        </h3>

        <div className="space-y-6">
          {/* Livestream Schedule */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Livestream Schedule (OnlyFans)
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              If open to livestreaming, select the best days and time range for your schedule.
            </p>

            {/* Day Selector */}
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Best Days</p>
              <div className="flex flex-wrap gap-2">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => {
                  const selected = (schedule.livestreamDays || []).includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => {
                        const current = schedule.livestreamDays || [];
                        const newDays = selected
                          ? current.filter((d) => d !== day)
                          : [...current, day];
                        
                        // Clean up times for removed days
                        if (selected && schedule.livestreamTimes) {
                          const newTimes = { ...schedule.livestreamTimes };
                          delete newTimes[day];
                          updateSchedule({
                            livestreamDays: newDays,
                            livestreamTimes: newTimes,
                          });
                        } else {
                          updateSchedule({ livestreamDays: newDays });
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        selected
                          ? "bg-brand-blue text-white border-2 border-brand-blue"
                          : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-2 border-gray-200 dark:border-gray-600 hover:border-brand-blue/50"
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time Range for each selected day */}
            {(schedule.livestreamDays || []).length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Time for each day</p>
                {schedule.livestreamDays?.map((day) => {
                  const dayTime = schedule.livestreamTimes?.[day] || { from: "", to: "" };
                  return (
                    <div key={day} className="grid grid-cols-[60px_1fr_1fr] gap-2 items-center">
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{day}</span>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                        <input
                          type="time"
                          value={dayTime.from}
                          onChange={(e) => {
                            const newTimes = {
                              ...(schedule.livestreamTimes || {}),
                              [day]: { ...dayTime, from: e.target.value },
                            };
                            updateSchedule({ livestreamTimes: newTimes });
                          }}
                          className="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white"
                        />
                      </div>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                        <input
                          type="time"
                          value={dayTime.to}
                          onChange={(e) => {
                            const newTimes = {
                              ...(schedule.livestreamTimes || {}),
                              [day]: { ...dayTime, to: e.target.value },
                            };
                            updateSchedule({ livestreamTimes: newTimes });
                          }}
                          className="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Video Call Schedule */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Video Call Schedule
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Specify one preferred day, time range, and which platform you prefer to video call on.
            </p>

            {/* Platform Preference */}
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Preferred Platform</p>
              <div className="flex flex-wrap gap-2">
                {["Skype", "Zoom", "Snapchat", "Other"].map((platform) => {
                  const selected = schedule.videoCallPlatform === platform;
                  return (
                    <button
                      key={platform}
                      type="button"
                      onClick={() => updateSchedule({ videoCallPlatform: platform })}
                      className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        selected
                          ? "bg-brand-light-pink text-white border-2 border-brand-light-pink"
                          : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-2 border-gray-200 dark:border-gray-600 hover:border-brand-light-pink/50"
                      }`}
                    >
                      {platform}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Day Selector */}
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Best Days</p>
              <div className="flex flex-wrap gap-2">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => {
                  const selected = (schedule.videoCallDays || []).includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => {
                        const current = schedule.videoCallDays || [];
                        const newDays = selected
                          ? current.filter((d) => d !== day)
                          : [...current, day];
                        
                        // Clean up times for removed days
                        if (selected && schedule.videoCallTimes) {
                          const newTimes = { ...schedule.videoCallTimes };
                          delete newTimes[day];
                          updateSchedule({
                            videoCallDays: newDays,
                            videoCallTimes: newTimes,
                          });
                        } else {
                          updateSchedule({ videoCallDays: newDays });
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        selected
                          ? "bg-brand-mid-pink text-white border-2 border-brand-mid-pink"
                          : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-2 border-gray-200 dark:border-gray-600 hover:border-brand-mid-pink/50"
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time Range for each selected day */}
            {(schedule.videoCallDays || []).length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Time for each day</p>
                {schedule.videoCallDays?.map((day) => {
                  const dayTime = schedule.videoCallTimes?.[day] || { from: "", to: "" };
                  return (
                    <div key={day} className="grid grid-cols-[60px_1fr_1fr] gap-2 items-center">
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{day}</span>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                        <input
                          type="time"
                          value={dayTime.from}
                          onChange={(e) => {
                            const newTimes = {
                              ...(schedule.videoCallTimes || {}),
                              [day]: { ...dayTime, from: e.target.value },
                            };
                            updateSchedule({ videoCallTimes: newTimes });
                          }}
                          className="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white"
                        />
                      </div>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                        <input
                          type="time"
                          value={dayTime.to}
                          onChange={(e) => {
                            const newTimes = {
                              ...(schedule.videoCallTimes || {}),
                              [day]: { ...dayTime, to: e.target.value },
                            };
                            updateSchedule({ videoCallTimes: newTimes });
                          }}
                          className="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bundle Clips OK */}
          <div className="flex items-center gap-3 p-3 bg-white dark:bg-gray-700 rounded-lg">
            <button
              type="button"
              onClick={() => updateSchedule({ bundleClipsOk: !schedule.bundleClipsOk })}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                schedule.bundleClipsOk
                  ? "bg-brand-light-pink"
                  : "bg-gray-300 dark:bg-gray-600"
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                  schedule.bundleClipsOk ? "translate-x-4.5" : "translate-x-0.5"
                }`}
              />
            </button>
            <label className="text-sm font-medium text-gray-900 dark:text-white cursor-pointer"
              onClick={() => updateSchedule({ bundleClipsOk: !schedule.bundleClipsOk })}>
              Comfortable with short clips of long-form content in Bundle Unlocks
            </label>
          </div>
        </div>
      </div>

      {/* Operator Notes Card */}
      <div className="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Operator Notes
        </h3>
        <textarea
          value={internalNotes}
          onChange={(e) => updateInternalNotes(e.target.value)}
          placeholder="Add internal notes about the model (e.g., best time to contact, preferences, performance notes)"
          rows={4}
          className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white resize-none"
        />
      </div>

      {/* Info Box */}
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 text-2xl">🛡️</div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-red-900 dark:text-red-100 mb-1">
              Content & Restrictions
            </h4>
            <p className="text-sm text-red-800 dark:text-red-200">
              Define content limits, blocked wording, schedule availability, and
              internal notes. These help operators understand what the model
              will and won't do.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
