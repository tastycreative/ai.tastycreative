"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useClerk, useUser } from "@clerk/nextjs";
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
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { GlobalProgressIndicator } from "@/components/GlobalProgressIndicator";

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

const navigation: (NavItem | NavSection)[] = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: Home,
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
        name: "Generated Content",
        href: "/workspace/generated-content",
        icon: FileText,
      },
      {
        name: "Social Media",
        href: "/workspace/social-media",
        icon: Share2,
      },
    ],
  },
  {
    name: "Generate Content",
    collapsible: true,
    items: [
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
        name: "Image to Video",
        href: "/workspace/generate-content/image-to-video",
        icon: Video,
      },
      {
        name: "Face Swapping",
        href: "/workspace/generate-content/face-swapping",
        icon: Shuffle,
      },
      {
        name: "Skin Enhancer",
        href: "/workspace/generate-content/skin-enhancer",
        icon: Sparkles,
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
    ],
  },
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

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [generateContentOpen, setGenerateContentOpen] = useState(false);
  const [aiToolsOpen, setAiToolsOpen] = useState(false);
  const [trainModelsOpen, setTrainModelsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const pathname = usePathname();
  const { signOut } = useClerk();
  const { user } = useUser();

  // Get user's first name or fallback
  const firstName = user?.firstName || user?.username || "User";
  const email = user?.emailAddresses?.[0]?.emailAddress || "";
  const initials = firstName.charAt(0).toUpperCase();

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

  const isNavItemActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname.startsWith(href);
  };

  const renderNavItem = (item: NavItem, isInSection = false) => {
    const isActive = isNavItemActive(item.href);
    const Icon = item.icon;

    const handleClick = () => {
      // Close sidebar on mobile when navigation item is clicked
      if (isMobile) {
        setSidebarOpen(false);
      }
    };

    return (
      <Link
        key={item.name}
        href={item.href}
        onClick={handleClick}
        className={classNames(
          isActive
            ? "bg-gradient-to-r from-blue-500 to-purple-600 dark:from-blue-600 dark:to-purple-700 text-white shadow-lg shadow-blue-500/25"
            : "text-gray-300 dark:text-gray-300 hover:bg-gradient-to-r hover:from-gray-700 hover:to-gray-600 dark:hover:from-gray-800 dark:hover:to-gray-700 hover:text-white dark:hover:text-white",
          "group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-300",
          isInSection ? "pl-8" : "",
          !sidebarOpen ? "justify-center" : ""
        )}
      >
        <Icon
          className={classNames(
            isActive
              ? "text-white"
              : "text-gray-400 dark:text-gray-400 group-hover:text-gray-300 dark:group-hover:text-white",
            "h-6 w-6 flex-shrink-0",
            sidebarOpen ? "mr-3" : ""
          )}
          aria-hidden="true"
        />
        {sidebarOpen && item.name}
      </Link>
    );
  };

  const renderNavSection = (section: NavSection) => {
    const isWorkspaceSection = section.name === "Workspace";
    const isGenerateContentSection = section.name === "Generate Content";
    const isAiToolsSection = section.name === "AI Tools";
    const isTrainModelsSection = section.name === "Train Models";

    // Determine if section is expanded
    let isExpanded = true;
    if (isWorkspaceSection) {
      isExpanded = workspaceOpen;
    } else if (isGenerateContentSection) {
      isExpanded = generateContentOpen;
    } else if (isAiToolsSection) {
      isExpanded = aiToolsOpen;
    } else if (isTrainModelsSection) {
      isExpanded = trainModelsOpen;
    }

    // Get the appropriate icon for the section
    const getSectionIcon = () => {
      if (isWorkspaceSection) return Users;
      if (isGenerateContentSection) return PlusCircle;
      if (isAiToolsSection) return Bot;
      if (isTrainModelsSection) return Settings;
      return Users; // fallback
    };

    const SectionIcon = getSectionIcon();

    // Handle section toggle
    const handleSectionToggle = () => {
      if (isWorkspaceSection) {
        setWorkspaceOpen(!workspaceOpen);
      } else if (isGenerateContentSection) {
        setGenerateContentOpen(!generateContentOpen);
      } else if (isAiToolsSection) {
        setAiToolsOpen(!aiToolsOpen);
      } else if (isTrainModelsSection) {
        setTrainModelsOpen(!trainModelsOpen);
      }
    };

    return (
      <div key={section.name} className="space-y-1">
        {section.collapsible && sidebarOpen ? (
          <button
            onClick={handleSectionToggle}
            className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-gray-300 dark:text-gray-300 hover:bg-gradient-to-r hover:from-gray-700 hover:to-gray-600 dark:hover:from-gray-800 dark:hover:to-gray-700 hover:text-white dark:hover:text-white rounded-lg transition-all duration-300"
          >
            <span className="flex items-center">
              <SectionIcon className="h-6 w-6 flex-shrink-0 mr-3 text-gray-400 dark:text-gray-400" />
              {section.name}
            </span>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        ) : (
          sidebarOpen && (
            <div className="px-2 py-2 text-xs font-semibold text-gray-400 dark:text-gray-400 uppercase tracking-wider">
              {section.name}
            </div>
          )
        )}
        {isExpanded && (
          <div
            className={classNames(
              section.collapsible ? "space-y-1" : "space-y-1"
            )}
          >
            {section.items.map((item) =>
              renderNavItem(item, section.collapsible)
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
          "hidden lg:flex bg-gradient-to-b from-gray-800 to-gray-900 dark:bg-gradient-to-b dark:from-gray-900/80 dark:to-black/90 backdrop-blur-sm transition-all duration-300 ease-in-out flex-col shadow-2xl border-r border-gray-200/20 dark:border-gray-700/30",
          sidebarOpen ? "w-64" : "w-16"
        )}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-700 dark:border-gray-800">
          {sidebarOpen && (
            <h1 className="text-white text-base sm:text-lg font-semibold">
              Creative Ink
            </h1>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 text-gray-400 hover:text-white dark:text-gray-400 dark:hover:text-white transition-colors duration-200"
          >
            {sidebarOpen ? (
              <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            ) : (
              <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-3 sm:py-4 space-y-1 sm:space-y-2 overflow-y-auto">
          {navigation.map((item) => {
            if ("items" in item) {
              return renderNavSection(item);
            } else {
              return renderNavItem(item);
            }
          })}
        </nav>

        {/* Theme toggle and footer */}
        <div className="border-t border-gray-700 dark:border-gray-800 p-3 sm:p-4">
          <div className="flex items-center justify-end">
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      <div
        className={classNames(
          "lg:hidden fixed inset-0 z-50 transition-opacity duration-300",
          sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/20 dark:bg-opacity-30 transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
        />

        {/* Mobile Sidebar */}
        <div
          className={classNames(
            "relative w-64 h-full bg-gradient-to-b from-gray-800 to-gray-900 dark:bg-gradient-to-b dark:from-gray-900/80 dark:to-black/90 backdrop-blur-sm flex flex-col shadow-2xl border-r border-gray-200/20 dark:border-gray-700/30 transition-transform duration-300 ease-in-out",
            sidebarOpen
              ? "transform translate-x-0"
              : "transform -translate-x-full"
          )}
        >
          {/* Sidebar header */}
          <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-700 dark:border-gray-800">
            <h1 className="text-white text-base sm:text-lg font-semibold">
              Creative Ink
            </h1>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1 text-gray-400 hover:text-white dark:text-gray-400 dark:hover:text-white transition-colors duration-200"
            >
              <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-2 py-3 sm:py-4 space-y-1 sm:space-y-2 overflow-y-auto">
            {navigation.map((item) => {
              if ("items" in item) {
                return renderNavSection(item);
              } else {
                return renderNavItem(item);
              }
            })}
          </nav>

          {/* Theme toggle and footer */}
          <div className="border-t border-gray-700 dark:border-gray-800 p-3 sm:p-4">
            <div className="flex items-center justify-end">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile menu button */}
        <div className="lg:hidden bg-white/90 dark:bg-gray-900/60 backdrop-blur-md shadow-sm border-b border-gray-200/50 dark:border-gray-700/30 px-3 sm:px-4 py-2">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 sm:p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
          >
            <div className="flex items-center space-x-1 sm:space-x-2">
              <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
              <span className="text-xs sm:text-sm font-medium">Menu</span>
            </div>
          </button>
        </div>

        {/* Content area */}
        <main className="flex-1 overflow-y-auto bg-gradient-to-br from-white to-gray-50/50 dark:bg-gradient-to-br dark:from-black dark:to-gray-900/30 custom-scrollbar">
          {/* Sticky Header with user info and credits */}
          <div className="sticky top-0 z-20 bg-white/90 dark:bg-gray-900/60 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-700/30 px-3 sm:px-4 lg:px-6 xl:px-8 py-2 sm:py-3 shadow-sm">
            <div className="flex items-center justify-between">
              {/* Left Side - Global Progress Indicator */}
              <div className="flex items-center">
                <GlobalProgressIndicator />
              </div>

              {/* Right Side - Credits and User */}
              <div className="flex items-center space-x-2 sm:space-x-4">
                {/* Available Credits */}
                <div className="flex items-center space-x-1 sm:space-x-2 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 border border-blue-200/50 dark:border-blue-700/30 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg shadow-sm">
                  <CreditCard className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs sm:text-sm font-medium bg-gradient-to-r from-blue-700 to-purple-700 dark:from-blue-300 dark:to-purple-300 bg-clip-text text-transparent">
                    25 Credits
                  </span>
                </div>

                {/* User Dropdown */}
                <div className="relative group">
                  <button className="flex items-center space-x-1 sm:space-x-2 bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-700 hover:from-gray-200 hover:to-gray-100 dark:hover:from-gray-700 dark:hover:to-gray-600 border border-gray-200/50 dark:border-gray-600/30 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-all duration-300 shadow-sm">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-md">
                      <span className="text-white text-xs sm:text-sm font-semibold">
                        {initials}
                      </span>
                    </div>
                    <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 hidden sm:block">
                      {firstName}
                    </span>
                    <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500 dark:text-gray-400" />
                  </button>

                  {/* Dropdown Menu */}
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                    <div className="py-2">
                      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {firstName}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {email}
                        </p>
                      </div>
                      <button className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                        Profile Settings
                      </button>
                      <button className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                        Billing
                      </button>
                      <div className="border-t border-gray-200 dark:border-gray-700 mt-2 pt-2">
                        <button
                          onClick={() => signOut({ redirectUrl: "/" })}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          Sign Out
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-3 py-3 sm:px-4 sm:py-4 lg:px-6 xl:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
