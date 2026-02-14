"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useParams, useRouter } from "next/navigation";
import {
  User,
  DollarSign,
  FileText,
  Image,
  MessageSquare,
  Settings,
  ChevronDown,
  Check,
  X,
  Edit2,
  Save,
  ExternalLink,
  Copy,
  Clock,
  Calendar,
  MapPin,
  Mail,
  Instagram,
  Twitter,
  Youtube,
  AlertCircle,
  Sparkles,
  ArrowLeft,
  Loader2,
  Upload,
  BookOpen,
  Heart,
  Camera,
  Palette,
  Shield,
  Trash2,
  Plus,
} from "lucide-react";
import { useApiClient } from "@/lib/apiClient";
import { toast } from "sonner";
import { useUser } from "@clerk/nextjs";

interface InfluencerProfile {
  id: string;
  clerkId: string;
  name: string;
  description?: string;
  instagramUsername?: string;
  instagramAccountId?: string;
  profileImageUrl?: string;
  isDefault: boolean;
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
  modelBible?: ModelBible;
  linkedLoRAs?: LinkedLoRA[];
  _count?: {
    posts: number;
    feedPosts: number;
  };
  organization?: {
    id: string;
    name: string;
    logoUrl: string | null;
  } | null;
  user?: {
    id: string;
    clerkId: string;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
    imageUrl: string | null;
    email: string | null;
  };
  isShared?: boolean;
  currentUserOrgRole?:
    | "OWNER"
    | "ADMIN"
    | "MANAGER"
    | "CREATOR"
    | "VIEWER"
    | "MEMBER"
    | null;
  tags?: string[];
  isFavorite?: boolean;
  pageStrategy?: string;
  customStrategies?: Array<{ id: string; label: string; desc: string }>;
  selectedContentTypes?: string[];
  customContentTypes?: string[];
  type?: "real" | "ai";
  status?: "active" | "paused" | "pending";
}

interface LinkedLoRA {
  id: string;
  displayName: string;
  thumbnailUrl: string | null;
  fileName: string;
}

interface PlatformPricing {
  massMessage?: { min?: number | null; general?: string };
  customVideo?: { perMin?: number | null; minimum?: number | null };
  videoCall?: { perMin?: number | null; minimum?: number | null };
  privateLive?: { perMin?: number | null; minimum?: number | null };
  dickRating?: { text?: number | null; nude?: number | null };
  contentMinimums?: { [key: string]: number };
  notes?: string;
  sfwOnly?: boolean;
}

interface ModelBible {
  age?: string;
  birthday?: string;
  height?: string;
  weight?: string;
  ethnicity?: string;
  timezone?: string;
  clothingSizes?: {
    bra?: string;
    top?: string;
    bottom?: string;
    shoes?: string;
  };
  interests?: string[];
  favoriteColors?: string[];
  lingoKeywords?: string[];
  preferredEmojis?: string[];
  platforms?: {
    onlyFansFree?: string;
    onlyFansPaid?: string;
    oftv?: string;
    oftvInterest?: string;
    fansly?: string;
  };
  platformPricing?: {
    of_free?: PlatformPricing;
    of_paid?: PlatformPricing;
    oftv?: PlatformPricing;
    fansly?: PlatformPricing;
  };
  socials?: {
    [key: string]: {
      handle: string;
      managed: boolean;
      contentLevel?: string[];
    };
  };
  location?: string;
  nationality?: string;
  occupation?: string;
  relationshipStatus?: string;
  backstory?: string;
  family?: string;
  pets?: string;
  education?: string;
  pastJobs?: string;
  contentCreationOrigin?: string;
  city?: string;
  livingSituation?: string;
  coreTraits?: string[];
  personalityDescription?: string;
  morningVibe?: string;
  afternoonVibe?: string;
  nightVibe?: string;
  primaryNiche?: string;
  feedAesthetic?: string;
  commonThemes?: string;
  signatureLook?: string;
  uniqueHook?: string;
  willDo?: string[];
  wontDo?: string[];
  maybeOrPremium?: string[];
  pricingMenu?: PricingItem[];
  tone?: string;
  emojiOften?: string[];
  emojiSometimes?: string[];
  emojiNever?: string[];
  signaturePhrases?: string[];
  messageLength?: string;
  capitalization?: string;
  punctuation?: string;
  responseSpeed?: string;
  sampleGreeting?: string;
  sampleFlirty?: string;
  samplePPV?: string;
  sampleFreeRequest?: string;
  instagramBio?: string;
  instagramPostingStyle?: string;
  instagramStoryVibe?: string;
  instagramDMApproach?: string;
  redditSubreddits?: string;
  redditPostingCadence?: string;
  redditTitleStyle?: string;
  onlyfansWelcome?: string;
  onlyfansMassDM?: string;
  onlyfansPPVStyle?: string;
  twitterVoice?: string;
  twitterEngagement?: string;
  hair?: string;
  eyes?: string;
  bodyType?: string;
  tattoosPiercings?: string;
  signatureVisualLook?: string;
  moodboardKeywords?: string;
  faqAreYouReal?: string;
  faqMeetUp?: string;
  faqVoiceNotes?: string;
  faqFreeContent?: string;
  faqRealName?: string;
  faqTooAttached?: string;
  dayChatter?: string;
  nightChatter?: string;
  internalNotes?: string;
  restrictions?: {
    contentLimitations?: string;
    wallRestrictions?: string;
    mmExclusions?: string;
    wordingToAvoid?: string[];
    customsToAvoid?: string;
  };
  schedule?: {
    livestreamSchedule?: string;
    videoCallSchedule?: string;
    bundleClipsOk?: boolean;
  };
}

interface PricingItem {
  item: string;
  price: string;
}

// Constants for form options
const TAG_CATEGORIES = [
  "Fitness",
  "Lifestyle",
  "Gaming",
  "Fashion",
  "Beauty",
  "Travel",
  "Food",
  "Tech",
  "Art",
  "Music",
  "Sports",
  "Comedy",
  "Educational",
  "ASMR",
  "Cosplay",
];

const CORE_TRAITS_OPTIONS = [
  "Flirty",
  "Bratty",
  "Sweet/Girl-next-door",
  "Dominant",
  "Submissive",
  "Mysterious",
  "Bubbly/Energetic",
  "Chill/Laid-back",
  "Nerdy/Gamer",
  "Fitness-focused",
  "Artistic/Creative",
  "Other",
];

// Edit Profile Form Component for Settings Tab
function EditProfileForm({
  profile,
  onUpdate,
}: {
  profile: InfluencerProfile;
  onUpdate: () => void;
}) {
  const [activeSection, setActiveSection] = useState("basic");
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const apiClient = useApiClient();
  const { user: clerkUser } = useUser();

  // Check if current user is the owner of this profile
  const isOwner = profile?.clerkId === clerkUser?.id;

  const [formData, setFormData] = useState({
    name: profile?.name || "",
    description: profile?.description || "",
    instagramUsername: profile?.instagramUsername || "",
    profileImageUrl: profile?.profileImageUrl || "",
    isDefault: profile?.isDefault || false,
    shareWithOrganization: !!profile?.organizationId,
    tags: profile?.tags || [],
    age: profile?.modelBible?.age || "",
    location: profile?.modelBible?.location || "",
    nationality: profile?.modelBible?.nationality || "",
    occupation: profile?.modelBible?.occupation || "",
    relationshipStatus: profile?.modelBible?.relationshipStatus || "",
    backstory: profile?.modelBible?.backstory || "",
    family: profile?.modelBible?.family || "",
    pets: profile?.modelBible?.pets || "",
    education: profile?.modelBible?.education || "",
    pastJobs: profile?.modelBible?.pastJobs || "",
    contentCreationOrigin: profile?.modelBible?.contentCreationOrigin || "",
    coreTraits: profile?.modelBible?.coreTraits || [],
    personalityDescription: profile?.modelBible?.personalityDescription || "",
    morningVibe: profile?.modelBible?.morningVibe || "",
    afternoonVibe: profile?.modelBible?.afternoonVibe || "",
    nightVibe: profile?.modelBible?.nightVibe || "",
    primaryNiche: profile?.modelBible?.primaryNiche || "",
    feedAesthetic: profile?.modelBible?.feedAesthetic || "",
    commonThemes: profile?.modelBible?.commonThemes || "",
    uniqueHook: profile?.modelBible?.uniqueHook || "",
    willDo: profile?.modelBible?.willDo || [],
    wontDo: profile?.modelBible?.wontDo || [],
    tone: profile?.modelBible?.tone || "",
    signaturePhrases: profile?.modelBible?.signaturePhrases || [],
    messageLength: profile?.modelBible?.messageLength || "",
    hair: profile?.modelBible?.hair || "",
    eyes: profile?.modelBible?.eyes || "",
    bodyType: profile?.modelBible?.bodyType || "",
    tattoosPiercings: profile?.modelBible?.tattoosPiercings || "",
  });

  const handleSubmit = async () => {
    if (!formData.name.trim() || !apiClient) {
      toast.error("Please enter a profile name");
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        name: formData.name,
        description: formData.description,
        instagramUsername: formData.instagramUsername,
        profileImageUrl: formData.profileImageUrl || null,
        modelBible: {
          age: formData.age,
          location: formData.location,
          nationality: formData.nationality,
          occupation: formData.occupation,
          relationshipStatus: formData.relationshipStatus,
          backstory: formData.backstory,
          family: formData.family,
          pets: formData.pets,
          education: formData.education,
          pastJobs: formData.pastJobs,
          contentCreationOrigin: formData.contentCreationOrigin,
          coreTraits: formData.coreTraits,
          personalityDescription: formData.personalityDescription,
          morningVibe: formData.morningVibe,
          afternoonVibe: formData.afternoonVibe,
          nightVibe: formData.nightVibe,
          primaryNiche: formData.primaryNiche,
          feedAesthetic: formData.feedAesthetic,
          commonThemes: formData.commonThemes,
          uniqueHook: formData.uniqueHook,
          willDo: formData.willDo,
          wontDo: formData.wontDo,
          tone: formData.tone,
          signaturePhrases: formData.signaturePhrases,
          messageLength: formData.messageLength,
          hair: formData.hair,
          eyes: formData.eyes,
          bodyType: formData.bodyType,
          tattoosPiercings: formData.tattoosPiercings,
        },
      };

      // Only include owner-only fields if user is the owner
      if (isOwner) {
        payload.isDefault = formData.isDefault;
        payload.shareWithOrganization = formData.shareWithOrganization;
      }

      // Always include tags
      payload.tags = formData.tags;

      const response = await apiClient.patch(
        `/api/instagram-profiles/${profile?.id}`,
        payload,
      );

      if (!response.ok) throw new Error("Failed to save profile");

      toast.success("Profile updated!");

      // Dispatch event to refresh profile list in sidebar
      if (profile?.id) {
        window.dispatchEvent(
          new CustomEvent("profilesUpdated", {
            detail: {
              profileId: profile.id,
              mode: "edit",
            },
          }),
        );
      }

      onUpdate();
    } catch {
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const sections = [
    { id: "basic", name: "Basic", icon: User },
    { id: "identity", name: "Identity", icon: FileText },
    { id: "backstory", name: "Backstory", icon: BookOpen },
    { id: "personality", name: "Personality", icon: Heart },
    { id: "content", name: "Content", icon: Camera },
    { id: "boundaries", name: "Boundaries", icon: Shield },
    { id: "communication", name: "Comms", icon: MessageSquare },
    { id: "visual", name: "Visual", icon: Palette },
  ];

  const FormSection = ({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
  }) => (
    <div className="space-y-5">
      <h3 className="text-lg font-semibold text-[#e4e4e7] tracking-tight">
        {title}
      </h3>
      {children}
    </div>
  );

  const FormField = ({
    label,
    required,
    children,
  }: {
    label: string;
    required?: boolean;
    children: React.ReactNode;
  }) => (
    <div>
      <label className="block text-sm font-medium text-[#e4e4e7] mb-2">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  );

  const ArrayField = ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: string[];
    onChange: (val: string[]) => void;
  }) => {
    const [inputValue, setInputValue] = useState("");

    return (
      <FormField label={label}>
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && inputValue.trim()) {
                  e.preventDefault();
                  onChange([...value, inputValue.trim()]);
                  setInputValue("");
                }
              }}
              placeholder="Type and press Enter..."
              className="flex-1 h-10 px-3 text-sm bg-[#18181b] border border-[#27272a] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-[#e4e4e7]"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {value.map((item, idx) => (
              <div
                key={idx}
                className="px-3 py-1.5 bg-[#27272a] rounded-lg text-xs flex items-center gap-2"
              >
                <span>{item}</span>
                <button
                  type="button"
                  onClick={() => onChange(value.filter((_, i) => i !== idx))}
                  className="text-[#71717a] hover:text-red-400"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </FormField>
    );
  };

  return (
    <div className="flex gap-6">
      {/* Sidebar */}
      <div className="w-48 flex-shrink-0">
        <nav className="space-y-1 sticky top-0">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded-lg transition-all ${
                  activeSection === section.id
                    ? "bg-[#18181b] text-[#e4e4e7] border border-[#27272a]"
                    : "text-[#71717a] hover:text-[#e4e4e7] hover:bg-[#18181b]/50"
                }`}
              >
                <Icon className="w-4 h-4" />
                {section.name}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Form Content */}
      <div className="flex-1 bg-[#18181b] rounded-xl border border-[#27272a] p-6">
        {activeSection === "basic" && (
          <FormSection title="Basic Information">
            {/* Profile Image Upload */}
            <div className="flex items-start gap-6 mb-6">
              <div className="relative group">
                <div className="w-24 h-24 rounded-2xl bg-[#27272a] flex items-center justify-center overflow-hidden ring-2 ring-[#27272a]">
                  {formData.profileImageUrl ? (
                    <img
                      src={formData.profileImageUrl}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-10 h-10 text-[#71717a]" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 rounded-2xl transition-opacity cursor-pointer disabled:cursor-not-allowed"
                >
                  {uploadingImage ? (
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  ) : (
                    <Upload className="w-6 h-6 text-white" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (!file.type.startsWith("image/")) {
                      toast.error("Please select an image file");
                      return;
                    }
                    if (file.size > 5 * 1024 * 1024) {
                      toast.error("Image must be less than 5MB");
                      return;
                    }
                    setUploadingImage(true);
                    try {
                      const presignedRes = await fetch(
                        "/api/reference-bank/presigned-url",
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            fileName: file.name,
                            fileType: file.type,
                            folderId: "profile-images",
                          }),
                        },
                      );
                      if (!presignedRes.ok)
                        throw new Error("Failed to get upload URL");
                      const { presignedUrl, url } = await presignedRes.json();
                      const uploadRes = await fetch(presignedUrl, {
                        method: "PUT",
                        body: file,
                        headers: { "Content-Type": file.type },
                      });
                      if (!uploadRes.ok)
                        throw new Error("Failed to upload image");
                      setFormData({ ...formData, profileImageUrl: url });
                      toast.success("Image uploaded!");
                    } catch (err) {
                      console.error("Upload error:", err);
                      toast.error("Failed to upload image");
                    } finally {
                      setUploadingImage(false);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }
                  }}
                />
              </div>
              <div className="flex-1 pt-1">
                <p className="text-sm font-medium text-[#e4e4e7] mb-1">
                  Profile Picture
                </p>
                <p className="text-xs text-[#71717a] mb-3">
                  Upload an image for this influencer profile. Max 5MB.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage}
                    className="px-3 py-1.5 text-xs font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {uploadingImage ? "Uploading..." : "Upload"}
                  </button>
                  {formData.profileImageUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({ ...formData, profileImageUrl: "" })
                      }
                      className="px-3 py-1.5 text-xs font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
            <FormField label="Profile Name" required>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Luna Rose"
                className="w-full h-11 px-4 text-sm bg-[#0c0c0f] border border-[#27272a] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-[#e4e4e7]"
              />
            </FormField>
            <FormField label="Description">
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={3}
                placeholder="Brief description..."
                className="w-full px-4 py-3 text-sm bg-[#0c0c0f] border border-[#27272a] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none text-[#e4e4e7]"
              />
            </FormField>
            <FormField label="Instagram Username">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#71717a] text-sm">
                  @
                </span>
                <input
                  type="text"
                  value={formData.instagramUsername}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      instagramUsername: e.target.value.replace("@", ""),
                    })
                  }
                  placeholder="username"
                  className="w-full h-11 pl-9 pr-4 text-sm bg-[#0c0c0f] border border-[#27272a] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-[#e4e4e7]"
                />
              </div>
            </FormField>
            {isOwner && (
              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isDefault}
                    onChange={(e) =>
                      setFormData({ ...formData, isDefault: e.target.checked })
                    }
                    className="w-5 h-5 rounded-md"
                  />
                  <span className="text-sm text-[#e4e4e7]">
                    Default profile
                  </span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.shareWithOrganization}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        shareWithOrganization: e.target.checked,
                      })
                    }
                    className="w-5 h-5 rounded-md"
                  />
                  <span className="text-sm text-[#e4e4e7]">Share with org</span>
                </label>
              </div>
            )}
            <FormField label="Tags">
              <div className="flex flex-wrap gap-2">
                {TAG_CATEGORIES.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      const isSelected = formData.tags.includes(tag);
                      setFormData({
                        ...formData,
                        tags: isSelected
                          ? formData.tags.filter((t) => t !== tag)
                          : [...formData.tags, tag],
                      });
                    }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                      formData.tags.includes(tag)
                        ? "bg-blue-500 text-white border-2 border-blue-400"
                        : "bg-[#27272a] text-[#e4e4e7] border-2 border-transparent hover:border-[#3b3b3f]"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </FormField>
          </FormSection>
        )}

        {activeSection === "identity" && (
          <FormSection title="Basic Identity">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Age">
                <input
                  type="text"
                  value={formData.age}
                  onChange={(e) =>
                    setFormData({ ...formData, age: e.target.value })
                  }
                  placeholder="e.g., 24"
                  className="w-full h-11 px-4 text-sm bg-[#0c0c0f] border border-[#27272a] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-[#e4e4e7]"
                />
              </FormField>
              <FormField label="Location">
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) =>
                    setFormData({ ...formData, location: e.target.value })
                  }
                  placeholder="e.g., Los Angeles, CA"
                  className="w-full h-11 px-4 text-sm bg-[#0c0c0f] border border-[#27272a] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-[#e4e4e7]"
                />
              </FormField>
              <FormField label="Nationality">
                <input
                  type="text"
                  value={formData.nationality}
                  onChange={(e) =>
                    setFormData({ ...formData, nationality: e.target.value })
                  }
                  placeholder="e.g., American"
                  className="w-full h-11 px-4 text-sm bg-[#0c0c0f] border border-[#27272a] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-[#e4e4e7]"
                />
              </FormField>
              <FormField label="Occupation">
                <input
                  type="text"
                  value={formData.occupation}
                  onChange={(e) =>
                    setFormData({ ...formData, occupation: e.target.value })
                  }
                  placeholder="e.g., Fitness model"
                  className="w-full h-11 px-4 text-sm bg-[#0c0c0f] border border-[#27272a] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-[#e4e4e7]"
                />
              </FormField>
            </div>
            <FormField label="Relationship Status">
              <input
                type="text"
                value={formData.relationshipStatus}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    relationshipStatus: e.target.value,
                  })
                }
                placeholder="e.g., Single"
                className="w-full h-11 px-4 text-sm bg-[#0c0c0f] border border-[#27272a] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-[#e4e4e7]"
              />
            </FormField>
          </FormSection>
        )}

        {activeSection === "backstory" && (
          <FormSection title="Backstory & Lore">
            <FormField label="Background Story">
              <textarea
                value={formData.backstory}
                onChange={(e) =>
                  setFormData({ ...formData, backstory: e.target.value })
                }
                rows={4}
                placeholder="Write 2-3 sentences about her 'life story'..."
                className="w-full px-4 py-3 text-sm bg-[#0c0c0f] border border-[#27272a] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none text-[#e4e4e7]"
              />
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Family">
                <input
                  type="text"
                  value={formData.family}
                  onChange={(e) =>
                    setFormData({ ...formData, family: e.target.value })
                  }
                  className="w-full h-11 px-4 text-sm bg-[#0c0c0f] border border-[#27272a] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-[#e4e4e7]"
                />
              </FormField>
              <FormField label="Pets">
                <input
                  type="text"
                  value={formData.pets}
                  onChange={(e) =>
                    setFormData({ ...formData, pets: e.target.value })
                  }
                  className="w-full h-11 px-4 text-sm bg-[#0c0c0f] border border-[#27272a] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-[#e4e4e7]"
                />
              </FormField>
              <FormField label="Education">
                <input
                  type="text"
                  value={formData.education}
                  onChange={(e) =>
                    setFormData({ ...formData, education: e.target.value })
                  }
                  className="w-full h-11 px-4 text-sm bg-[#0c0c0f] border border-[#27272a] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-[#e4e4e7]"
                />
              </FormField>
              <FormField label="Past Jobs">
                <input
                  type="text"
                  value={formData.pastJobs}
                  onChange={(e) =>
                    setFormData({ ...formData, pastJobs: e.target.value })
                  }
                  className="w-full h-11 px-4 text-sm bg-[#0c0c0f] border border-[#27272a] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-[#e4e4e7]"
                />
              </FormField>
            </div>
            <FormField label="How she got into content creation">
              <textarea
                value={formData.contentCreationOrigin}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    contentCreationOrigin: e.target.value,
                  })
                }
                rows={2}
                className="w-full px-4 py-3 text-sm bg-[#0c0c0f] border border-[#27272a] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none text-[#e4e4e7]"
              />
            </FormField>
          </FormSection>
        )}

        {activeSection === "personality" && (
          <FormSection title="Personality Profile">
            <FormField label="Core Traits (select 3-5)">
              <div className="flex flex-wrap gap-2">
                {CORE_TRAITS_OPTIONS.map((trait) => (
                  <button
                    key={trait}
                    type="button"
                    onClick={() => {
                      const current = formData.coreTraits || [];
                      if (current.includes(trait))
                        setFormData({
                          ...formData,
                          coreTraits: current.filter((t) => t !== trait),
                        });
                      else
                        setFormData({
                          ...formData,
                          coreTraits: [...current, trait],
                        });
                    }}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                      (formData.coreTraits || []).includes(trait)
                        ? "bg-blue-500 text-white"
                        : "bg-[#27272a] text-[#e4e4e7] hover:bg-[#3b3b3f]"
                    }`}
                  >
                    {trait}
                  </button>
                ))}
              </div>
            </FormField>
            <FormField label="Personality Description">
              <textarea
                value={formData.personalityDescription}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    personalityDescription: e.target.value,
                  })
                }
                rows={3}
                placeholder="2-3 sentences describing how she comes across..."
                className="w-full px-4 py-3 text-sm bg-[#0c0c0f] border border-[#27272a] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none text-[#e4e4e7]"
              />
            </FormField>
            <div className="grid grid-cols-3 gap-4">
              <FormField label="Morning Vibe">
                <input
                  type="text"
                  value={formData.morningVibe}
                  onChange={(e) =>
                    setFormData({ ...formData, morningVibe: e.target.value })
                  }
                  placeholder="Sleepy, cozy"
                  className="w-full h-11 px-4 text-sm bg-[#0c0c0f] border border-[#27272a] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-[#e4e4e7]"
                />
              </FormField>
              <FormField label="Afternoon Vibe">
                <input
                  type="text"
                  value={formData.afternoonVibe}
                  onChange={(e) =>
                    setFormData({ ...formData, afternoonVibe: e.target.value })
                  }
                  placeholder="Playful, chatty"
                  className="w-full h-11 px-4 text-sm bg-[#0c0c0f] border border-[#27272a] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-[#e4e4e7]"
                />
              </FormField>
              <FormField label="Night Vibe">
                <input
                  type="text"
                  value={formData.nightVibe}
                  onChange={(e) =>
                    setFormData({ ...formData, nightVibe: e.target.value })
                  }
                  placeholder="Flirty, spicy"
                  className="w-full h-11 px-4 text-sm bg-[#0c0c0f] border border-[#27272a] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-[#e4e4e7]"
                />
              </FormField>
            </div>
          </FormSection>
        )}

        {activeSection === "content" && (
          <FormSection title="Content & Niche">
            <FormField label="Primary Niche">
              <input
                type="text"
                value={formData.primaryNiche}
                onChange={(e) =>
                  setFormData({ ...formData, primaryNiche: e.target.value })
                }
                placeholder="e.g., Fitness / GFE / Cosplay"
                className="w-full h-11 px-4 text-sm bg-[#0c0c0f] border border-[#27272a] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-[#e4e4e7]"
              />
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Feed Aesthetic">
                <input
                  type="text"
                  value={formData.feedAesthetic}
                  onChange={(e) =>
                    setFormData({ ...formData, feedAesthetic: e.target.value })
                  }
                  className="w-full h-11 px-4 text-sm bg-[#0c0c0f] border border-[#27272a] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-[#e4e4e7]"
                />
              </FormField>
              <FormField label="Common Themes">
                <input
                  type="text"
                  value={formData.commonThemes}
                  onChange={(e) =>
                    setFormData({ ...formData, commonThemes: e.target.value })
                  }
                  className="w-full h-11 px-4 text-sm bg-[#0c0c0f] border border-[#27272a] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-[#e4e4e7]"
                />
              </FormField>
            </div>
            <FormField label="What Makes Her Unique">
              <textarea
                value={formData.uniqueHook}
                onChange={(e) =>
                  setFormData({ ...formData, uniqueHook: e.target.value })
                }
                rows={3}
                placeholder="What's her hook?"
                className="w-full px-4 py-3 text-sm bg-[#0c0c0f] border border-[#27272a] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none text-[#e4e4e7]"
              />
            </FormField>
          </FormSection>
        )}

        {activeSection === "boundaries" && (
          <FormSection title="Content Boundaries">
            <ArrayField
              label="Will Do"
              value={formData.willDo}
              onChange={(val) => setFormData({ ...formData, willDo: val })}
            />
            <ArrayField
              label="Won't Do"
              value={formData.wontDo}
              onChange={(val) => setFormData({ ...formData, wontDo: val })}
            />
          </FormSection>
        )}

        {activeSection === "communication" && (
          <FormSection title="Communication Style">
            <FormField label="Tone">
              <input
                type="text"
                value={formData.tone}
                onChange={(e) =>
                  setFormData({ ...formData, tone: e.target.value })
                }
                placeholder="e.g., Flirty, sweet, playful"
                className="w-full h-11 px-4 text-sm bg-[#0c0c0f] border border-[#27272a] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-[#e4e4e7]"
              />
            </FormField>
            <ArrayField
              label="Signature Phrases"
              value={formData.signaturePhrases}
              onChange={(val) =>
                setFormData({ ...formData, signaturePhrases: val })
              }
            />
            <FormField label="Message Length">
              <input
                type="text"
                value={formData.messageLength}
                onChange={(e) =>
                  setFormData({ ...formData, messageLength: e.target.value })
                }
                placeholder="e.g., Short & punchy, Long & detailed"
                className="w-full h-11 px-4 text-sm bg-[#0c0c0f] border border-[#27272a] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-[#e4e4e7]"
              />
            </FormField>
          </FormSection>
        )}

        {activeSection === "visual" && (
          <FormSection title="Visual Profile">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Hair">
                <input
                  type="text"
                  value={formData.hair}
                  onChange={(e) =>
                    setFormData({ ...formData, hair: e.target.value })
                  }
                  placeholder="e.g., Blonde, long"
                  className="w-full h-11 px-4 text-sm bg-[#0c0c0f] border border-[#27272a] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-[#e4e4e7]"
                />
              </FormField>
              <FormField label="Eyes">
                <input
                  type="text"
                  value={formData.eyes}
                  onChange={(e) =>
                    setFormData({ ...formData, eyes: e.target.value })
                  }
                  placeholder="e.g., Blue, green"
                  className="w-full h-11 px-4 text-sm bg-[#0c0c0f] border border-[#27272a] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-[#e4e4e7]"
                />
              </FormField>
            </div>
            <FormField label="Body Type">
              <input
                type="text"
                value={formData.bodyType}
                onChange={(e) =>
                  setFormData({ ...formData, bodyType: e.target.value })
                }
                placeholder="e.g., Athletic, curvy"
                className="w-full h-11 px-4 text-sm bg-[#0c0c0f] border border-[#27272a] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-[#e4e4e7]"
              />
            </FormField>
            <FormField label="Tattoos & Piercings">
              <input
                type="text"
                value={formData.tattoosPiercings}
                onChange={(e) =>
                  setFormData({ ...formData, tattoosPiercings: e.target.value })
                }
                placeholder="Describe any tattoos or piercings"
                className="w-full h-11 px-4 text-sm bg-[#0c0c0f] border border-[#27272a] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-[#e4e4e7]"
              />
            </FormField>
          </FormSection>
        )}

        {/* Save Button */}
        <div className="mt-8 pt-6 border-t border-[#27272a] flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Pricing Tab Component with per-platform pricing
function PricingTab({
  profile,
  onSavePricingSection,
  savingPricing,
}: {
  profile: InfluencerProfile;
  onSavePricingSection: (
    platformId: string,
    section: string,
    data: Partial<PlatformPricing>,
  ) => Promise<void>;
  savingPricing: boolean;
}) {
  const [activePlatform, setActivePlatform] = useState("of_paid");
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [sectionForm, setSectionForm] = useState<any>({});

  const platforms = [
    { id: "of_free", label: "OF Free" },
    { id: "of_paid", label: "OF Paid" },
    { id: "oftv", label: "OFTV" },
    { id: "fansly", label: "Fansly" },
  ];

  // Get pricing data from profile or use defaults
  const getPlatformPricing = (platformId: string) => {
    return (
      profile?.modelBible?.platformPricing?.[
        platformId as keyof typeof profile.modelBible.platformPricing
      ] || {
        massMessage: { min: null, general: "" },
        customVideo: { perMin: null, minimum: null },
        videoCall: { perMin: null, minimum: null },
        privateLive: { perMin: null, minimum: null },
        dickRating: { text: null, nude: null },
        contentMinimums: {},
        notes: "",
        sfwOnly: platformId === "oftv",
      }
    );
  };

  const currentPricing = getPlatformPricing(activePlatform);
  const currentPlatform = platforms.find((p) => p.id === activePlatform);
  const isConfigured =
    profile?.modelBible?.platformPricing?.[
      activePlatform as keyof typeof profile.modelBible.platformPricing
    ] !== undefined;

  // Section editing handlers
  const handleEditSection = (section: string) => {
    const pricing = getPlatformPricing(activePlatform);
    switch (section) {
      case "notes":
        setSectionForm({
          notes: pricing.notes || "",
          sfwOnly: pricing.sfwOnly || false,
        });
        break;
      case "services":
        setSectionForm({
          massMessage: pricing.massMessage || { min: null, general: "" },
          customVideo: pricing.customVideo || { perMin: null, minimum: null },
          videoCall: pricing.videoCall || { perMin: null, minimum: null },
          privateLive: pricing.privateLive || { perMin: null, minimum: null },
        });
        break;
      case "contentMinimums":
        setSectionForm({ contentMinimums: pricing.contentMinimums || {} });
        break;
      case "otherServices":
        setSectionForm({
          dickRating: pricing.dickRating || { text: null, nude: null },
        });
        break;
    }
    setEditingSection(section);
  };

  const handleSaveSection = async () => {
    if (!editingSection) return;
    await onSavePricingSection(activePlatform, editingSection, sectionForm);
    setEditingSection(null);
    setSectionForm({});
  };

  const handleCancelSection = () => {
    setEditingSection(null);
    setSectionForm({});
  };

  // Helper to add/update content minimum
  const updateContentMinimum = (type: string, value: number) => {
    setSectionForm({
      ...sectionForm,
      contentMinimums: {
        ...sectionForm.contentMinimums,
        [type]: value,
      },
    });
  };

  const deleteContentMinimum = (type: string) => {
    const newMinimums = { ...sectionForm.contentMinimums };
    delete newMinimums[type];
    setSectionForm({
      ...sectionForm,
      contentMinimums: newMinimums,
    });
  };

  return (
    <div>
      {/* Platform Tabs */}
      <div className="flex gap-1 mb-6 p-1 bg-[#18181b] rounded-xl w-fit">
        {platforms.map((platform) => {
          const platformConfigured =
            profile?.modelBible?.platformPricing?.[
              platform.id as keyof typeof profile.modelBible.platformPricing
            ] !== undefined;
          return (
            <button
              key={platform.id}
              onClick={() => {
                if (!editingSection) {
                  setActivePlatform(platform.id);
                }
              }}
              disabled={!!editingSection}
              className={`px-5 py-2.5 rounded-lg text-[13px] font-medium transition-all flex items-center gap-2 ${
                activePlatform === platform.id
                  ? "bg-[#27272a] text-[#e4e4e7]"
                  : "text-[#71717a] hover:text-[#a1a1aa]"
              } ${editingSection ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {platform.label}
              {!platformConfigured && (
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              )}
            </button>
          );
        })}
      </div>

      {/* Platform Pricing Sections - Always Show */}
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Platform Note */}
          <div className="lg:col-span-2 bg-[#18181b] rounded-xl p-6 border border-[#27272a]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold">Platform Notes</h3>
                <p className="text-xs text-[#71717a] mt-1">
                  Notes about this platform's pricing strategy
                </p>
              </div>
              {editingSection !== "notes" ? (
                <button
                  onClick={() => handleEditSection("notes")}
                  disabled={!!editingSection}
                  className="px-3 py-1.5 bg-[#27272a] rounded-lg text-[#a1a1aa] text-xs hover:bg-[#3f3f46] transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <Edit2 size={12} />
                  Edit
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={handleCancelSection}
                    disabled={savingPricing}
                    className="px-3 py-1.5 bg-[#27272a] rounded-lg text-[#a1a1aa] text-xs hover:bg-[#3f3f46] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveSection}
                    disabled={savingPricing}
                    className="px-3 py-1.5 bg-[#3b82f6] rounded-lg text-white text-xs hover:bg-[#2563eb] transition-colors flex items-center gap-2"
                  >
                    {savingPricing ? (
                      <>Saving...</>
                    ) : (
                      <>
                        <Save size={12} />
                        Save
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {editingSection === "notes" ? (
              <>
                <textarea
                  value={sectionForm.notes || ""}
                  onChange={(e) =>
                    setSectionForm({ ...sectionForm, notes: e.target.value })
                  }
                  rows={2}
                  placeholder="Add notes about this platform's pricing strategy..."
                  className="w-full px-4 py-3 text-sm bg-[#0c0c0f] border border-[#27272a] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none text-[#e4e4e7] mb-3"
                />
                {activePlatform === "oftv" && (
                  <label className="flex items-center gap-3 px-4 py-3 bg-[#0c0c0f] border border-[#27272a] rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sectionForm.sfwOnly || false}
                      onChange={(e) =>
                        setSectionForm({
                          ...sectionForm,
                          sfwOnly: e.target.checked,
                        })
                      }
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-[#e4e4e7]">
                      SFW Only Platform (different pricing model)
                    </span>
                  </label>
                )}
              </>
            ) : currentPricing.notes ? (
              <div className="px-4 py-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-[13px] text-blue-400">
                {currentPricing.notes}
              </div>
            ) : (
              <div className="px-4 py-3 bg-[#0c0c0f] border border-[#27272a] rounded-lg text-[13px] text-[#71717a] italic">
                No notes added
              </div>
            )}
          </div>

          {/* SFW Notice for OFTV */}
          {currentPricing.sfwOnly && (
            <div className="lg:col-span-2 p-6 bg-[#18181b] border border-[#27272a] rounded-xl text-center">
              <div className="text-sm text-[#71717a] mb-2">
                OFTV is a SFW platform with different monetization
              </div>
              <div className="text-[13px] text-[#52525b]">
                Standard content pricing does not apply. Configure tip goals,
                PPV workout content, etc.
              </div>
            </div>
          )}

          {/* Pricing Matrix */}
          {!currentPricing.sfwOnly && (
            <div className="lg:col-span-2 bg-[#18181b] rounded-xl p-6 border border-[#27272a]">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-semibold">
                  Pricing — {currentPlatform?.label}
                </h3>
                {editingSection !== "services" ? (
                  <button
                    onClick={() => handleEditSection("services")}
                    disabled={!!editingSection}
                    className="px-3 py-1.5 bg-[#27272a] rounded-lg text-[#a1a1aa] text-xs hover:bg-[#3f3f46] transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    <Edit2 size={12} />
                    Edit
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={handleCancelSection}
                      disabled={savingPricing}
                      className="px-3 py-1.5 bg-[#27272a] rounded-lg text-[#a1a1aa] text-xs hover:bg-[#3f3f46] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveSection}
                      disabled={savingPricing}
                      className="px-3 py-1.5 bg-[#3b82f6] rounded-lg text-white text-xs hover:bg-[#2563eb] transition-colors flex items-center gap-2"
                    >
                      {savingPricing ? (
                        <>Saving...</>
                      ) : (
                        <>
                          <Save size={12} />
                          Save
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Mass Messages */}
                <div className="p-5 bg-[#0c0c0f] rounded-xl border border-[#27272a]">
                  <div className="text-[11px] text-[#71717a] mb-2">
                    Mass Messages
                  </div>
                  {editingSection === "services" ? (
                    <div className="space-y-2">
                      <input
                        type="number"
                        value={sectionForm.massMessage?.min || ""}
                        onChange={(e) =>
                          setSectionForm({
                            ...sectionForm,
                            massMessage: {
                              ...sectionForm.massMessage,
                              min: e.target.value
                                ? Number(e.target.value)
                                : null,
                            },
                          })
                        }
                        placeholder="Min $"
                        className="w-full h-9 px-3 text-sm bg-[#18181b] border border-[#27272a] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-[#e4e4e7]"
                      />
                      <input
                        type="text"
                        value={sectionForm.massMessage?.general || ""}
                        onChange={(e) =>
                          setSectionForm({
                            ...sectionForm,
                            massMessage: {
                              ...sectionForm.massMessage,
                              general: e.target.value,
                            },
                          })
                        }
                        placeholder="Range (e.g., 5-15)"
                        className="w-full h-9 px-3 text-sm bg-[#18181b] border border-[#27272a] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-[#e4e4e7]"
                      />
                    </div>
                  ) : (
                    <>
                      <div className="text-2xl font-semibold mb-1">
                        ${currentPricing.massMessage?.min || 0}+
                      </div>
                      <div className="text-xs text-[#71717a]">
                        Range: ${currentPricing.massMessage?.general || "N/A"}
                      </div>
                    </>
                  )}
                </div>

                {/* Custom Videos */}
                <div className="p-5 bg-[#0c0c0f] rounded-xl border border-[#27272a]">
                  <div className="text-[11px] text-[#71717a] mb-2">
                    Custom Videos
                  </div>
                  {editingSection === "services" ? (
                    <div className="space-y-2">
                      <input
                        type="number"
                        value={sectionForm.customVideo?.perMin || ""}
                        onChange={(e) =>
                          setSectionForm({
                            ...sectionForm,
                            customVideo: {
                              ...sectionForm.customVideo,
                              perMin: e.target.value
                                ? Number(e.target.value)
                                : null,
                            },
                          })
                        }
                        placeholder="$ per min"
                        className="w-full h-9 px-3 text-sm bg-[#18181b] border border-[#27272a] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-[#e4e4e7]"
                      />
                      <input
                        type="number"
                        value={sectionForm.customVideo?.minimum || ""}
                        onChange={(e) =>
                          setSectionForm({
                            ...sectionForm,
                            customVideo: {
                              ...sectionForm.customVideo,
                              minimum: e.target.value
                                ? Number(e.target.value)
                                : null,
                            },
                          })
                        }
                        placeholder="Minimum $"
                        className="w-full h-9 px-3 text-sm bg-[#18181b] border border-[#27272a] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-[#e4e4e7]"
                      />
                    </div>
                  ) : (
                    <>
                      <div className="text-2xl font-semibold mb-1">
                        ${currentPricing.customVideo?.perMin || 0}/min
                      </div>
                      <div className="text-xs text-[#71717a]">
                        Minimum: ${currentPricing.customVideo?.minimum || 0}
                      </div>
                    </>
                  )}
                </div>

                {/* Video Calls */}
                <div className="p-5 bg-[#0c0c0f] rounded-xl border border-[#27272a]">
                  <div className="text-[11px] text-[#71717a] mb-2">
                    Video Calls
                  </div>
                  {editingSection === "services" ? (
                    <div className="space-y-2">
                      <input
                        type="number"
                        value={sectionForm.videoCall?.perMin || ""}
                        onChange={(e) =>
                          setSectionForm({
                            ...sectionForm,
                            videoCall: {
                              ...sectionForm.videoCall,
                              perMin: e.target.value
                                ? Number(e.target.value)
                                : null,
                            },
                          })
                        }
                        placeholder="$ per min"
                        className="w-full h-9 px-3 text-sm bg-[#18181b] border border-[#27272a] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-[#e4e4e7]"
                      />
                      <input
                        type="number"
                        value={sectionForm.videoCall?.minimum || ""}
                        onChange={(e) =>
                          setSectionForm({
                            ...sectionForm,
                            videoCall: {
                              ...sectionForm.videoCall,
                              minimum: e.target.value
                                ? Number(e.target.value)
                                : null,
                            },
                          })
                        }
                        placeholder="Minimum $"
                        className="w-full h-9 px-3 text-sm bg-[#18181b] border border-[#27272a] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-[#e4e4e7]"
                      />
                    </div>
                  ) : (
                    <>
                      <div className="text-2xl font-semibold mb-1">
                        ${currentPricing.videoCall?.perMin || 0}/min
                      </div>
                      <div className="text-xs text-[#71717a]">
                        Minimum: ${currentPricing.videoCall?.minimum || 0}
                      </div>
                    </>
                  )}
                </div>

                {/* Private Lives */}
                <div className="p-5 bg-[#0c0c0f] rounded-xl border border-[#27272a]">
                  <div className="text-[11px] text-[#71717a] mb-2">
                    1-on-1 Livestream
                  </div>
                  {editingSection === "services" ? (
                    <div className="space-y-2">
                      <input
                        type="number"
                        value={sectionForm.privateLive?.perMin || ""}
                        onChange={(e) =>
                          setSectionForm({
                            ...sectionForm,
                            privateLive: {
                              ...sectionForm.privateLive,
                              perMin: e.target.value
                                ? Number(e.target.value)
                                : null,
                            },
                          })
                        }
                        placeholder="$ per min"
                        className="w-full h-9 px-3 text-sm bg-[#18181b] border border-[#27272a] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-[#e4e4e7]"
                      />
                      <input
                        type="number"
                        value={sectionForm.privateLive?.minimum || ""}
                        onChange={(e) =>
                          setSectionForm({
                            ...sectionForm,
                            privateLive: {
                              ...sectionForm.privateLive,
                              minimum: e.target.value
                                ? Number(e.target.value)
                                : null,
                            },
                          })
                        }
                        placeholder="Minimum $"
                        className="w-full h-9 px-3 text-sm bg-[#18181b] border border-[#27272a] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-[#e4e4e7]"
                      />
                    </div>
                  ) : (
                    <>
                      <div className="text-2xl font-semibold mb-1">
                        ${currentPricing.privateLive?.perMin || 0}/min
                      </div>
                      <div className="text-xs text-[#71717a]">
                        Minimum: ${currentPricing.privateLive?.minimum || 0}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Content Minimums */}
          <div className="bg-[#18181b] rounded-xl p-6 border border-[#27272a]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold">Content Minimums</h3>
                <p className="text-xs text-[#71717a] mt-1">
                  Minimum prices per content type for PPV/bundles
                </p>
              </div>
              {editingSection !== "contentMinimums" ? (
                <button
                  onClick={() => handleEditSection("contentMinimums")}
                  disabled={!!editingSection}
                  className="px-3 py-1.5 bg-[#27272a] rounded-lg text-[#a1a1aa] text-xs hover:bg-[#3f3f46] transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <Edit2 size={12} />
                  Edit
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={handleCancelSection}
                    disabled={savingPricing}
                    className="px-3 py-1.5 bg-[#27272a] rounded-lg text-[#a1a1aa] text-xs hover:bg-[#3f3f46] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveSection}
                    disabled={savingPricing}
                    className="px-3 py-1.5 bg-[#3b82f6] rounded-lg text-white text-xs hover:bg-[#2563eb] transition-colors flex items-center gap-2"
                  >
                    {savingPricing ? (
                      <>Saving...</>
                    ) : (
                      <>
                        <Save size={12} />
                        Save
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {editingSection === "contentMinimums" && (
              <div className="flex items-center gap-2 mb-3">
                {profile.selectedContentTypes &&
                  profile.selectedContentTypes.length > 0 && (
                    <select
                      onChange={(e) => {
                        if (
                          e.target.value &&
                          !Object.keys(
                            sectionForm.contentMinimums || {},
                          ).includes(e.target.value)
                        ) {
                          updateContentMinimum(e.target.value, 0);
                          e.target.value = "";
                        }
                      }}
                      className="px-3 py-1.5 bg-[#27272a] border border-[#3f3f46] text-[#e4e4e7] rounded-lg text-xs transition-colors"
                    >
                      <option value="">Add from selected types...</option>
                      {profile.selectedContentTypes
                        .filter(
                          (type) =>
                            !Object.keys(
                              sectionForm.contentMinimums || {},
                            ).includes(type),
                        )
                        .map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                    </select>
                  )}
                <button
                  onClick={() => updateContentMinimum("New Type", 0)}
                  className="px-3 py-1.5 bg-[#27272a] hover:bg-[#3f3f46] text-[#e4e4e7] rounded-lg text-xs flex items-center gap-1 transition-colors"
                >
                  <Plus size={12} />
                  Custom
                </button>
              </div>
            )}

            {/* Show selected content types without pricing as suggestions */}
            {editingSection !== "contentMinimums" &&
              profile.selectedContentTypes &&
              profile.selectedContentTypes.length > 0 && (
                <>
                  {profile.selectedContentTypes.filter(
                    (type) =>
                      !Object.keys(
                        currentPricing.contentMinimums || {},
                      ).includes(type),
                  ).length > 0 && (
                    <div className="mb-3 px-3 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                      <div className="flex items-start gap-2 mb-2">
                        <AlertCircle
                          size={14}
                          className="mt-0.5 flex-shrink-0 text-amber-400"
                        />
                        <div className="flex-1">
                          <p className="text-xs text-amber-400 font-medium">
                            Missing pricing for selected content types
                          </p>
                          <p className="text-xs text-amber-400/70 mt-0.5">
                            Click "Edit" to add minimum prices for these types
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {profile.selectedContentTypes
                          .filter(
                            (type) =>
                              !Object.keys(
                                currentPricing.contentMinimums || {},
                              ).includes(type),
                          )
                          .map((type) => (
                            <span
                              key={type}
                              className="px-2 py-1 bg-amber-500/20 text-amber-300 rounded text-[11px] font-medium"
                            >
                              {type}
                            </span>
                          ))}
                      </div>
                    </div>
                  )}
                </>
              )}

            <div className="flex flex-col gap-2.5">
              {(editingSection === "contentMinimums"
                ? Object.entries(sectionForm.contentMinimums || {}).length
                : Object.entries(currentPricing.contentMinimums || {})
                    .length) === 0 && editingSection !== "contentMinimums" ? (
                <div className="px-3 py-2.5 bg-[#0c0c0f] rounded-lg text-[13px] text-[#71717a] italic text-center">
                  {profile.selectedContentTypes &&
                  profile.selectedContentTypes.length > 0
                    ? "No pricing set for selected content types yet"
                    : "No content minimums set"}
                </div>
              ) : (
                Object.entries(
                  (editingSection === "contentMinimums"
                    ? sectionForm.contentMinimums
                    : currentPricing.contentMinimums) || {},
                ).map(([type, min]: [string, any]) => {
                  const isSelectedType =
                    profile.selectedContentTypes?.includes(type);
                  return (
                    <div
                      key={type}
                      className="flex items-center gap-2 px-3 py-2.5 bg-[#0c0c0f] rounded-lg"
                    >
                      {editingSection === "contentMinimums" ? (
                        <>
                          <input
                            type="text"
                            value={type}
                            onChange={(e) => {
                              const newMinimums = {
                                ...sectionForm.contentMinimums,
                              };
                              delete newMinimums[type];
                              newMinimums[e.target.value] = min;
                              setSectionForm({
                                ...sectionForm,
                                contentMinimums: newMinimums,
                              });
                            }}
                            className="flex-1 h-8 px-2 text-[13px] bg-[#18181b] border border-[#27272a] rounded focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-[#e4e4e7]"
                          />
                          <input
                            type="number"
                            value={min}
                            onChange={(e) =>
                              updateContentMinimum(
                                type,
                                e.target.value ? Number(e.target.value) : 0,
                              )
                            }
                            className="w-20 h-8 px-2 text-[13px] bg-[#18181b] border border-[#27272a] rounded focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-[#e4e4e7]"
                          />
                          <button
                            onClick={() => deleteContentMinimum(type)}
                            className="p-1.5 hover:bg-red-500/10 text-red-400 rounded transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 text-[13px] flex items-center gap-2">
                            {type}
                            {isSelectedType && (
                              <span className="px-1.5 py-0.5 bg-emerald-500/15 text-emerald-400 rounded text-[10px] font-medium">
                                Active
                              </span>
                            )}
                          </span>
                          <span className="text-sm font-semibold">${min}+</span>
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Other Services */}
          <div className="bg-[#18181b] rounded-xl p-6 border border-[#27272a]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Other Services</h3>
              {editingSection !== "otherServices" ? (
                <button
                  onClick={() => handleEditSection("otherServices")}
                  disabled={!!editingSection}
                  className="px-3 py-1.5 bg-[#27272a] rounded-lg text-[#a1a1aa] text-xs hover:bg-[#3f3f46] transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <Edit2 size={12} />
                  Edit
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={handleCancelSection}
                    disabled={savingPricing}
                    className="px-3 py-1.5 bg-[#27272a] rounded-lg text-[#a1a1aa] text-xs hover:bg-[#3f3f46] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveSection}
                    disabled={savingPricing}
                    className="px-3 py-1.5 bg-[#3b82f6] rounded-lg text-white text-xs hover:bg-[#2563eb] transition-colors flex items-center gap-2"
                  >
                    {savingPricing ? (
                      <>Saving...</>
                    ) : (
                      <>
                        <Save size={12} />
                        Save
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2.5">
              <div className="p-3 bg-[#0c0c0f] rounded-lg">
                <div className="text-[11px] text-[#71717a] mb-2">
                  Dick Rating
                </div>
                {editingSection === "otherServices" ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-[#71717a] mb-1 block">
                        Text
                      </label>
                      <input
                        type="number"
                        value={sectionForm.dickRating?.text || ""}
                        onChange={(e) =>
                          setSectionForm({
                            ...sectionForm,
                            dickRating: {
                              ...sectionForm.dickRating,
                              text: e.target.value
                                ? Number(e.target.value)
                                : null,
                            },
                          })
                        }
                        placeholder="$"
                        className="w-full h-8 px-2 text-sm bg-[#18181b] border border-[#27272a] rounded focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-[#e4e4e7]"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[#71717a] mb-1 block">
                        Nude
                      </label>
                      <input
                        type="number"
                        value={sectionForm.dickRating?.nude || ""}
                        onChange={(e) =>
                          setSectionForm({
                            ...sectionForm,
                            dickRating: {
                              ...sectionForm.dickRating,
                              nude: e.target.value
                                ? Number(e.target.value)
                                : null,
                            },
                          })
                        }
                        placeholder="$"
                        className="w-full h-8 px-2 text-sm bg-[#18181b] border border-[#27272a] rounded focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-[#e4e4e7]"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="text-[13px]">
                    ${currentPricing.dickRating?.text || 0} text / $
                    {currentPricing.dickRating?.nude || 0} nude
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-[#27272a]">
              <div className="text-[11px] text-[#71717a] mb-2">
                Services on {currentPlatform?.label}
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "Customs", active: true },
                  { label: "Wishlist", active: true },
                  { label: "Private Lives", active: true },
                  { label: "Video Calls", active: true },
                ].map((item) => (
                  <span
                    key={item.label}
                    className={`px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 ${
                      item.active
                        ? "bg-emerald-500/15 text-emerald-400 border border-transparent"
                        : "bg-[#0c0c0f] text-[#52525b] border border-[#27272a]"
                    }`}
                  >
                    {item.active && <Check size={12} />}
                    {item.label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Copy from another platform */}
          {!editingSection && (
            <div className="lg:col-span-2 px-4 py-4 bg-[#18181b] border border-[#27272a] rounded-xl flex items-center justify-between">
              <div className="text-[13px] text-[#71717a]">
                Copy all pricing from another platform?
              </div>
              <div className="flex gap-2">
                {platforms
                  .filter((p) => {
                    if (p.id === activePlatform) return false;
                    const platformConfigured =
                      profile?.modelBible?.platformPricing?.[
                        p.id as keyof typeof profile.modelBible.platformPricing
                      ] !== undefined;
                    return platformConfigured;
                  })
                  .map((p) => (
                    <button
                      key={p.id}
                      onClick={async () => {
                        const sourcePricing = getPlatformPricing(p.id);
                        await onSavePricingSection(
                          activePlatform,
                          "all",
                          sourcePricing,
                        );
                      }}
                      className="px-3.5 py-2 bg-[#27272a] rounded-lg text-[#a1a1aa] text-xs hover:bg-[#3f3f46] transition-colors"
                    >
                      Copy from {p.label}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Content & Restrictions Tab Component
function ContentTab({
  profile,
  editingRestrictions,
  restrictionsForm,
  setRestrictionsForm,
  wordingToAvoidInput,
  setWordingToAvoidInput,
  onEditRestrictions,
  onSaveRestrictions,
  onCancelRestrictions,
  savingRestrictions,
  editingSchedule,
  scheduleForm,
  setScheduleForm,
  onEditSchedule,
  onSaveSchedule,
  onCancelSchedule,
  savingSchedule,
  editingNotes,
  notesForm,
  setNotesForm,
  onEditNotes,
  onSaveNotes,
  onCancelNotes,
  savingNotes,
}: {
  profile: InfluencerProfile;
  editingRestrictions: boolean;
  restrictionsForm: {
    contentLimitations: string;
    wallRestrictions: string;
    mmExclusions: string;
    wordingToAvoid: string[];
    customsToAvoid: string;
  };
  setRestrictionsForm: React.Dispatch<
    React.SetStateAction<{
      contentLimitations: string;
      wallRestrictions: string;
      mmExclusions: string;
      wordingToAvoid: string[];
      customsToAvoid: string;
    }>
  >;
  wordingToAvoidInput: string;
  setWordingToAvoidInput: React.Dispatch<React.SetStateAction<string>>;
  onEditRestrictions: () => void;
  onSaveRestrictions: () => void;
  onCancelRestrictions: () => void;
  savingRestrictions: boolean;
  editingSchedule: boolean;
  scheduleForm: {
    livestreamSchedule: string;
    videoCallSchedule: string;
    bundleClipsOk: boolean;
  };
  setScheduleForm: React.Dispatch<
    React.SetStateAction<{
      livestreamSchedule: string;
      videoCallSchedule: string;
      bundleClipsOk: boolean;
    }>
  >;
  onEditSchedule: () => void;
  onSaveSchedule: () => void;
  onCancelSchedule: () => void;
  savingSchedule: boolean;
  editingNotes: boolean;
  notesForm: string;
  setNotesForm: React.Dispatch<React.SetStateAction<string>>;
  onEditNotes: () => void;
  onSaveNotes: () => void;
  onCancelNotes: () => void;
  savingNotes: boolean;
}) {
  const restrictions = profile?.modelBible?.restrictions;
  const schedule = profile?.modelBible?.schedule;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Restrictions & Limits Card */}
      <div className="bg-[#18181b] rounded-xl p-6 border border-[#27272a]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-red-400">
            Restrictions & Limits
          </h3>
          {!editingRestrictions ? (
            <button
              onClick={onEditRestrictions}
              className="px-3 py-1.5 bg-[#27272a] rounded-lg text-[#a1a1aa] text-xs hover:bg-[#3f3f46] transition-colors flex items-center gap-2"
            >
              <Edit2 size={12} />
              Edit
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={onCancelRestrictions}
                disabled={savingRestrictions}
                className="px-3 py-1.5 bg-[#27272a] rounded-lg text-[#a1a1aa] text-xs hover:bg-[#3f3f46] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onSaveRestrictions}
                disabled={savingRestrictions}
                className="px-3 py-1.5 bg-[#3b82f6] rounded-lg text-white text-xs hover:bg-[#2563eb] transition-colors flex items-center gap-2"
              >
                {savingRestrictions ? (
                  <>Saving...</>
                ) : (
                  <>
                    <Save size={12} />
                    Save
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {/* Content Limitations */}
          <div>
            <div className="text-[11px] text-[#71717a] mb-2">
              Content Limitations
            </div>
            {editingRestrictions ? (
              <textarea
                value={restrictionsForm.contentLimitations}
                onChange={(e) =>
                  setRestrictionsForm({
                    ...restrictionsForm,
                    contentLimitations: e.target.value,
                  })
                }
                placeholder="e.g., No face in BG content. No anal."
                className="w-full px-3 py-2 bg-[#0c0c0f] border border-[#27272a] rounded-lg text-[13px] min-h-[60px] resize-vertical focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            ) : (
              <div className="px-3 py-2 bg-[#0c0c0f] rounded-lg text-[13px] leading-relaxed">
                {restrictions?.contentLimitations || "Not set"}
              </div>
            )}
          </div>

          {/* Wall Restrictions */}
          <div>
            <div className="text-[11px] text-[#71717a] mb-2">
              Wall Restrictions
            </div>
            {editingRestrictions ? (
              <textarea
                value={restrictionsForm.wallRestrictions}
                onChange={(e) =>
                  setRestrictionsForm({
                    ...restrictionsForm,
                    wallRestrictions: e.target.value,
                  })
                }
                placeholder="e.g., No full nudes on wall. Lingerie/implied only."
                className="w-full px-3 py-2 bg-[#0c0c0f] border border-[#27272a] rounded-lg text-[13px] min-h-[60px] resize-vertical focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            ) : (
              <div className="px-3 py-2 bg-[#0c0c0f] rounded-lg text-[13px] leading-relaxed">
                {restrictions?.wallRestrictions || "Not set"}
              </div>
            )}
          </div>

          {/* Mass Message Exclusions */}
          <div>
            <div className="text-[11px] text-[#71717a] mb-2">
              Mass Message Exclusions
            </div>
            {editingRestrictions ? (
              <textarea
                value={restrictionsForm.mmExclusions}
                onChange={(e) =>
                  setRestrictionsForm({
                    ...restrictionsForm,
                    mmExclusions: e.target.value,
                  })
                }
                placeholder="e.g., No dick pics in mass messages"
                className="w-full px-3 py-2 bg-[#0c0c0f] border border-[#27272a] rounded-lg text-[13px] min-h-[60px] resize-vertical focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            ) : (
              <div className="px-3 py-2 bg-[#0c0c0f] rounded-lg text-[13px] leading-relaxed">
                {restrictions?.mmExclusions || "Not set"}
              </div>
            )}
          </div>

          {/* Wording to Avoid */}
          <div>
            <div className="text-[11px] text-[#71717a] mb-2">
              Wording to Avoid
            </div>
            {editingRestrictions ? (
              <>
                <input
                  type="text"
                  value={wordingToAvoidInput}
                  onChange={(e) => setWordingToAvoidInput(e.target.value)}
                  onBlur={() => {
                    const words = wordingToAvoidInput
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean);
                    setRestrictionsForm({
                      ...restrictionsForm,
                      wordingToAvoid: words,
                    });
                  }}
                  placeholder="Comma-separated (e.g., daddy, slut, whore)"
                  className="w-full px-3 py-2 bg-[#0c0c0f] border border-[#27272a] rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
                {restrictionsForm.wordingToAvoid.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {restrictionsForm.wordingToAvoid.map((word) => (
                      <span
                        key={word}
                        className="px-2.5 py-1 bg-red-500/15 text-red-400 rounded text-xs"
                      >
                        {word}
                      </span>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-wrap gap-2">
                {restrictions?.wordingToAvoid &&
                restrictions.wordingToAvoid.length > 0 ? (
                  restrictions.wordingToAvoid.map((word) => (
                    <span
                      key={word}
                      className="px-2.5 py-1 bg-red-500/15 text-red-400 rounded text-xs"
                    >
                      {word}
                    </span>
                  ))
                ) : (
                  <span className="text-[13px] text-[#52525b]">Not set</span>
                )}
              </div>
            )}
          </div>

          {/* Customs to Avoid */}
          <div>
            <div className="text-[11px] text-[#71717a] mb-2">
              Customs to Avoid
            </div>
            {editingRestrictions ? (
              <textarea
                value={restrictionsForm.customsToAvoid}
                onChange={(e) =>
                  setRestrictionsForm({
                    ...restrictionsForm,
                    customsToAvoid: e.target.value,
                  })
                }
                placeholder="e.g., No race play, no degradation, no family roleplay"
                className="w-full px-3 py-2 bg-[#0c0c0f] border border-[#27272a] rounded-lg text-[13px] min-h-[60px] resize-vertical focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            ) : (
              <div className="px-3 py-2 bg-[#0c0c0f] rounded-lg text-[13px] leading-relaxed">
                {restrictions?.customsToAvoid || "Not set"}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Schedule & Availability Card */}
      <div className="bg-[#18181b] rounded-xl p-6 border border-[#27272a]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">Schedule & Availability</h3>
          {!editingSchedule ? (
            <button
              onClick={onEditSchedule}
              className="px-3 py-1.5 bg-[#27272a] rounded-lg text-[#a1a1aa] text-xs hover:bg-[#3f3f46] transition-colors flex items-center gap-2"
            >
              <Edit2 size={12} />
              Edit
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={onCancelSchedule}
                disabled={savingSchedule}
                className="px-3 py-1.5 bg-[#27272a] rounded-lg text-[#a1a1aa] text-xs hover:bg-[#3f3f46] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onSaveSchedule}
                disabled={savingSchedule}
                className="px-3 py-1.5 bg-[#3b82f6] rounded-lg text-white text-xs hover:bg-[#2563eb] transition-colors flex items-center gap-2"
              >
                {savingSchedule ? (
                  <>Saving...</>
                ) : (
                  <>
                    <Save size={12} />
                    Save
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {/* Livestream Schedule */}
          <div>
            <div className="text-[11px] text-[#71717a] mb-2">
              Livestream Schedule
            </div>
            {editingSchedule ? (
              <input
                type="text"
                value={scheduleForm.livestreamSchedule}
                onChange={(e) =>
                  setScheduleForm({
                    ...scheduleForm,
                    livestreamSchedule: e.target.value,
                  })
                }
                placeholder="e.g., Fridays 8-10pm PST, Sundays 2-4pm PST"
                className="w-full px-3 py-2 bg-[#0c0c0f] border border-[#27272a] rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            ) : (
              <div className="px-3 py-2 bg-[#0c0c0f] rounded-lg text-[13px] flex items-center gap-2">
                <Calendar size={14} className="text-[#71717a]" />
                {schedule?.livestreamSchedule || "Not set"}
              </div>
            )}
          </div>

          {/* Video Call Availability */}
          <div>
            <div className="text-[11px] text-[#71717a] mb-2">
              Video Call Availability
            </div>
            {editingSchedule ? (
              <input
                type="text"
                value={scheduleForm.videoCallSchedule}
                onChange={(e) =>
                  setScheduleForm({
                    ...scheduleForm,
                    videoCallSchedule: e.target.value,
                  })
                }
                placeholder="e.g., Wednesdays 6-9pm PST"
                className="w-full px-3 py-2 bg-[#0c0c0f] border border-[#27272a] rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            ) : (
              <div className="px-3 py-2 bg-[#0c0c0f] rounded-lg text-[13px] flex items-center gap-2">
                <Clock size={14} className="text-[#71717a]" />
                {schedule?.videoCallSchedule || "Not set"}
              </div>
            )}
          </div>

          {/* Bundle Clips OK */}
          <div>
            {editingSchedule ? (
              <label className="flex items-center gap-2 cursor-pointer px-3 py-2 bg-[#0c0c0f] rounded-lg">
                <input
                  type="checkbox"
                  checked={scheduleForm.bundleClipsOk}
                  onChange={(e) =>
                    setScheduleForm({
                      ...scheduleForm,
                      bundleClipsOk: e.target.checked,
                    })
                  }
                  className="w-4 h-4 rounded"
                />
                <span className="text-[13px] text-[#e4e4e7]">
                  Bundle clips in unlocks OK
                </span>
              </label>
            ) : (
              <div
                className={`px-3 py-2 rounded-lg text-xs flex items-center gap-2 ${
                  schedule?.bundleClipsOk
                    ? "bg-emerald-500/10 border border-emerald-500/20"
                    : "bg-[#0c0c0f]"
                }`}
              >
                {schedule?.bundleClipsOk ? (
                  <>
                    <Check size={14} className="text-emerald-400" />
                    <span className="text-emerald-400">
                      Bundle clips in unlocks OK
                    </span>
                  </>
                ) : (
                  <span className="text-[#52525b]">
                    Bundle clips not configured
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Operator Notes - Full Width */}
      <div className="lg:col-span-2 bg-[#18181b] rounded-xl p-6 border border-[#27272a]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">Operator Notes</h3>
          {!editingNotes ? (
            <button
              onClick={onEditNotes}
              className="px-3 py-1.5 bg-[#27272a] rounded-lg text-[#a1a1aa] text-xs hover:bg-[#3f3f46] transition-colors flex items-center gap-2"
            >
              <Edit2 size={12} />
              Edit
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={onCancelNotes}
                disabled={savingNotes}
                className="px-3 py-1.5 bg-[#27272a] rounded-lg text-[#a1a1aa] text-xs hover:bg-[#3f3f46] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onSaveNotes}
                disabled={savingNotes}
                className="px-3 py-1.5 bg-[#3b82f6] rounded-lg text-white text-xs hover:bg-[#2563eb] transition-colors flex items-center gap-2"
              >
                {savingNotes ? (
                  <>Saving...</>
                ) : (
                  <>
                    <Save size={12} />
                    Save
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {editingNotes ? (
          <textarea
            value={notesForm}
            onChange={(e) => setNotesForm(e.target.value)}
            placeholder="Add internal notes about the model (e.g., best time to contact, preferences, performance notes)"
            className="w-full px-4 py-3 bg-[#0c0c0f] border border-[#27272a] rounded-lg text-[13px] leading-relaxed min-h-[120px] resize-vertical focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
        ) : (
          <div className="px-4 py-3 bg-[#0c0c0f] border border-[#27272a] rounded-lg text-[13px] leading-relaxed">
            {profile?.modelBible?.internalNotes || "No notes added yet"}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ModelProfilePage() {
  const params = useParams();
  const router = useRouter();
  const apiClient = useApiClient();
  const [profile, setProfile] = useState<InfluencerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [pageStrategy, setPageStrategy] = useState<string>("gf_experience");
  const [savingStrategy, setSavingStrategy] = useState(false);
  const [showStrategyModal, setShowStrategyModal] = useState(false);
  const [editingStrategy, setEditingStrategy] = useState<{
    id: string;
    label: string;
    desc: string;
  } | null>(null);
  const [customStrategies, setCustomStrategies] = useState<
    Array<{ id: string; label: string; desc: string }>
  >([]);
  const [selectedContentTypes, setSelectedContentTypes] = useState<string[]>(
    [],
  );
  const [customContentTypes, setCustomContentTypes] = useState<string[]>([]);
  const [showContentTypeModal, setShowContentTypeModal] = useState(false);
  const [editingContentType, setEditingContentType] = useState<string | null>(
    null,
  );
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const [editingSettings, setEditingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState<{
    type: "real" | "ai";
    shareWithOrganization: boolean;
  }>({ type: "real", shareWithOrganization: false });
  const [editingBasicInfo, setEditingBasicInfo] = useState(false);
  const [savingBasicInfo, setSavingBasicInfo] = useState(false);
  const [basicInfoForm, setBasicInfoForm] = useState({
    age: "",
    birthday: "",
    height: "",
    weight: "",
    ethnicity: "",
    timezone: "",
    clothingSizes: {
      bra: "",
      top: "",
      bottom: "",
      shoes: "",
    },
  });
  const [editingPersona, setEditingPersona] = useState(false);
  const [savingPersona, setSavingPersona] = useState(false);
  const [personaForm, setPersonaForm] = useState({
    backstory: "",
    interests: [] as string[],
    personalityDescription: "",
    favoriteColors: [] as string[],
    lingoKeywords: [] as string[],
    preferredEmojis: [] as string[],
  });
  // Temp strings for editing comma/space-separated fields
  const [interestsInput, setInterestsInput] = useState("");
  const [colorsInput, setColorsInput] = useState("");
  const [lingoInput, setLingoInput] = useState("");
  const [emojisInput, setEmojisInput] = useState("");
  const [editingPlatforms, setEditingPlatforms] = useState(false);
  const [savingPlatforms, setSavingPlatforms] = useState(false);
  const [platformsForm, setPlatformsForm] = useState({
    onlyFansFree: "",
    onlyFansPaid: "",
    oftv: "",
    fansly: "",
  });
  const [editingSocials, setEditingSocials] = useState(false);
  const [savingSocials, setSavingSocials] = useState(false);
  const [socialsForm, setSocialsForm] = useState<{
    [key: string]: {
      handle: string;
      managed: boolean;
      contentLevel: string;
    };
  }>({});
  const [savingPricing, setSavingPricing] = useState(false);

  // Content & Restrictions editing
  const [editingRestrictions, setEditingRestrictions] = useState(false);
  const [savingRestrictions, setSavingRestrictions] = useState(false);
  const [restrictionsForm, setRestrictionsForm] = useState({
    contentLimitations: "",
    wallRestrictions: "",
    mmExclusions: "",
    wordingToAvoid: [] as string[],
    customsToAvoid: "",
  });
  const [wordingToAvoidInput, setWordingToAvoidInput] = useState("");

  const [editingSchedule, setEditingSchedule] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    livestreamSchedule: "",
    videoCallSchedule: "",
    bundleClipsOk: false,
  });

  const [editingNotes, setEditingNotes] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesForm, setNotesForm] = useState("");

  const tenant = params.tenant as string;
  const profileId = params.profileId as string;

  // Close status dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        statusDropdownRef.current &&
        !statusDropdownRef.current.contains(event.target as Node)
      ) {
        setShowStatusDropdown(false);
      }
    };

    if (showStatusDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showStatusDropdown]);

  useEffect(() => {
    if (apiClient && profileId) {
      loadProfile();
    }
  }, [apiClient, profileId]);

  useEffect(() => {
    if (profile?.pageStrategy) {
      setPageStrategy(profile.pageStrategy);
    }
    if (profile?.customStrategies) {
      setCustomStrategies(profile.customStrategies);
    }
    if (profile?.selectedContentTypes) {
      setSelectedContentTypes(profile.selectedContentTypes);
    }
    if (profile?.customContentTypes) {
      setCustomContentTypes(profile.customContentTypes);
    }
    // Initialize basic info form from profile
    if (profile?.modelBible) {
      setBasicInfoForm({
        age: profile.modelBible.age || "",
        birthday: profile.modelBible.birthday || "",
        height: profile.modelBible.height || "",
        weight: profile.modelBible.weight || "",
        ethnicity: profile.modelBible.ethnicity || "",
        timezone: profile.modelBible.timezone || "",
        clothingSizes: {
          bra: profile.modelBible.clothingSizes?.bra || "",
          top: profile.modelBible.clothingSizes?.top || "",
          bottom: profile.modelBible.clothingSizes?.bottom || "",
          shoes: profile.modelBible.clothingSizes?.shoes || "",
        },
      });
    }
    // Initialize persona form from profile
    if (profile?.modelBible) {
      setPersonaForm({
        backstory: profile.modelBible.backstory || "",
        interests: profile.modelBible.interests || [],
        personalityDescription: profile.modelBible.personalityDescription || "",
        favoriteColors: profile.modelBible.favoriteColors || [],
        lingoKeywords: profile.modelBible.lingoKeywords || [],
        preferredEmojis: profile.modelBible.preferredEmojis || [],
      });
      setInterestsInput(profile.modelBible.interests?.join(", ") || "");
      setColorsInput(profile.modelBible.favoriteColors?.join(", ") || "");
      setLingoInput(profile.modelBible.lingoKeywords?.join(", ") || "");
      setEmojisInput(profile.modelBible.preferredEmojis?.join(" ") || "");
    }
    // Initialize platforms form from profile
    if (profile?.modelBible?.platforms) {
      setPlatformsForm({
        onlyFansFree: profile.modelBible.platforms.onlyFansFree || "",
        onlyFansPaid: profile.modelBible.platforms.onlyFansPaid || "",
        oftv: profile.modelBible.platforms.oftv || "",
        fansly: profile.modelBible.platforms.fansly || "",
      });
    }
    // Initialize socials form from profile
    const defaultPlatforms = ["instagram", "twitter", "tiktok", "reddit"];
    const formattedSocials: any = {};
    defaultPlatforms.forEach((platform) => {
      const data = profile?.modelBible?.socials?.[platform];
      formattedSocials[platform] = {
        handle: data?.handle || "",
        managed: data?.managed || false,
        contentLevel: data?.contentLevel?.join(", ") || "",
      };
    });
    setSocialsForm(formattedSocials);
    // Initialize pricing form from profile
    if (profile?.modelBible?.platformPricing) {
      // Pricing will be loaded when editing a specific platform
    }
    // Initialize restrictions form from profile
    if (profile?.modelBible?.restrictions) {
      const restrictions = profile.modelBible.restrictions;
      setRestrictionsForm({
        contentLimitations: restrictions.contentLimitations || "",
        wallRestrictions: restrictions.wallRestrictions || "",
        mmExclusions: restrictions.mmExclusions || "",
        wordingToAvoid: restrictions.wordingToAvoid || [],
        customsToAvoid: restrictions.customsToAvoid || "",
      });
      setWordingToAvoidInput(restrictions.wordingToAvoid?.join(", ") || "");
    }
    // Initialize schedule form from profile
    if (profile?.modelBible?.schedule) {
      const schedule = profile.modelBible.schedule;
      setScheduleForm({
        livestreamSchedule: schedule.livestreamSchedule || "",
        videoCallSchedule: schedule.videoCallSchedule || "",
        bundleClipsOk: schedule.bundleClipsOk || false,
      });
    }
    // Initialize notes form from profile
    if (profile?.modelBible?.internalNotes) {
      setNotesForm(profile.modelBible.internalNotes);
    }
  }, [profile]);

  const loadProfile = async () => {
    if (!apiClient) return;
    try {
      setLoading(true);
      const response = await apiClient.get(
        `/api/instagram-profiles/${profileId}`,
      );
      if (!response.ok) throw new Error("Failed to load profile");
      const data = await response.json();
      setProfile(data);
    } catch (error) {
      console.error("Error loading profile:", error);
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const handleStrategyChange = async (strategyId: string) => {
    if (!apiClient || !profile) return;

    setPageStrategy(strategyId);
    setSavingStrategy(true);

    try {
      const response = await apiClient.patch(
        `/api/instagram-profiles/${profile.id}`,
        {
          pageStrategy: strategyId,
        },
      );

      if (!response.ok) throw new Error("Failed to save strategy");

      toast.success("Page strategy updated!");

      // Update profile data
      setProfile({ ...profile, pageStrategy: strategyId });
    } catch (error) {
      console.error("Error saving strategy:", error);
      toast.error("Failed to save page strategy");
      // Revert on error
      setPageStrategy(profile.pageStrategy || "gf_experience");
    } finally {
      setSavingStrategy(false);
    }
  };

  const handleDeleteStrategy = async (strategyId: string) => {
    if (!apiClient || !profile) return;

    if (!confirm("Are you sure you want to delete this custom strategy?"))
      return;

    try {
      const updatedStrategies = customStrategies.filter(
        (s) => s.id !== strategyId,
      );

      const response = await apiClient.patch(
        `/api/instagram-profiles/${profile.id}`,
        {
          customStrategies: updatedStrategies,
        },
      );

      if (!response.ok) throw new Error("Failed to delete strategy");

      setCustomStrategies(updatedStrategies);
      setProfile({ ...profile, customStrategies: updatedStrategies });

      // If the deleted strategy was selected, reset to default
      if (pageStrategy === strategyId) {
        handleStrategyChange("gf_experience");
      }

      toast.success("Strategy deleted!");
    } catch (error) {
      console.error("Error deleting strategy:", error);
      toast.error("Failed to delete strategy");
    }
  };

  const handleEditStrategy = (strategy: {
    id: string;
    label: string;
    desc: string;
  }) => {
    setEditingStrategy(strategy);
    setShowStrategyModal(true);
  };

  const handleToggleContentType = async (type: string) => {
    if (!apiClient || !profile) return;

    let newSelected: string[] = [];

    setSelectedContentTypes((prev) => {
      newSelected = prev.includes(type)
        ? prev.filter((t) => t !== type)
        : [...prev, type];
      return newSelected;
    });

    try {
      const response = await apiClient.patch(
        `/api/instagram-profiles/${profile.id}`,
        {
          selectedContentTypes: newSelected,
        },
      );

      if (!response.ok) throw new Error("Failed to save content types");

      setProfile({ ...profile, selectedContentTypes: newSelected });
    } catch (error) {
      console.error("Error saving content types:", error);
      toast.error("Failed to save content types");
      // Revert on error
      setSelectedContentTypes((prev) =>
        prev.includes(type) ? [...prev, type] : prev.filter((t) => t !== type),
      );
    }
  };

  const handleDeleteContentType = async (type: string) => {
    if (!apiClient || !profile) return;

    if (!confirm(`Are you sure you want to delete "${type}"?`)) return;

    try {
      const updatedCustomTypes = customContentTypes.filter((t) => t !== type);
      const updatedSelectedTypes = selectedContentTypes.filter(
        (t) => t !== type,
      );

      const response = await apiClient.patch(
        `/api/instagram-profiles/${profile.id}`,
        {
          customContentTypes: updatedCustomTypes,
          selectedContentTypes: updatedSelectedTypes,
        },
      );

      if (!response.ok) throw new Error("Failed to delete content type");

      setCustomContentTypes(updatedCustomTypes);
      setSelectedContentTypes(updatedSelectedTypes);
      setProfile({
        ...profile,
        customContentTypes: updatedCustomTypes,
        selectedContentTypes: updatedSelectedTypes,
      });

      toast.success("Content type deleted!");
    } catch (error) {
      console.error("Error deleting content type:", error);
      toast.error("Failed to delete content type");
    }
  };

  const handleEditContentType = (type: string) => {
    setEditingContentType(type);
    setShowContentTypeModal(true);
  };

  const handleSaveBasicInfo = async () => {
    if (!apiClient || !profile) return;

    setSavingBasicInfo(true);

    try {
      const updatedBible = {
        ...profile.modelBible,
        age: basicInfoForm.age,
        birthday: basicInfoForm.birthday,
        height: basicInfoForm.height,
        weight: basicInfoForm.weight,
        ethnicity: basicInfoForm.ethnicity,
        timezone: basicInfoForm.timezone,
        clothingSizes: basicInfoForm.clothingSizes,
      };

      const response = await apiClient.patch(
        `/api/instagram-profiles/${profile.id}`,
        {
          modelBible: updatedBible,
        },
      );

      if (!response.ok) throw new Error("Failed to save basic info");

      setProfile({ ...profile, modelBible: updatedBible });
      setEditingBasicInfo(false);
      toast.success("Basic info updated!");
    } catch (error) {
      console.error("Error saving basic info:", error);
      toast.error("Failed to save basic info");
    } finally {
      setSavingBasicInfo(false);
    }
  };

  const handleCancelBasicInfo = () => {
    // Reset form to original values
    if (profile?.modelBible) {
      setBasicInfoForm({
        age: profile.modelBible.age || "",
        birthday: profile.modelBible.birthday || "",
        height: profile.modelBible.height || "",
        weight: profile.modelBible.weight || "",
        ethnicity: profile.modelBible.ethnicity || "",
        timezone: profile.modelBible.timezone || "",
        clothingSizes: {
          bra: profile.modelBible.clothingSizes?.bra || "",
          top: profile.modelBible.clothingSizes?.top || "",
          bottom: profile.modelBible.clothingSizes?.bottom || "",
          shoes: profile.modelBible.clothingSizes?.shoes || "",
        },
      });
    }
    setEditingBasicInfo(false);
  };

  const handleSavePersona = async () => {
    if (!apiClient || !profile) return;

    setSavingPersona(true);

    try {
      const updatedBible = {
        ...profile.modelBible,
        backstory: personaForm.backstory,
        interests: interestsInput
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        personalityDescription: personaForm.personalityDescription,
        favoriteColors: colorsInput
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        lingoKeywords: lingoInput
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        preferredEmojis: emojisInput.split(" ").filter(Boolean),
      };

      const response = await apiClient.patch(
        `/api/instagram-profiles/${profile.id}`,
        {
          modelBible: updatedBible,
        },
      );

      if (!response.ok) throw new Error("Failed to save persona");

      setProfile({ ...profile, modelBible: updatedBible });
      setEditingPersona(false);
      toast.success("Persona updated!");
    } catch (error) {
      console.error("Error saving persona:", error);
      toast.error("Failed to save persona");
    } finally {
      setSavingPersona(false);
    }
  };

  const handleCancelPersona = () => {
    // Reset form to original values
    if (profile?.modelBible) {
      setPersonaForm({
        backstory: profile.modelBible.backstory || "",
        interests: profile.modelBible.interests || [],
        personalityDescription: profile.modelBible.personalityDescription || "",
        favoriteColors: profile.modelBible.favoriteColors || [],
        lingoKeywords: profile.modelBible.lingoKeywords || [],
        preferredEmojis: profile.modelBible.preferredEmojis || [],
      });
      setInterestsInput(profile.modelBible.interests?.join(", ") || "");
      setColorsInput(profile.modelBible.favoriteColors?.join(", ") || "");
      setLingoInput(profile.modelBible.lingoKeywords?.join(", ") || "");
      setEmojisInput(profile.modelBible.preferredEmojis?.join(" ") || "");
    }
    setEditingPersona(false);
  };

  const handleSavePlatforms = async () => {
    if (!apiClient || !profile) return;

    setSavingPlatforms(true);

    try {
      const updatedBible = {
        ...profile.modelBible,
        platforms: {
          ...profile.modelBible?.platforms,
          onlyFansFree: platformsForm.onlyFansFree || undefined,
          onlyFansPaid: platformsForm.onlyFansPaid || undefined,
          oftv: platformsForm.oftv || undefined,
          fansly: platformsForm.fansly || undefined,
        },
      };

      const response = await apiClient.patch(
        `/api/instagram-profiles/${profile.id}`,
        {
          modelBible: updatedBible,
        },
      );

      if (!response.ok) throw new Error("Failed to save platforms");

      setProfile({ ...profile, modelBible: updatedBible });
      setEditingPlatforms(false);
      toast.success("Platforms updated!");
    } catch (error) {
      console.error("Error saving platforms:", error);
      toast.error("Failed to save platforms");
    } finally {
      setSavingPlatforms(false);
    }
  };

  const handleCancelPlatforms = () => {
    // Reset form to original values
    if (profile?.modelBible?.platforms) {
      setPlatformsForm({
        onlyFansFree: profile.modelBible.platforms.onlyFansFree || "",
        onlyFansPaid: profile.modelBible.platforms.onlyFansPaid || "",
        oftv: profile.modelBible.platforms.oftv || "",
        fansly: profile.modelBible.platforms.fansly || "",
      });
    }
    setEditingPlatforms(false);
  };

  const handleSaveSocials = async () => {
    if (!apiClient || !profile) return;

    setSavingSocials(true);

    try {
      const formattedSocials: any = {};
      Object.entries(socialsForm).forEach(([platform, data]) => {
        formattedSocials[platform] = {
          handle: data.handle,
          managed: data.managed,
          contentLevel: data.contentLevel
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        };
      });

      const updatedBible = {
        ...profile.modelBible,
        socials: formattedSocials,
      };

      const response = await apiClient.patch(
        `/api/instagram-profiles/${profile.id}`,
        {
          modelBible: updatedBible,
        },
      );

      if (!response.ok) throw new Error("Failed to save socials");

      setProfile({ ...profile, modelBible: updatedBible });
      setEditingSocials(false);
      toast.success("Socials updated!");
    } catch (error) {
      console.error("Error saving socials:", error);
      toast.error("Failed to save socials");
    } finally {
      setSavingSocials(false);
    }
  };

  const handleCancelSocials = () => {
    // Reset form to original values
    const defaultPlatforms = ["instagram", "twitter", "tiktok", "reddit"];
    const formattedSocials: any = {};
    defaultPlatforms.forEach((platform) => {
      const data = profile?.modelBible?.socials?.[platform];
      formattedSocials[platform] = {
        handle: data?.handle || "",
        managed: data?.managed || false,
        contentLevel: data?.contentLevel?.join(", ") || "",
      };
    });
    setSocialsForm(formattedSocials);
    setEditingSocials(false);
  };

  const handleStatusChange = async (
    newStatus: "active" | "paused" | "pending",
  ) => {
    if (!apiClient || !profile || savingStatus) return;

    setSavingStatus(true);
    try {
      const response = await apiClient.patch(
        `/api/instagram-profiles/${profile.id}`,
        { status: newStatus },
      );

      if (!response.ok) throw new Error("Failed to update status");

      setProfile({ ...profile, status: newStatus });
      setShowStatusDropdown(false);
      toast.success(`Status updated to ${newStatus}`);
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    } finally {
      setSavingStatus(false);
    }
  };

  const handleSavePricingSection = async (
    platformId: string,
    section: string,
    data: Partial<PlatformPricing>,
  ) => {
    if (!apiClient || !profile) return;

    setSavingPricing(true);

    try {
      // Get current pricing for this platform
      const currentPlatformPricing = profile?.modelBible?.platformPricing?.[
        platformId as keyof typeof profile.modelBible.platformPricing
      ] || {
        massMessage: { min: null, general: "" },
        customVideo: { perMin: null, minimum: null },
        videoCall: { perMin: null, minimum: null },
        privateLive: { perMin: null, minimum: null },
        dickRating: { text: null, nude: null },
        contentMinimums: {},
        notes: "",
        sfwOnly: platformId === "oftv",
      };

      // Merge the section data with existing data
      const updatedPlatformPricing =
        section === "all" ? data : { ...currentPlatformPricing, ...data };

      const updatedBible = {
        ...profile.modelBible,
        platformPricing: {
          ...profile.modelBible?.platformPricing,
          [platformId]: updatedPlatformPricing,
        },
      };

      const response = await apiClient.patch(
        `/api/instagram-profiles/${profile.id}`,
        {
          modelBible: updatedBible,
        },
      );

      if (!response.ok) throw new Error("Failed to save pricing");

      setProfile({ ...profile, modelBible: updatedBible });
      toast.success(section === "all" ? "Pricing copied!" : "Pricing updated!");
    } catch (error) {
      console.error("Error saving pricing:", error);
      toast.error("Failed to save pricing");
    } finally {
      setSavingPricing(false);
    }
  };

  // Content & Restrictions handlers
  const handleEditRestrictions = () => {
    if (profile?.modelBible?.restrictions) {
      const restrictions = profile.modelBible.restrictions;
      setRestrictionsForm({
        contentLimitations: restrictions.contentLimitations || "",
        wallRestrictions: restrictions.wallRestrictions || "",
        mmExclusions: restrictions.mmExclusions || "",
        wordingToAvoid: restrictions.wordingToAvoid || [],
        customsToAvoid: restrictions.customsToAvoid || "",
      });
      setWordingToAvoidInput(restrictions.wordingToAvoid?.join(", ") || "");
    }
    setEditingRestrictions(true);
  };

  const handleSaveRestrictions = async () => {
    if (!apiClient || !profile) return;

    setSavingRestrictions(true);

    try {
      const updatedBible = {
        ...profile.modelBible,
        restrictions: {
          contentLimitations: restrictionsForm.contentLimitations,
          wallRestrictions: restrictionsForm.wallRestrictions,
          mmExclusions: restrictionsForm.mmExclusions,
          wordingToAvoid: restrictionsForm.wordingToAvoid,
          customsToAvoid: restrictionsForm.customsToAvoid,
        },
      };

      const response = await apiClient.patch(
        `/api/instagram-profiles/${profile.id}`,
        {
          modelBible: updatedBible,
        },
      );

      if (!response.ok) throw new Error("Failed to save restrictions");

      setProfile({ ...profile, modelBible: updatedBible });
      setEditingRestrictions(false);
      toast.success("Restrictions updated!");
    } catch (error) {
      console.error("Error saving restrictions:", error);
      toast.error("Failed to save restrictions");
    } finally {
      setSavingRestrictions(false);
    }
  };

  const handleCancelRestrictions = () => {
    if (profile?.modelBible?.restrictions) {
      const restrictions = profile.modelBible.restrictions;
      setRestrictionsForm({
        contentLimitations: restrictions.contentLimitations || "",
        wallRestrictions: restrictions.wallRestrictions || "",
        mmExclusions: restrictions.mmExclusions || "",
        wordingToAvoid: restrictions.wordingToAvoid || [],
        customsToAvoid: restrictions.customsToAvoid || "",
      });
      setWordingToAvoidInput(restrictions.wordingToAvoid?.join(", ") || "");
    }
    setEditingRestrictions(false);
  };

  const handleEditSchedule = () => {
    if (profile?.modelBible?.schedule) {
      const schedule = profile.modelBible.schedule;
      setScheduleForm({
        livestreamSchedule: schedule.livestreamSchedule || "",
        videoCallSchedule: schedule.videoCallSchedule || "",
        bundleClipsOk: schedule.bundleClipsOk || false,
      });
    }
    setEditingSchedule(true);
  };

  const handleSaveSchedule = async () => {
    if (!apiClient || !profile) return;

    setSavingSchedule(true);

    try {
      const updatedBible = {
        ...profile.modelBible,
        schedule: scheduleForm,
      };

      const response = await apiClient.patch(
        `/api/instagram-profiles/${profile.id}`,
        {
          modelBible: updatedBible,
        },
      );

      if (!response.ok) throw new Error("Failed to save schedule");

      setProfile({ ...profile, modelBible: updatedBible });
      setEditingSchedule(false);
      toast.success("Schedule updated!");
    } catch (error) {
      console.error("Error saving schedule:", error);
      toast.error("Failed to save schedule");
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleCancelSchedule = () => {
    if (profile?.modelBible?.schedule) {
      const schedule = profile.modelBible.schedule;
      setScheduleForm({
        livestreamSchedule: schedule.livestreamSchedule || "",
        videoCallSchedule: schedule.videoCallSchedule || "",
        bundleClipsOk: schedule.bundleClipsOk || false,
      });
    }
    setEditingSchedule(false);
  };

  const handleEditNotes = () => {
    setNotesForm(profile?.modelBible?.internalNotes || "");
    setEditingNotes(true);
  };

  const handleSaveNotes = async () => {
    if (!apiClient || !profile) return;

    setSavingNotes(true);

    try {
      const updatedBible = {
        ...profile.modelBible,
        internalNotes: notesForm,
      };

      const response = await apiClient.patch(
        `/api/instagram-profiles/${profile.id}`,
        {
          modelBible: updatedBible,
        },
      );

      if (!response.ok) throw new Error("Failed to save notes");

      setProfile({ ...profile, modelBible: updatedBible });
      setEditingNotes(false);
      toast.success("Notes updated!");
    } catch (error) {
      console.error("Error saving notes:", error);
      toast.error("Failed to save notes");
    } finally {
      setSavingNotes(false);
    }
  };

  const handleCancelNotes = () => {
    setNotesForm(profile?.modelBible?.internalNotes || "");
    setEditingNotes(false);
  };

  const defaultStrategies = [
    {
      id: "gf_experience",
      label: "GF Experience",
      desc: "Personal, intimate, relationship-focused",
    },
    {
      id: "porn_accurate",
      label: "Porn Accurate",
      desc: "Direct, explicit, content-focused",
    },
    {
      id: "tease_denial",
      label: "Tease & Denial",
      desc: "Playful buildup, anticipation",
    },
    {
      id: "premium_exclusive",
      label: "Premium Exclusive",
      desc: "High-end, selective, luxury feel",
    },
    {
      id: "girl_next_door",
      label: "Girl Next Door",
      desc: "Approachable, casual, friendly",
    },
    {
      id: "domme",
      label: "Domme",
      desc: "Commanding, in control, worship-focused",
    },
  ];

  const pageStrategies = [...defaultStrategies, ...customStrategies];

  const defaultContentTypes = [
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

  const allContentTypes = [...defaultContentTypes, ...customContentTypes];

  const tabs = [
    { id: "overview", label: "Overview", icon: User },
    { id: "pricing", label: "Pricing", icon: DollarSign },
    { id: "content", label: "Content & Restrictions", icon: FileText },
    { id: "captions", label: "Captions", icon: MessageSquare },
    { id: "gallery", label: "Gallery", icon: Image },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0c0c0f] text-[#e4e4e7] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#3b82f6]" />
          <p className="text-sm text-[#71717a]">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#0c0c0f] text-[#e4e4e7] flex items-center justify-center">
        <div className="text-center space-y-4">
          <AlertCircle className="w-12 h-12 mx-auto text-red-400" />
          <p className="text-sm text-[#71717a]">Profile not found</p>
          <button
            onClick={() => router.push(`/${tenant}/workspace/my-influencers`)}
            className="px-4 py-2 bg-[#3b82f6] text-white rounded-lg text-sm hover:bg-[#2563eb] transition-colors"
          >
            Back to Profiles
          </button>
        </div>
      </div>
    );
  }

  const bible = profile.modelBible;
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const totalPosts =
    (profile._count?.posts || 0) + (profile._count?.feedPosts || 0);

  // Add Strategy Modal Component
  const AddStrategyModal = () => {
    const [formData, setFormData] = useState({ id: "", label: "", desc: "" });
    const [saving, setSaving] = useState(false);

    // Initialize form with editing data
    useEffect(() => {
      if (editingStrategy) {
        setFormData(editingStrategy);
      } else {
        setFormData({ id: "", label: "", desc: "" });
      }
    }, [editingStrategy]);

    const handleSubmit = async () => {
      if (!formData.label.trim() || !formData.desc.trim()) {
        toast.error("Please fill in all fields");
        return;
      }

      setSaving(true);

      try {
        let updatedStrategies;

        if (editingStrategy) {
          // Edit existing strategy
          updatedStrategies = customStrategies.map((s) =>
            s.id === editingStrategy.id
              ? {
                  id: editingStrategy.id,
                  label: formData.label,
                  desc: formData.desc,
                }
              : s,
          );
        } else {
          // Add new strategy
          const id = formData.label.toLowerCase().replace(/[^a-z0-9]+/g, "_");
          const newStrategy = {
            id,
            label: formData.label,
            desc: formData.desc,
          };
          updatedStrategies = [...customStrategies, newStrategy];
        }

        // Save to database
        if (apiClient && profile) {
          const response = await apiClient.patch(
            `/api/instagram-profiles/${profile.id}`,
            {
              customStrategies: updatedStrategies,
            },
          );

          if (!response.ok) throw new Error("Failed to save strategy");

          // Update profile data
          setProfile({ ...profile, customStrategies: updatedStrategies });
        }

        // Add to local state
        setCustomStrategies(updatedStrategies);

        toast.success(
          editingStrategy ? "Strategy updated!" : "Strategy added!",
        );
        setShowStrategyModal(false);
        setEditingStrategy(null);
        setFormData({ id: "", label: "", desc: "" });
      } catch (error) {
        console.error("Error saving strategy:", error);
        toast.error("Failed to save strategy");
      } finally {
        setSaving(false);
      }
    };

    const handleClose = () => {
      setShowStrategyModal(false);
      setEditingStrategy(null);
      setFormData({ id: "", label: "", desc: "" });
    };

    if (!showStrategyModal) return null;

    const modalContent = (
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={handleClose}
      >
        <div
          className="bg-[#18181b] border border-[#27272a] rounded-2xl w-full max-w-md shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-6 border-b border-[#27272a]">
            <h3 className="text-lg font-semibold">
              {editingStrategy ? "Edit Strategy" : "Add Custom Strategy"}
            </h3>
            <button
              onClick={handleClose}
              className="text-[#71717a] hover:text-[#e4e4e7] transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-[#e4e4e7] mb-2">
                Strategy Name *
              </label>
              <input
                type="text"
                value={formData.label}
                onChange={(e) =>
                  setFormData({ ...formData, label: e.target.value })
                }
                placeholder="e.g., Fitness Babe"
                className="w-full h-11 px-4 text-sm bg-[#0c0c0f] border border-[#27272a] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-[#e4e4e7]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#e4e4e7] mb-2">
                Description *
              </label>
              <textarea
                value={formData.desc}
                onChange={(e) =>
                  setFormData({ ...formData, desc: e.target.value })
                }
                rows={3}
                placeholder="Brief description of the strategy approach..."
                className="w-full px-4 py-3 text-sm bg-[#0c0c0f] border border-[#27272a] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none text-[#e4e4e7]"
              />
            </div>

            <div className="px-4 py-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-400">
              This strategy will be available for selection and will affect
              caption generation and pricing.
            </div>
          </div>

          <div className="flex gap-3 p-6 border-t border-[#27272a]">
            <button
              onClick={handleClose}
              className="flex-1 px-4 py-2.5 bg-[#27272a] text-[#e4e4e7] rounded-lg text-sm hover:bg-[#3f3f46] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {editingStrategy ? "Updating..." : "Adding..."}
                </>
              ) : editingStrategy ? (
                "Update Strategy"
              ) : (
                "Add Strategy"
              )}
            </button>
          </div>
        </div>
      </div>
    );

    return typeof document !== "undefined"
      ? createPortal(modalContent, document.body)
      : null;
  };

  // Add Content Type Modal Component
  const AddContentTypeModal = () => {
    const [typeName, setTypeName] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
      if (editingContentType) {
        setTypeName(editingContentType);
      } else {
        setTypeName("");
      }
    }, [editingContentType]);

    const handleSubmit = async () => {
      if (!typeName.trim()) {
        toast.error("Please enter a content type name");
        return;
      }

      setSaving(true);

      try {
        let updatedCustomTypes;

        if (editingContentType) {
          // Edit existing type
          updatedCustomTypes = customContentTypes.map((t) =>
            t === editingContentType ? typeName.trim() : t,
          );
          // Update selected types if it was selected
          const updatedSelectedTypes = selectedContentTypes.map((t) =>
            t === editingContentType ? typeName.trim() : t,
          );
          setSelectedContentTypes(updatedSelectedTypes);
        } else {
          // Add new type
          updatedCustomTypes = [...customContentTypes, typeName.trim()];
        }

        // Save to database
        if (apiClient && profile) {
          const payload: any = { customContentTypes: updatedCustomTypes };
          if (
            editingContentType &&
            selectedContentTypes.includes(editingContentType)
          ) {
            payload.selectedContentTypes = selectedContentTypes.map((t) =>
              t === editingContentType ? typeName.trim() : t,
            );
          }

          const response = await apiClient.patch(
            `/api/instagram-profiles/${profile.id}`,
            payload,
          );

          if (!response.ok) throw new Error("Failed to save content type");

          setProfile({ ...profile, customContentTypes: updatedCustomTypes });
        }

        setCustomContentTypes(updatedCustomTypes);

        toast.success(
          editingContentType ? "Content type updated!" : "Content type added!",
        );
        setShowContentTypeModal(false);
        setEditingContentType(null);
        setTypeName("");
      } catch (error) {
        console.error("Error saving content type:", error);
        toast.error("Failed to save content type");
      } finally {
        setSaving(false);
      }
    };

    const handleClose = () => {
      setShowContentTypeModal(false);
      setEditingContentType(null);
      setTypeName("");
    };

    if (!showContentTypeModal) return null;

    const modalContent = (
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={handleClose}
      >
        <div
          className="bg-[#18181b] border border-[#27272a] rounded-2xl w-full max-w-md shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-6 border-b border-[#27272a]">
            <h3 className="text-lg font-semibold">
              {editingContentType ? "Edit Content Type" : "Add Content Type"}
            </h3>
            <button
              onClick={handleClose}
              className="text-[#71717a] hover:text-[#e4e4e7] transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-[#e4e4e7] mb-2">
                Content Type Name *
              </label>
              <input
                type="text"
                value={typeName}
                onChange={(e) => setTypeName(e.target.value)}
                placeholder="e.g., Behind The Scenes"
                className="w-full h-11 px-4 text-sm bg-[#0c0c0f] border border-[#27272a] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-[#e4e4e7]"
              />
            </div>

            <div className="px-4 py-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-400">
              This content type will be available for tagging and filtering
              content.
            </div>
          </div>

          <div className="flex gap-3 p-6 border-t border-[#27272a]">
            <button
              onClick={handleClose}
              className="flex-1 px-4 py-2.5 bg-[#27272a] text-[#e4e4e7] rounded-lg text-sm hover:bg-[#3f3f46] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {editingContentType ? "Updating..." : "Adding..."}
                </>
              ) : editingContentType ? (
                "Update Type"
              ) : (
                "Add Type"
              )}
            </button>
          </div>
        </div>
      </div>
    );

    return typeof document !== "undefined"
      ? createPortal(modalContent, document.body)
      : null;
  };

  return (
    <>
      <AddStrategyModal />
      <AddContentTypeModal />
      <div className="max-h-[85vh] overflow-y-auto overflow-x-hidden bg-[#0c0c0f] text-[#e4e4e7] font-sans border border-[#27272a] rounded-2xl shadow-lg custom-scrollbar">
        {/* Header */}
        <div className="sticky top-0 z-40 backdrop-blur-xl bg-[#0c0c0f]/90 border-b border-[#1f1f23] px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-5">
              {/* Back Button */}
              <button
                onClick={() =>
                  router.push(`/${tenant}/workspace/my-influencers`)
                }
                className="p-2 hover:bg-[#18181b] rounded-lg transition-colors"
              >
                <ArrowLeft size={20} className="text-[#71717a]" />
              </button>

              {/* Avatar */}
              <div className="w-18 h-18 rounded-2xl bg-gradient-to-br from-[#EC67A1] to-[#F774B9] flex items-center justify-center text-2xl font-semibold overflow-hidden">
                {profile.profileImageUrl ? (
                  <img
                    src={profile.profileImageUrl}
                    alt={profile.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  getInitials(profile.name)
                )}
              </div>

              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-2xl font-semibold">{profile.name}</h1>

                  {/* Type Badge */}
                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase ${
                      (profile.type || "real") === "ai"
                        ? "bg-brand-blue/15 text-brand-blue border border-brand-blue/30"
                        : "bg-brand-light-pink/15 text-brand-light-pink border border-brand-light-pink/30"
                    }`}
                  >
                    {(profile.type || "real") === "ai" ? "AI" : "Real"}
                  </span>

                  {/* Status Badge with Dropdown */}
                  <div className="relative" ref={statusDropdownRef}>
                    <button
                      onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                      disabled={savingStatus}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase flex items-center gap-1.5 transition-all hover:opacity-80 disabled:opacity-50 ${
                        (profile.status || "active") === "active"
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                          : (profile.status || "active") === "paused"
                            ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                            : "bg-gray-500/15 text-gray-400 border border-gray-500/30"
                      }`}
                    >
                      {(profile.status || "active") === "active"
                        ? "Active"
                        : (profile.status || "active") === "paused"
                          ? "Paused"
                          : "Pending"}
                      <ChevronDown
                        size={12}
                        className={`transition-transform ${showStatusDropdown ? "rotate-180" : ""}`}
                      />
                    </button>

                    {showStatusDropdown && (
                      <div className="absolute top-full mt-2 right-0 bg-[#18181b] border border-[#27272a] rounded-lg shadow-xl py-1 min-w-[140px] z-50">
                        {[
                          {
                            value: "active",
                            label: "Active",
                            color: "emerald",
                          },
                          { value: "paused", label: "Paused", color: "amber" },
                          { value: "pending", label: "Pending", color: "gray" },
                        ].map((status) => (
                          <button
                            key={status.value}
                            onClick={() =>
                              handleStatusChange(
                                status.value as "active" | "paused" | "pending",
                              )
                            }
                            disabled={
                              savingStatus ||
                              (profile.status || "active") === status.value
                            }
                            className={`w-full px-4 py-2 text-left text-[12px] font-medium transition-colors flex items-center gap-2 ${
                              (profile.status || "active") === status.value
                                ? "bg-[#27272a] text-[#e4e4e7]"
                                : "text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#e4e4e7]"
                            } disabled:opacity-50`}
                          >
                            {(profile.status || "active") === status.value && (
                              <Check size={12} />
                            )}
                            <span
                              className={`w-2 h-2 rounded-full ${
                                status.color === "emerald"
                                  ? "bg-emerald-400"
                                  : status.color === "amber"
                                    ? "bg-amber-400"
                                    : "bg-gray-400"
                              }`}
                            />
                            {status.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-[13px] text-[#71717a]">
                  {profile.name} •{" "}
                  {bible?.city || bible?.location || "Location not set"} •{" "}
                  {bible?.timezone || "Timezone not set"}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button className="px-4 py-2.5 bg-[#18181b] border border-[#27272a] rounded-lg text-[#a1a1aa] text-[13px] hover:bg-[#27272a] transition-colors flex items-center gap-2">
                <ExternalLink size={14} />
                View Pages
              </button>
              <button className="px-5 py-2.5 bg-[#3b82f6] rounded-lg text-white text-[13px] font-medium hover:bg-[#2563eb] transition-colors">
                Export Profile
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 rounded-lg text-[13px] transition-all flex items-center gap-2 ${
                  activeTab === tab.id
                    ? "bg-[#27272a] text-[#e4e4e7]"
                    : "text-[#71717a] hover:text-[#a1a1aa]"
                }`}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="px-8 py-8">
          {activeTab === "overview" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Page Strategy */}
              <div className="lg:col-span-2 bg-[#18181b] rounded-xl p-6 border border-[#27272a]">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 className="text-sm font-semibold mb-1">
                      Page Strategy
                    </h3>
                    <p className="text-xs text-[#71717a]">
                      Affects caption tone, pricing defaults, and content
                      approach
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowStrategyModal(true)}
                      className="px-3 py-1.5 bg-[#27272a] hover:bg-[#3f3f46] text-[#e4e4e7] rounded-lg text-[11px] font-medium transition-colors flex items-center gap-1.5"
                    >
                      <Plus size={12} />
                      Add Strategy
                    </button>
                    <div className="px-3 py-1.5 bg-blue-500/15 text-blue-400 rounded-lg text-[11px] font-semibold">
                      OPERATOR SET
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {pageStrategies.map((strategy) => {
                    const isCustom = !defaultStrategies.find(
                      (d) => d.id === strategy.id,
                    );
                    return (
                      <div
                        key={strategy.id}
                        onClick={() =>
                          !savingStrategy && handleStrategyChange(strategy.id)
                        }
                        className={`p-4 rounded-xl text-left transition-all relative group cursor-pointer ${
                          savingStrategy ? "opacity-50 cursor-not-allowed" : ""
                        } ${
                          pageStrategy === strategy.id
                            ? "bg-blue-500/10 border-2 border-blue-500"
                            : "bg-[#0c0c0f] border-2 border-[#27272a] hover:border-[#3f3f46]"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div
                            className={`text-sm font-semibold ${
                              pageStrategy === strategy.id
                                ? "text-blue-400"
                                : "text-[#e4e4e7]"
                            }`}
                          >
                            {strategy.label}
                          </div>
                          {pageStrategy === strategy.id && (
                            <Check className="w-4 h-4 text-blue-400" />
                          )}
                        </div>
                        <div className="text-xs text-[#71717a]">
                          {strategy.desc}
                        </div>
                        {isCustom && (
                          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditStrategy(strategy);
                              }}
                              className="p-1.5 bg-[#27272a] hover:bg-blue-500/20 rounded-lg transition-colors"
                              title="Edit strategy"
                            >
                              <Edit2 size={12} className="text-blue-400" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteStrategy(strategy.id);
                              }}
                              className="p-1.5 bg-[#27272a] hover:bg-red-500/20 rounded-lg transition-colors"
                              title="Delete strategy"
                            >
                              <Trash2 size={12} className="text-red-400" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {savingStrategy && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-blue-400">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Saving strategy...
                  </div>
                )}
              </div>

              {/* Content Types */}
              <div className="bg-[#18181b] rounded-xl p-6 border border-[#27272a]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold">Content Types</h3>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowContentTypeModal(true)}
                      className="px-3 py-1.5 bg-[#27272a] hover:bg-[#3f3f46] text-[#e4e4e7] rounded-lg text-[11px] font-medium transition-colors flex items-center gap-1.5"
                    >
                      <Plus size={12} />
                      Add Type
                    </button>
                    <span className="px-2 py-1 bg-emerald-500/15 text-emerald-400 rounded text-[11px] font-medium">
                      {selectedContentTypes.length} active
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {allContentTypes.map((type) => {
                    const isSelected = selectedContentTypes.includes(type);
                    const isCustom = !defaultContentTypes.includes(type);
                    return (
                      <div
                        key={type}
                        onClick={() => handleToggleContentType(type)}
                        className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer relative group ${
                          isSelected
                            ? "bg-emerald-500/15 border border-emerald-500 text-emerald-400"
                            : "bg-[#0c0c0f] border border-[#27272a] text-[#52525b] hover:border-[#3f3f46]"
                        }`}
                      >
                        {isSelected && <Check size={12} />}
                        {type}
                        {isCustom && (
                          <div className="absolute -top-1 -right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditContentType(type);
                              }}
                              className="p-1 bg-[#18181b] hover:bg-blue-500/20 rounded-md transition-colors border border-[#27272a]"
                              title="Edit type"
                            >
                              <Edit2 size={10} className="text-blue-400" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteContentType(type);
                              }}
                              className="p-1 bg-[#18181b] hover:bg-red-500/20 rounded-md transition-colors border border-[#27272a]"
                              title="Delete type"
                            >
                              <Trash2 size={10} className="text-red-400" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 px-3 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-400 flex items-start gap-2">
                  <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                  <span>
                    These content types filter which captions appear for this
                    model and how gallery content is tagged.
                  </span>
                </div>
              </div>

              {/* Basic Info */}
              <div className="bg-[#18181b] rounded-xl p-6 border border-[#27272a]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold">Basic Info</h3>
                  {!editingBasicInfo ? (
                    <button
                      onClick={() => setEditingBasicInfo(true)}
                      className="px-3 py-1.5 bg-[#27272a] hover:bg-[#3f3f46] text-[#e4e4e7] rounded-lg text-[11px] font-medium transition-colors flex items-center gap-1.5"
                    >
                      <Edit2 size={12} />
                      Edit
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCancelBasicInfo}
                        disabled={savingBasicInfo}
                        className="px-3 py-1.5 bg-[#27272a] hover:bg-[#3f3f46] text-[#e4e4e7] rounded-lg text-[11px] font-medium transition-colors disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveBasicInfo}
                        disabled={savingBasicInfo}
                        className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-[11px] font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {savingBasicInfo ? (
                          <>
                            <Loader2 size={12} className="animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save size={12} />
                            Save
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {[
                    {
                      label: "Age",
                      value: bible?.age,
                      field: "age",
                      type: "text",
                    },
                    {
                      label: "Birthday",
                      value: bible?.birthday,
                      field: "birthday",
                      type: "date",
                    },
                    {
                      label: "Height",
                      value: bible?.height,
                      field: "height",
                      type: "text",
                    },
                    {
                      label: "Weight",
                      value: bible?.weight,
                      field: "weight",
                      type: "text",
                    },
                    {
                      label: "Ethnicity",
                      value: bible?.ethnicity,
                      field: "ethnicity",
                      type: "text",
                    },
                    {
                      label: "Timezone",
                      value: bible?.timezone,
                      field: "timezone",
                      type: "text",
                    },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="text-[11px] text-[#71717a] mb-1">
                        {item.label}
                      </div>
                      {editingBasicInfo ? (
                        <input
                          type={item.type}
                          value={
                            basicInfoForm[
                              item.field as keyof typeof basicInfoForm
                            ] as string
                          }
                          onChange={(e) =>
                            setBasicInfoForm({
                              ...basicInfoForm,
                              [item.field]: e.target.value,
                            })
                          }
                          placeholder={
                            item.type === "date"
                              ? ""
                              : `Enter ${item.label.toLowerCase()}`
                          }
                          className="w-full px-2.5 py-1.5 bg-[#0c0c0f] border border-[#27272a] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                      ) : (
                        <div className="text-sm">{item.value || "Not set"}</div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-4 border-t border-[#27272a]">
                  <div className="text-[11px] text-[#71717a] mb-1">
                    Clothing Sizes
                  </div>
                  {editingBasicInfo ? (
                    <div className="grid grid-cols-4 gap-3">
                      <div>
                        <input
                          type="text"
                          value={basicInfoForm.clothingSizes.bra}
                          onChange={(e) =>
                            setBasicInfoForm({
                              ...basicInfoForm,
                              clothingSizes: {
                                ...basicInfoForm.clothingSizes,
                                bra: e.target.value,
                              },
                            })
                          }
                          placeholder="Bra"
                          className="w-full px-2.5 py-1.5 bg-[#0c0c0f] border border-[#27272a] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          value={basicInfoForm.clothingSizes.top}
                          onChange={(e) =>
                            setBasicInfoForm({
                              ...basicInfoForm,
                              clothingSizes: {
                                ...basicInfoForm.clothingSizes,
                                top: e.target.value,
                              },
                            })
                          }
                          placeholder="Top"
                          className="w-full px-2.5 py-1.5 bg-[#0c0c0f] border border-[#27272a] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          value={basicInfoForm.clothingSizes.bottom}
                          onChange={(e) =>
                            setBasicInfoForm({
                              ...basicInfoForm,
                              clothingSizes: {
                                ...basicInfoForm.clothingSizes,
                                bottom: e.target.value,
                              },
                            })
                          }
                          placeholder="Bottom"
                          className="w-full px-2.5 py-1.5 bg-[#0c0c0f] border border-[#27272a] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          value={basicInfoForm.clothingSizes.shoes}
                          onChange={(e) =>
                            setBasicInfoForm({
                              ...basicInfoForm,
                              clothingSizes: {
                                ...basicInfoForm.clothingSizes,
                                shoes: e.target.value,
                              },
                            })
                          }
                          placeholder="Shoes"
                          className="w-full px-2.5 py-1.5 bg-[#0c0c0f] border border-[#27272a] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-[13px]">
                      {bible?.clothingSizes?.bra ||
                      bible?.clothingSizes?.top ||
                      bible?.clothingSizes?.bottom ||
                      bible?.clothingSizes?.shoes ? (
                        <>
                          {bible.clothingSizes.bra &&
                            `Bra: ${bible.clothingSizes.bra}`}
                          {bible.clothingSizes.bra &&
                            bible.clothingSizes.top &&
                            " • "}
                          {bible.clothingSizes.top &&
                            `Top: ${bible.clothingSizes.top}`}
                          {bible.clothingSizes.top &&
                            bible.clothingSizes.bottom &&
                            " • "}
                          {bible.clothingSizes.bottom &&
                            `Bottom: ${bible.clothingSizes.bottom}`}
                          {bible.clothingSizes.bottom &&
                            bible.clothingSizes.shoes &&
                            " • "}
                          {bible.clothingSizes.shoes &&
                            `Shoes: ${bible.clothingSizes.shoes}`}
                        </>
                      ) : (
                        "Not set"
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Persona */}
              <div className="bg-[#18181b] rounded-xl p-6 border border-[#27272a]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold">Persona</h3>
                  {!editingPersona ? (
                    <button
                      onClick={() => setEditingPersona(true)}
                      className="px-3 py-1.5 bg-[#27272a] hover:bg-[#3f3f46] text-[#e4e4e7] rounded-lg text-[11px] font-medium transition-colors flex items-center gap-1.5"
                    >
                      <Edit2 size={12} />
                      Edit
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCancelPersona}
                        disabled={savingPersona}
                        className="px-3 py-1.5 bg-[#27272a] hover:bg-[#3f3f46] text-[#e4e4e7] rounded-lg text-[11px] font-medium transition-colors disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSavePersona}
                        disabled={savingPersona}
                        className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-[11px] font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {savingPersona ? (
                          <>
                            <Loader2 size={12} className="animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save size={12} />
                            Save
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                <div className="mb-4">
                  <div className="text-[11px] text-[#71717a] mb-1">
                    Background
                  </div>
                  {editingPersona ? (
                    <textarea
                      value={personaForm.backstory}
                      onChange={(e) =>
                        setPersonaForm({
                          ...personaForm,
                          backstory: e.target.value,
                        })
                      }
                      placeholder="Enter background story..."
                      rows={3}
                      className="w-full px-2.5 py-1.5 bg-[#0c0c0f] border border-[#27272a] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
                    />
                  ) : (
                    <div className="text-[13px] leading-relaxed">
                      {bible?.backstory || "Not set"}
                    </div>
                  )}
                </div>

                <div className="mb-4">
                  <div className="text-[11px] text-[#71717a] mb-2">
                    Interests
                  </div>
                  {editingPersona ? (
                    <input
                      type="text"
                      value={interestsInput}
                      onChange={(e) => setInterestsInput(e.target.value)}
                      placeholder="Yoga, Hiking, Coffee (comma-separated)"
                      className="w-full px-2.5 py-1.5 bg-[#0c0c0f] border border-[#27272a] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {bible?.interests && bible.interests.length > 0 ? (
                        bible.interests.map((interest: string) => (
                          <span
                            key={interest}
                            className="px-2.5 py-1 bg-[#27272a] rounded text-xs"
                          >
                            {interest}
                          </span>
                        ))
                      ) : (
                        <span className="text-[13px] text-[#71717a]">
                          Not set
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className="text-[11px] text-[#71717a] mb-1">
                      Personality
                    </div>
                    {editingPersona ? (
                      <input
                        type="text"
                        value={personaForm.personalityDescription}
                        onChange={(e) =>
                          setPersonaForm({
                            ...personaForm,
                            personalityDescription: e.target.value,
                          })
                        }
                        placeholder="e.g., Switch"
                        className="w-full px-2.5 py-1.5 bg-[#0c0c0f] border border-[#27272a] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      />
                    ) : (
                      <div className="text-[13px] capitalize">
                        {bible?.personalityDescription || "Not set"}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-[11px] text-[#71717a] mb-1">
                      Favorite Colors
                    </div>
                    {editingPersona ? (
                      <input
                        type="text"
                        value={colorsInput}
                        onChange={(e) => setColorsInput(e.target.value)}
                        placeholder="Pink, White, Black"
                        className="w-full px-2.5 py-1.5 bg-[#0c0c0f] border border-[#27272a] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      />
                    ) : (
                      <div className="text-[13px]">
                        {bible?.favoriteColors &&
                        bible.favoriteColors.length > 0
                          ? bible.favoriteColors.join(", ")
                          : "Not set"}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mb-4">
                  <div className="text-[11px] text-[#71717a] mb-1">
                    Lingo & Keywords
                  </div>
                  {editingPersona ? (
                    <input
                      type="text"
                      value={lingoInput}
                      onChange={(e) => setLingoInput(e.target.value)}
                      placeholder="babe, hun, omg, literally"
                      className="w-full px-2.5 py-1.5 bg-[#0c0c0f] border border-[#27272a] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  ) : (
                    <div className="text-[13px]">
                      {bible?.lingoKeywords && bible.lingoKeywords.length > 0
                        ? bible.lingoKeywords.join(", ")
                        : "Not set"}
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-[11px] text-[#71717a] mb-1">
                    Preferred Emojis
                  </div>
                  {editingPersona ? (
                    <input
                      type="text"
                      value={emojisInput}
                      onChange={(e) => setEmojisInput(e.target.value)}
                      placeholder="💕 🥰 😘 ✨ 🔥"
                      className="w-full px-2.5 py-1.5 bg-[#0c0c0f] border border-[#27272a] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  ) : (
                    <div className="text-lg">
                      {bible?.preferredEmojis &&
                      bible.preferredEmojis.length > 0
                        ? bible.preferredEmojis.join(" ")
                        : "Not set"}
                    </div>
                  )}
                </div>
              </div>

              {/* Platforms */}
              <div className="bg-[#18181b] rounded-xl p-6 border border-[#27272a]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold">Platforms</h3>
                  {!editingPlatforms ? (
                    <button
                      onClick={() => setEditingPlatforms(true)}
                      className="px-3 py-1.5 bg-[#27272a] hover:bg-[#3f3f46] text-[#e4e4e7] rounded-lg text-[11px] font-medium transition-colors flex items-center gap-1.5"
                    >
                      <Edit2 size={12} />
                      Edit
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCancelPlatforms}
                        disabled={savingPlatforms}
                        className="px-3 py-1.5 bg-[#27272a] hover:bg-[#3f3f46] text-[#e4e4e7] rounded-lg text-[11px] font-medium transition-colors disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSavePlatforms}
                        disabled={savingPlatforms}
                        className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-[11px] font-medium transition-colors disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {savingPlatforms ? (
                          <>
                            <Loader2 size={12} className="animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save size={12} />
                            Save
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  {[
                    {
                      label: "OF Free",
                      field: "onlyFansFree",
                      placeholder: "https://onlyfans.com/username",
                    },
                    {
                      label: "OF Paid",
                      field: "onlyFansPaid",
                      placeholder: "https://onlyfans.com/username",
                    },
                    {
                      label: "OFTV",
                      field: "oftv",
                      placeholder: "https://oftv.com/username",
                    },
                    {
                      label: "Fansly",
                      field: "fansly",
                      placeholder: "https://fansly.com/username",
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between px-3 py-2.5 bg-[#0c0c0f] rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="text-[11px] text-[#71717a] mb-1">
                          {item.label}
                        </div>
                        {editingPlatforms ? (
                          <input
                            type="text"
                            value={
                              platformsForm[
                                item.field as keyof typeof platformsForm
                              ]
                            }
                            onChange={(e) =>
                              setPlatformsForm({
                                ...platformsForm,
                                [item.field]: e.target.value,
                              })
                            }
                            placeholder={item.placeholder}
                            className="w-full px-2 py-1 bg-[#18181b] border border-[#27272a] rounded text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                          />
                        ) : (
                          <div
                            className={`text-[13px] ${bible?.platforms?.[item.field as keyof typeof bible.platforms] ? "text-[#e4e4e7]" : "text-[#52525b]"}`}
                          >
                            {bible?.platforms?.[
                              item.field as keyof typeof bible.platforms
                            ] || "Not set"}
                          </div>
                        )}
                      </div>
                      {!editingPlatforms &&
                        bible?.platforms?.[
                          item.field as keyof typeof bible.platforms
                        ] && (
                          <ExternalLink
                            size={14}
                            className="text-[#71717a] cursor-pointer ml-2"
                          />
                        )}
                    </div>
                  ))}
                </div>

                {bible?.platforms?.oftvInterest === "need_info" && (
                  <div className="mt-3 px-3 py-2.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-400">
                    Model interested in OFTV — needs more info
                  </div>
                )}
              </div>

              {/* Socials */}
              <div className="bg-[#18181b] rounded-xl p-6 border border-[#27272a]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold">Socials</h3>
                  {!editingSocials ? (
                    <button
                      onClick={() => setEditingSocials(true)}
                      className="px-3 py-1.5 bg-[#27272a] hover:bg-[#3f3f46] text-[#e4e4e7] rounded-lg text-[11px] font-medium transition-colors flex items-center gap-1.5"
                    >
                      <Edit2 size={12} />
                      Edit
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCancelSocials}
                        disabled={savingSocials}
                        className="px-3 py-1.5 bg-[#27272a] hover:bg-[#3f3f46] text-[#e4e4e7] rounded-lg text-[11px] font-medium transition-colors disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveSocials}
                        disabled={savingSocials}
                        className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-[11px] font-medium transition-colors disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {savingSocials ? (
                          <>
                            <Loader2 size={12} className="animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save size={12} />
                            Save
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2.5">
                  {["instagram", "twitter", "tiktok", "reddit"].map(
                    (platform) => {
                      const data = bible?.socials?.[platform] || {
                        handle: "",
                        managed: false,
                        contentLevel: [],
                      };
                      return editingSocials ? (
                        <div
                          key={platform}
                          className="px-3 py-2.5 bg-[#0c0c0f] rounded-lg"
                        >
                          <div className="flex items-center gap-2.5 mb-2">
                            <div className="w-7 h-7 rounded-md bg-[#27272a] flex items-center justify-center flex-shrink-0">
                              {platform === "instagram" && (
                                <Instagram size={14} />
                              )}
                              {platform === "twitter" && <Twitter size={14} />}
                              {platform === "tiktok" && (
                                <span className="text-xs font-semibold">
                                  TT
                                </span>
                              )}
                              {platform === "reddit" && (
                                <span className="text-xs font-semibold">R</span>
                              )}
                            </div>
                            <div className="capitalize text-[11px] text-[#71717a] font-medium">
                              {platform}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div>
                              <div className="text-[10px] text-[#71717a] mb-1">
                                Handle
                              </div>
                              <input
                                type="text"
                                value={socialsForm[platform]?.handle || ""}
                                onChange={(e) =>
                                  setSocialsForm({
                                    ...socialsForm,
                                    [platform]: {
                                      ...socialsForm[platform],
                                      handle: e.target.value,
                                    },
                                  })
                                }
                                placeholder="@username"
                                className="w-full px-2 py-1 bg-[#18181b] border border-[#27272a] rounded text-[12px] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                              />
                            </div>
                            <div>
                              <div className="text-[10px] text-[#71717a] mb-1">
                                Content Level
                              </div>
                              <input
                                type="text"
                                value={
                                  socialsForm[platform]?.contentLevel || ""
                                }
                                onChange={(e) =>
                                  setSocialsForm({
                                    ...socialsForm,
                                    [platform]: {
                                      ...socialsForm[platform],
                                      contentLevel: e.target.value,
                                    },
                                  })
                                }
                                placeholder="SFW, NSFW (comma-separated)"
                                className="w-full px-2 py-1 bg-[#18181b] border border-[#27272a] rounded text-[12px] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                              />
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={
                                  socialsForm[platform]?.managed || false
                                }
                                onChange={(e) =>
                                  setSocialsForm({
                                    ...socialsForm,
                                    [platform]: {
                                      ...socialsForm[platform],
                                      managed: e.target.checked,
                                    },
                                  })
                                }
                                className="w-4 h-4 rounded"
                              />
                              <span className="text-[11px] text-[#e4e4e7]">
                                Managed by team
                              </span>
                            </label>
                          </div>
                        </div>
                      ) : (
                        <div
                          key={platform}
                          className="flex items-center justify-between px-3 py-2.5 bg-[#0c0c0f] rounded-lg"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-md bg-[#27272a] flex items-center justify-center">
                              {platform === "instagram" && (
                                <Instagram size={14} />
                              )}
                              {platform === "twitter" && <Twitter size={14} />}
                              {platform === "tiktok" && (
                                <span className="text-xs font-semibold">
                                  TT
                                </span>
                              )}
                              {platform === "reddit" && (
                                <span className="text-xs font-semibold">R</span>
                              )}
                            </div>
                            <div>
                              <div className="text-[13px]">
                                {data.handle || "Not set"}
                              </div>
                              {data.contentLevel &&
                                data.contentLevel.length > 0 && (
                                  <div className="text-[11px] text-[#71717a]">
                                    {data.contentLevel.join(", ")}
                                  </div>
                                )}
                            </div>
                          </div>
                          <span
                            className={`px-2 py-1 rounded text-[10px] font-semibold ${
                              data.managed
                                ? "bg-emerald-500/15 text-emerald-400"
                                : "bg-amber-500/15 text-amber-400"
                            }`}
                          >
                            {data.managed ? "MANAGED" : "NOT MANAGED"}
                          </span>
                        </div>
                      );
                    },
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "pricing" && profile && (
            <PricingTab
              profile={profile}
              onSavePricingSection={handleSavePricingSection}
              savingPricing={savingPricing}
            />
          )}

          {activeTab === "content" && (
            <ContentTab
              profile={profile}
              editingRestrictions={editingRestrictions}
              restrictionsForm={restrictionsForm}
              setRestrictionsForm={setRestrictionsForm}
              wordingToAvoidInput={wordingToAvoidInput}
              setWordingToAvoidInput={setWordingToAvoidInput}
              onEditRestrictions={handleEditRestrictions}
              onSaveRestrictions={handleSaveRestrictions}
              onCancelRestrictions={handleCancelRestrictions}
              savingRestrictions={savingRestrictions}
              editingSchedule={editingSchedule}
              scheduleForm={scheduleForm}
              setScheduleForm={setScheduleForm}
              onEditSchedule={handleEditSchedule}
              onSaveSchedule={handleSaveSchedule}
              onCancelSchedule={handleCancelSchedule}
              savingSchedule={savingSchedule}
              editingNotes={editingNotes}
              notesForm={notesForm}
              setNotesForm={setNotesForm}
              onEditNotes={handleEditNotes}
              onSaveNotes={handleSaveNotes}
              onCancelNotes={handleCancelNotes}
              savingNotes={savingNotes}
            />
          )}

          {activeTab === "captions" && (
            <div className="bg-[#18181b] rounded-xl p-6 border border-[#27272a]">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-base font-semibold mb-1">
                    Captions for {profile.name}
                  </h3>
                  <p className="text-[13px] text-[#71717a]">
                    Showing captions matching active content types
                  </p>
                </div>
                <button className="px-4 py-2.5 bg-[#3b82f6] rounded-lg text-white text-[13px] hover:bg-[#2563eb] transition-colors">
                  + Add Caption
                </button>
              </div>

              <div className="py-10 bg-[#0c0c0f] rounded-lg text-center text-[#52525b]">
                <MessageSquare size={32} className="mx-auto mb-3 opacity-50" />
                <div className="text-sm mb-1">Caption Bank</div>
                <div className="text-xs">
                  Filtered by model's content types. Only shows relevant
                  captions.
                </div>
              </div>
            </div>
          )}

          {activeTab === "gallery" && (
            <div className="bg-[#18181b] rounded-xl p-6 border border-[#27272a]">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-base font-semibold mb-1">
                    Captions for {profile.name}
                  </h3>
                  <p className="text-[13px] text-[#71717a]">
                    Showing captions matching active content types
                  </p>
                </div>
                <button className="px-4 py-2.5 bg-[#3b82f6] rounded-lg text-white text-[13px] hover:bg-[#2563eb] transition-colors">
                  + Add Caption
                </button>
              </div>

              <div className="py-10 bg-[#0c0c0f] rounded-lg text-center text-[#52525b]">
                <MessageSquare size={32} className="mx-auto mb-3 opacity-50" />
                <div className="text-sm mb-1">Caption Bank</div>
                <div className="text-xs">
                  Filtered by model's content types. Only shows relevant
                  captions.
                </div>
              </div>
            </div>
          )}

          {activeTab === "gallery" && (
            <div className="bg-[#18181b] rounded-xl p-6 border border-[#27272a]">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-base font-semibold mb-1">
                    Gallery for {profile.name}
                  </h3>
                  <p className="text-[13px] text-[#71717a]">
                    Content tagged by type with performance metrics
                  </p>
                </div>
                <button className="px-4 py-2.5 bg-[#3b82f6] rounded-lg text-white text-[13px] hover:bg-[#2563eb] transition-colors">
                  + Upload Content
                </button>
              </div>

              <div className="py-10 bg-[#0c0c0f] rounded-lg text-center text-[#52525b]">
                <Image size={32} className="mx-auto mb-3 opacity-50" />
                <div className="text-sm mb-1">Content Gallery</div>
                <div className="text-xs">
                  Each item tagged by content type with revenue, sales, and
                  conversion data.
                </div>
              </div>
            </div>
          )}

          {activeTab === "settings" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Profile Configuration */}
              <div className="bg-[#18181b] rounded-xl p-6 border border-[#27272a]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold">
                    Profile Configuration
                  </h3>
                  {!editingSettings ? (
                    <button
                      onClick={() => {
                        setSettingsForm({
                          type: profile.type || "real",
                          shareWithOrganization: !!profile.organizationId,
                        });
                        setEditingSettings(true);
                      }}
                      className="px-3 py-1.5 bg-[#27272a] rounded-lg text-[#a1a1aa] text-xs hover:bg-[#3f3f46] transition-colors flex items-center gap-2"
                    >
                      <Edit2 size={12} />
                      Edit
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingSettings(false)}
                        disabled={savingSettings}
                        className="px-3 py-1.5 bg-[#27272a] rounded-lg text-[#a1a1aa] text-xs hover:bg-[#3f3f46] transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={async () => {
                          if (!apiClient || !profile) return;
                          setSavingSettings(true);
                          try {
                            const response = await apiClient.patch(
                              `/api/instagram-profiles/${profile.id}`,
                              {
                                type: settingsForm.type,
                                shareWithOrganization:
                                  settingsForm.shareWithOrganization,
                              },
                            );
                            if (!response.ok)
                              throw new Error("Failed to save settings");
                            setProfile({
                              ...profile,
                              type: settingsForm.type,
                              organizationId: settingsForm.shareWithOrganization
                                ? profile.organizationId || undefined
                                : undefined,
                            });
                            setEditingSettings(false);
                            toast.success("Settings updated!");
                            await loadProfile();
                          } catch (error) {
                            console.error("Error saving settings:", error);
                            toast.error("Failed to save settings");
                          } finally {
                            setSavingSettings(false);
                          }
                        }}
                        disabled={savingSettings}
                        className="px-3 py-1.5 bg-[#3b82f6] rounded-lg text-white text-xs hover:bg-[#2563eb] transition-colors flex items-center gap-2"
                      >
                        {savingSettings ? (
                          <>Saving...</>
                        ) : (
                          <>
                            <Save size={12} />
                            Save
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {/* Profile Type */}
                  <div>
                    <div className="text-[11px] text-[#71717a] mb-2">
                      Profile Type
                    </div>
                    {editingSettings ? (
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() =>
                            setSettingsForm({ ...settingsForm, type: "real" })
                          }
                          className={`px-4 py-3 rounded-lg text-sm font-medium transition-all border-2 ${
                            settingsForm.type === "real"
                              ? "bg-brand-light-pink/15 text-brand-light-pink border-brand-light-pink/30"
                              : "bg-[#0c0c0f] text-[#71717a] border-[#27272a] hover:border-[#3f3f46]"
                          }`}
                        >
                          <div className="flex items-center justify-center gap-2">
                            {settingsForm.type === "real" && (
                              <Check size={14} />
                            )}
                            Real Person
                          </div>
                        </button>
                        <button
                          onClick={() =>
                            setSettingsForm({ ...settingsForm, type: "ai" })
                          }
                          className={`px-4 py-3 rounded-lg text-sm font-medium transition-all border-2 ${
                            settingsForm.type === "ai"
                              ? "bg-brand-blue/15 text-brand-blue border-brand-blue/30"
                              : "bg-[#0c0c0f] text-[#71717a] border-[#27272a] hover:border-[#3f3f46]"
                          }`}
                        >
                          <div className="flex items-center justify-center gap-2">
                            {settingsForm.type === "ai" && <Check size={14} />}
                            AI Model
                          </div>
                        </button>
                      </div>
                    ) : (
                      <div
                        className={`px-4 py-3 rounded-lg text-sm font-medium border-2 ${
                          (profile.type || "real") === "ai"
                            ? "bg-brand-blue/15 text-brand-blue border-brand-blue/30"
                            : "bg-brand-light-pink/15 text-brand-light-pink border-brand-light-pink/30"
                        }`}
                      >
                        {(profile.type || "real") === "ai"
                          ? "AI Model"
                          : "Real Person"}
                      </div>
                    )}
                  </div>

                  {/* Share with Organization */}
                  <div>
                    <div className="text-[11px] text-[#71717a] mb-2">
                      Organization Sharing
                    </div>
                    {editingSettings ? (
                      <label className="flex items-center gap-3 px-4 py-3 bg-[#0c0c0f] border border-[#27272a] rounded-lg cursor-pointer hover:bg-[#18181b] transition-colors">
                        <input
                          type="checkbox"
                          checked={settingsForm.shareWithOrganization}
                          onChange={(e) =>
                            setSettingsForm({
                              ...settingsForm,
                              shareWithOrganization: e.target.checked,
                            })
                          }
                          className="w-4 h-4"
                        />
                        <div>
                          <div className="text-sm text-[#e4e4e7]">
                            Share with Organization
                          </div>
                          <div className="text-xs text-[#71717a] mt-0.5">
                            Allow team members to access this profile
                          </div>
                        </div>
                      </label>
                    ) : (
                      <div
                        className={`px-4 py-3 rounded-lg text-sm border ${
                          profile.organizationId
                            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                            : "bg-[#0c0c0f] text-[#71717a] border-[#27272a]"
                        }`}
                      >
                        {profile.organizationId ? (
                          <div className="flex items-center gap-2">
                            <Check size={14} />
                            Shared with{" "}
                            {profile.organization?.name || "Organization"}
                          </div>
                        ) : (
                          "Not shared with organization"
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Profile Owner Info */}
              <div className="bg-[#18181b] rounded-xl p-6 border border-[#27272a]">
                <h3 className="text-sm font-semibold mb-4">
                  Profile Information
                </h3>
                <div className="space-y-3">
                  <div>
                    <div className="text-[11px] text-[#71717a] mb-1">
                      Profile ID
                    </div>
                    <div className="px-3 py-2 bg-[#0c0c0f] rounded-lg text-[13px] font-mono text-[#a1a1aa]">
                      {profile.id}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#71717a] mb-1">
                      Created
                    </div>
                    <div className="px-3 py-2 bg-[#0c0c0f] rounded-lg text-[13px]">
                      {new Date(profile.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </div>
                  </div>
                  {profile.isShared && profile.user && (
                    <div>
                      <div className="text-[11px] text-[#71717a] mb-1">
                        Shared By
                      </div>
                      <div className="px-3 py-2 bg-[#0c0c0f] rounded-lg text-[13px] flex items-center gap-2">
                        {profile.user.imageUrl && (
                          <img
                            src={profile.user.imageUrl}
                            alt={profile.user.name || "User"}
                            className="w-6 h-6 rounded-full"
                          />
                        )}
                        <span>
                          {profile.user.name ||
                            `${profile.user.firstName || ""} ${profile.user.lastName || ""}`.trim() ||
                            profile.user.email ||
                            "Unknown User"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
