// app/(dashboard)/workspace/my-influencers/page.tsx - Modern Influencer Profile Management
"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useApiClient } from "@/lib/apiClient";
import { useUser } from "@clerk/nextjs";
import { useRouter, useParams } from "next/navigation";
import { useBillingInfo } from "@/lib/hooks/useBilling.query";
import {
  Users,
  Plus,
  Edit3,
  Trash2,
  AlertCircle,
  Loader2,
  Share2,
  X,
  CheckCircle,
  Instagram,
  User,
  Heart,
  Palette,
  MessageCircle,
  Camera,
  FileText,
  Star,
  BookOpen,
  MoreVertical,
  Building2,
  Search,
  ChevronRight,
  Settings,
  Upload,
  CreditCard,
  Pause,
  XCircle,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

// Types
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
  type?: string; // "real", "ai", or "of_model"
  status?: string; // "active", "pending", etc.
  metadata?: Record<string, string | string[] | boolean>;
}

interface LinkedLoRA {
  id: string;
  displayName: string;
  thumbnailUrl: string | null;
  fileName: string;
}

interface ModelBible {
  age?: string;
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

  // OF Model Business Fields
  displayName?: string;
  slug?: string;
  percentageTaken?: number;
  guaranteedAmount?: number;
  launchDate?: string;
  referrerName?: string;
  chattingManagers?: string[];

  // Social URLs
  twitterUrl?: string;
  tiktokUrl?: string;
  websiteUrl?: string;
  profileLinkUrl?: string;

  // Extended Details
  fullName?: string;
  birthday?: string;
  height?: string;
  weight?: string;
  ethnicity?: string;
  timezone?: string;
  interests?: string[];
  favoriteColors?: string[];
  amazonWishlist?: string;
  restrictedTerms?: string[];

  // Enriched Pricing
  pricingCategories?: PricingCategory[];

  // Migration tracking
  migratedFromOfModel?: string;
  migratedAt?: string;
}

interface PricingItem {
  item: string;
  price: string;
}

interface PricingCategory {
  name: string;
  slug: string;
  description?: string;
  order: number;
  items: PricingCategoryItem[];
}

interface PricingCategoryItem {
  name: string;
  price: number;
  description?: string;
  order: number;
  isActive: boolean;
  isFree: boolean;
  priceType: "FIXED" | "RANGE" | "MINIMUM";
  priceMin?: number;
  priceMax?: number;
}

type FilterMode = "all" | "mine" | "shared";

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

type SortOption =
  | "name"
  | "dateCreated"
  | "dateUpdated"
  | "postsCount"
  | "completeness";

const DEFAULT_PRICING_ITEMS: PricingItem[] = [
  { item: "Dick rating (text)", price: "" },
  { item: "Dick rating (video)", price: "" },
  { item: "Custom photo (SFW)", price: "" },
  { item: "Custom photo (NSFW)", price: "" },
  { item: "Custom video (per min)", price: "" },
  { item: "Sexting session (10 min)", price: "" },
  { item: "GFE (daily)", price: "" },
  { item: "GFE (weekly)", price: "" },
  { item: "Video call (per min)", price: "" },
  { item: "Worn items", price: "" },
];

// Profile completeness calculation
interface CompletenessResult {
  percentage: number;
  filledSections: string[];
  missingSections: string[];
  totalSections: number;
  filledCount: number;
}

const MODEL_BIBLE_SECTIONS = [
  {
    name: "Identity",
    fields: [
      "age",
      "location",
      "nationality",
      "occupation",
      "relationshipStatus",
    ],
  },
  {
    name: "Backstory",
    fields: ["backstory", "family", "contentCreationOrigin"],
  },
  { name: "Personality", fields: ["coreTraits", "personalityDescription"] },
  { name: "Content", fields: ["primaryNiche", "feedAesthetic", "uniqueHook"] },
  { name: "Boundaries", fields: ["willDo", "wontDo"] },
  {
    name: "Communication",
    fields: ["tone", "signaturePhrases", "messageLength"],
  },
  { name: "Visual", fields: ["hair", "eyes", "bodyType"] },
  { name: "Platform", fields: ["instagramBio", "instagramPostingStyle"] },
  { name: "FAQs", fields: ["faqAreYouReal", "faqMeetUp", "faqFreeContent"] },
];

function calculateProfileCompleteness(
  profile: InfluencerProfile,
): CompletenessResult {
  const bible = profile.modelBible;

  if (!bible) {
    return {
      percentage: 0,
      filledSections: [],
      missingSections: MODEL_BIBLE_SECTIONS.map((s) => s.name),
      totalSections: MODEL_BIBLE_SECTIONS.length,
      filledCount: 0,
    };
  }

  const filledSections: string[] = [];
  const missingSections: string[] = [];

  MODEL_BIBLE_SECTIONS.forEach((section) => {
    const hasContent = section.fields.some((field) => {
      const value = bible[field as keyof ModelBible];
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === "string") return value.trim().length > 0;
      return !!value;
    });

    if (hasContent) {
      filledSections.push(section.name);
    } else {
      missingSections.push(section.name);
    }
  });

  const percentage = Math.round(
    (filledSections.length / MODEL_BIBLE_SECTIONS.length) * 100,
  );

  return {
    percentage,
    filledSections,
    missingSections,
    totalSections: MODEL_BIBLE_SECTIONS.length,
    filledCount: filledSections.length,
  };
}

function getCompletenessColor(percentage: number): string {
  if (percentage >= 80) return "emerald";
  if (percentage >= 50) return "amber";
  return "red";
}

function getCompletenessLabel(percentage: number): string {
  if (percentage === 100) return "Complete";
  if (percentage >= 80) return "Excellent";
  if (percentage >= 50) return "Good";
  if (percentage >= 25) return "Basic";
  return "Started";
}

export default function MyInfluencersPage() {
  const [profiles, setProfiles] = useState<InfluencerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("name");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [selectedProfile, setSelectedProfile] =
    useState<InfluencerProfile | null>(null);

  const apiClient = useApiClient();
  const { user: clerkUser } = useUser();
  const router = useRouter();
  const { data: billingInfo } = useBillingInfo();
  const params = useParams();
  const tenant = params.tenant as string;

  useEffect(() => {
    if (apiClient) loadProfiles();
  }, [apiClient]);

  const loadProfiles = async () => {
    if (!apiClient) return;
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get("/api/instagram-profiles");
      if (!response.ok)
        throw new Error(`Failed to load profiles: ${response.status}`);
      const data = await response.json();
      setProfiles(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error loading profiles:", err);
      setError(err instanceof Error ? err.message : "Failed to load profiles");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProfile = () => {
    // Check if user has reached profile limit
    if (billingInfo) {
      const currentProfiles = billingInfo.usage.profiles.current;
      const maxProfiles = billingInfo.usage.profiles.max;

      if (currentProfiles >= maxProfiles) {
        setShowLimitModal(true);
        return;
      }
    }

    setSelectedProfile(null);
    setShowCreateModal(true);
  };

  const isOwnProfile = (profile: InfluencerProfile) => {
    if (profile.isShared !== undefined) return !profile.isShared;
    return profile.clerkId === clerkUser?.id;
  };

  const canEditProfile = (profile: InfluencerProfile) => {
    // Owner can always edit
    if (isOwnProfile(profile)) return true;

    // Check if user has elevated role in the organization
    if (profile.organizationId && profile.currentUserOrgRole) {
      const elevatedRoles = ["OWNER", "ADMIN", "MANAGER"];
      return elevatedRoles.includes(profile.currentUserOrgRole);
    }

    return false;
  };

  const canDeleteProfile = (profile: InfluencerProfile) => {
    // Owner can always delete
    if (isOwnProfile(profile)) return true;

    // Check if user has elevated role in the organization for shared profiles
    if (profile.organizationId && profile.currentUserOrgRole) {
      const elevatedRoles = ["OWNER", "ADMIN", "MANAGER"];
      return elevatedRoles.includes(profile.currentUserOrgRole);
    }

    return false;
  };

  const getOwnerDisplayName = (profile: InfluencerProfile) => {
    if (!profile.user) return "Unknown";
    if (profile.user.name) return profile.user.name;
    if (profile.user.firstName || profile.user.lastName) {
      return `${profile.user.firstName || ""} ${profile.user.lastName || ""}`.trim();
    }
    return profile.user.email?.split("@")[0] || "Unknown";
  };

  const handleSetDefault = async (profileId: string) => {
    if (!apiClient) return;
    try {
      const response = await apiClient.patch(
        `/api/instagram-profiles/${profileId}`,
        { isDefault: true },
      );
      if (!response.ok) throw new Error("Failed to set default");
      toast.success("Default profile updated");
      await loadProfiles();
    } catch {
      toast.error("Failed to set default profile");
    }
  };

  const handleToggleShare = async (profile: InfluencerProfile) => {
    if (!apiClient) return;
    const isCurrentlyShared = !!profile.organizationId;
    try {
      const response = await apiClient.patch(
        `/api/instagram-profiles/${profile.id}`,
        { shareWithOrganization: !isCurrentlyShared },
      );
      if (!response.ok) throw new Error("Failed to update sharing");
      toast.success(
        isCurrentlyShared
          ? "Profile unshared"
          : "Profile shared with organization",
      );
      await loadProfiles();
    } catch {
      toast.error("Failed to update sharing settings");
    }
  };

  const handleToggleFavorite = async (profileId: string) => {
    if (!apiClient) return;
    try {
      const profile = profiles.find((p) => p.id === profileId);
      const response = await apiClient.patch(
        `/api/instagram-profiles/${profileId}`,
        { isFavorite: !profile?.isFavorite },
      );
      if (!response.ok) throw new Error("Failed to update favorite");
      toast.success(
        profile?.isFavorite ? "Removed from favorites" : "Added to favorites",
      );
      await loadProfiles();
    } catch {
      toast.error("Failed to update favorite status");
    }
  };

  const filteredProfiles = profiles.filter((profile) => {
    // Exclude OF Model profiles from this page
    if (profile.type === "of_model") return false;

    const matchesSearch =
      profile.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      profile.instagramUsername
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      getOwnerDisplayName(profile)
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
    const matchesFilter =
      filterMode === "all"
        ? true
        : filterMode === "mine"
          ? isOwnProfile(profile)
          : !isOwnProfile(profile);
    const matchesTags =
      selectedTags.length === 0 ||
      selectedTags.some((tag) => profile.tags?.includes(tag));
    return matchesSearch && matchesFilter && matchesTags;
  });

  // Sort profiles
  const sortedProfiles = [...filteredProfiles].sort((a, b) => {
    // Default profiles always on top
    if (a.isDefault && !b.isDefault) return -1;
    if (!a.isDefault && b.isDefault) return 1;

    // Then favorites
    if (a.isFavorite && !b.isFavorite) return -1;
    if (!a.isFavorite && b.isFavorite) return 1;

    // Then apply selected sort
    switch (sortBy) {
      case "name":
        return a.name.localeCompare(b.name);
      case "dateCreated":
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      case "dateUpdated":
        return (
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      case "postsCount":
        const aCount = (a._count?.posts || 0) + (a._count?.feedPosts || 0);
        const bCount = (b._count?.posts || 0) + (b._count?.feedPosts || 0);
        return bCount - aCount;
      case "completeness":
        const aComplete = calculateProfileCompleteness(a).percentage;
        const bComplete = calculateProfileCompleteness(b).percentage;
        return bComplete - aComplete;
      default:
        return 0;
    }
  });

  const visibleProfiles = profiles.filter((p) => p.type !== "of_model");
  const myProfilesCount = visibleProfiles.filter((p) => isOwnProfile(p)).length;
  const sharedProfilesCount = visibleProfiles.filter((p) => !isOwnProfile(p)).length;

  if (!apiClient || loading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="text-center space-y-4">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 rounded-full border-2 border-zinc-200 dark:border-zinc-800" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-brand-mid-pink animate-spin" />
          </div>
          <p className="text-sm text-header-muted">Loading profiles...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-h-[85vh] overflow-y-auto overflow-x-hidden bg-[#F8F8F8] dark:bg-[#0a0a0f] border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-2xl shadow-lg custom-scrollbar">
      {/* Header */}
      <div className="sticky top-0 z-40 backdrop-blur-xl bg-white/90 dark:bg-[#1a1625]/90 border-b border-[#EC67A1]/20 dark:border-[#EC67A1]/20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-[#EC67A1] to-[#F774B9] shadow-lg shadow-[#EC67A1]/30">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-sidebar-foreground tracking-tight">
                  Influencers
                </h1>
                <p className="text-xs text-header-muted">
                  {visibleProfiles.length} profile{visibleProfiles.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <button
              onClick={handleCreateProfile}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#EC67A1] to-[#F774B9] text-white text-sm font-medium rounded-xl hover:from-[#E1518E] hover:to-[#EC67A1] transition-all shadow-lg shadow-[#EC67A1]/30"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Profile</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        {/* Search & Filters */}
        <div className="space-y-4 mb-8">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-header-muted" />
              <input
                type="text"
                placeholder="Search profiles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-11 pl-11 pr-4 text-sm text-sidebar-foreground bg-white dark:bg-[#1a1625] border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/20 focus:border-[#EC67A1] transition-all placeholder:text-header-muted"
              />
            </div>
            <div className="inline-flex items-center p-1 bg-white dark:bg-[#1a1625] rounded-xl border border-[#EC67A1]/10 dark:border-[#EC67A1]/20">
              {[
                { key: "all", label: "All", count: visibleProfiles.length },
                { key: "mine", label: "Mine", count: myProfilesCount },
                { key: "shared", label: "Shared", count: sharedProfilesCount },
              ].map((filter) => (
                <button
                  key={filter.key}
                  onClick={() => setFilterMode(filter.key as FilterMode)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${filterMode === filter.key ? "bg-white dark:bg-zinc-800 text-sidebar-foreground shadow-sm" : "text-header-muted hover:text-sidebar-foreground"}`}
                >
                  {filter.label}
                  <span className="ml-1.5 text-xs opacity-60">
                    {filter.count}
                  </span>
                </button>
              ))}
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="h-11 px-4 text-sm text-sidebar-foreground bg-white dark:bg-[#1a1625] border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/20 focus:border-[#EC67A1] transition-all"
            >
              <option
                value="name"
                className="bg-white dark:bg-[#1a1625] text-sidebar-foreground"
              >
                Sort: Name
              </option>
              <option
                value="dateCreated"
                className="bg-white dark:bg-[#1a1625] text-sidebar-foreground"
              >
                Sort: Date Created
              </option>
              <option
                value="dateUpdated"
                className="bg-white dark:bg-[#1a1625] text-sidebar-foreground"
              >
                Sort: Last Updated
              </option>
              <option
                value="postsCount"
                className="bg-white dark:bg-[#1a1625] text-sidebar-foreground"
              >
                Sort: Posts Count
              </option>
              <option
                value="completeness"
                className="bg-white dark:bg-[#1a1625] text-sidebar-foreground"
              >
                Sort: Completeness
              </option>
            </select>
          </div>

          {/* Tag Filter */}
          {TAG_CATEGORIES.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-header-muted">
                Tags:
              </span>
              {TAG_CATEGORIES.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                const tagCount = profiles.filter((p) =>
                  p.tags?.includes(tag),
                ).length;
                if (tagCount === 0) return null;
                return (
                  <button
                    key={tag}
                    onClick={() =>
                      setSelectedTags(
                        isSelected
                          ? selectedTags.filter((t) => t !== tag)
                          : [...selectedTags, tag],
                      )
                    }
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                      isSelected
                        ? "bg-gradient-to-r from-[#EC67A1] to-[#F774B9] text-white shadow-sm"
                        : "bg-white dark:bg-[#1a1625] text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-zinc-100 dark:hover:bg-[#0f0d18] border border-[#EC67A1]/10 rounded-lg"
                    }`}
                  >
                    {tag}
                    <span className="opacity-60">({tagCount})</span>
                  </button>
                );
              })}
              {selectedTags.length > 0 && (
                <button
                  onClick={() => setSelectedTags([])}
                  className="text-xs font-medium text-[#EC67A1] dark:text-[#F774B9] hover:underline"
                >
                  Clear all
                </button>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
            </div>
          </div>
        )}

        {filteredProfiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-[#EC67A1]/10 to-[#F774B9]/10 dark:from-[#EC67A1]/20 dark:to-[#F774B9]/20 flex items-center justify-center mb-8 shadow-xl border border-[#EC67A1]/20">
              <Users className="w-12 h-12 text-[#EC67A1] dark:text-[#F774B9]" />
            </div>
            <h3 className="text-xl font-semibold text-sidebar-foreground mb-2">
              {searchQuery ? "No profiles found" : "No influencer profiles yet"}
            </h3>
            <p className="text-sm text-header-muted text-center max-w-sm mb-8">
              {searchQuery
                ? "Try adjusting your search or filters"
                : "Create your first influencer profile with comprehensive Model Bible documentation"}
            </p>
            {!searchQuery && (
              <button
                onClick={handleCreateProfile}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#EC67A1] to-[#F774B9] text-white text-sm font-semibold rounded-xl hover:from-[#E1518E] hover:to-[#EC67A1] transition-all shadow-xl shadow-[#EC67A1]/30"
              >
                <Plus className="w-4 h-4" />
                Create Profile
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {sortedProfiles.map((profile) => (
              <ProfileCard
                key={profile.id}
                profile={profile}
                isOwn={isOwnProfile(profile)}
                canEdit={canEditProfile(profile)}
                canDelete={canDeleteProfile(profile)}
                ownerName={getOwnerDisplayName(profile)}
                onEdit={() => {
                  setSelectedProfile(profile);
                  setShowEditModal(true);
                }}
                onDelete={() => {
                  setSelectedProfile(profile);
                  setShowDeleteModal(true);
                }}
                onView={() => {
                  router.push(
                    `/${tenant}/workspace/my-influencers/${profile.id}`,
                  );
                }}
                onSetDefault={() => handleSetDefault(profile.id)}
                onToggleShare={() => handleToggleShare(profile)}
                onToggleFavorite={() => handleToggleFavorite(profile.id)}
              />
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateEditProfileModal
          mode="create"
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadProfiles();
          }}
        />
      )}
      {showEditModal && selectedProfile && (
        <CreateEditProfileModal
          mode="edit"
          profile={selectedProfile}
          onClose={() => {
            setShowEditModal(false);
            setSelectedProfile(null);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setSelectedProfile(null);
            loadProfiles();
          }}
        />
      )}
      {showDeleteModal && selectedProfile && (
        <DeleteProfileModal
          profile={selectedProfile}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedProfile(null);
          }}
          onSuccess={() => {
            setShowDeleteModal(false);
            setSelectedProfile(null);
            loadProfiles();
          }}
        />
      )}
      {showLimitModal && (
        <ProfileLimitModal
          billingInfo={billingInfo}
          onClose={() => setShowLimitModal(false)}
          onUpgrade={() => router.push("/ai-content-team/billing")}
        />
      )}
    </div>
  );
}

function ProfileLimitModal({
  billingInfo,
  onClose,
  onUpgrade,
}: {
  billingInfo: any;
  onClose: () => void;
  onUpgrade: () => void;
}) {
  if (typeof window === "undefined") return null;

  const currentProfiles = billingInfo?.usage.profiles.current || 0;
  const maxProfiles = billingInfo?.usage.profiles.max || 0;
  const baseLimit = billingInfo?.usage.profiles.baseLimit || 0;
  const additionalSlots = billingInfo?.usage.profiles.additionalSlots || 0;

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#1a1625] rounded-2xl shadow-2xl w-full max-w-md border border-[#EC67A1]/20 dark:border-[#EC67A1]/30">
        <div className="p-6 border-b border-[#EC67A1]/20 dark:border-[#EC67A1]/30">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#EC67A1]/10 dark:bg-[#EC67A1]/20 rounded-xl">
              <AlertCircle className="w-6 h-6 text-[#EC67A1]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-sidebar-foreground">
                Profile Limit Reached
              </h2>
              <p className="text-sm text-header-muted">
                You've reached your plan's profile limit
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-[#F8F8F8] dark:bg-[#0f0d18] rounded-xl p-4 border border-[#EC67A1]/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-sidebar-foreground">
                Current Usage
              </span>
              <span className="text-sm font-bold text-[#EC67A1]">
                {currentProfiles} / {maxProfiles}
              </span>
            </div>
            <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-2">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-[#EC67A1] to-[#F774B9]"
                style={{
                  width: `${Math.min((currentProfiles / maxProfiles) * 100, 100)}%`,
                }}
              />
            </div>
            <p className="text-xs text-header-muted mt-2">
              {baseLimit} base limit{" "}
              {additionalSlots > 0 &&
                `+ ${additionalSlots} add-on slot${additionalSlots > 1 ? "s" : ""}`}
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-sm text-sidebar-foreground">
              You've created {currentProfiles} content profile
              {currentProfiles !== 1 ? "s" : ""}, which is the maximum for your
              current plan.
            </p>
            <p className="text-sm text-sidebar-foreground">
              To create more profiles, you can:
            </p>
            <ul className="space-y-2 text-sm text-sidebar-foreground">
              <li className="flex items-start gap-2">
                <CreditCard className="w-4 h-4 text-[#EC67A1] mt-0.5 flex-shrink-0" />
                <span>
                  Purchase additional profile slots ($
                  {billingInfo?.usage.profiles.contentProfileSlotPrice || 10}
                  /month per slot)
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Trash2 className="w-4 h-4 text-[#EC67A1] mt-0.5 flex-shrink-0" />
                <span>Delete an existing profile to free up space</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="p-6 bg-[#F8F8F8] dark:bg-[#0f0d18] border-t border-[#EC67A1]/20 dark:border-[#EC67A1]/30 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-white dark:bg-[#1a1625] border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 text-sidebar-foreground rounded-xl hover:bg-[#F774B9]/10 dark:hover:bg-[#EC67A1]/10 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onUpgrade}
            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[#EC67A1] to-[#F774B9] text-white rounded-xl hover:from-[#E1518E] hover:to-[#EC67A1] transition-all shadow-lg shadow-[#EC67A1]/30 font-medium"
          >
            Add Slots
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ProfileCard({
  profile,
  isOwn,
  canEdit,
  canDelete,
  ownerName,
  onEdit,
  onDelete,
  onView,
  onSetDefault,
  onToggleShare,
  onToggleFavorite,
}: {
  profile: InfluencerProfile;
  isOwn: boolean;
  canEdit: boolean;
  canDelete: boolean;
  ownerName: string;
  onEdit: () => void;
  onDelete: () => void;
  onView: () => void;
  onSetDefault: () => void;
  onToggleShare: () => void;
  onToggleFavorite: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node))
        setMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const totalPosts =
    (profile._count?.posts || 0) + (profile._count?.feedPosts || 0);
  const completeness = calculateProfileCompleteness(profile);
  const color = getCompletenessColor(completeness.percentage);

  return (
    <div className="group relative bg-white dark:bg-[#1a1625] rounded-2xl shadow-sm shadow-[#EC67A1]/10 dark:shadow-[#EC67A1]/5 overflow-hidden hover:shadow-2xl hover:shadow-[#EC67A1]/20 dark:hover:shadow-[#EC67A1]/10 hover:-translate-y-1 transition-all duration-300 border border-[#EC67A1]/10 dark:border-[#EC67A1]/20">
      <div className="relative aspect-[4/5] bg-gradient-to-br from-[#EC67A1]/5 to-[#F774B9]/5 dark:from-[#EC67A1]/10 dark:to-[#F774B9]/10 overflow-hidden">
        {profile.profileImageUrl ? (
          <img
            src={profile.profileImageUrl}
            alt={profile.name}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <User className="w-20 h-20 text-zinc-300 dark:text-zinc-700" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <div className="absolute top-3 left-3 flex flex-wrap gap-2">
          {profile.isFavorite && (
            <div className="group/tooltip relative">
              <div className="p-2 bg-yellow-500/90 backdrop-blur-sm rounded-lg shadow-lg">
                <Star className="w-3.5 h-3.5 text-white fill-current" />
              </div>
              <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 px-2 py-1 bg-black/90 text-white text-[10px] rounded whitespace-nowrap opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-10">
                Favorite
              </div>
            </div>
          )}
          {profile.isDefault && (
            <div className="group/tooltip relative">
              <div className="p-2 bg-amber-500/90 backdrop-blur-sm rounded-lg shadow-lg">
                <Star className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 px-2 py-1 bg-black/90 text-white text-[10px] rounded whitespace-nowrap opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-10">
                Default
              </div>
            </div>
          )}
          {profile.organizationId && isOwn && (
            <div className="group/tooltip relative">
              <div className="p-2 bg-[#EC67A1]/90 backdrop-blur-sm rounded-lg shadow-lg">
                <Building2 className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 px-2 py-1 bg-black/90 text-white text-[10px] rounded whitespace-nowrap opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-10">
                Shared with Org
              </div>
            </div>
          )}
          {/* Status Badge */}
          {profile.status && (
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 backdrop-blur-sm text-white text-[11px] font-semibold rounded-lg shadow-lg capitalize ${
                profile.status === "active"
                  ? "bg-emerald-500/90"
                  : profile.status === "paused"
                    ? "bg-amber-500/90"
                    : profile.status === "dropped"
                      ? "bg-red-500/90"
                      : "bg-gray-500/90"
              }`}
            >
              {profile.status}
            </span>
          )}
        </div>
        {canEdit && (
          <div className="absolute top-3 right-3" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 bg-black/20 hover:bg-black/40 backdrop-blur-md rounded-lg transition-colors"
            >
              <MoreVertical className="w-4 h-4 text-white" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-44 bg-white dark:bg-[#1a1625] rounded-xl shadow-2xl border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 overflow-hidden z-20">
                <button
                  onClick={() => {
                    onToggleFavorite();
                    setMenuOpen(false);
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm text-sidebar-foreground hover:bg-[#F774B9]/10 dark:hover:bg-[#EC67A1]/10 flex items-center gap-3 transition-colors"
                >
                  <Star
                    className={`w-4 h-4 ${profile.isFavorite ? "fill-yellow-500 text-yellow-500" : "text-[#EC67A1]"}`}
                  />
                  {profile.isFavorite ? "Unfavorite" : "Favorite"}
                </button>
                {isOwn && !profile.isDefault && (
                  <button
                    onClick={() => {
                      onSetDefault();
                      setMenuOpen(false);
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-sidebar-foreground hover:bg-[#F774B9]/10 dark:hover:bg-[#EC67A1]/10 flex items-center gap-3 transition-colors"
                  >
                    <Star className="w-4 h-4 text-[#EC67A1]" />
                    Set as Default
                  </button>
                )}
                {isOwn && (
                  <button
                    onClick={() => {
                      onToggleShare();
                      setMenuOpen(false);
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-sidebar-foreground hover:bg-[#F774B9]/10 dark:hover:bg-[#EC67A1]/10 flex items-center gap-3 transition-colors"
                  >
                    <Share2 className="w-4 h-4 text-[#EC67A1]" />
                    {profile.organizationId ? "Unshare" : "Share with Org"}
                  </button>
                )}
                {canDelete && (
                  <>
                    <div className="border-t border-[#EC67A1]/10 dark:border-[#EC67A1]/20" />
                    <button
                      onClick={() => {
                        onDelete();
                        setMenuOpen(false);
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 flex items-center gap-3 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
        <div className="absolute left-0 right-0 bottom-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <button
            onClick={onView}
            className="w-full py-2.5 bg-white/95 backdrop-blur-sm text-zinc-900 text-sm font-semibold rounded-xl hover:bg-white transition-colors flex items-center justify-center gap-2"
          >
            View Profile
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="p-4">
        <div className="mb-3">
          <h3 className="text-base font-semibold text-sidebar-foreground truncate">
            {profile.name}
          </h3>
          {profile.instagramUsername && (
            <p className="text-sm text-header-muted flex items-center gap-1.5 mt-0.5">
              <Instagram className="w-3.5 h-3.5" />@{profile.instagramUsername}
            </p>
          )}
          {!isOwn && (
            <p className="text-xs text-header-muted mt-1">
              Shared by {ownerName}
            </p>
          )}
        </div>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs text-header-muted">
              <Camera className="w-3.5 h-3.5" />
              {totalPosts} posts
            </span>
          </div>

          {/* Tags */}
          {profile.tags && profile.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-[#EC67A1]/10 dark:border-[#EC67A1]/20">
              {profile.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center px-2 py-0.5 bg-white dark:bg-[#0f0d18] text-[#EC67A1] dark:text-[#F774B9] text-xs font-medium rounded-md border border-[#EC67A1]/20"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateEditProfileModal({
  mode,
  profile,
  onClose,
  onSuccess,
}: {
  mode: "create" | "edit";
  profile?: InfluencerProfile;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [activeSection, setActiveSection] = useState("basic");
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const apiClient = useApiClient();
  const { user: clerkUser } = useUser();

  // Check if current user is the owner of this profile
  const isOwner = mode === "create" || profile?.clerkId === clerkUser?.id;

  const [formData, setFormData] = useState({
    name: profile?.name || "",
    description: profile?.description || "",
    instagramUsername: profile?.instagramUsername || "",
    profileImageUrl: profile?.profileImageUrl || "",
    isDefault: profile?.isDefault || false,
    shareWithOrganization: !!profile?.organizationId,
    tags: profile?.tags || [],
    type: profile?.type || "real", // "real", "ai", or "of_model"
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
    city: profile?.modelBible?.city || "",
    livingSituation: profile?.modelBible?.livingSituation || "",
    coreTraits: profile?.modelBible?.coreTraits || [],
    personalityDescription: profile?.modelBible?.personalityDescription || "",
    morningVibe: profile?.modelBible?.morningVibe || "",
    afternoonVibe: profile?.modelBible?.afternoonVibe || "",
    nightVibe: profile?.modelBible?.nightVibe || "",
    primaryNiche: profile?.modelBible?.primaryNiche || "",
    feedAesthetic: profile?.modelBible?.feedAesthetic || "",
    commonThemes: profile?.modelBible?.commonThemes || "",
    signatureLook: profile?.modelBible?.signatureLook || "",
    uniqueHook: profile?.modelBible?.uniqueHook || "",
    willDo: profile?.modelBible?.willDo || [],
    wontDo: profile?.modelBible?.wontDo || [],
    maybeOrPremium: profile?.modelBible?.maybeOrPremium || [],
    pricingMenu: profile?.modelBible?.pricingMenu || DEFAULT_PRICING_ITEMS,
    tone: profile?.modelBible?.tone || "",
    emojiOften: profile?.modelBible?.emojiOften || [],
    signaturePhrases: profile?.modelBible?.signaturePhrases || [],
    messageLength: profile?.modelBible?.messageLength || "",
    capitalization: profile?.modelBible?.capitalization || "",
    punctuation: profile?.modelBible?.punctuation || "",
    responseSpeed: profile?.modelBible?.responseSpeed || "",
    sampleGreeting: profile?.modelBible?.sampleGreeting || "",
    sampleFlirty: profile?.modelBible?.sampleFlirty || "",
    samplePPV: profile?.modelBible?.samplePPV || "",
    sampleFreeRequest: profile?.modelBible?.sampleFreeRequest || "",
    instagramBio: profile?.modelBible?.instagramBio || "",
    instagramPostingStyle: profile?.modelBible?.instagramPostingStyle || "",
    onlyfansWelcome: profile?.modelBible?.onlyfansWelcome || "",
    hair: profile?.modelBible?.hair || "",
    eyes: profile?.modelBible?.eyes || "",
    bodyType: profile?.modelBible?.bodyType || "",
    tattoosPiercings: profile?.modelBible?.tattoosPiercings || "",
    moodboardKeywords: profile?.modelBible?.moodboardKeywords || "",
    faqAreYouReal: profile?.modelBible?.faqAreYouReal || "",
    faqMeetUp: profile?.modelBible?.faqMeetUp || "",
    faqFreeContent: profile?.modelBible?.faqFreeContent || "",
    faqRealName: profile?.modelBible?.faqRealName || "",
    faqTooAttached: profile?.modelBible?.faqTooAttached || "",
    internalNotes: profile?.modelBible?.internalNotes || "",
  });

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

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
        type: formData.type, // Include type field
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
          city: formData.city,
          livingSituation: formData.livingSituation,
          coreTraits: formData.coreTraits,
          personalityDescription: formData.personalityDescription,
          morningVibe: formData.morningVibe,
          afternoonVibe: formData.afternoonVibe,
          nightVibe: formData.nightVibe,
          primaryNiche: formData.primaryNiche,
          feedAesthetic: formData.feedAesthetic,
          commonThemes: formData.commonThemes,
          signatureLook: formData.signatureLook,
          uniqueHook: formData.uniqueHook,
          willDo: formData.willDo,
          wontDo: formData.wontDo,
          maybeOrPremium: formData.maybeOrPremium,
          pricingMenu: formData.pricingMenu,
          tone: formData.tone,
          signaturePhrases: formData.signaturePhrases,
          messageLength: formData.messageLength,
          capitalization: formData.capitalization,
          punctuation: formData.punctuation,
          responseSpeed: formData.responseSpeed,
          sampleGreeting: formData.sampleGreeting,
          sampleFlirty: formData.sampleFlirty,
          samplePPV: formData.samplePPV,
          sampleFreeRequest: formData.sampleFreeRequest,
          instagramBio: formData.instagramBio,
          instagramPostingStyle: formData.instagramPostingStyle,
          onlyfansWelcome: formData.onlyfansWelcome,
          hair: formData.hair,
          eyes: formData.eyes,
          bodyType: formData.bodyType,
          tattoosPiercings: formData.tattoosPiercings,
          moodboardKeywords: formData.moodboardKeywords,
          faqAreYouReal: formData.faqAreYouReal,
          faqMeetUp: formData.faqMeetUp,
          faqFreeContent: formData.faqFreeContent,
          faqRealName: formData.faqRealName,
          faqTooAttached: formData.faqTooAttached,
          internalNotes: formData.internalNotes,
        },
      };

      // Only include owner-only fields if user is the owner
      if (isOwner) {
        payload.isDefault = formData.isDefault;
        payload.shareWithOrganization = formData.shareWithOrganization;
      }

      // Always include tags
      payload.tags = formData.tags;

      const response =
        mode === "create"
          ? await apiClient.post("/api/instagram-profiles", payload)
          : await apiClient.patch(
              `/api/instagram-profiles/${profile?.id}`,
              payload,
            );
      if (!response.ok) throw new Error("Failed to save profile");
      const savedProfile = await response.json();
      toast.success(
        mode === "create" ? "Profile created!" : "Profile updated!",
      );

      // Dispatch event to refresh profile list in sidebar
      if (savedProfile?.id) {
        window.dispatchEvent(
          new CustomEvent("profilesUpdated", {
            detail: {
              profileId: savedProfile.id,
              mode: mode, // 'create' or 'edit'
            },
          }),
        );
      }

      onSuccess();
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
    { id: "boundaries", name: "Boundaries", icon: AlertCircle },
    { id: "communication", name: "Comms", icon: MessageCircle },
    { id: "visual", name: "Visual", icon: Palette },
    { id: "faqs", name: "FAQs", icon: FileText },
    { id: "team", name: "Team", icon: Settings },
  ];

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#1a1625] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-[#EC67A1]/20 dark:border-[#EC67A1]/30">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#EC67A1]/20 dark:border-[#EC67A1]/30">
          <h2 className="text-lg font-semibold text-sidebar-foreground">
            {mode === "create" ? "Create Profile" : "Edit Profile"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#F774B9]/10 dark:hover:bg-[#EC67A1]/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-header-muted" />
          </button>
        </div>
        <div className="flex flex-1 overflow-hidden">
          {/* Only show sidebar navigation in edit mode */}
          {mode === "edit" && (
            <div className="w-44 border-r border-[#EC67A1]/20 dark:border-[#EC67A1]/30 bg-[#F8F8F8] dark:bg-[#0f0d18] overflow-y-auto rounded-bl-2xl">
              <nav className="p-2 space-y-0.5">
                {sections.map((section) => {
                  const Icon = section.icon;
                  return (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded-xl transition-all ${activeSection === section.id ? "bg-white dark:bg-[#1a1625] text-sidebar-foreground shadow-sm border border-[#EC67A1]/20" : "text-header-muted hover:text-sidebar-foreground hover:bg-white/50 dark:hover:bg-[#1a1625]/70"}`}
                    >
                      <Icon className="w-4 h-4" />
                      {section.name}
                    </button>
                  );
                })}
              </nav>
            </div>
          )}
          <div className="flex-1 overflow-y-auto p-6">
            {activeSection === "basic" && (
              <FormSection title="Basic Information">
                {/* Profile Image Upload */}
                <div className="flex items-start gap-6 mb-6">
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden ring-2 ring-[#EC67A1]/20 dark:ring-[#EC67A1]/30">
                      {formData.profileImageUrl ? (
                        <img
                          src={formData.profileImageUrl}
                          alt="Profile"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-10 h-10 text-zinc-400" />
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
                          const { presignedUrl, url } =
                            await presignedRes.json();
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
                          if (fileInputRef.current)
                            fileInputRef.current.value = "";
                        }
                      }}
                    />
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="text-sm font-medium text-sidebar-foreground mb-1">
                      Profile Picture
                    </p>
                    <p className="text-xs text-header-muted mb-3">
                      Upload an image for this influencer profile. Max 5MB.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingImage}
                        className="px-3 py-1.5 text-xs font-medium text-[#EC67A1] dark:text-[#F774B9] bg-[#EC67A1]/10 dark:bg-[#EC67A1]/20 hover:bg-[#EC67A1]/20 dark:hover:bg-[#EC67A1]/30 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {uploadingImage ? "Uploading..." : "Upload"}
                      </button>
                      {formData.profileImageUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            setFormData({ ...formData, profileImageUrl: "" })
                          }
                          className="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-950 rounded-lg transition-colors"
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
                    className="w-full h-11 px-4 text-sm bg-[#F8F8F8] dark:bg-[#0f0d18] border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/20 focus:border-[#EC67A1] transition-all"
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
                    className="w-full px-4 py-3 text-sm bg-[#F8F8F8] dark:bg-[#0f0d18] border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/20 focus:border-[#EC67A1] transition-all resize-none"
                  />
                </FormField>
                <FormField label="Instagram Username">
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">
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
                      className="w-full h-11 pl-9 pr-4 text-sm bg-[#F8F8F8] dark:bg-[#1a1625]/50 border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/20 focus:border-[#EC67A1] transition-all"
                    />
                  </div>
                </FormField>

                {/* Profile Type */}
                <FormField label="Profile Type" required>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, type: "real" })}
                      className={`flex-1 px-4 py-3 text-sm font-medium rounded-xl transition-all border-2 ${
                        formData.type === "real"
                          ? "bg-gradient-to-r from-[#EC67A1] to-[#F774B9] text-white border-[#EC67A1] shadow-lg shadow-[#EC67A1]/30"
                          : "bg-white dark:bg-[#1a1625] text-sidebar-foreground border-[#EC67A1]/20 hover:border-[#EC67A1]/40"
                      }`}
                    >
                      Real Person
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, type: "ai" })}
                      className={`flex-1 px-4 py-3 text-sm font-medium rounded-xl transition-all border-2 ${
                        formData.type === "ai"
                          ? "bg-gradient-to-r from-[#EC67A1] to-[#F774B9] text-white border-[#EC67A1] shadow-lg shadow-[#EC67A1]/30"
                          : "bg-white dark:bg-[#1a1625] text-sidebar-foreground border-[#EC67A1]/20 hover:border-[#EC67A1]/40"
                      }`}
                    >
                      AI Generated
                    </button>
                  </div>
                </FormField>

                {isOwner && mode === "edit" && (
                  <div className="flex items-center gap-6 pt-2">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isDefault}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            isDefault: e.target.checked,
                          })
                        }
                        className="w-5 h-5 rounded-md border-[#EC67A1]/30 text-brand-mid-pink focus:ring-[#EC67A1]/20 focus:ring-offset-0"
                      />
                      <span className="text-sm text-sidebar-foreground">
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
                        className="w-5 h-5 rounded-md border-[#EC67A1]/30 text-brand-mid-pink focus:ring-[#EC67A1]/20 focus:ring-offset-0"
                      />
                      <span className="text-sm text-sidebar-foreground">
                        Share with org
                      </span>
                    </label>
                  </div>
                )}

                {/* Tags Selection - Only show in edit mode */}
                {mode === "edit" && (
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
                              ? "bg-gradient-to-r from-[#EC67A1] to-[#F774B9] text-white border-2 border-[#EC67A1]"
                              : "bg-zinc-100 dark:bg-[#1a1625]/50 text-sidebar-foreground border-2 border-transparent hover:border-[#EC67A1]/30"
                          }`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </FormField>
                )}
              </FormSection>
            )}
            {/* Only show other sections in edit mode */}
            {mode === "edit" && activeSection === "identity" && (
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
                      className="w-full h-11 px-4 text-sm bg-[#F8F8F8] dark:bg-[#1a1625]/50 border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/20 focus:border-[#EC67A1] transition-all text-sidebar-foreground"
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
                      className="w-full h-11 px-4 text-sm bg-[#F8F8F8] dark:bg-[#1a1625]/50 border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/20 focus:border-[#EC67A1] transition-all text-sidebar-foreground"
                    />
                  </FormField>
                  <FormField label="Nationality">
                    <input
                      type="text"
                      value={formData.nationality}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          nationality: e.target.value,
                        })
                      }
                      placeholder="e.g., American"
                      className="w-full h-11 px-4 text-sm bg-[#F8F8F8] dark:bg-[#1a1625]/50 border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/20 focus:border-[#EC67A1] transition-all text-sidebar-foreground"
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
                      className="w-full h-11 px-4 text-sm bg-[#F8F8F8] dark:bg-[#1a1625]/50 border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/20 focus:border-[#EC67A1] transition-all text-sidebar-foreground"
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
                    className="w-full h-11 px-4 text-sm bg-[#F8F8F8] dark:bg-[#1a1625]/50 border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/20 focus:border-[#EC67A1] transition-all text-sidebar-foreground"
                  />
                </FormField>
              </FormSection>
            )}
            {mode === "edit" && activeSection === "backstory" && (
              <FormSection title="Backstory & Lore">
                <FormField label="Background Story">
                  <textarea
                    value={formData.backstory}
                    onChange={(e) =>
                      setFormData({ ...formData, backstory: e.target.value })
                    }
                    rows={4}
                    placeholder="Write 2-3 sentences about her 'life story'..."
                    className="w-full px-4 py-3 text-sm bg-[#F8F8F8] dark:bg-[#1a1625]/50 border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/20 focus:border-[#EC67A1] transition-all resize-none text-sidebar-foreground"
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
                      className="w-full h-11 px-4 text-sm bg-[#F8F8F8] dark:bg-[#1a1625]/50 border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/20 focus:border-[#EC67A1] transition-all text-sidebar-foreground"
                    />
                  </FormField>
                  <FormField label="Pets">
                    <input
                      type="text"
                      value={formData.pets}
                      onChange={(e) =>
                        setFormData({ ...formData, pets: e.target.value })
                      }
                      className="w-full h-11 px-4 text-sm bg-[#F8F8F8] dark:bg-[#1a1625]/50 border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/20 focus:border-[#EC67A1] transition-all text-sidebar-foreground"
                    />
                  </FormField>
                  <FormField label="Education">
                    <input
                      type="text"
                      value={formData.education}
                      onChange={(e) =>
                        setFormData({ ...formData, education: e.target.value })
                      }
                      className="w-full h-11 px-4 text-sm bg-[#F8F8F8] dark:bg-[#1a1625]/50 border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/20 focus:border-[#EC67A1] transition-all text-sidebar-foreground"
                    />
                  </FormField>
                  <FormField label="Past Jobs">
                    <input
                      type="text"
                      value={formData.pastJobs}
                      onChange={(e) =>
                        setFormData({ ...formData, pastJobs: e.target.value })
                      }
                      className="w-full h-11 px-4 text-sm bg-[#F8F8F8] dark:bg-[#1a1625]/50 border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/20 focus:border-[#EC67A1] transition-all text-sidebar-foreground"
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
                    className="w-full px-4 py-3 text-sm bg-[#F8F8F8] dark:bg-[#1a1625]/50 border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/20 focus:border-[#EC67A1] transition-all resize-none text-sidebar-foreground"
                  />
                </FormField>
              </FormSection>
            )}
            {mode === "edit" && activeSection === "personality" && (
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
                        className={`px-4 py-2 text-sm font-medium rounded-xl transition-all ${(formData.coreTraits || []).includes(trait) ? "bg-gradient-to-r from-[#EC67A1] to-[#F774B9] text-white shadow-lg shadow-[#EC67A1]/30" : "bg-zinc-100 dark:bg-[#1a1625]/50 text-sidebar-foreground hover:bg-zinc-200 dark:hover:bg-[#1a1625]/70 border border-[#EC67A1]/10"}`}
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
                    className="w-full px-4 py-3 text-sm bg-[#F8F8F8] dark:bg-[#1a1625]/50 border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/20 focus:border-[#EC67A1] transition-all resize-none text-sidebar-foreground"
                  />
                </FormField>
                <div className="grid grid-cols-3 gap-4">
                  <FormField label="Morning Vibe">
                    <input
                      type="text"
                      value={formData.morningVibe}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          morningVibe: e.target.value,
                        })
                      }
                      placeholder="Sleepy, cozy"
                      className="w-full h-11 px-4 text-sm bg-[#F8F8F8] dark:bg-[#1a1625]/50 border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/20 focus:border-[#EC67A1] transition-all text-sidebar-foreground"
                    />
                  </FormField>
                  <FormField label="Afternoon Vibe">
                    <input
                      type="text"
                      value={formData.afternoonVibe}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          afternoonVibe: e.target.value,
                        })
                      }
                      placeholder="Playful, chatty"
                      className="w-full h-11 px-4 text-sm bg-[#F8F8F8] dark:bg-[#1a1625]/50 border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/20 focus:border-[#EC67A1] transition-all text-sidebar-foreground"
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
                      className="w-full h-11 px-4 text-sm bg-[#F8F8F8] dark:bg-[#1a1625]/50 border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/20 focus:border-[#EC67A1] transition-all text-sidebar-foreground"
                    />
                  </FormField>
                </div>
              </FormSection>
            )}
            {mode === "edit" && activeSection === "content" && (
              <FormSection title="Content & Niche">
                <FormField label="Primary Niche">
                  <input
                    type="text"
                    value={formData.primaryNiche}
                    onChange={(e) =>
                      setFormData({ ...formData, primaryNiche: e.target.value })
                    }
                    placeholder="e.g., Fitness / GFE / Cosplay"
                    className="w-full h-11 px-4 text-sm bg-[#F8F8F8] dark:bg-[#1a1625]/50 border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/20 focus:border-[#EC67A1] transition-all text-sidebar-foreground"
                  />
                </FormField>
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Feed Aesthetic">
                    <input
                      type="text"
                      value={formData.feedAesthetic}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          feedAesthetic: e.target.value,
                        })
                      }
                      className="w-full h-11 px-4 text-sm bg-[#F8F8F8] dark:bg-[#1a1625]/50 border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/20 focus:border-[#EC67A1] transition-all text-sidebar-foreground"
                    />
                  </FormField>
                  <FormField label="Common Themes">
                    <input
                      type="text"
                      value={formData.commonThemes}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          commonThemes: e.target.value,
                        })
                      }
                      className="w-full h-11 px-4 text-sm bg-[#F8F8F8] dark:bg-[#1a1625]/50 border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/20 focus:border-[#EC67A1] transition-all text-sidebar-foreground"
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
                    className="w-full px-4 py-3 text-sm bg-[#F8F8F8] dark:bg-[#1a1625]/50 border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/20 focus:border-[#EC67A1] transition-all resize-none text-sidebar-foreground"
                  />
                </FormField>
              </FormSection>
            )}
            {mode === "edit" && activeSection === "boundaries" && (
              <FormSection title="Boundaries & Menu">
                <div className="grid grid-cols-3 gap-4">
                  <FormField label="✅ Will Do">
                    <textarea
                      value={(formData.willDo || []).join("\n")}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          willDo: e.target.value.split("\n").filter(Boolean),
                        })
                      }
                      rows={6}
                      placeholder="One item per line..."
                      className="w-full px-4 py-3 text-sm bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
                    />
                  </FormField>
                  <FormField label="❌ Won't Do">
                    <textarea
                      value={(formData.wontDo || []).join("\n")}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          wontDo: e.target.value.split("\n").filter(Boolean),
                        })
                      }
                      rows={6}
                      placeholder="One item per line..."
                      className="w-full px-4 py-3 text-sm bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all resize-none"
                    />
                  </FormField>
                  <FormField label="⚠️ Maybe/Premium">
                    <textarea
                      value={(formData.maybeOrPremium || []).join("\n")}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          maybeOrPremium: e.target.value
                            .split("\n")
                            .filter(Boolean),
                        })
                      }
                      rows={6}
                      placeholder="One item per line..."
                      className="w-full px-4 py-3 text-sm bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all resize-none"
                    />
                  </FormField>
                </div>
              </FormSection>
            )}
            {mode === "edit" && activeSection === "communication" && (
              <FormSection title="Communication Style">
                <FormField label="Tone">
                  <input
                    type="text"
                    value={formData.tone}
                    onChange={(e) =>
                      setFormData({ ...formData, tone: e.target.value })
                    }
                    placeholder='e.g., Casual, uses lowercase, lots of "haha"'
                    className="w-full h-11 px-4 text-sm bg-[#F8F8F8] dark:bg-[#1a1625]/50 border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/20 focus:border-[#EC67A1] transition-all text-sidebar-foreground"
                  />
                </FormField>
                <FormField label="Signature Phrases">
                  <textarea
                    value={(formData.signaturePhrases || []).join("\n")}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        signaturePhrases: e.target.value
                          .split("\n")
                          .filter(Boolean),
                      })
                    }
                    rows={3}
                    placeholder="One phrase per line..."
                    className="w-full px-4 py-3 text-sm bg-[#F8F8F8] dark:bg-[#1a1625]/50 border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/20 focus:border-[#EC67A1] transition-all resize-none text-sidebar-foreground"
                  />
                </FormField>
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Sample Greeting">
                    <textarea
                      value={formData.sampleGreeting}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          sampleGreeting: e.target.value,
                        })
                      }
                      rows={2}
                      placeholder="How she greets new subs..."
                      className="w-full px-4 py-3 text-sm bg-[#F8F8F8] dark:bg-[#1a1625]/50 border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/20 focus:border-[#EC67A1] transition-all resize-none text-sidebar-foreground"
                    />
                  </FormField>
                  <FormField label="Sample Flirty">
                    <textarea
                      value={formData.sampleFlirty}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          sampleFlirty: e.target.value,
                        })
                      }
                      rows={2}
                      placeholder="Flirty example..."
                      className="w-full px-4 py-3 text-sm bg-[#F8F8F8] dark:bg-[#1a1625]/50 border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/20 focus:border-[#EC67A1] transition-all resize-none text-sidebar-foreground"
                    />
                  </FormField>
                </div>
                <FormField label="Sample PPV Pitch">
                  <textarea
                    value={formData.samplePPV}
                    onChange={(e) =>
                      setFormData({ ...formData, samplePPV: e.target.value })
                    }
                    rows={2}
                    placeholder="How she sells PPV..."
                    className="w-full px-4 py-3 text-sm bg-[#F8F8F8] dark:bg-[#1a1625]/50 border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/20 focus:border-[#EC67A1] transition-all resize-none text-sidebar-foreground"
                  />
                </FormField>
              </FormSection>
            )}
            {mode === "edit" && activeSection === "visual" && (
              <FormSection title="Visual Reference">
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Hair">
                    <input
                      type="text"
                      value={formData.hair}
                      onChange={(e) =>
                        setFormData({ ...formData, hair: e.target.value })
                      }
                      placeholder="e.g., Long brunette"
                      className="w-full h-11 px-4 text-sm bg-[#F8F8F8] dark:bg-[#1a1625]/50 border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/20 focus:border-[#EC67A1] transition-all text-sidebar-foreground"
                    />
                  </FormField>
                  <FormField label="Eyes">
                    <input
                      type="text"
                      value={formData.eyes}
                      onChange={(e) =>
                        setFormData({ ...formData, eyes: e.target.value })
                      }
                      placeholder="e.g., Hazel"
                      className="w-full h-11 px-4 text-sm bg-[#F8F8F8] dark:bg-[#1a1625]/50 border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/20 focus:border-[#EC67A1] transition-all text-sidebar-foreground"
                    />
                  </FormField>
                  <FormField label="Body Type">
                    <input
                      type="text"
                      value={formData.bodyType}
                      onChange={(e) =>
                        setFormData({ ...formData, bodyType: e.target.value })
                      }
                      placeholder="e.g., Athletic"
                      className="w-full h-11 px-4 text-sm bg-[#F8F8F8] dark:bg-[#1a1625]/50 border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/20 focus:border-[#EC67A1] transition-all text-sidebar-foreground"
                    />
                  </FormField>
                  <FormField label="Tattoos/Piercings">
                    <input
                      type="text"
                      value={formData.tattoosPiercings}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          tattoosPiercings: e.target.value,
                        })
                      }
                      placeholder="e.g., Small rose on wrist"
                      className="w-full h-11 px-4 text-sm bg-[#F8F8F8] dark:bg-[#1a1625]/50 border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/20 focus:border-[#EC67A1] transition-all text-sidebar-foreground"
                    />
                  </FormField>
                </div>
                <FormField label="Moodboard Keywords">
                  <input
                    type="text"
                    value={formData.moodboardKeywords}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        moodboardKeywords: e.target.value,
                      })
                    }
                    placeholder="e.g., golden hour, beach vibes, mirror selfies"
                    className="w-full h-11 px-4 text-sm bg-[#F8F8F8] dark:bg-[#1a1625]/50 border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/20 focus:border-[#EC67A1] transition-all text-sidebar-foreground"
                  />
                </FormField>
              </FormSection>
            )}
            {mode === "edit" && activeSection === "faqs" && (
              <FormSection title="FAQs & Scenarios">
                <FormField label='"Are you real?"'>
                  <textarea
                    value={formData.faqAreYouReal}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        faqAreYouReal: e.target.value,
                      })
                    }
                    rows={2}
                    className="w-full px-4 py-3 text-sm bg-[#F8F8F8] dark:bg-[#1a1625]/50 border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/20 focus:border-[#EC67A1] transition-all resize-none text-sidebar-foreground"
                  />
                </FormField>
                <FormField label='"Can we meet up?"'>
                  <textarea
                    value={formData.faqMeetUp}
                    onChange={(e) =>
                      setFormData({ ...formData, faqMeetUp: e.target.value })
                    }
                    rows={2}
                    className="w-full px-4 py-3 text-sm bg-[#F8F8F8] dark:bg-[#1a1625]/50 border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/20 focus:border-[#EC67A1] transition-all resize-none text-sidebar-foreground"
                  />
                </FormField>
                <FormField label='"Can I get free content?"'>
                  <textarea
                    value={formData.faqFreeContent}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        faqFreeContent: e.target.value,
                      })
                    }
                    rows={2}
                    className="w-full px-4 py-3 text-sm bg-[#F8F8F8] dark:bg-[#1a1625]/50 border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/20 focus:border-[#EC67A1] transition-all resize-none text-sidebar-foreground"
                  />
                </FormField>
                <FormField label="Fan gets too attached">
                  <textarea
                    value={formData.faqTooAttached}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        faqTooAttached: e.target.value,
                      })
                    }
                    rows={2}
                    className="w-full px-4 py-3 text-sm bg-[#F8F8F8] dark:bg-[#1a1625]/50 border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/20 focus:border-[#EC67A1] transition-all resize-none text-sidebar-foreground"
                  />
                </FormField>
              </FormSection>
            )}
            {mode === "edit" && activeSection === "team" && (
              <FormSection title="Team Notes">
                <FormField label="Internal Notes">
                  <textarea
                    value={formData.internalNotes}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        internalNotes: e.target.value,
                      })
                    }
                    rows={6}
                    placeholder="Notes for the team (not part of the persona)..."
                    className="w-full px-4 py-3 text-sm bg-[#F8F8F8] dark:bg-[#1a1625]/50 border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EC67A1]/20 focus:border-[#EC67A1] transition-all resize-none text-sidebar-foreground"
                  />
                </FormField>
              </FormSection>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#EC67A1]/20 dark:border-[#EC67A1]/30 bg-[#F8F8F8] dark:bg-[#0f0d18] rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-sidebar-foreground hover:text-sidebar-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !formData.name.trim()}
            className="px-6 py-2.5 bg-gradient-to-r from-[#EC67A1] to-[#F774B9] text-white text-sm font-semibold rounded-xl hover:from-[#E1518E] hover:to-[#EC67A1] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-[#EC67A1]/30"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                {mode === "create" ? "Create" : "Save"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function DeleteProfileModal({
  profile,
  onClose,
  onSuccess,
}: {
  profile: InfluencerProfile;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const apiClient = useApiClient();
  const { user: clerkUser } = useUser();

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Determine if this is a shared profile being deleted
  const isOwnProfile = profile.clerkId === clerkUser?.id;
  const isSharedProfile = !isOwnProfile && !!profile.organizationId;

  const handleDelete = async () => {
    if (!apiClient) return;
    setDeleting(true);
    try {
      const response = await apiClient.delete(
        `/api/instagram-profiles/${profile.id}`,
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete profile");
      }
      toast.success(
        isSharedProfile
          ? "Shared profile removed from organization"
          : "Profile deleted",
      );

      // Dispatch event to refresh profile list in sidebar and auto-select another profile
      window.dispatchEvent(
        new CustomEvent("profilesUpdated", {
          detail: {
            deleted: true,
            deletedProfileId: profile.id,
          },
        }),
      );

      onSuccess();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete profile",
      );
    } finally {
      setDeleting(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#1a1625] rounded-2xl shadow-2xl w-full max-w-md p-6 border border-[#EC67A1]/20 dark:border-[#EC67A1]/30">
        <div className="w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-950/50 flex items-center justify-center mx-auto mb-5">
          <Trash2 className="w-7 h-7 text-red-600 dark:text-red-400" />
        </div>
        <h3 className="text-xl font-semibold text-sidebar-foreground text-center mb-2">
          {isSharedProfile ? "Delete Shared Profile" : "Delete Profile"}
        </h3>
        <p className="text-sm text-header-muted text-center mb-6">
          {isSharedProfile ? (
            <>
              Are you sure you want to delete{" "}
              <span className="font-semibold text-sidebar-foreground">
                {profile.name}
              </span>
              ? This will remove the profile from your organization. The profile
              owner will still have access to their profile.
            </>
          ) : (
            <>
              Are you sure you want to delete{" "}
              <span className="font-semibold text-sidebar-foreground">
                {profile.name}
              </span>
              ? This action cannot be undone and will permanently delete the
              profile and all associated data.
            </>
          )}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-5 py-2.5 text-sm font-medium text-sidebar-foreground bg-zinc-100 dark:bg-[#0f0d18] hover:bg-zinc-200 dark:hover:bg-[#1a1625] rounded-xl transition-colors border border-[#EC67A1]/10"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex-1 px-5 py-2.5 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {deleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            Delete
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      <h3 className="text-lg font-semibold text-sidebar-foreground tracking-tight">
        {title}
      </h3>
      {children}
    </div>
  );
}

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-sidebar-foreground mb-2">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

function DetailSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-sidebar-foreground mb-4 flex items-center gap-2">
        <Icon className="w-4 h-4 text-violet-500" />
        {title}
      </h3>
      {children}
    </div>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
      <p className="text-[10px] uppercase tracking-wider text-header-muted mb-1 font-medium">
        {label}
      </p>
      <p className="text-sm font-semibold text-sidebar-foreground">{value}</p>
    </div>
  );
}
