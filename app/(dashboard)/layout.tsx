"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useClerk, useUser } from "@clerk/nextjs";
import { useIsAdmin } from "@/lib/hooks/useIsAdmin";
import { useIsContentCreator } from "@/lib/hooks/useIsContentCreator";
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
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { GlobalProgressIndicator } from "@/components/GlobalProgressIndicator";
import { NotificationBell } from "@/components/NotificationBell";

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
  const [isMobile, setIsMobile] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [hoveredSection, setHoveredSection] = useState<string | null>(null);
  const [flyoutPosition, setFlyoutPosition] = useState({ x: 0, y: 0 });
  const [mounted, setMounted] = useState(false);
  const flyoutTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pathname = usePathname();
  const { signOut } = useClerk();
  const { user } = useUser();
  const { isAdmin } = useIsAdmin();
  const { isContentCreator } = useIsContentCreator();

  // Dynamic navigation based on user permissions
  const navigation: (NavItem | NavSection)[] = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: Home,
    },
    {
      name: "Content Studio",
      collapsible: true,
      items: [
        {
          name: "Staging",
          href: "/workspace/content-studio/staging",
          icon: Layers,
        },
        {
          name: "Calendar",
          href: "/workspace/content-studio/calendar",
          icon: Calendar,
        },
        {
          name: "Pipeline",
          href: "/workspace/content-studio/pipeline",
          icon: GitBranch,
        },
        {
          name: "Stories",
          href: "/workspace/content-studio/stories",
          icon: Clock,
        },
        {
          name: "Reels",
          href: "/workspace/content-studio/reels",
          icon: Sparkles,
        },
        {
          name: "Feed Posts",
          href: "/workspace/content-studio/feed-posts",
          icon: ImageIcon,
        },
        {
          name: "Performance",
          href: "/workspace/content-studio/performance",
          icon: Activity,
        },
        {
          name: "Formulas",
          href: "/workspace/content-studio/formulas",
          icon: Sparkles,
        },
        {
          name: "Hashtags",
          href: "/workspace/content-studio/hashtags",
          icon: Hash,
        },
        {
          name: "Workflow",
          href: "/workspace/content-studio/workflow",
          icon: ListChecks,
        },
        {
          name: "Sexting Set Organizer",
          href: "/workspace/content-studio/sexting-set-organizer",
          icon: Flame,
        },
      ],
    },
    {
      name: "Generate Content",
      collapsible: true,
      items: [
        {
          name: "FLUX_GROUP_LABEL",
          href: "#",
          icon: Sparkles,
        },
        {
          name: "Text to Image",
          href: "/workspace/generate-content/text-to-image",
          icon: ImageIcon,
        },
        {
          name: "Style Transfer",
          href: "/workspace/generate-content/style-transfer",
          icon: Palette,
        },
        {
          name: "Skin Enhancer",
          href: "/workspace/generate-content/skin-enhancer",
          icon: Sparkles,
        },
        {
          name: "Flux Kontext",
          href: "/workspace/generate-content/flux-kontext",
          icon: Wand2,
        },
        {
          name: "DIVIDER_1",
          href: "#",
          icon: Sparkles,
        },
        {
          name: "WAN_22_GROUP_LABEL",
          href: "#",
          icon: Video,
        },
        {
          name: "Text to Video",
          href: "/workspace/generate-content/text-to-video",
          icon: PlayCircle,
        },
        {
          name: "Image to Video",
          href: "/workspace/generate-content/image-to-video",
          icon: Video,
        },
        {
          name: "DIVIDER_2",
          href: "#",
          icon: Sparkles,
        },
        {
          name: "ADVANCED_TOOLS_GROUP_LABEL",
          href: "#",
          icon: Wand2,
        },
        {
          name: "Face Swapping",
          href: "/workspace/generate-content/face-swapping",
          icon: Shuffle,
        },
        {
          name: "Image-to-Image Skin Enhancer",
          href: "/workspace/generate-content/image-to-image-skin-enhancer",
          icon: Palette,
        },
        {
          name: "FPS Boost",
          href: "/workspace/generate-content/fps-boost",
          icon: PlayCircle,
        },
        {
          name: "DIVIDER_3",
          href: "#",
          icon: Sparkles,
        },
        {
          name: "SEEDREAM_45_GROUP_LABEL",
          href: "#",
          icon: Sparkles,
        },
        {
          name: "SeeDream Text to Image",
          href: "/workspace/generate-content/seedream-text-to-image",
          icon: ImageIcon,
        },
        {
          name: "SeeDream Image to Image",
          href: "/workspace/generate-content/seedream-image-to-image",
          icon: Palette,
        },
        {
          name: "SeeDream Text to Video",
          href: "/workspace/generate-content/seedream-text-to-video",
          icon: Video,
        },
        {
          name: "SeeDream Image to Video",
          href: "/workspace/generate-content/seedream-image-to-video",
          icon: PlayCircle,
        },
        {
          name: "DIVIDER_4",
          href: "#",
          icon: Sparkles,
        },
        {
          name: "KLING_AI_GROUP_LABEL",
          href: "#",
          icon: Film,
        },
        {
          name: "Kling Text to Video",
          href: "/workspace/generate-content/kling-text-to-video",
          icon: PlayCircle,
        },
        {
          name: "Kling Image to Video",
          href: "/workspace/generate-content/kling-image-to-video",
          icon: Video,
        },
        {
          name: "Kling Multi-Image to Video",
          href: "/workspace/generate-content/kling-multi-image-to-video",
          icon: Film,
        },
        {
          name: "Kling Motion Control",
          href: "/workspace/generate-content/kling-motion-control",
          icon: Move,
        },
        {
          name: "DIVIDER_5",
          href: "#",
          icon: Sparkles,
        },
        {
          name: "AI_VOICE_GROUP_LABEL",
          href: "#",
          icon: Mic,
        },
        {
          name: "Voice Generator",
          href: "/workspace/generate-content/ai-voice",
          icon: Mic,
        },
      ],
    },
    {
      name: "Workspace",
      collapsible: true,
      items: [
        {
          name: "My Influencers",
          href: "/workspace/my-influencers",
          icon: Users,
        },
        {
          name: "Vault",
          href: "/workspace/vault",
          icon: Shield,
        },
      ],
    },
    {
      name: "Social Media",
      collapsible: true,
      items: [
        {
          name: "User Feed",
          href: "/workspace/user-feed",
          icon: Share2,
        },
        {
          name: "My Profile",
          href: "/workspace/my-profile",
          icon: UserCheck,
        },
        {
          name: "Friends",
          href: "/workspace/friends",
          icon: UserCheck,
        },
        {
          name: "Bookmarks",
          href: "/workspace/bookmarks",
          icon: Bookmark,
        },
        {
          name: "My Creators",
          href: "/workspace/creators",
          icon: Users,
        },
      ],
    },
    {
      name: "Train Models",
      collapsible: true,
      items: [
        {
          name: "Train LoRA",
          href: "/workspace/train-lora",
          icon: PlusCircle,
        },
        {
          name: "Training Jobs",
          href: "/workspace/training-jobs",
          icon: BarChart3,
        },
      ],
    },
    {
      name: "AI Tools",
      collapsible: true,
      items: [
        {
          name: "Instagram Extractor",
          href: "/workspace/ai-tools/instagram-extractor",
          icon: Instagram,
        },
        {
          name: "Style Transfer Prompts",
          href: "/workspace/ai-tools/style-transfer-prompts",
          icon: Wand2,
        },
        {
          name: "Video Prompts",
          href: "/workspace/ai-tools/video-prompts",
          icon: PlayCircle,
        },
        {
          name: "Flux Kontext Prompts",
          href: "/workspace/ai-tools/flux-kontext-prompts",
          icon: Sparkles,
        },
      ],
    },
    {
      name: "AI Marketplace",
      href: "/workspace/ai-marketplace",
      icon: ShoppingBag,
    },
    {
      name: "Caption Banks",
      collapsible: true,
      items: [
        {
          name: "Captions",
          href: "/workspace/caption-banks/captions",
          icon: FileText,
        },
        {
          name: "Caption Performance Tracker",
          href: "/workspace/caption-banks/caption-performance-tracker",
          icon: BarChart3,
        },
      ],
    },
    // Conditionally add content creator link
    ...(isContentCreator
      ? [
          {
            name: "Content Creator",
            href: "/content-creator",
            icon: BarChart3,
          },
        ]
      : []),
    {
      name: "Settings",
      href: "/settings",
      icon: Settings,
    },
    {
      name: "Billing",
      href: "/billing",
      icon: CreditCard,
    },
    {
      name: "Team",
      href: "/team",
      icon: UserCheck,
    },
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

  const isNavItemActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
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
          <div className="relative">
            {/* Background glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 rounded-lg blur-sm"></div>

            {/* Main label container */}
            <div className="relative bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 dark:from-blue-500/10 dark:via-purple-500/10 dark:to-pink-500/10 border border-blue-400/30 dark:border-blue-500/20 rounded-lg px-2.5 xs:px-3 py-1.5 xs:py-2 backdrop-blur-sm">
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
                <div className="h-1 w-1 rounded-full bg-blue-400 dark:bg-blue-300 animate-pulse"></div>
              </div>
            </div>
          </div>
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
          <div className="relative">
            {/* Background glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 via-emerald-500/10 to-teal-500/10 rounded-lg blur-sm"></div>

            {/* Main label container */}
            <div className="relative bg-gradient-to-r from-green-500/20 via-emerald-500/20 to-teal-500/20 dark:from-green-500/10 dark:via-emerald-500/10 dark:to-teal-500/10 border border-green-400/30 dark:border-green-500/20 rounded-lg px-2.5 xs:px-3 py-1.5 xs:py-2 backdrop-blur-sm">
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
                <div className="h-1 w-1 rounded-full bg-green-400 dark:bg-green-300 animate-pulse"></div>
              </div>
            </div>
          </div>
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
          <div className="relative">
            {/* Background glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-orange-500/10 rounded-lg blur-sm"></div>

            {/* Main label container */}
            <div className="relative bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-orange-500/20 dark:from-purple-500/10 dark:via-pink-500/10 dark:to-orange-500/10 border border-purple-400/30 dark:border-purple-500/20 rounded-lg px-2.5 xs:px-3 py-1.5 xs:py-2 backdrop-blur-sm">
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
                <div className="h-1 w-1 rounded-full bg-purple-400 dark:bg-purple-300 animate-pulse"></div>
              </div>
            </div>
          </div>
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
          <div className="relative">
            {/* Background glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-indigo-500/10 rounded-lg blur-sm"></div>

            {/* Main label container */}
            <div className="relative bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-indigo-500/20 dark:from-cyan-500/10 dark:via-blue-500/10 dark:to-indigo-500/10 border border-cyan-400/30 dark:border-cyan-500/20 rounded-lg px-2.5 xs:px-3 py-1.5 xs:py-2 backdrop-blur-sm">
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
                <div className="h-1 w-1 rounded-full bg-cyan-400 dark:bg-cyan-300 animate-pulse"></div>
              </div>
            </div>
          </div>
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
          <div className="relative">
            {/* Background glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-violet-500/10 via-purple-500/10 to-pink-500/10 rounded-lg blur-sm"></div>

            {/* Main label container */}
            <div className="relative bg-gradient-to-r from-violet-500/20 via-purple-500/20 to-pink-500/20 dark:from-violet-500/10 dark:via-purple-500/10 dark:to-pink-500/10 border border-violet-400/30 dark:border-violet-500/20 rounded-lg px-2.5 xs:px-3 py-1.5 xs:py-2 backdrop-blur-sm">
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
                <div className="h-1 w-1 rounded-full bg-violet-400 dark:bg-violet-300 animate-pulse"></div>
              </div>
            </div>
          </div>
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
          <div className="relative">
            {/* Background glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 via-orange-500/10 to-yellow-500/10 rounded-lg blur-sm"></div>

            {/* Main label container */}
            <div className="relative bg-gradient-to-r from-red-500/20 via-orange-500/20 to-yellow-500/20 dark:from-red-500/10 dark:via-orange-500/10 dark:to-yellow-500/10 border border-red-400/30 dark:border-red-500/20 rounded-lg px-2.5 xs:px-3 py-1.5 xs:py-2 backdrop-blur-sm">
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
                <div className="h-1 w-1 rounded-full bg-red-400 dark:bg-red-300 animate-pulse"></div>
              </div>
            </div>
          </div>
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
            ? "bg-gradient-to-r from-blue-500 to-purple-600 dark:from-blue-600 dark:to-purple-700 text-white shadow-lg shadow-blue-500/25 scale-[1.02]"
            : "text-gray-300 dark:text-gray-300 hover:bg-gradient-to-r hover:from-gray-700 hover:to-gray-600 dark:hover:from-gray-800 dark:hover:to-gray-700 hover:text-white dark:hover:text-white hover:scale-[1.02] hover:shadow-md",
          "group flex items-center px-2.5 xs:px-3 py-2 xs:py-2.5 text-xs xs:text-sm font-medium rounded-lg transition-all duration-300 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900",
          isInSection ? "pl-6 xs:pl-7 sm:pl-8" : "",
          !sidebarOpen ? "justify-center" : "",
        )}
      >
        <Icon
          className={classNames(
            isActive
              ? "text-white"
              : "text-gray-400 dark:text-gray-400 group-hover:text-gray-300 dark:group-hover:text-white",
            "h-5 w-5 xs:h-5.5 xs:w-5.5 sm:h-6 sm:w-6 flex-shrink-0 transition-transform duration-300",
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
                ? "bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-l-2 border-blue-500"
                : "",
              "w-full flex items-center justify-between px-2.5 xs:px-3 py-2 xs:py-2.5 text-xs xs:text-sm font-medium text-gray-300 dark:text-gray-300 hover:bg-gradient-to-r hover:from-gray-700 hover:to-gray-600 dark:hover:from-gray-800 dark:hover:to-gray-700 hover:text-white dark:hover:text-white rounded-lg transition-all duration-300 active:scale-95 hover:scale-[1.02] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900",
            )}
          >
            <span className="flex items-center">
              <SectionIcon
                className={classNames(
                  isSectionActive
                    ? "text-blue-400"
                    : "text-gray-400 dark:text-gray-400",
                  "h-5 w-5 xs:h-5.5 xs:w-5.5 sm:h-6 sm:w-6 flex-shrink-0 mr-2 xs:mr-2.5 sm:mr-3 transition-transform duration-300 group-hover:scale-110",
                )}
              />
              <span className="truncate">{section.name}</span>
            </span>
            {isExpanded ? (
              <ChevronUp className="h-3.5 w-3.5 xs:h-4 xs:w-4 transition-transform duration-300" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 xs:h-4 xs:w-4 transition-transform duration-300" />
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
                  ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white"
                  : "text-gray-300 dark:text-gray-300 hover:bg-gradient-to-r hover:from-gray-700 hover:to-gray-600 dark:hover:from-gray-800 dark:hover:to-gray-700 hover:text-white",
                "w-full flex items-center justify-center px-2.5 py-2 xs:py-2.5 rounded-lg transition-all duration-300 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500",
              )}
            >
              <SectionIcon
                className={classNames(
                  isSectionActive
                    ? "text-blue-400"
                    : "text-gray-400 dark:text-gray-400",
                  "h-5 w-5 xs:h-5.5 xs:w-5.5 sm:h-6 sm:w-6 flex-shrink-0 transition-transform duration-300 hover:scale-110",
                )}
              />
            </button>

            {/* Flyout menu - rendered via portal */}
            {mounted &&
              hoveredSection === section.name &&
              createPortal(
                <div
                  data-flyout
                  className="fixed bg-gray-800 dark:bg-gray-900 rounded-lg shadow-2xl border border-gray-700 dark:border-gray-600 z-[100] animate-fadeIn"
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
                  <div className="px-3 py-2.5 border-b border-gray-700 dark:border-gray-600 bg-gray-900/50 rounded-t-lg">
                    <span className="text-sm font-semibold text-white flex items-center gap-2">
                      <SectionIcon className="h-4 w-4 text-blue-400" />
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
                                ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white"
                                : "text-gray-300 hover:bg-gray-700 dark:hover:bg-gray-800 hover:text-white",
                              "flex items-center gap-2 px-3 py-2 text-sm transition-all duration-200",
                            )}
                          >
                            <ItemIcon
                              className={classNames(
                                isActive ? "text-white" : "text-gray-400",
                                "h-4 w-4 flex-shrink-0",
                              )}
                            />
                            <span className="truncate">{item.name}</span>
                          </Link>
                        );
                      })}
                  </div>
                  {/* Arrow pointer */}
                  <div className="absolute left-0 top-3 transform -translate-x-1 w-2 h-2 bg-gray-800 dark:bg-gray-900 rotate-45 border-l border-b border-gray-700 dark:border-gray-600"></div>
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
    <div className="flex h-screen bg-gradient-to-br from-gray-50 to-blue-50 dark:bg-gradient-to-br dark:from-black dark:via-gray-900 dark:to-blue-900/20 relative">
      {/* Desktop Sidebar */}
      <div
        className={classNames(
          "hidden lg:flex bg-gradient-to-b from-gray-800 to-gray-900 dark:bg-gradient-to-b dark:from-gray-900/80 dark:to-black/90 backdrop-blur-sm transition-all duration-300 ease-in-out flex-col shadow-2xl border-r border-gray-200/20 dark:border-gray-700/30 relative",
          sidebarOpen ? "w-64" : "w-16",
        )}
      >
        {/* Animated gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-pink-500/5 opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
        {/* Sidebar header */}
        <div className="flex items-center justify-between p-2.5 xs:p-3 sm:p-4 border-b border-gray-700 dark:border-gray-800 relative">
          {sidebarOpen && (
            <h1 className="text-sm xs:text-base sm:text-lg font-semibold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent animate-gradient">
              Creative Ink
            </h1>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 text-gray-400 hover:text-white dark:text-gray-400 dark:hover:text-white transition-all duration-200 active:scale-95 hover:rotate-180 hover:bg-gray-700/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            {sidebarOpen ? (
              <ChevronLeft className="h-4 w-4 xs:h-4.5 xs:w-4.5 sm:h-5 sm:w-5" />
            ) : (
              <ChevronRight className="h-4 w-4 xs:h-4.5 xs:w-4.5 sm:h-5 sm:w-5" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-2.5 xs:py-3 sm:py-4 space-y-1 sm:space-y-2 overflow-y-auto custom-scrollbar">
          {navigation.map((item) => {
            if ("items" in item) {
              return renderNavSection(item);
            } else {
              return renderNavItem(item);
            }
          })}
        </nav>

        {/* Theme toggle and footer */}
        <div className="border-t border-gray-700 dark:border-gray-800 p-2.5 xs:p-3 sm:p-4 bg-gradient-to-t from-gray-900/50 to-transparent">
          <div className="flex items-center justify-end">
            <div className="transform transition-transform duration-300 hover:scale-110">
              <ThemeToggle />
            </div>
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
          className="absolute inset-0 bg-black/40 backdrop-blur-sm dark:bg-black/60 transition-all duration-300"
          onClick={() => setSidebarOpen(false)}
        />

        {/* Mobile Sidebar */}
        <div
          className={classNames(
            "relative w-64 h-full bg-gradient-to-b from-gray-800 to-gray-900 dark:bg-gradient-to-b dark:from-gray-900/80 dark:to-black/90 backdrop-blur-sm flex flex-col shadow-2xl border-r border-gray-200/20 dark:border-gray-700/30 transition-all duration-300 ease-out",
            sidebarOpen
              ? "transform translate-x-0 opacity-100"
              : "transform -translate-x-full opacity-0",
          )}
        >
          {/* Sidebar header */}
          <div className="flex items-center justify-between p-2.5 xs:p-3 sm:p-4 border-b border-gray-700 dark:border-gray-800">
            <h1 className="text-sm xs:text-base sm:text-lg font-semibold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Creative Ink
            </h1>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1 text-gray-400 hover:text-white dark:text-gray-400 dark:hover:text-white transition-all duration-200 active:scale-95 hover:bg-gray-700/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Close sidebar"
            >
              <ChevronLeft className="h-4 w-4 xs:h-4.5 xs:w-4.5 sm:h-5 sm:w-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-2 py-2.5 xs:py-3 sm:py-4 space-y-1 sm:space-y-2 overflow-y-auto">
            {navigation.map((item) => {
              if ("items" in item) {
                return renderNavSection(item);
              } else {
                return renderNavItem(item);
              }
            })}
          </nav>

          {/* Theme toggle and footer */}
          <div className="border-t border-gray-700 dark:border-gray-800 p-2.5 xs:p-3 sm:p-4 bg-gradient-to-t from-gray-900/50 to-transparent">
            <div className="flex items-center justify-end">
              <div className="transform transition-transform duration-300 hover:scale-110">
                <ThemeToggle />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile menu button */}
        <div className="lg:hidden bg-white/90 dark:bg-gray-900/60 backdrop-blur-md shadow-sm border-b border-gray-200/50 dark:border-gray-700/30 px-2.5 xs:px-3 sm:px-4 py-1.5 xs:py-2">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 xs:p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition-all duration-300 active:scale-95 hover:bg-gray-100 dark:hover:bg-gray-800/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Open menu"
          >
            <div className="flex items-center space-x-1 xs:space-x-1.5 sm:space-x-2">
              <ChevronRight className="h-4 w-4 xs:h-5 xs:w-5 sm:h-6 sm:w-6 transition-transform duration-300 group-hover:translate-x-1" />
              <span className="text-[10px] xs:text-xs sm:text-sm font-medium">
                Menu
              </span>
            </div>
          </button>
        </div>

        {/* Content area */}
        <main className="flex-1 overflow-y-auto bg-gradient-to-br from-white to-gray-50/50 dark:bg-gradient-to-br dark:from-black dark:to-gray-900/30 custom-scrollbar">
          {/* Sticky Header with user info and credits */}
          <div className="sticky top-0 z-20 bg-white/90 dark:bg-gray-900/60 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-700/30 px-2.5 xs:px-3 sm:px-4 lg:px-6 xl:px-8 py-2 xs:py-2.5 sm:py-3 shadow-sm transition-all duration-300 hover:shadow-md">
            <div className="flex items-center justify-between">
              {/* Left Side - Global Progress Indicator */}
              <div className="flex items-center">
                <GlobalProgressIndicator />
              </div>

              {/* Right Side - Credits and User */}
              <div className="flex items-center space-x-1.5 xs:space-x-2 sm:space-x-4">
                {/* Unified Notification Bell (includes both post notifications and production tasks) */}
                <NotificationBell />

                {/* Theme Toggle */}
                <ThemeToggle />

                {/* Available Credits */}
                <div className="flex items-center space-x-1 xs:space-x-1.5 sm:space-x-2 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 border border-blue-200/50 dark:border-blue-700/30 px-1.5 xs:px-2 sm:px-3 py-1 xs:py-1.5 sm:py-2 rounded-lg shadow-sm hover:shadow-md hover:scale-105 transition-all duration-300 cursor-pointer group">
                  <CreditCard className="w-3 h-3 xs:w-3.5 xs:h-3.5 sm:w-4 sm:h-4 text-blue-600 dark:text-blue-400 group-hover:animate-pulse" />
                  <span className="text-[10px] xs:text-xs sm:text-sm font-medium bg-gradient-to-r from-blue-700 to-purple-700 dark:from-blue-300 dark:to-purple-300 bg-clip-text text-transparent">
                    <span className="hidden xs:inline">25 Credits</span>
                    <span className="xs:hidden">25</span>
                  </span>
                </div>

                {/* User Dropdown */}
                <div className="relative group">
                  <button className="flex items-center space-x-1 xs:space-x-1.5 sm:space-x-2 bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-700 hover:from-gray-200 hover:to-gray-100 dark:hover:from-gray-700 dark:hover:to-gray-600 border border-gray-200/50 dark:border-gray-600/30 px-1.5 xs:px-2 sm:px-3 py-1 xs:py-1.5 sm:py-2 rounded-lg transition-all duration-300 shadow-sm active:scale-95 hover:shadow-md hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                    <div className="w-6 h-6 xs:w-7 xs:h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-md ring-2 ring-white/20 group-hover:ring-white/40 transition-all duration-300">
                      <span className="text-white text-[10px] xs:text-xs sm:text-sm font-semibold">
                        {initials}
                      </span>
                    </div>
                    <span className="text-[10px] xs:text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 hidden sm:block">
                      {firstName}
                    </span>
                    <ChevronDown className="w-3 h-3 xs:w-3.5 xs:h-3.5 sm:w-4 sm:h-4 text-gray-500 dark:text-gray-400 transition-transform duration-300 group-hover:rotate-180" />
                  </button>

                  {/* Dropdown Menu */}
                  <div className="absolute right-0 mt-2 w-44 xs:w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 transform group-hover:translate-y-0 translate-y-2">
                    <div className="py-2">
                      <div className="px-3 xs:px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                        <p className="text-xs xs:text-sm font-medium text-gray-900 dark:text-white truncate">
                          {firstName}
                        </p>
                        <p className="text-[10px] xs:text-xs text-gray-500 dark:text-gray-400 truncate">
                          {email}
                        </p>
                      </div>
                      <Link
                        href="/settings"
                        className="w-full text-left px-3 xs:px-4 py-2 text-xs xs:text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 hover:translate-x-1 flex items-center space-x-2"
                      >
                        <Settings className="w-3.5 h-3.5" />
                        <span>Profile Settings</span>
                      </Link>
                      <Link
                        href="/billing"
                        className="w-full text-left px-3 xs:px-4 py-2 text-xs xs:text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 hover:translate-x-1 flex items-center space-x-2"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>Billing</span>
                      </Link>
                      {isAdmin && (
                        <Link
                          href="/admin"
                          className="w-full text-left px-3 xs:px-4 py-2 text-xs xs:text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 hover:translate-x-1 flex items-center space-x-2"
                        >
                          <Shield className="w-3.5 h-3.5" />
                          <span>Admin</span>
                        </Link>
                      )}
                      <div className="border-t border-gray-200 dark:border-gray-700 mt-2 pt-2">
                        <button
                          onClick={() => signOut({ redirectUrl: "/" })}
                          className="w-full text-left px-3 xs:px-4 py-2 text-xs xs:text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200 hover:translate-x-1 flex items-center space-x-2 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-inset rounded"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-2.5 py-2.5 xs:px-3 xs:py-3 sm:px-4 sm:py-4 lg:px-6 xl:px-8 animate-fadeIn">
            {children}
          </div>
        </main>
      </div>

      {/* Tooltip for collapsed sidebar */}
      {!sidebarOpen && hoveredItem && (
        <div
          className="hidden lg:block fixed z-50 px-3 py-2 bg-gray-900 dark:bg-gray-800 text-white text-sm rounded-lg shadow-lg border border-gray-700 dark:border-gray-600 pointer-events-none animate-fadeIn"
          style={{
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y}px`,
            transform: "translateY(-50%)",
          }}
        >
          {hoveredItem}
          <div className="absolute left-0 top-1/2 transform -translate-x-1 -translate-y-1/2 w-2 h-2 bg-gray-900 dark:bg-gray-800 rotate-45 border-l border-b border-gray-700 dark:border-gray-600"></div>
        </div>
      )}
    </div>
  );
}
