import { useState } from "react";
import { DollarSign, Plus, X } from "lucide-react";
import { ModelOnboardingDraft } from "@/lib/hooks/useModelOnboarding.query";

interface PricingSectionProps {
  formData: Partial<ModelOnboardingDraft>;
  updateFormData: (updates: Partial<ModelOnboardingDraft>) => void;
}

const PLATFORMS = [
  { id: "of_free", label: "OnlyFans Free", color: "blue" },
  { id: "of_paid", label: "OnlyFans Paid", color: "pink" },
  { id: "oftv", label: "OFTV", color: "purple" },
  { id: "fansly", label: "Fansly", color: "green" },
];

interface PlatformPricing {
  massMessage?: { min?: number | null; general?: string };
  customVideo?: { perMin?: number | null; minimum?: number | null };
  videoCall?: { perMin?: number | null; minimum?: number | null };
  privateLive?: { perMin?: number | null; minimum?: number | null };
  contentMinimums?: { [key: string]: number };
  otherServices?: { [key: string]: number };
  notes?: string;
  sfwOnly?: boolean;
}

export default function PricingSection({
  formData,
  updateFormData,
}: PricingSectionProps) {
  const [activePlatform, setActivePlatform] = useState("of_paid");
  const [newContentType, setNewContentType] = useState("");
  const [newContentPrice, setNewContentPrice] = useState("");
  const [newServiceName, setNewServiceName] = useState("");
  const [newServicePrice, setNewServicePrice] = useState("");

  const getPlatformPricing = (platformId: string): PlatformPricing => {
    const allPricing = (formData.platformPricing as any) || {};
    return (
      allPricing[platformId] || {
        massMessage: { min: null, general: "" },
        customVideo: { perMin: null, minimum: null },
        videoCall: { perMin: null, minimum: null },
        privateLive: { perMin: null, minimum: null },
        contentMinimums: {},
        otherServices: {},
        notes: "",
        sfwOnly: platformId === "oftv",
      }
    );
  };

  const updatePlatformPricing = (
    platformId: string,
    updates: Partial<PlatformPricing>,
  ) => {
    const allPricing = (formData.platformPricing as any) || {};
    const currentPlatform = getPlatformPricing(platformId);
    updateFormData({
      platformPricing: {
        ...allPricing,
        [platformId]: { ...currentPlatform, ...updates },
      },
    });
  };

  const addContentMinimum = () => {
    if (!newContentType.trim() || !newContentPrice) return;
    const currentPricing = getPlatformPricing(activePlatform);
    updatePlatformPricing(activePlatform, {
      contentMinimums: {
        ...currentPricing.contentMinimums,
        [newContentType.trim()]: Number(newContentPrice),
      },
    });
    setNewContentType("");
    setNewContentPrice("");
  };

  // Get available content types (selected in Section 3, not already priced)
  const getAvailableContentTypes = () => {
    const selectedTypes = formData.selectedContentTypes || [];
    const currentPricing = getPlatformPricing(activePlatform);
    const alreadyPriced = Object.keys(currentPricing.contentMinimums || {});
    return selectedTypes.filter((type) => !alreadyPriced.includes(type));
  };

  const removeContentMinimum = (type: string) => {
    const currentPricing = getPlatformPricing(activePlatform);
    const newMinimums = { ...currentPricing.contentMinimums };
    delete newMinimums[type];
    updatePlatformPricing(activePlatform, {
      contentMinimums: newMinimums,
    });
  };

  const addOtherService = () => {
    if (!newServiceName.trim() || !newServicePrice) return;
    const currentPricing = getPlatformPricing(activePlatform);
    updatePlatformPricing(activePlatform, {
      otherServices: {
        ...currentPricing.otherServices,
        [newServiceName.trim()]: Number(newServicePrice),
      },
    });
    setNewServiceName("");
    setNewServicePrice("");
  };

  const removeOtherService = (serviceName: string) => {
    const currentPricing = getPlatformPricing(activePlatform);
    const newServices = { ...currentPricing.otherServices };
    delete newServices[serviceName];
    updatePlatformPricing(activePlatform, {
      otherServices: newServices,
    });
  };

  const currentPricing = getPlatformPricing(activePlatform);
  const currentPlatform = PLATFORMS.find((p) => p.id === activePlatform);

  return (
    <div className="space-y-6">
      {/* Platform Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-3">
          Select Platform to Configure
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {PLATFORMS.map((platform) => (
            <button
              key={platform.id}
              type="button"
              onClick={() => setActivePlatform(platform.id)}
              className={`p-3 rounded-lg border-2 transition-all ${
                activePlatform === platform.id
                  ? "border-brand-light-pink bg-brand-light-pink/10"
                  : "border-gray-300 dark:border-gray-600 hover:border-brand-light-pink/50"
              }`}
            >
              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                {platform.label}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Platform Pricing Form */}
      <div className="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-brand-light-pink" />
          {currentPlatform?.label} Pricing
        </h3>

        {/* Platform Notes */}
        <div className="mb-6">
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
            Platform Notes
          </label>
          <textarea
            value={currentPricing.notes || ""}
            onChange={(e) =>
              updatePlatformPricing(activePlatform, {
                notes: e.target.value,
              })
            }
            placeholder="Notes about this platform's pricing strategy..."
            rows={2}
            className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white resize-none"
          />
        </div>

        {/* SFW Only Toggle */}
        {activePlatform === "oftv" && (
          <div className="flex items-center gap-3 mb-6 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <input
              type="checkbox"
              id="sfw-only"
              checked={currentPricing.sfwOnly || false}
              onChange={(e) =>
                updatePlatformPricing(activePlatform, {
                  sfwOnly: e.target.checked,
                })
              }
              className="w-4 h-4 text-brand-light-pink bg-gray-100 border-gray-300 rounded focus:ring-brand-light-pink"
            />
            <label
              htmlFor="sfw-only"
              className="text-sm font-medium text-gray-900 dark:text-white"
            >
              SFW Only Platform (different pricing model)
            </label>
          </div>
        )}

        {/* Core Services - Only show if not SFW only */}
        {!currentPricing.sfwOnly && (
          <div className="space-y-4 mb-6">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
              Core Services
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Mass Messages */}
              <div className="p-4 bg-white dark:bg-gray-700 rounded-lg">
                <h5 className="font-medium text-gray-900 dark:text-white mb-3">
                  Mass Messages
                </h5>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Minimum ($)
                    </label>
                    <input
                      type="number"
                      value={currentPricing.massMessage?.min || ""}
                      onChange={(e) =>
                        updatePlatformPricing(activePlatform, {
                          massMessage: {
                            ...currentPricing.massMessage,
                            min: e.target.value ? Number(e.target.value) : null,
                          },
                        })
                      }
                      placeholder="0"
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Range
                    </label>
                    <input
                      type="text"
                      value={currentPricing.massMessage?.general || ""}
                      onChange={(e) =>
                        updatePlatformPricing(activePlatform, {
                          massMessage: {
                            ...currentPricing.massMessage,
                            general: e.target.value,
                          },
                        })
                      }
                      placeholder="e.g., 5-15"
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Custom Videos */}
              <div className="p-4 bg-white dark:bg-gray-700 rounded-lg">
                <h5 className="font-medium text-gray-900 dark:text-white mb-3">
                  Custom Videos
                </h5>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Per Minute ($)
                    </label>
                    <input
                      type="number"
                      value={currentPricing.customVideo?.perMin || ""}
                      onChange={(e) =>
                        updatePlatformPricing(activePlatform, {
                          customVideo: {
                            ...currentPricing.customVideo,
                            perMin: e.target.value
                              ? Number(e.target.value)
                              : null,
                          },
                        })
                      }
                      placeholder="0"
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Minimum ($)
                    </label>
                    <input
                      type="number"
                      value={currentPricing.customVideo?.minimum || ""}
                      onChange={(e) =>
                        updatePlatformPricing(activePlatform, {
                          customVideo: {
                            ...currentPricing.customVideo,
                            minimum: e.target.value
                              ? Number(e.target.value)
                              : null,
                          },
                        })
                      }
                      placeholder="0"
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Video Calls */}
              <div className="p-4 bg-white dark:bg-gray-700 rounded-lg">
                <h5 className="font-medium text-gray-900 dark:text-white mb-3">
                  Video Calls
                </h5>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Per Minute ($)
                    </label>
                    <input
                      type="number"
                      value={currentPricing.videoCall?.perMin || ""}
                      onChange={(e) =>
                        updatePlatformPricing(activePlatform, {
                          videoCall: {
                            ...currentPricing.videoCall,
                            perMin: e.target.value
                              ? Number(e.target.value)
                              : null,
                          },
                        })
                      }
                      placeholder="0"
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Minimum ($)
                    </label>
                    <input
                      type="number"
                      value={currentPricing.videoCall?.minimum || ""}
                      onChange={(e) =>
                        updatePlatformPricing(activePlatform, {
                          videoCall: {
                            ...currentPricing.videoCall,
                            minimum: e.target.value
                              ? Number(e.target.value)
                              : null,
                          },
                        })
                      }
                      placeholder="0"
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* 1-on-1 Livestream */}
              <div className="p-4 bg-white dark:bg-gray-700 rounded-lg">
                <h5 className="font-medium text-gray-900 dark:text-white mb-3">
                  1-on-1 Livestream
                </h5>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Per Minute ($)
                    </label>
                    <input
                      type="number"
                      value={currentPricing.privateLive?.perMin || ""}
                      onChange={(e) =>
                        updatePlatformPricing(activePlatform, {
                          privateLive: {
                            ...currentPricing.privateLive,
                            perMin: e.target.value
                              ? Number(e.target.value)
                              : null,
                          },
                        })
                      }
                      placeholder="0"
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Minimum ($)
                    </label>
                    <input
                      type="number"
                      value={currentPricing.privateLive?.minimum || ""}
                      onChange={(e) =>
                        updatePlatformPricing(activePlatform, {
                          privateLive: {
                            ...currentPricing.privateLive,
                            minimum: e.target.value
                              ? Number(e.target.value)
                              : null,
                          },
                        })
                      }
                      placeholder="0"
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Content Minimums */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Content Minimums
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Minimum prices per content type for PPV/bundles
              </p>
            </div>
          </div>

          {/* Existing Content Minimums */}
          <div className="space-y-2 mb-3">
            {Object.entries(currentPricing.contentMinimums || {}).map(
              ([type, price]) => (
                <div
                  key={type}
                  className="flex items-center justify-between p-3 bg-white dark:bg-gray-700 rounded-lg"
                >
                  <span className="text-sm text-gray-900 dark:text-white">
                    {type}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      ${price}+
                    </span>
                    <button
                      type="button"
                      onClick={() => removeContentMinimum(type)}
                      className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ),
            )}
            {Object.keys(currentPricing.contentMinimums || {}).length === 0 && (
              <div className="text-sm text-gray-500 dark:text-gray-400 italic p-3 bg-white dark:bg-gray-700 rounded-lg">
                No content minimums set
              </div>
            )}
          </div>

          {/* Add Content Minimum */}
          <div className="flex gap-2">
            <select
              value={newContentType}
              onChange={(e) => setNewContentType(e.target.value)}
              className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white"
              disabled={getAvailableContentTypes().length === 0}
            >
              <option value="">
                {getAvailableContentTypes().length === 0
                  ? "No content types available"
                  : "Select content type"}
              </option>
              {getAvailableContentTypes().map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={newContentPrice}
              onChange={(e) => setNewContentPrice(e.target.value)}
              placeholder="Min $"
              className="w-24 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white"
              disabled={!newContentType}
            />
            <button
              type="button"
              onClick={addContentMinimum}
              disabled={!newContentType || !newContentPrice}
              className="px-3 py-2 bg-brand-light-pink text-white rounded hover:bg-brand-mid-pink transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Helper message */}
          {(formData.selectedContentTypes || []).length === 0 && (
            <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-xs text-blue-800 dark:text-blue-200">
                💡 Select content types in Section 3 first, then set minimum
                prices for each type here.
              </p>
            </div>
          )}

          {(formData.selectedContentTypes || []).length > 0 &&
            getAvailableContentTypes().length === 0 &&
            Object.keys(currentPricing.contentMinimums || {}).length > 0 && (
              <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-xs text-green-800 dark:text-green-200">
                  ✓ All selected content types have minimum prices set
                </p>
              </div>
            )}
        </div>

        {/* Other Services */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
              Other Services
            </h4>
          </div>

          {/* Existing Services */}
          <div className="space-y-2 mb-3">
            {Object.entries(currentPricing.otherServices || {}).map(
              ([serviceName, price]) => (
                <div
                  key={serviceName}
                  className="flex items-center justify-between p-3 bg-white dark:bg-gray-700 rounded-lg"
                >
                  <span className="text-sm text-gray-900 dark:text-white">
                    {serviceName}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      ${price}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeOtherService(serviceName)}
                      className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ),
            )}
            {Object.keys(currentPricing.otherServices || {}).length === 0 && (
              <div className="text-sm text-gray-500 dark:text-gray-400 italic p-3 bg-white dark:bg-gray-700 rounded-lg">
                No other services configured
              </div>
            )}
          </div>

          {/* Add Other Service */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newServiceName}
              onChange={(e) => setNewServiceName(e.target.value)}
              placeholder="Service name (e.g., Dick Rating, Sexting)"
              className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white"
            />
            <input
              type="number"
              value={newServicePrice}
              onChange={(e) => setNewServicePrice(e.target.value)}
              placeholder="Price $"
              className="w-24 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white"
            />
            <button
              type="button"
              onClick={addOtherService}
              className="px-3 py-2 bg-brand-light-pink text-white rounded hover:bg-brand-mid-pink transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="p-4 bg-brand-blue/10 border border-brand-blue/20 rounded-lg">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 text-2xl">💰</div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-brand-blue dark:text-brand-blue mb-1">
              Pricing Configuration
            </h4>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Configure pricing for each platform separately. Core services
              define standard rates,{" "}
              <strong>
                content minimums show only the content types selected in Section
                3
              </strong>
              , and other services are for additional offerings.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
