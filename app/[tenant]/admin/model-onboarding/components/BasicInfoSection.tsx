import { useState, useRef, useEffect, useMemo } from "react";
import {
  Upload,
  X,
  User,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import {
  ModelOnboardingDraft,
  useCheckDuplicate,
} from "@/lib/hooks/useModelOnboarding.query";
import { validateBasicInfo } from "@/lib/validation/onboarding";

// Constants for dropdowns
const TOP_SIZES = [
  "XXS",
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "3XL",
  "4XL",
  "5XL",
  "Other",
];
const BOTTOM_SIZES = [
  "0",
  "2",
  "4",
  "6",
  "8",
  "10",
  "12",
  "14",
  "16",
  "18",
  "20",
  "22",
  "24",
  "Other",
];
const SHOE_SIZES = [
  "4",
  "4.5",
  "5",
  "5.5",
  "6",
  "6.5",
  "7",
  "7.5",
  "8",
  "8.5",
  "9",
  "9.5",
  "10",
  "10.5",
  "11",
  "11.5",
  "12",
  "12.5",
  "13",
  "14",
  "Other",
];

interface BasicInfoSectionProps {
  formData: Partial<ModelOnboardingDraft>;
  updateFormData: (updates: Partial<ModelOnboardingDraft>) => void;
  invitationToken?: string; // Optional token for public uploads
}

export default function BasicInfoSection({
  formData,
  updateFormData,
  invitationToken,
}: BasicInfoSectionProps) {
  const [uploadingImage, setUploadingImage] = useState(false);
  const [usernameDebounced, setUsernameDebounced] = useState(
    formData.instagramUsername || "",
  );
  const [heightUnit, setHeightUnit] = useState<"ft" | "cm">("ft");
  const [weightUnit, setWeightUnit] = useState<"lbs" | "kg">("lbs");
  const [touched, setTouched] = useState({
    name: false,
    instagramUsername: false,
    profileImageUrl: false,
    type: false,
    age: false,
    birthday: false,
    height: false,
    weight: false,
    ethnicity: false,
    timezone: false,
  });

  // Helper to get modelBible data
  const modelBible = (formData.modelBible as any) || {};
  const clothingSizes = modelBible.clothingSizes || {};

  // Helper to update modelBible
  const updateModelBible = (updates: any) => {
    updateFormData({
      modelBible: {
        ...modelBible,
        ...updates,
      },
    });
  };

  const updateClothingSizes = (updates: any) => {
    updateModelBible({
      clothingSizes: {
        ...clothingSizes,
        ...updates,
      },
    });
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Debounce username for duplicate checking
  useEffect(() => {
    const timer = setTimeout(() => {
      setUsernameDebounced(formData.instagramUsername || "");
    }, 500);
    return () => clearTimeout(timer);
  }, [formData.instagramUsername]);

  // Check for duplicates (only if username is valid and has been typed)
  const cleanUsername = usernameDebounced.replace("@", "").trim();
  const { data: duplicateCheck, isLoading: checkingDuplicate } =
    useCheckDuplicate(cleanUsername, formData.id);

  // Validate fields
  const validation = useMemo(() => validateBasicInfo(formData), [formData]);

  // Check if username has duplicate
  const hasDuplicate = duplicateCheck?.exists && cleanUsername.length > 0;

  const markTouched = (field: keyof typeof touched) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be less than 5MB");
      return;
    }

    setUploadingImage(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      // Add token to URL if provided (for public uploads)
      const url = invitationToken
        ? `/api/upload/profile-image?token=${invitationToken}`
        : "/api/upload/profile-image";

      const response = await fetch(url, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const data = await response.json();
      updateFormData({ profileImageUrl: data.url });
      toast.success("Profile image uploaded");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload image");
    } finally {
      setUploadingImage(false);
    }
  };

  const removeImage = () => {
    updateFormData({ profileImageUrl: undefined });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      {/* Profile Image */}
      <div>
        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-3">
          Profile Image <span className="text-red-500">*</span>
        </label>
        <div className="flex items-start gap-6">
          {/* Image Preview */}
          <div className="flex-shrink-0">
            {formData.profileImageUrl ? (
              <div className="relative group">
                <img
                  src={formData.profileImageUrl}
                  alt="Profile"
                  className="w-32 h-32 rounded-full object-cover border-4 border-gray-200 dark:border-gray-700"
                />
                <button
                  onClick={removeImage}
                  className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="w-32 h-32 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center border-4 border-gray-200 dark:border-gray-600">
                <User className="w-12 h-12 text-gray-400" />
              </div>
            )}
          </div>

          {/* Upload Button */}
          <div className="flex-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImage}
              className="flex items-center gap-2 px-4 py-2 bg-brand-light-pink text-white rounded-lg hover:bg-brand-mid-pink transition-colors disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              {uploadingImage ? "Uploading..." : "Upload Image"}
            </button>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              Recommended: Square image, at least 400x400px, max 5MB
            </p>
          </div>
        </div>
      </div>

      {/* Model Name */}
      <div>
        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
          Model Name <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            type="text"
            value={formData.name || ""}
            onChange={(e) => {
              updateFormData({ name: e.target.value });
              markTouched("name");
            }}
            onBlur={() => markTouched("name")}
            placeholder="e.g., Bella Rose"
            className={`w-full px-4 py-3 pr-12 bg-white dark:bg-gray-700 border rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 ${
              touched.name && !validation.name.isValid
                ? "border-red-500 focus:ring-red-500"
                : touched.name && validation.name.isValid
                  ? "border-green-500 focus:ring-green-500"
                  : "border-gray-300 dark:border-gray-600 focus:ring-brand-light-pink"
            }`}
            required
          />
          {/* Validation Icon */}
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            {touched.name && !validation.name.isValid ? (
              <AlertCircle className="w-5 h-5 text-red-500" />
            ) : touched.name && validation.name.isValid ? (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            ) : null}
          </div>
        </div>
        {touched.name && !validation.name.isValid && (
          <p className="text-sm text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            {validation.name.error}
          </p>
        )}
        {(!touched.name || validation.name.isValid) && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            The public name used for this model profile
          </p>
        )}
      </div>

      {/* Instagram Username */}
      <div>
        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
          Instagram Username <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
            @
          </span>
          <input
            type="text"
            value={formData.instagramUsername || ""}
            onChange={(e) => {
              updateFormData({ instagramUsername: e.target.value });
              markTouched("instagramUsername");
            }}
            onBlur={() => markTouched("instagramUsername")}
            placeholder="username"
            className={`w-full pl-8 pr-12 py-3 bg-white dark:bg-gray-700 border rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 ${
              touched.instagramUsername && !validation.instagramUsername.isValid
                ? "border-red-500 focus:ring-red-500"
                : hasDuplicate
                  ? "border-yellow-500 focus:ring-yellow-500"
                  : touched.instagramUsername &&
                      validation.instagramUsername.isValid
                    ? "border-green-500 focus:ring-green-500"
                    : "border-gray-300 dark:border-gray-600 focus:ring-brand-light-pink"
            }`}
          />
          {/* Validation Icon */}
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            {checkingDuplicate && cleanUsername.length > 0 ? (
              <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
            ) : touched.instagramUsername &&
              !validation.instagramUsername.isValid ? (
              <AlertCircle className="w-5 h-5 text-red-500" />
            ) : hasDuplicate ? (
              <AlertCircle className="w-5 h-5 text-yellow-500" />
            ) : touched.instagramUsername &&
              validation.instagramUsername.isValid &&
              !hasDuplicate ? (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            ) : null}
          </div>
        </div>

        {/* Error Messages */}
        {touched.instagramUsername && !validation.instagramUsername.isValid && (
          <p className="text-sm text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            {validation.instagramUsername.error}
          </p>
        )}

        {/* Duplicate Warning */}
        {hasDuplicate && validation.instagramUsername.isValid && (
          <div className="mt-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  Username already exists
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  {duplicateCheck.duplicate?.type === "profile" ? (
                    <>
                      This username is already used by{" "}
                      <span className="font-semibold">
                        {duplicateCheck.duplicate.name}
                      </span>{" "}
                      (Active Profile)
                    </>
                  ) : (
                    <>
                      This username is being used in another draft (Status:{" "}
                      {duplicateCheck.duplicate?.status})
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Helper Text */}
        {!touched.instagramUsername ||
        (validation.instagramUsername.isValid && !hasDuplicate) ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Instagram handle without the @ symbol
          </p>
        ) : null}
      </div>

      {/* Location */}
      <div>
        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
          Location
        </label>
        <input
          type="text"
          value={formData.location || ""}
          onChange={(e) => updateFormData({ location: e.target.value })}
          placeholder="e.g., Los Angeles, CA"
          className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-light-pink"
        />
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          City and state/country
        </p>
      </div>

      {/* Overview Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Basic Details
          </h3>
        </div>

        {/* Age & Birthday */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              Age
            </label>
            <input
              type="number"
              value={formData.age || ""}
              onChange={(e) => updateFormData({ age: e.target.value })}
              placeholder="e.g., 25"
              min="18"
              max="65"
              className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-light-pink"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Must be 18 or older
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              Birthday
            </label>
            <input
              type="date"
              value={formData.birthday || ""}
              onChange={(e) => updateFormData({ birthday: e.target.value })}
              className="w-full px-3 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-light-pink"
            />
          </div>
        </div>

        {/* Height & Weight */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              Height
            </label>
            <div className="flex gap-2">
              <div className="flex-1">
                <input
                  type="number"
                  value={modelBible.height || ""}
                  onChange={(e) => updateModelBible({ height: e.target.value })}
                  placeholder={heightUnit === "ft" ? "5.6" : "168"}
                  min={heightUnit === "ft" ? "4" : "100"}
                  max={heightUnit === "ft" ? "7" : "220"}
                  step={heightUnit === "ft" ? "0.1" : "1"}
                  className="w-full px-3 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-light-pink"
                />
              </div>
              <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setHeightUnit("ft")}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${
                    heightUnit === "ft"
                      ? "bg-brand-light-pink text-white"
                      : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
                  }`}
                >
                  ft
                </button>
                <button
                  type="button"
                  onClick={() => setHeightUnit("cm")}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${
                    heightUnit === "cm"
                      ? "bg-brand-light-pink text-white"
                      : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
                  }`}
                >
                  cm
                </button>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              Weight
            </label>
            <div className="flex gap-2">
              <div className="flex-1">
                <input
                  type="number"
                  value={modelBible.weight || ""}
                  onChange={(e) => updateModelBible({ weight: e.target.value })}
                  placeholder={weightUnit === "lbs" ? "125" : "57"}
                  min="50"
                  max="500"
                  className="w-full px-3 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-light-pink"
                />
              </div>
              <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setWeightUnit("lbs")}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${
                    weightUnit === "lbs"
                      ? "bg-brand-light-pink text-white"
                      : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
                  }`}
                >
                  lbs
                </button>
                <button
                  type="button"
                  onClick={() => setWeightUnit("kg")}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${
                    weightUnit === "kg"
                      ? "bg-brand-light-pink text-white"
                      : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
                  }`}
                >
                  kg
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Ethnicity & Timezone */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              Ethnicity
            </label>
            <input
              type="text"
              value={formData.ethnicity || ""}
              onChange={(e) => updateFormData({ ethnicity: e.target.value })}
              placeholder="e.g., Latina, Asian, Caucasian"
              className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-light-pink"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              Timezone
            </label>
            <input
              type="text"
              value={modelBible.timezone || ""}
              onChange={(e) => updateModelBible({ timezone: e.target.value })}
              placeholder="e.g., PST, EST, GMT+1"
              className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-light-pink"
            />
          </div>
        </div>

        {/* Clothing Sizes */}
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-3">
            Clothing Sizes
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                Bra
              </label>
              <input
                type="text"
                value={clothingSizes.bra || ""}
                onChange={(e) => updateClothingSizes({ bra: e.target.value })}
                placeholder="e.g., 32D, 34C"
                className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-light-pink"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                Top
              </label>
              <select
                value={
                  TOP_SIZES.includes(clothingSizes.top)
                    ? clothingSizes.top
                    : clothingSizes.top
                      ? "Other"
                      : ""
                }
                onChange={(e) => {
                  if (e.target.value === "Other") {
                    updateClothingSizes({ top: "Other" });
                  } else {
                    updateClothingSizes({ top: e.target.value });
                  }
                }}
                className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-light-pink"
              >
                <option value="">Select...</option>
                {TOP_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              {(clothingSizes.top === "Other" ||
                (clothingSizes.top &&
                  !TOP_SIZES.includes(clothingSizes.top))) && (
                <input
                  type="text"
                  value={
                    clothingSizes.top === "Other" ? "" : clothingSizes.top || ""
                  }
                  onChange={(e) =>
                    updateClothingSizes({ top: e.target.value || "Other" })
                  }
                  placeholder="Enter custom size"
                  className="w-full px-3 py-2 mt-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-light-pink"
                />
              )}
            </div>
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                Bottom
              </label>
              <select
                value={
                  BOTTOM_SIZES.includes(clothingSizes.bottom)
                    ? clothingSizes.bottom
                    : clothingSizes.bottom
                      ? "Other"
                      : ""
                }
                onChange={(e) => {
                  if (e.target.value === "Other") {
                    updateClothingSizes({ bottom: "Other" });
                  } else {
                    updateClothingSizes({ bottom: e.target.value });
                  }
                }}
                className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-light-pink"
              >
                <option value="">Select...</option>
                {BOTTOM_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              {(clothingSizes.bottom === "Other" ||
                (clothingSizes.bottom &&
                  !BOTTOM_SIZES.includes(clothingSizes.bottom))) && (
                <input
                  type="text"
                  value={
                    clothingSizes.bottom === "Other"
                      ? ""
                      : clothingSizes.bottom || ""
                  }
                  onChange={(e) =>
                    updateClothingSizes({ bottom: e.target.value || "Other" })
                  }
                  placeholder="Enter custom size"
                  className="w-full px-3 py-2 mt-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-light-pink"
                />
              )}
            </div>
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                Shoes (US)
              </label>
              <select
                value={
                  SHOE_SIZES.includes(clothingSizes.shoes)
                    ? clothingSizes.shoes
                    : clothingSizes.shoes
                      ? "Other"
                      : ""
                }
                onChange={(e) => {
                  if (e.target.value === "Other") {
                    updateClothingSizes({ shoes: "Other" });
                  } else {
                    updateClothingSizes({ shoes: e.target.value });
                  }
                }}
                className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-light-pink"
              >
                <option value="">Select...</option>
                {SHOE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              {(clothingSizes.shoes === "Other" ||
                (clothingSizes.shoes &&
                  !SHOE_SIZES.includes(clothingSizes.shoes))) && (
                <input
                  type="text"
                  value={
                    clothingSizes.shoes === "Other"
                      ? ""
                      : clothingSizes.shoes || ""
                  }
                  onChange={(e) =>
                    updateClothingSizes({ shoes: e.target.value || "Other" })
                  }
                  placeholder="Enter custom size"
                  className="w-full px-3 py-2 mt-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-light-pink"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Model Type */}
      <div>
        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
          Model Type <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => updateFormData({ type: "real" })}
            className={`p-4 rounded-lg border-2 transition-all ${
              formData.type === "real"
                ? "border-brand-light-pink bg-brand-light-pink/10"
                : "border-gray-300 dark:border-gray-600 hover:border-brand-light-pink/50"
            }`}
          >
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                Real Model
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Physical person/creator
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => updateFormData({ type: "ai" })}
            className={`p-4 rounded-lg border-2 transition-all ${
              formData.type === "ai"
                ? "border-brand-light-pink bg-brand-light-pink/10"
                : "border-gray-300 dark:border-gray-600 hover:border-brand-light-pink/50"
            }`}
          >
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                AI Model
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                AI-generated persona
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Validation Summary */}
      <div
        className={`p-4 border rounded-lg ${
          validation.name.isValid &&
          validation.profileImageUrl.isValid &&
          validation.instagramUsername.isValid &&
          validation.type.isValid &&
          !hasDuplicate
            ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
            : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
        }`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold mt-0.5 ${
              validation.name.isValid &&
              validation.profileImageUrl.isValid &&
              validation.instagramUsername.isValid &&
              validation.type.isValid &&
              !hasDuplicate
                ? "bg-green-500"
                : "bg-blue-500"
            }`}
          >
            {validation.name.isValid &&
            validation.profileImageUrl.isValid &&
            validation.instagramUsername.isValid &&
            validation.type.isValid &&
            !hasDuplicate
              ? "✓"
              : "i"}
          </div>
          <div className="flex-1">
            <h4
              className={`text-sm font-semibold mb-2 ${
                validation.name.isValid &&
                validation.profileImageUrl.isValid &&
                validation.instagramUsername.isValid &&
                validation.type.isValid &&
                !hasDuplicate
                  ? "text-green-900 dark:text-green-100"
                  : "text-blue-900 dark:text-blue-100"
              }`}
            >
              {validation.name.isValid &&
              validation.profileImageUrl.isValid &&
              validation.instagramUsername.isValid &&
              validation.type.isValid &&
              !hasDuplicate
                ? "All Required Fields Complete"
                : "Required Fields"}
            </h4>
            <ul
              className={`text-sm space-y-1 ${
                validation.name.isValid &&
                validation.profileImageUrl.isValid &&
                validation.instagramUsername.isValid &&
                validation.type.isValid &&
                !hasDuplicate
                  ? "text-green-800 dark:text-green-200"
                  : "text-blue-800 dark:text-blue-200"
              }`}
            >
              <li className="flex items-center gap-2">
                {validation.profileImageUrl.isValid ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-500" />
                )}
                Profile Image
              </li>
              <li className="flex items-center gap-2">
                {validation.name.isValid ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-500" />
                )}
                Model Name
              </li>
              <li className="flex items-center gap-2">
                {validation.instagramUsername.isValid && !hasDuplicate ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : hasDuplicate ? (
                  <AlertCircle className="w-4 h-4 text-yellow-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-500" />
                )}
                Instagram Username {hasDuplicate && "(Duplicate Found)"}
              </li>
              <li className="flex items-center gap-2">
                {validation.type.isValid ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-500" />
                )}
                Model Type
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
