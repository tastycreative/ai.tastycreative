"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { useClerk, useUser } from "@clerk/nextjs";
import { useIsAdmin } from "@/lib/hooks/useIsAdmin";
import { useIsContentCreator } from "@/lib/hooks/useIsContentCreator";
import { usePermissions } from "@/lib/hooks/usePermissions.query";
import { useOrganization } from "@/lib/hooks/useOrganization.query";
import { CreditIndicator } from "@/components/credits/CreditIndicator";
import { PaymentRequiredOverlay } from "@/components/layout/PaymentRequiredOverlay";
import {
  ChevronLeft,
  ChevronRight,
  Home,
  Users,
  FileText,
  Share2,
  PlusCircle,
  Settings,
  CreditCard,
  UserCheck,
  ChevronDown,
  ChevronUp,
  ImageIcon,
  Palette,
  Video,
  Shuffle,
  Sparkles,
  BarChart3,
  Instagram,
  Wand2,
  PlayCircle,
  Bot,
  Shield,
  Bookmark,
  ShoppingBag,
  Calendar,
  GitBranch,
  Clock,
  Activity,
  Hash,
  ListChecks,
  Layers,
  Film,
  Move,
  Flame,
  Mic,
  Library,
  Building2,
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { GlobalProgressDropdown } from "@/components/GlobalProgressDropdown";
import { NotificationBell } from "@/components/NotificationBell";
import { GlobalProfileSelector } from "@/components/GlobalProfileSelector";
import { OrganizationSwitcher } from "@/components/OrganizationSwitcher";
import { PermissionGuard } from "@/components/PermissionGuard";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

interface NavSection {
  name: string;
  items: NavItem[];
  collapsible?: boolean;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [socialMediaOpen, setSocialMediaOpen] = useState(false);
  const [contentStudioOpen, setContentStudioOpen] = useState(false);
  const [generateContentOpen, setGenerateContentOpen] = useState(false);
  const [aiToolsOpen, setAiToolsOpen] = useState(false);
  const [trainModelsOpen, setTrainModelsOpen] = useState(false);
  const [captionBanksOpen, setCaptionBanksOpen] = useState(false);
  const [fluxGroupOpen, setFluxGroupOpen] = useState(false);
  const [wan22GroupOpen, setWan22GroupOpen] = useState(false);
  const [advancedToolsGroupOpen, setAdvancedToolsGroupOpen] = useState(false);
  const [seedreamGroupOpen, setSeedreamGroupOpen] = useState(false);
  const [klingAiGroupOpen, setKlingAiGroupOpen] = useState(false);
  const [aiVoiceGroupOpen, setAiVoiceGroupOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [hoveredSection, setHoveredSection] = useState<string | null>(null);
  const [flyoutPosition, setFlyoutPosition] = useState({ x: 0, y: 0 });
  const [mounted, setMounted] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const flyoutTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const userDropdownButtonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const params = useParams();
  const tenant = params.tenant as string;
  const { signOut } = useClerk();
  const { user } = useUser();
  const { isAdmin } = useIsAdmin();
  const { isContentCreator } = useIsContentCreator();
  const {
    permissions,
    subscriptionInfo,
    loading: permissionsLoading,
  } = usePermissions();
  const { currentOrganization } = useOrganization();

  // Check if organization payment is required
  // Exclude billing page from payment block so users can access it to pay
  const isBillingPage = pathname === `/${tenant}/billing`;
  const isPaymentRequired = !isBillingPage && (
    currentOrganization?.subscriptionStatus === 'PAST_DUE' ||
    currentOrganization?.subscriptionStatus === 'CANCELLED' ||
    currentOrganization?.subscriptionStatus === 'EXPIRED'
  );

  // Dynamic navigation based on user permissions
  // Don't build navigation until permissions are loaded to prevent showing unauthorized tabs
  const navigation: (NavItem | NavSection)[] = permissionsLoading
    ? []
    : [
        {
          name: "Dashboard",
          href: `/${tenant}/dashboard`,
          icon: Home,
        },
        {
          name: "My Influencers",
          href: `/${tenant}/workspace/my-influencers`,
          icon: Users,
        },
        ...(permissions.hasContentTab
          ? [
              {
                name: "Content Ops",
                collapsible: true,
                items: [
                  {
                    name: "OF Models",
                    href: `/${tenant}/of-models`,
                    icon: UserCheck,
                  },
                  {
                    name: "Gallery",
                    href: `/${tenant}/gallery`,
                    icon: ImageIcon,
                  },
                  {
                    name: "GIF Maker",
                    href: `/${tenant}/gif-maker`,
                    icon: Film,
                  },
                  {
                    name: "OTP/PTR",
                    href: `/${tenant}/submissions`,
                    icon: FileText,
                  },
                  {
                    name: "Caption Workspace",
                    href: `/${tenant}/workspace/caption-workspace`,
                    icon: FileText,
                  },
                  {
                    name: "Caption Queue",
                    href: `/${tenant}/workspace/caption-queue`,
                    icon: ListChecks,
                  },
                ],
              },
            ]
          : []),
        {
          name: "Vault",
          href: `/${tenant}/workspace/vault`,
          icon: Shield,
        },
        ...(permissions.hasReferenceBank
          ? [
              {
                name: "Reference Bank",
                href: `/${tenant}/workspace/reference-bank`,
                icon: Library,
              },
            ]
          : []),
        ...(permissions.canCaptionBank
          ? [
              {
                name: "Caption Banks",
                collapsible: true,
                items: [
                  {
                    name: "Captions",
                    href: `/${tenant}/workspace/caption-banks/captions`,
                    icon: FileText,
                  },
                ],
              },
            ]
          : []),
        // Content Studio - check Instagram/Planning tab permissions and individual features
        ...(permissions.hasInstagramTab || permissions.hasPlanningTab
          ? [
              {
                name: "Content Studio",
                collapsible: true,
                items: [
                  // Sexting Set Organizer - always show first if user has the tab
                  {
                    name: "Sexting Set Organizer",
                    href: `/${tenant}/workspace/content-studio/sexting-set-organizer`,
                    icon: Flame,
                  },
                  // Always show these core features if user has the tab
                  {
                    name: "Staging",
                    href: `/${tenant}/workspace/content-studio/staging`,
                    icon: Layers,
                  },
                  {
                    name: "Calendar",
                    href: `/${tenant}/workspace/content-studio/calendar`,
                    icon: Calendar,
                  },
                  // Pipeline - check canContentPipeline permission
                  ...(permissions.canContentPipeline
                    ? [
                        {
                          name: "Pipeline",
                          href: `/${tenant}/workspace/content-studio/pipeline`,
                          icon: GitBranch,
                        },
                      ]
                    : []),
                  // Stories - check canStoryPlanner permission
                  ...(permissions.canStoryPlanner
                    ? [
                        {
                          name: "Stories",
                          href: `/${tenant}/workspace/content-studio/stories`,
                          icon: Clock,
                        },
                      ]
                    : []),
                  // Reels - check canReelPlanner permission
                  ...(permissions.canReelPlanner
                    ? [
                        {
                          name: "Reels",
                          href: `/${tenant}/workspace/content-studio/reels`,
                          icon: Sparkles,
                        },
                      ]
                    : []),
                  // Feed Posts - check canFeedPostPlanner permission
                  ...(permissions.canFeedPostPlanner
                    ? [
                        {
                          name: "Feed Posts",
                          href: `/${tenant}/workspace/content-studio/feed-posts`,
                          icon: ImageIcon,
                        },
                      ]
                    : []),
                  // Performance - check canPerformanceMetrics permission
                  ...(permissions.canPerformanceMetrics
                    ? [
                        {
                          name: "Performance",
                          href: `/${tenant}/workspace/content-studio/performance`,
                          icon: Activity,
                        },
                      ]
                    : []),
                  // Formulas - always show if user has the tab (utility feature)
                  {
                    name: "Formulas",
                    href: `/${tenant}/workspace/content-studio/formulas`,
                    icon: Sparkles,
                  },
                  // Hashtags - check canHashtagBank permission
                  ...(permissions.canHashtagBank
                    ? [
                        {
                          name: "Hashtags",
                          href: `/${tenant}/workspace/content-studio/hashtags`,
                          icon: Hash,
                        },
                      ]
                    : []),
                  // Workflow - always show if user has the tab (utility feature)
                  {
                    name: "Workflow",
                    href: `/${tenant}/workspace/content-studio/workflow`,
                    icon: ListChecks,
                  },
                ],
              },
            ]
          : []),
        // Generate Content - check hasGenerateTab permission and individual feature permissions
        ...(permissions.hasGenerateTab
          ? [
              {
                name: "Generate Content",
                collapsible: true,
                items: [
                  // SeeDream 4.5 section - only show if user has SeeDream features
                  ...(permissions.canSeeDreamTextToImage ||
                  permissions.canSeeDreamImageToImage ||
                  permissions.canSeeDreamTextToVideo ||
                  permissions.canSeeDreamImageToVideo
                    ? [
                        {
                          name: "SEEDREAM_45_GROUP_LABEL",
                          href: "#",
                          icon: Sparkles,
                        },
                        ...(permissions.canSeeDreamTextToImage
                          ? [
                              {
                                name: "SeeDream Text to Image",
                                href: `/${tenant}/workspace/generate-content/seedream-text-to-image`,
                                icon: ImageIcon,
                              },
                            ]
                          : []),
                        ...(permissions.canSeeDreamImageToImage
                          ? [
                              {
                                name: "SeeDream Image to Image",
                                href: `/${tenant}/workspace/generate-content/seedream-image-to-image`,
                                icon: Palette,
                              },
                            ]
                          : []),
                        ...(permissions.canSeeDreamTextToVideo
                          ? [
                              {
                                name: "SeeDream Text to Video",
                                href: `/${tenant}/workspace/generate-content/seedream-text-to-video`,
                                icon: Video,
                              },
                            ]
                          : []),
                        ...(permissions.canSeeDreamImageToVideo
                          ? [
                              {
                                name: "SeeDream Image to Video",
                                href: `/${tenant}/workspace/generate-content/seedream-image-to-video`,
                                icon: PlayCircle,
                              },
                            ]
                          : []),
                      ]
                    : []),
                  // Divider only if we have SeeDream features AND Kling features below
                  ...((permissions.canSeeDreamTextToImage ||
                    permissions.canSeeDreamImageToImage ||
                    permissions.canSeeDreamTextToVideo ||
                    permissions.canSeeDreamImageToVideo) &&
                  (permissions.canKlingTextToVideo ||
                    permissions.canKlingImageToVideo ||
                    permissions.canKlingMultiImageToVideo ||
                    permissions.canKlingMotionControl)
                    ? [
                        {
                          name: "DIVIDER_1",
                          href: "#",
                          icon: Sparkles,
                        },
                      ]
                    : []),
                  // Kling AI section - only show if user has Kling features
                  ...(permissions.canKlingTextToVideo ||
                  permissions.canKlingImageToVideo ||
                  permissions.canKlingMultiImageToVideo ||
                  permissions.canKlingMotionControl
                    ? [
                        {
                          name: "KLING_AI_GROUP_LABEL",
                          href: "#",
                          icon: Film,
                        },
                        ...(permissions.canKlingTextToVideo
                          ? [
                              {
                                name: "Kling Text to Video",
                                href: `/${tenant}/workspace/generate-content/kling-text-to-video`,
                                icon: PlayCircle,
                              },
                            ]
                          : []),
                        ...(permissions.canKlingImageToVideo
                          ? [
                              {
                                name: "Kling Image to Video",
                                href: `/${tenant}/workspace/generate-content/kling-image-to-video`,
                                icon: Video,
                              },
                            ]
                          : []),
                        ...(permissions.canKlingMultiImageToVideo
                          ? [
                              {
                                name: "Kling Multi-Image to Video",
                                href: `/${tenant}/workspace/generate-content/kling-multi-image-to-video`,
                                icon: Film,
                              },
                            ]
                          : []),
                        ...(permissions.canKlingMotionControl
                          ? [
                              {
                                name: "Kling Motion Control",
                                href: `/${tenant}/workspace/generate-content/kling-motion-control`,
                                icon: Move,
                              },
                            ]
                          : []),
                      ]
                    : []),
                  // Divider only if we have Kling features AND AI Voice feature below
                  ...((permissions.canKlingTextToVideo ||
                    permissions.canKlingImageToVideo ||
                    permissions.canKlingMultiImageToVideo ||
                    permissions.canKlingMotionControl) &&
                  permissions.canAIVoice
                    ? [
                        {
                          name: "DIVIDER_2",
                          href: "#",
                          icon: Sparkles,
                        },
                      ]
                    : []),
                  // AI Voice section - only show if user has AI Voice permission
                  ...(permissions.canAIVoice
                    ? [
                        {
                          name: "AI_VOICE_GROUP_LABEL",
                          href: "#",
                          icon: Mic,
                        },
                        {
                          name: "Voice Generator",
                          href: `/${tenant}/workspace/generate-content/ai-voice`,
                          icon: Mic,
                        },
                      ]
                    : []),
                  // Divider only if we have AI Voice AND Advanced Tools below
                  ...(permissions.canAIVoice &&
                  (permissions.canFaceSwap ||
                    permissions.canImageToImageSkinEnhancer ||
                    permissions.canVideoFpsBoost)
                    ? [
                        {
                          name: "DIVIDER_3",
                          href: "#",
                          icon: Sparkles,
                        },
                      ]
                    : []),
                  // Advanced Tools section - only show if user has advanced features
                  ...(permissions.canFaceSwap ||
                  permissions.canImageToImageSkinEnhancer ||
                  permissions.canVideoFpsBoost
                    ? [
                        {
                          name: "ADVANCED_TOOLS_GROUP_LABEL",
                          href: "#",
                          icon: Wand2,
                        },
                        ...(permissions.canFaceSwap
                          ? [
                              {
                                name: "Face Swapping",
                                href: `/${tenant}/workspace/generate-content/face-swapping`,
                                icon: Shuffle,
                              },
                            ]
                          : []),
                        ...(permissions.canImageToImageSkinEnhancer
                          ? [
                              {
                                name: "Image-to-Image Skin Enhancer",
                                href: `/${tenant}/workspace/generate-content/image-to-image-skin-enhancer`,
                                icon: Palette,
                              },
                            ]
                          : []),
                        ...(permissions.canVideoFpsBoost
                          ? [
                              {
                                name: "FPS Boost",
                                href: `/${tenant}/workspace/generate-content/fps-boost`,
                                icon: PlayCircle,
                              },
                            ]
                          : []),
                      ]
                    : []),
                ].flat(), // Flatten to remove nested arrays
              },
            ]
          : []),
        // Social Media - check hasFeedTab permission
        ...(permissions.hasFeedTab
          ? [
              {
                name: "Social Media",
                collapsible: true,
                items: [
                  {
                    name: "User Feed",
                    href: `/${tenant}/workspace/user-feed`,
                    icon: Share2,
                  },
                  {
                    name: "My Profile",
                    href: `/${tenant}/workspace/my-profile`,
                    icon: UserCheck,
                  },
                  {
                    name: "Friends",
                    href: `/${tenant}/workspace/friends`,
                    icon: UserCheck,
                  },
                  {
                    name: "Bookmarks",
                    href: `/${tenant}/workspace/bookmarks`,
                    icon: Bookmark,
                  },
                ],
              },
            ]
          : []),
        // Train Models - check hasTrainingTab permission
        ...(permissions.hasTrainingTab
          ? [
              {
                name: "Train Models",
                collapsible: true,
                items: [
                  {
                    name: "Train LoRA",
                    href: `/${tenant}/workspace/train-lora`,
                    icon: PlusCircle,
                  },
                  {
                    name: "Training Jobs",
                    href: `/${tenant}/workspace/training-jobs`,
                    icon: BarChart3,
                  },
                ],
              },
            ]
          : []),
        // AI Tools - show if user has generation features
        ...(permissions.hasGenerateTab
          ? [
              {
                name: "AI Tools",
                collapsible: true,
                items: [
                  {
                    name: "My LoRA Models",
                    href: `/${tenant}/workspace/my-lora-models`,
                    icon: Users,
                  },
                  {
                    name: "Instagram Extractor",
                    href: `/${tenant}/workspace/ai-tools/instagram-extractor`,
                    icon: Instagram,
                  },
                  {
                    name: "Style Transfer Prompts",
                    href: `/${tenant}/workspace/ai-tools/style-transfer-prompts`,
                    icon: Wand2,
                  },
                  {
                    name: "Video Prompts",
                    href: `/${tenant}/workspace/ai-tools/video-prompts`,
                    icon: PlayCircle,
                  },
                  {
                    name: "Flux Kontext Prompts",
                    href: `/${tenant}/workspace/ai-tools/flux-kontext-prompts`,
                    icon: Sparkles,
                  },
                ],
              },
            ]
          : []),
        // Marketplace - check permission
        ...(permissions.hasMarketplaceTab
          ? [
              {
                name: "AI Marketplace",
                href: `/${tenant}/workspace/ai-marketplace`,
                icon: ShoppingBag,
              },
            ]
          : []),
        // Caption Banks - check canCaptionBank permission

        // Conditionally add content creator link
        ...(isContentCreator
          ? [
              {
                name: "Content Creator",
                href: `/${tenant}/content-creator`,
                icon: BarChart3,
              },
            ]
          : []),
        {
          name: "Settings",
          href: `/${tenant}/settings`,
          icon: Settings,
        },
        // Billing - only show to OWNER and ADMIN
        ...(currentOrganization?.role === "OWNER" ||
        currentOrganization?.role === "ADMIN"
          ? [
              {
                name: "Billing",
                href: `/${tenant}/billing`,
                icon: CreditCard,
              },
            ]
          : []),
        // Team - only show to OWNER, ADMIN, and MANAGER
        ...(currentOrganization?.role === "OWNER" ||
        currentOrganization?.role === "ADMIN" ||
        currentOrganization?.role === "MANAGER"
          ? [
              {
                name: "Team",
                href: `/${tenant}/team`,
                icon: UserCheck,
              },
            ]
          : []),
      ];

  // Get user's first name or fallback
  const firstName = user?.firstName || user?.username || "User";
  const email = user?.emailAddresses?.[0]?.emailAddress || "";
  const initials = firstName.charAt(0).toUpperCase();

  function classNames(...classes: string[]) {
    return classes.filter(Boolean).join(" ");
  }

  // Handle mobile detection and sidebar state
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (mobile) {
        setSidebarOpen(false); // Default to closed on mobile
      }
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Mount state for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle click outside user dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // Don't close if clicking inside the user dropdown
      if (userDropdownRef.current && userDropdownRef.current.contains(target)) {
        return;
      }

      // Don't close if clicking the user dropdown button
      if (
        userDropdownButtonRef.current &&
        userDropdownButtonRef.current.contains(target)
      ) {
        return;
      }

      // Don't close if clicking inside any portal dropdown (like OrganizationSwitcher)
      const portalElements = document.querySelectorAll(
        "[data-dropdown-portal]",
      );
      for (const portal of Array.from(portalElements)) {
        if (portal.contains(target)) {
          return;
        }
      }

      // Close the dropdown if clicking outside
      setUserDropdownOpen(false);
    };

    if (userDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [userDropdownOpen]);

  const isNavItemActive = (href: string) => {
    if (href === `//dashboard`) {
      return pathname === `//dashboard`;
    }
    return pathname.startsWith(href);
  };

  const renderNavItem = (item: NavItem, isInSection = false) => {
    // Handle Flux group label
    if (item.name === "FLUX_GROUP_LABEL") {
      return sidebarOpen ? (
        <div
          key="flux-group-label"
          className="mx-2.5 xs:mx-3 mt-2.5 xs:mt-3 mb-1.5"
        >
          <button
            onClick={() => setFluxGroupOpen(!fluxGroupOpen)}
            className="w-full relative group"
          >
            {/* Background glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 rounded-lg blur-sm"></div>

            {/* Main label container */}
            <div className="relative bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 dark:from-blue-500/10 dark:via-purple-500/10 dark:to-pink-500/10 border border-blue-400/30 dark:border-blue-500/20 rounded-lg px-2.5 xs:px-3 py-1.5 xs:py-2 backdrop-blur-sm hover:border-blue-400/50 transition-all duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5 xs:space-x-2">
                  <div className="relative">
                    <Sparkles className="h-3.5 w-3.5 xs:h-4 xs:w-4 text-blue-400 dark:text-blue-300 animate-pulse" />
                    <div className="absolute inset-0 h-3.5 w-3.5 xs:h-4 xs:w-4 text-blue-400 dark:text-blue-300 opacity-50 blur-sm">
                      <Sparkles className="h-3.5 w-3.5 xs:h-4 xs:w-4" />
                    </div>
                  </div>
                  <span className="text-[10px] xs:text-xs font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 dark:from-blue-300 dark:via-purple-300 dark:to-pink-300 bg-clip-text text-transparent uppercase tracking-wider">
                    Flux Models
                  </span>
                </div>
                {fluxGroupOpen ? (
                  <ChevronUp className="h-3 w-3 text-blue-400 dark:text-blue-300 transition-transform duration-200" />
                ) : (
                  <ChevronDown className="h-3 w-3 text-blue-400 dark:text-blue-300 transition-transform duration-200" />
                )}
              </div>
            </div>
          </button>
        </div>
      ) : null;
    }

    // Handle Wan 2.2 group label
    if (item.name === "WAN_22_GROUP_LABEL") {
      return sidebarOpen ? (
        <div
          key="wan-22-group-label"
          className="mx-2.5 xs:mx-3 mt-2.5 xs:mt-3 mb-1.5"
        >
          <button
            onClick={() => setWan22GroupOpen(!wan22GroupOpen)}
            className="w-full relative group"
          >
            {/* Background glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 via-emerald-500/10 to-teal-500/10 rounded-lg blur-sm"></div>

            {/* Main label container */}
            <div className="relative bg-gradient-to-r from-green-500/20 via-emerald-500/20 to-teal-500/20 dark:from-green-500/10 dark:via-emerald-500/10 dark:to-teal-500/10 border border-green-400/30 dark:border-green-500/20 rounded-lg px-2.5 xs:px-3 py-1.5 xs:py-2 backdrop-blur-sm hover:border-green-400/50 transition-all duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5 xs:space-x-2">
                  <div className="relative">
                    <Video className="h-3.5 w-3.5 xs:h-4 xs:w-4 text-green-400 dark:text-green-300 animate-pulse" />
                    <div className="absolute inset-0 h-3.5 w-3.5 xs:h-4 xs:w-4 text-green-400 dark:text-green-300 opacity-50 blur-sm">
                      <Video className="h-3.5 w-3.5 xs:h-4 xs:w-4" />
                    </div>
                  </div>
                  <span className="text-[10px] xs:text-xs font-bold bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400 dark:from-green-300 dark:via-emerald-300 dark:to-teal-300 bg-clip-text text-transparent uppercase tracking-wider">
                    Wan 2.2 Models
                  </span>
                </div>
                {wan22GroupOpen ? (
                  <ChevronUp className="h-3 w-3 text-green-400 dark:text-green-300 transition-transform duration-200" />
                ) : (
                  <ChevronDown className="h-3 w-3 text-green-400 dark:text-green-300 transition-transform duration-200" />
                )}
              </div>
            </div>
          </button>
        </div>
      ) : null;
    }

    // Handle Advanced Tools group label
    if (item.name === "ADVANCED_TOOLS_GROUP_LABEL") {
      return sidebarOpen ? (
        <div
          key="advanced-tools-group-label"
          className="mx-2.5 xs:mx-3 mt-2.5 xs:mt-3 mb-1.5"
        >
          <button
            onClick={() => setAdvancedToolsGroupOpen(!advancedToolsGroupOpen)}
            className="w-full relative group"
          >
            {/* Background glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-orange-500/10 rounded-lg blur-sm"></div>

            {/* Main label container */}
            <div className="relative bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-orange-500/20 dark:from-purple-500/10 dark:via-pink-500/10 dark:to-orange-500/10 border border-purple-400/30 dark:border-purple-500/20 rounded-lg px-2.5 xs:px-3 py-1.5 xs:py-2 backdrop-blur-sm hover:border-purple-400/50 transition-all duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5 xs:space-x-2">
                  <div className="relative">
                    <Wand2 className="h-3.5 w-3.5 xs:h-4 xs:w-4 text-purple-400 dark:text-purple-300 animate-pulse" />
                    <div className="absolute inset-0 h-3.5 w-3.5 xs:h-4 xs:w-4 text-purple-400 dark:text-purple-300 opacity-50 blur-sm">
                      <Wand2 className="h-3.5 w-3.5 xs:h-4 xs:w-4" />
                    </div>
                  </div>
                  <span className="text-[10px] xs:text-xs font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 dark:from-purple-300 dark:via-pink-300 dark:to-orange-300 bg-clip-text text-transparent uppercase tracking-wider">
                    Advanced Tools
                  </span>
                </div>
                {advancedToolsGroupOpen ? (
                  <ChevronUp className="h-3 w-3 text-purple-400 dark:text-purple-300 transition-transform duration-200" />
                ) : (
                  <ChevronDown className="h-3 w-3 text-purple-400 dark:text-purple-300 transition-transform duration-200" />
                )}
              </div>
            </div>
          </button>
        </div>
      ) : null;
    }

    // Handle SeeDream 4.5 group label
    if (item.name === "SEEDREAM_45_GROUP_LABEL") {
      return sidebarOpen ? (
        <div
          key="seedream-45-group-label"
          className="mx-2.5 xs:mx-3 mt-2.5 xs:mt-3 mb-1.5"
        >
          <button
            onClick={() => setSeedreamGroupOpen(!seedreamGroupOpen)}
            className="w-full relative group"
          >
            {/* Background glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-indigo-500/10 rounded-lg blur-sm"></div>

            {/* Main label container */}
            <div className="relative bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-indigo-500/20 dark:from-cyan-500/10 dark:via-blue-500/10 dark:to-indigo-500/10 border border-cyan-400/30 dark:border-cyan-500/20 rounded-lg px-2.5 xs:px-3 py-1.5 xs:py-2 backdrop-blur-sm hover:border-cyan-400/50 transition-all duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5 xs:space-x-2">
                  <div className="relative">
                    <Sparkles className="h-3.5 w-3.5 xs:h-4 xs:w-4 text-cyan-400 dark:text-cyan-300 animate-pulse" />
                    <div className="absolute inset-0 h-3.5 w-3.5 xs:h-4 xs:w-4 text-cyan-400 dark:text-cyan-300 opacity-50 blur-sm">
                      <Sparkles className="h-3.5 w-3.5 xs:h-4 xs:w-4" />
                    </div>
                  </div>
                  <span className="text-[10px] xs:text-xs font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 dark:from-cyan-300 dark:via-blue-300 dark:to-indigo-300 bg-clip-text text-transparent uppercase tracking-wider">
                    SeeDream 4.5
                  </span>
                </div>
                {seedreamGroupOpen ? (
                  <ChevronUp className="h-3 w-3 text-cyan-400 dark:text-cyan-300 transition-transform duration-200" />
                ) : (
                  <ChevronDown className="h-3 w-3 text-cyan-400 dark:text-cyan-300 transition-transform duration-200" />
                )}
              </div>
            </div>
          </button>
        </div>
      ) : null;
    }

    // Handle Kling AI group label
    if (item.name === "KLING_AI_GROUP_LABEL") {
      return sidebarOpen ? (
        <div
          key="kling-ai-group-label"
          className="mx-2.5 xs:mx-3 mt-2.5 xs:mt-3 mb-1.5"
        >
          <button
            onClick={() => setKlingAiGroupOpen(!klingAiGroupOpen)}
            className="w-full relative group"
          >
            {/* Background glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-violet-500/10 via-purple-500/10 to-pink-500/10 rounded-lg blur-sm"></div>

            {/* Main label container */}
            <div className="relative bg-gradient-to-r from-violet-500/20 via-purple-500/20 to-pink-500/20 dark:from-violet-500/10 dark:via-purple-500/10 dark:to-pink-500/10 border border-violet-400/30 dark:border-violet-500/20 rounded-lg px-2.5 xs:px-3 py-1.5 xs:py-2 backdrop-blur-sm hover:border-violet-400/50 transition-all duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5 xs:space-x-2">
                  <div className="relative">
                    <Film className="h-3.5 w-3.5 xs:h-4 xs:w-4 text-violet-400 dark:text-violet-300 animate-pulse" />
                    <div className="absolute inset-0 h-3.5 w-3.5 xs:h-4 xs:w-4 text-violet-400 dark:text-violet-300 opacity-50 blur-sm">
                      <Film className="h-3.5 w-3.5 xs:h-4 xs:w-4" />
                    </div>
                  </div>
                  <span className="text-[10px] xs:text-xs font-bold bg-gradient-to-r from-violet-400 via-purple-400 to-pink-400 dark:from-violet-300 dark:via-purple-300 dark:to-pink-300 bg-clip-text text-transparent uppercase tracking-wider">
                    Kling AI
                  </span>
                </div>
                {klingAiGroupOpen ? (
                  <ChevronUp className="h-3 w-3 text-violet-400 dark:text-violet-300 transition-transform duration-200" />
                ) : (
                  <ChevronDown className="h-3 w-3 text-violet-400 dark:text-violet-300 transition-transform duration-200" />
                )}
              </div>
            </div>
          </button>
        </div>
      ) : null;
    }

    // Handle AI Voice group label
    if (item.name === "AI_VOICE_GROUP_LABEL") {
      return sidebarOpen ? (
        <div
          key="ai-voice-group-label"
          className="mx-2.5 xs:mx-3 mt-2.5 xs:mt-3 mb-1.5"
        >
          <button
            onClick={() => setAiVoiceGroupOpen(!aiVoiceGroupOpen)}
            className="w-full relative group"
          >
            {/* Background glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 via-orange-500/10 to-yellow-500/10 rounded-lg blur-sm"></div>

            {/* Main label container */}
            <div className="relative bg-gradient-to-r from-red-500/20 via-orange-500/20 to-yellow-500/20 dark:from-red-500/10 dark:via-orange-500/10 dark:to-yellow-500/10 border border-red-400/30 dark:border-red-500/20 rounded-lg px-2.5 xs:px-3 py-1.5 xs:py-2 backdrop-blur-sm hover:border-red-400/50 transition-all duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5 xs:space-x-2">
                  <div className="relative">
                    <Mic className="h-3.5 w-3.5 xs:h-4 xs:w-4 text-red-400 dark:text-red-300 animate-pulse" />
                    <div className="absolute inset-0 h-3.5 w-3.5 xs:h-4 xs:w-4 text-red-400 dark:text-red-300 opacity-50 blur-sm">
                      <Mic className="h-3.5 w-3.5 xs:h-4 xs:w-4" />
                    </div>
                  </div>
                  <span className="text-[10px] xs:text-xs font-bold bg-gradient-to-r from-red-400 via-orange-400 to-yellow-400 dark:from-red-300 dark:via-orange-300 dark:to-yellow-300 bg-clip-text text-transparent uppercase tracking-wider">
                    AI Voice
                  </span>
                </div>
                {aiVoiceGroupOpen ? (
                  <ChevronUp className="h-3 w-3 text-red-400 dark:text-red-300 transition-transform duration-200" />
                ) : (
                  <ChevronDown className="h-3 w-3 text-red-400 dark:text-red-300 transition-transform duration-200" />
                )}
              </div>
            </div>
          </button>
        </div>
      ) : null;
    }

    // Handle divider
    if (item.name.startsWith("DIVIDER")) {
      return sidebarOpen ? (
        <div key={item.name} className="mx-2.5 xs:mx-3 my-2.5 xs:my-3">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-500/20 to-transparent blur-sm"></div>
            <div className="relative border-t border-gray-600/40 dark:border-gray-700/40"></div>
          </div>
        </div>
      ) : null;
    }

    // Helper function to check if item should be hidden based on group state
    const isItemInCollapsedGroup = () => {
      // Map of group states to their item names
      if (
        !fluxGroupOpen &&
        [
          "Text to Image",
          "Style Transfer",
          "Skin Enhancer",
          "Flux Kontext",
        ].includes(item.name)
      ) {
        return true;
      }
      if (
        !wan22GroupOpen &&
        ["Text to Video", "Image to Video"].includes(item.name)
      ) {
        return true;
      }
      if (
        !advancedToolsGroupOpen &&
        ["Face Swapping", "Image-to-Image Skin Enhancer", "FPS Boost"].includes(
          item.name,
        )
      ) {
        return true;
      }
      if (
        !seedreamGroupOpen &&
        [
          "SeeDream Text to Image",
          "SeeDream Image to Image",
          "SeeDream Text to Video",
          "SeeDream Image to Video",
        ].includes(item.name)
      ) {
        return true;
      }
      if (
        !klingAiGroupOpen &&
        [
          "Kling Text to Video",
          "Kling Image to Video",
          "Kling Multi-Image to Video",
          "Kling Motion Control",
        ].includes(item.name)
      ) {
        return true;
      }
      if (!aiVoiceGroupOpen && ["Voice Generator"].includes(item.name)) {
        return true;
      }
      return false;
    };

    // Don't render item if it's in a collapsed group and sidebar is open
    if (sidebarOpen && isItemInCollapsedGroup()) {
      return null;
    }

    const isActive = isNavItemActive(item.href);
    const Icon = item.icon;

    const handleClick = () => {
      // Close sidebar on mobile when navigation item is clicked
      if (isMobile) {
        setSidebarOpen(false);
      }
    };

    const handleMouseEnter = (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (!sidebarOpen) {
        const rect = e.currentTarget.getBoundingClientRect();
        setTooltipPosition({
          x: rect.right + 8,
          y: rect.top + rect.height / 2,
        });
        setHoveredItem(item.name);
      }
    };

    const handleMouseLeave = () => {
      setHoveredItem(null);
    };

    return (
      <Link
        key={item.name}
        href={item.href}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={classNames(
          isActive
            ? "bg-gradient-to-r from-[#EC67A1] to-[#F774B9] text-white shadow-lg shadow-[#EC67A1]/25 scale-[1.02] border-2 border-[#EC67A1]/30"
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground hover:scale-[1.02] hover:shadow-md hover:border-[#EC67A1]/20 border-2 border-transparent",
          "group flex items-center px-2.5 xs:px-3 py-2 xs:py-2.5 text-xs xs:text-sm font-medium rounded-xl transition-all duration-300 active:scale-95",
          isInSection ? "pl-6 xs:pl-7 sm:pl-8" : "",
          !sidebarOpen ? "justify-center" : "",
        )}
      >
        <Icon
          className={classNames(
            isActive
              ? "text-white"
              : "text-[#5DC3F8] group-hover:text-[#EC67A1]",
            "h-5 w-5 xs:h-5.5 xs:w-5.5 sm:h-6 sm:w-6 flex-shrink-0 transition-all duration-300",
            sidebarOpen ? "mr-2 xs:mr-2.5 sm:mr-3" : "",
            isActive ? "scale-110" : "group-hover:scale-110",
          )}
          aria-hidden="true"
        />
        {sidebarOpen && <span className="truncate">{item.name}</span>}
      </Link>
    );
  };

  const renderNavSection = (section: NavSection) => {
    const isWorkspaceSection = section.name === "Workspace";
    const isSocialMediaSection = section.name === "Social Media";
    const isContentStudioSection = section.name === "Content Studio";
    const isGenerateContentSection = section.name === "Generate Content";
    const isAiToolsSection = section.name === "AI Tools";
    const isTrainModelsSection = section.name === "Train Models";
    const isCaptionBanksSection = section.name === "Caption Banks";

    // Determine if section is expanded
    let isExpanded = true;
    if (isWorkspaceSection) {
      isExpanded = workspaceOpen;
    } else if (isSocialMediaSection) {
      isExpanded = socialMediaOpen;
    } else if (isContentStudioSection) {
      isExpanded = contentStudioOpen;
    } else if (isGenerateContentSection) {
      isExpanded = generateContentOpen;
    } else if (isAiToolsSection) {
      isExpanded = aiToolsOpen;
    } else if (isTrainModelsSection) {
      isExpanded = trainModelsOpen;
    } else if (isCaptionBanksSection) {
      isExpanded = captionBanksOpen;
    }

    // Get the appropriate icon for the section
    const getSectionIcon = () => {
      if (isWorkspaceSection) return Users;
      if (isSocialMediaSection) return Share2;
      if (isContentStudioSection) return Layers;
      if (isGenerateContentSection) return PlusCircle;
      if (isAiToolsSection) return Bot;
      if (isTrainModelsSection) return Settings;
      if (isCaptionBanksSection) return FileText;
      return Users; // fallback
    };

    const SectionIcon = getSectionIcon();

    // Handle section toggle
    const handleSectionToggle = () => {
      if (isWorkspaceSection) {
        setWorkspaceOpen(!workspaceOpen);
      } else if (isSocialMediaSection) {
        setSocialMediaOpen(!socialMediaOpen);
      } else if (isContentStudioSection) {
        setContentStudioOpen(!contentStudioOpen);
      } else if (isGenerateContentSection) {
        setGenerateContentOpen(!generateContentOpen);
      } else if (isAiToolsSection) {
        setAiToolsOpen(!aiToolsOpen);
      } else if (isTrainModelsSection) {
        setTrainModelsOpen(!trainModelsOpen);
      } else if (isCaptionBanksSection) {
        setCaptionBanksOpen(!captionBanksOpen);
      }
    };

    // Check if any item in this section is active
    const isSectionActive = section.items.some((item) =>
      isNavItemActive(item.href),
    );

    return (
      <div key={section.name} className="space-y-1">
        {section.collapsible && sidebarOpen ? (
          <button
            onClick={handleSectionToggle}
            className={classNames(
              isSectionActive
                ? "bg-sidebar-accent/80 border-l-4 border-[#EC67A1]"
                : "border-l-4 border-transparent hover:border-[#EC67A1]/30",
              "w-full flex items-center justify-between px-2.5 xs:px-3 py-2 xs:py-2.5 text-xs xs:text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground rounded-xl transition-all duration-300 active:scale-95 hover:scale-[1.02] hover:shadow-md",
            )}
          >
            <span className="flex items-center">
              <SectionIcon
                className={classNames(
                  isSectionActive
                    ? "text-[#EC67A1]"
                    : "text-[#5DC3F8] group-hover:text-[#EC67A1]",
                  "h-5 w-5 xs:h-5.5 xs:w-5.5 sm:h-6 sm:w-6 flex-shrink-0 mr-2 xs:mr-2.5 sm:mr-3 transition-all duration-300 group-hover:scale-110",
                )}
              />
              <span className="truncate">{section.name}</span>
            </span>
            {isExpanded ? (
              <ChevronUp className="h-3.5 w-3.5 xs:h-4 xs:w-4 text-[#EC67A1] transition-transform duration-300" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 xs:h-4 xs:w-4 text-[#5DC3F8] transition-transform duration-300" />
            )}
          </button>
        ) : section.collapsible && !sidebarOpen ? (
          // Collapsed sidebar - show section icon with flyout menu on hover
          <div className="relative">
            <button
              onMouseEnter={(e) => {
                // Clear any pending close timeout
                if (flyoutTimeoutRef.current) {
                  clearTimeout(flyoutTimeoutRef.current);
                  flyoutTimeoutRef.current = null;
                }
                const rect = e.currentTarget.getBoundingClientRect();
                setFlyoutPosition({ x: rect.right, y: rect.top });
                setHoveredSection(section.name);
              }}
              onMouseLeave={() => {
                // Delay closing to allow mouse to reach flyout
                flyoutTimeoutRef.current = setTimeout(() => {
                  setHoveredSection(null);
                }, 150);
              }}
              className={classNames(
                isSectionActive || hoveredSection === section.name
                  ? "bg-sidebar-accent/80 text-sidebar-foreground border-2 border-[#EC67A1]/30"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground border-2 border-transparent hover:border-[#EC67A1]/20",
                "w-full flex items-center justify-center px-2.5 py-2 xs:py-2.5 rounded-xl transition-all duration-300 active:scale-95",
              )}
            >
              <SectionIcon
                className={classNames(
                  isSectionActive ? "text-[#EC67A1]" : "text-[#5DC3F8]",
                  "h-5 w-5 xs:h-5.5 xs:w-5.5 sm:h-6 sm:w-6 flex-shrink-0 transition-all duration-300 hover:scale-110",
                )}
              />
            </button>

            {/* Flyout menu - rendered via portal */}
            {mounted &&
              hoveredSection === section.name &&
              createPortal(
                <div
                  data-flyout
                  className="fixed bg-sidebar rounded-2xl shadow-2xl border border-sidebar-border z-[100] animate-fadeIn"
                  style={{
                    left: `${flyoutPosition.x + 8}px`,
                    top: `${flyoutPosition.y}px`,
                    maxHeight: "calc(100vh - 100px)",
                    minWidth: "220px",
                  }}
                  onMouseEnter={() => {
                    // Clear any pending close timeout
                    if (flyoutTimeoutRef.current) {
                      clearTimeout(flyoutTimeoutRef.current);
                      flyoutTimeoutRef.current = null;
                    }
                  }}
                  onMouseLeave={() => {
                    setHoveredSection(null);
                  }}
                >
                  {/* Invisible bridge to connect button to flyout */}
                  <div
                    className="absolute right-full top-0 w-3 h-full"
                    style={{ background: "transparent" }}
                  />
                  {/* Section header */}
                  <div className="px-3 py-2.5 border-b border-sidebar-border bg-sidebar-accent rounded-t-2xl">
                    <span className="text-sm font-semibold text-sidebar-foreground flex items-center gap-2">
                      <SectionIcon className="h-4 w-4 text-[#5DC3F8]" />
                      {section.name}
                    </span>
                  </div>
                  {/* Section items */}
                  <div className="py-1 max-h-80 overflow-y-auto custom-scrollbar">
                    {section.items
                      .filter(
                        (item) =>
                          !item.name.startsWith("DIVIDER") &&
                          !item.name.endsWith("_GROUP_LABEL"),
                      )
                      .map((item) => {
                        const isActive = isNavItemActive(item.href);
                        const ItemIcon = item.icon;
                        return (
                          <Link
                            key={item.name}
                            href={item.href}
                            onClick={() => {
                              setHoveredSection(null);
                              if (isMobile) {
                                setSidebarOpen(false);
                              }
                            }}
                            className={classNames(
                              isActive
                                ? "bg-gradient-to-r from-[#EC67A1] to-[#F774B9] text-white"
                                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
                              "flex items-center gap-2 px-3 py-2 text-sm transition-all duration-200 rounded-lg mx-1",
                            )}
                          >
                            <ItemIcon
                              className={classNames(
                                isActive ? "text-white" : "text-[#5DC3F8]",
                                "h-4 w-4 flex-shrink-0",
                              )}
                            />
                            <span className="truncate">{item.name}</span>
                          </Link>
                        );
                      })}
                  </div>
                  {/* Arrow pointer */}
                  <div className="absolute left-0 top-3 transform -translate-x-1 w-2 h-2 bg-sidebar rotate-45 border-l border-b border-sidebar-border"></div>
                </div>,
                document.body,
              )}
          </div>
        ) : (
          sidebarOpen && (
            <div className="px-2 py-2 text-[10px] xs:text-xs font-semibold text-gray-400 dark:text-gray-400 uppercase tracking-wider">
              {section.name}
            </div>
          )
        )}
        {isExpanded && sidebarOpen && (
          <div
            className={classNames(
              section.collapsible ? "space-y-1 animate-fadeIn" : "space-y-1",
            )}
          >
            {section.items.map((item) =>
              renderNavItem(item, section.collapsible),
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-background relative overflow-hidden">
      {/* Background ambient effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#EC67A1]/10 dark:bg-[#F774B9]/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#5DC3F8]/10 dark:bg-[#EC67A1]/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-br from-[#EC67A1]/5 to-[#5DC3F8]/5 rounded-full blur-3xl" />
      </div>

      {/* Desktop Sidebar - Modern Glass Design */}
      <div
        className={classNames(
          "hidden lg:flex flex-col transition-all duration-300 ease-out relative z-10",
          sidebarOpen ? "w-80" : "w-24",
        )}
      >
        {/* Sidebar Glass Container */}
        <div className="flex-1 m-3 rounded-3xl bg-background backdrop-blur-2xl border border-sidebar-border flex flex-col overflow-hidden shadow-xl">
          {/* Sidebar Header with Logo */}
          <div className="p-5 border-b border-sidebar-border">
            <div className="flex items-center justify-between">
              {sidebarOpen ? (
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#EC67A1] via-[#F774B9] to-[#5DC3F8] flex items-center justify-center shadow-lg shadow-[#EC67A1]/30 flex-shrink-0">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h1 className="text-xl font-bold text-sidebar-foreground">
                      Creative Ink
                    </h1>
                    {!permissionsLoading && currentOrganization ? (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {currentOrganization.logoUrl ? (
                          <img
                            src={currentOrganization.logoUrl}
                            alt={currentOrganization.name}
                            className="w-3 h-3 rounded object-cover flex-shrink-0"
                          />
                        ) : (
                          <Building2 className="w-3 h-3 text-[#5DC3F8] flex-shrink-0" />
                        )}
                        <p className="text-[10px] text-sidebar-foreground/50 font-medium tracking-wide truncate">
                          {currentOrganization.name}
                        </p>
                      </div>
                    ) : (
                      <p className="text-[11px] text-sidebar-foreground/40 font-medium tracking-wide">
                        AI CONTENT STUDIO
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#EC67A1] via-[#F774B9] to-[#5DC3F8] flex items-center justify-center shadow-lg shadow-[#EC67A1]/30 mx-auto">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
              )}
              {sidebarOpen && (
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="p-2.5 rounded-xl text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all duration-200 flex-shrink-0"
                  title="Collapse sidebar"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}
            </div>
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="w-full mt-4 p-2.5 rounded-xl text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all duration-200 flex items-center justify-center"
                title="Expand sidebar"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}

            {/* Profile Selector Section */}
            {sidebarOpen && (
              <div className="w-full mt-4">
                {permissionsLoading ? (
                  <div className="animate-pulse">
                    <div className="h-12 bg-sidebar-accent rounded-lg" />
                  </div>
                ) : (
                  <>
                    {/* Profile Selector - for switching between Instagram profiles */}
                    <div className="w-full">
                      <div className="text-[10px] font-semibold text-sidebar-foreground/30 uppercase tracking-wider mb-2 px-1">
                        Active Profile
                      </div>
                      <GlobalProfileSelector />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto custom-scrollbar">
            {permissionsLoading ? (
              // Loading skeleton while permissions are being fetched
              <div className="space-y-2 animate-pulse">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="h-10 bg-gray-700/50 dark:bg-gray-800/50 rounded-lg"
                  />
                ))}
              </div>
            ) : (
              navigation.map((item) => {
                if ("items" in item) {
                  return renderNavSection(item);
                } else {
                  return renderNavItem(item);
                }
              })
            )}
          </nav>

          {/* Sidebar Footer */}
          <div className="p-5 border-t border-sidebar-border">
            {sidebarOpen ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ThemeToggle />
                </div>
                <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-sidebar-accent border border-[#EC67A1]/20">
                  <CreditCard className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-semibold text-sidebar-foreground">
                    {currentOrganization?.availableCredits ?? 0} Credits
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <ThemeToggle />
                <div
                  className="flex items-center justify-center w-12 h-12 rounded-xl bg-sidebar-accent border border-[#EC67A1]/20"
                  title={`${currentOrganization?.availableCredits ?? 0} Credits`}
                >
                  <CreditCard className="w-5 h-5 text-emerald-400" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      <div
        className={classNames(
          "lg:hidden fixed inset-0 z-50 transition-opacity duration-300",
          sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />

        {/* Mobile Sidebar */}
        <div
          className={classNames(
            "absolute left-0 top-0 bottom-0 w-80 bg-background border-r border-sidebar-border flex flex-col transition-transform duration-300 ease-out rounded-r-3xl",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          {/* Sidebar header */}
          <div className="flex flex-col space-y-2 p-2.5 xs:p-3 sm:p-4 border-b border-sidebar-border">
            <div className="flex items-center justify-end">
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1 text-sidebar-foreground/50 hover:text-sidebar-foreground transition-all duration-200 active:scale-95 hover:bg-sidebar-accent rounded-xl"
                aria-label="Close sidebar"
              >
                <ChevronLeft className="h-4 w-4 xs:h-4.5 xs:w-4.5 sm:h-5 sm:w-5" />
              </button>
            </div>
            <div className="space-y-3">
              {permissionsLoading ? (
                // Loading skeleton for selectors
                <div className="animate-pulse space-y-3">
                  <div className="h-10 bg-sidebar-accent rounded-xl" />
                  <div className="h-10 bg-sidebar-accent rounded-xl" />
                </div>
              ) : (
                <>
                  {/* Organization Switcher */}
                  <div>
                    <div className="px-1 mb-2">
                      <p className="text-[10px] font-medium text-sidebar-foreground/40 uppercase tracking-wider">
                        Organization
                      </p>
                    </div>
                    <OrganizationSwitcher />
                  </div>

                  {/* Profile Selector */}
                  <div>
                    <div className="px-1 mb-2">
                      <p className="text-[10px] font-medium text-sidebar-foreground/40 uppercase tracking-wider">
                        Active Profile
                      </p>
                    </div>
                    <GlobalProfileSelector />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-2 py-2.5 xs:py-3 sm:py-4 space-y-1 sm:space-y-2 overflow-y-auto">
            {permissionsLoading ? (
              // Loading skeleton while permissions are being fetched
              <div className="space-y-2 animate-pulse">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-10 bg-sidebar-accent rounded-xl" />
                ))}
              </div>
            ) : (
              navigation.map((item) => {
                if ("items" in item) {
                  return renderNavSection(item);
                } else {
                  return renderNavItem(item);
                }
              })
            )}
          </nav>

          {/* Mobile Footer */}
          <div className="p-5 border-t border-sidebar-border">
            <div className="flex items-center justify-between">
              <ThemeToggle />
              <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-sidebar-accent border border-[#EC67A1]/20">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-semibold text-sidebar-foreground">
                  {currentOrganization?.availableCredits ?? 0} Credits
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        {/* Mobile Header Bar */}
        <div className="lg:hidden bg-background backdrop-blur-xl border-b border-header-border px-4 py-3 rounded-b-2xl">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-xl text-header-muted hover:text-header-foreground hover:bg-sidebar-accent transition-all border border-transparent hover:border-[#EC67A1]/20"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <NotificationBell />
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#EC67A1] to-[#F774B9] flex items-center justify-center ring-2 ring-[#EC67A1]/20">
                <span className="text-white text-xs font-bold">{initials}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content area */}
        <main className="flex-1 overflow-y-auto bg-transparent custom-scrollbar">
          {/* Modern Top Header */}
          <div className="sticky top-0 z-20 backdrop-blur-2xl bg-background border-b border-header-border rounded-b-2xl">
            <div className="px-6 lg:px-8 py-4">
              <div className="flex items-center justify-between">
                {/* Left Side - Progress & Breadcrumb Area */}
                <div className="flex items-center gap-4">
                  <GlobalProgressDropdown />
                </div>

                {/* Right Side - Compact Controls */}
                <div className="hidden lg:flex items-center gap-3">
                  {/* Notification */}
                  <NotificationBell />

                  {/* User Menu */}
                  <div className="relative">
                    <button
                      ref={userDropdownButtonRef}
                      onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                      className="flex items-center gap-3 pl-3 pr-4 py-2 rounded-2xl bg-sidebar-accent hover:bg-sidebar-accent/80 border-2 border-transparent hover:border-[#EC67A1]/30 transition-all duration-200"
                    >
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#EC67A1] via-[#F774B9] to-[#5DC3F8] flex items-center justify-center ring-2 ring-[#EC67A1]/20">
                        <span className="text-white text-xs font-bold">
                          {initials}
                        </span>
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium text-header-foreground">
                          {firstName}
                        </p>
                        <p className="text-[10px] text-header-muted truncate max-w-[120px]">
                          {email}
                        </p>
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 text-[#EC67A1] transition-all duration-200 ${userDropdownOpen ? "rotate-180" : ""}`}
                      />
                    </button>

                    {/* User Dropdown */}
                    {userDropdownOpen && (
                      <div
                        ref={userDropdownRef}
                        className="absolute right-0 mt-2 w-72 py-2 bg-sidebar rounded-2xl border border-sidebar-border shadow-2xl animate-fadeIn z-50"
                      >
                        <div className="px-4 py-3 border-b border-sidebar-border">
                          <p className="text-sm font-semibold text-sidebar-foreground">
                            {firstName}
                          </p>
                          <p className="text-xs text-sidebar-foreground/60 truncate">
                            {email}
                          </p>
                        </div>

                        {/* Organization Switcher Section */}
                        {!permissionsLoading && (
                          <div
                            className="px-3 py-3 border-b border-sidebar-border"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="mb-2">
                              <p className="text-[10px] font-semibold text-sidebar-foreground/50 uppercase tracking-wider px-1">
                                Organization
                              </p>
                            </div>
                            <OrganizationSwitcher />
                          </div>
                        )}

                        <div className="py-1">
                          <Link
                            href={`/${tenant}/settings`}
                            onClick={() => setUserDropdownOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-sidebar-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all rounded-lg mx-2"
                          >
                            <Settings className="w-4 h-4 text-[#5DC3F8]" />
                            Settings
                          </Link>
                          {(currentOrganization?.role === "OWNER" ||
                            currentOrganization?.role === "ADMIN") && (
                            <Link
                              href={`/${tenant}/billing`}
                              onClick={() => setUserDropdownOpen(false)}
                              className="flex items-center gap-3 px-4 py-2.5 text-sm text-sidebar-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all rounded-lg mx-2"
                            >
                              <CreditCard className="w-4 h-4 text-[#5DC3F8]" />
                              Billing
                            </Link>
                          )}
                          {isAdmin && (
                            <Link
                              href={`/${tenant}/admin`}
                              onClick={() => setUserDropdownOpen(false)}
                              className="flex items-center gap-3 px-4 py-2.5 text-sm text-sidebar-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all rounded-lg mx-2"
                            >
                              <Shield className="w-4 h-4 text-[#5DC3F8]" />
                              Admin Panel
                            </Link>
                          )}
                        </div>
                        <div className="border-t border-sidebar-border pt-1 mt-1">
                          <button
                            onClick={() => {
                              setUserDropdownOpen(false);
                              signOut({ redirectUrl: "/" });
                            }}
                            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-500/10 transition-all rounded-lg mx-2"
                          >
                            <ChevronRight className="w-4 h-4" />
                            Sign Out
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-2.5 py-2.5 xs:px-3 xs:py-3 sm:px-4 sm:py-4 lg:px-6 xl:px-8 animate-fadeIn relative">
            {isPaymentRequired ? (
              <PaymentRequiredOverlay tenant={tenant} isAdmin={isAdmin} />
            ) : (
              <PermissionGuard>{children}</PermissionGuard>
            )}
          </div>
        </main>
      </div>

      {/* Global Credit Indicator */}
      <CreditIndicator />

      {/* Tooltip for collapsed sidebar */}
      {!sidebarOpen && hoveredItem && (
        <div
          className="hidden lg:block fixed z-50 px-3 py-2 bg-sidebar text-sidebar-foreground text-sm rounded-xl shadow-xl border border-sidebar-border pointer-events-none animate-fadeIn"
          style={{
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y}px`,
            transform: "translateY(-50%)",
          }}
        >
          {hoveredItem}
          <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 bg-sidebar rotate-45 border-l border-b border-sidebar-border" />
        </div>
      )}
    </div>
  );
}
