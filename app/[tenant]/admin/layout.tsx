"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { useClerk, useUser } from "@clerk/nextjs";
import {
  ChevronLeft,
  ChevronRight,
  Home,
  Users,
  Settings,
  BarChart,
  Shield,
  Activity,
  ShoppingBag,
  ChevronDown,
  Database,
  Bell,
  CreditCard,
  LogOut,
  Zap,
  TrendingUp,
  FileText,
  Lock,
  Building2,
  Mic,
  UserCircle,
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

interface NavSection {
  name: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  items: NavItem[];
  collapsible?: boolean;
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [expandedSections, setExpandedSections] = useState<string[]>(["AI Voice Note Tracker"]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const pathname = usePathname();
  const params = useParams();
  const { signOut } = useClerk();
  const { user } = useUser();

  // Get the slug from params
  const tenant = params.tenant as string;

  // Check if user is super admin
  useEffect(() => {
    const checkSuperAdmin = async () => {
      try {
        const response = await fetch('/api/auth/check-role');
        if (response.ok) {
          const data = await response.json();
          setIsSuperAdmin(data.isSuperAdmin || false);
        }
      } catch (error) {
        console.error('Error checking super admin status:', error);
      }
    };
    checkSuperAdmin();
  }, []);

  // Build navigation based on user role
  const baseNavigation: (NavItem | NavSection)[] = [
    {
      name: "Overview",
      href: `/${tenant}/admin`,
      icon: Home,
    },
    {
      name: "Users Management",
      href: `/${tenant}/admin/users`,
      icon: Users,
    },
    {
      name: "Organization Members",
      href: `/${tenant}/admin/members`,
      icon: Users,
    },
  ];

  // Super admin only navigation items
  const superAdminNavigation: (NavItem | NavSection)[] = isSuperAdmin ? [
    {
      name: "Organizations",
      href: `/${tenant}/admin/organizations`,
      icon: Building2,
    },
    {
      name: "Subscription Plans",
      href: `/${tenant}/admin/plans`,
      icon: CreditCard,
    },
    {
      name: "Feature Pricing",
      href: `/${tenant}/admin/feature-pricing`,
      icon: Zap,
    },
  ] : [];

  // Common navigation items
  const commonNavigation: (NavItem | NavSection)[] = [
    {
      name: "Production Tracker",
      href: `/${tenant}/admin/production`,
      icon: Activity,
    },
    {
      name: "AI Marketplace",
      href: `/${tenant}/admin/marketplace`,
      icon: ShoppingBag,
    },
    {
      name: "AI Voice Note Tracker",
      icon: Mic,
      collapsible: true,
      items: [
        {
          name: "AI Voice Accounts",
          href: `/${tenant}/admin/ai-voice-note-tracker/ai-voice-accounts`,
          icon: UserCircle,
        },
        {
          name: "Generation Tracker",
          href: `/${tenant}/admin/ai-voice-note-tracker/generation-tracker`,
          icon: TrendingUp,
        },
      ],
    },
    {
      name: "Analytics",
      href: `/${tenant}/admin/analytics`,
      icon: BarChart,
    },
    {
      name: "Security",
      href: `/${tenant}/admin/security`,
      icon: Shield,
    },
    {
      name: "System Settings",
      href: `/${tenant}/admin/settings`,
      icon: Settings,
    },
    {
      name: "Database",
      href: `/${tenant}/admin/database`,
      icon: Database,
    },
    {
      name: "Notifications",
      href: `/${tenant}/admin/notifications`,
      icon: Bell,
    },
    {
      name: "Billing & Plans",
      href: `/${tenant}/admin/billing`,
      icon: CreditCard,
    },
    {
      name: "Activity Logs",
      href: `/${tenant}/admin/logs`,
      icon: FileText,
    },
  ];

  // Combine navigation based on user role
  const navigation: (NavItem | NavSection)[] = [
    ...baseNavigation,
    ...superAdminNavigation,
    ...commonNavigation,
  ];

  // Get user's first name or fallback
  const firstName = user?.firstName || user?.username || "Admin";
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
        setSidebarOpen(false);
      }
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const isNavItemActive = (href: string) => {
    if (href === `/${tenant}/admin`) {
      return pathname === `/${tenant}/admin`;
    }
    return pathname.startsWith(href);
  };

  const toggleSection = (sectionName: string) => {
    setExpandedSections((prev) =>
      prev.includes(sectionName)
        ? prev.filter((name) => name !== sectionName)
        : [...prev, sectionName]
    );
  };

  const isSectionExpanded = (sectionName: string) => {
    return expandedSections.includes(sectionName);
  };

  const renderNavItem = (item: NavItem) => {
    const isActive = isNavItemActive(item.href);
    const Icon = item.icon;

    const handleClick = () => {
      if (isMobile) {
        setSidebarOpen(false);
      }
    };

    const handleMouseEnter = (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (!sidebarOpen) {
        const rect = e.currentTarget.getBoundingClientRect();
        setTooltipPosition({ x: rect.right + 8, y: rect.top + rect.height / 2 });
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
          !sidebarOpen ? "justify-center" : ""
        )}
      >
        <Icon
          className={classNames(
            isActive
              ? "text-white"
              : "text-[#5DC3F8] group-hover:text-[#EC67A1]",
            "h-5 w-5 xs:h-5.5 xs:w-5.5 sm:h-6 sm:w-6 flex-shrink-0 transition-all duration-300",
            sidebarOpen ? "mr-2 xs:mr-2.5 sm:mr-3" : "",
            isActive ? "scale-110" : "group-hover:scale-110"
          )}
          aria-hidden="true"
        />
        {sidebarOpen && <span className="truncate">{item.name}</span>}
      </Link>
    );
  };

  const renderNavSection = (section: NavSection) => {
    const isExpanded = isSectionExpanded(section.name);
    const hasActiveItem = section.items.some((item) => isNavItemActive(item.href));
    const Icon = section.icon;

    return (
      <div key={section.name} className="space-y-1">
        <button
          onClick={() => toggleSection(section.name)}
          className={classNames(
            hasActiveItem
              ? "bg-gradient-to-r from-[#EC67A1]/10 to-[#F774B9]/10 border-2 border-[#EC67A1]/30"
              : "border-2 border-transparent hover:border-[#EC67A1]/20",
            "w-full flex items-center justify-between px-2.5 xs:px-3 py-2 xs:py-2.5 text-xs xs:text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground rounded-xl transition-all duration-300 active:scale-95 hover:scale-[1.02] hover:shadow-md",
            !sidebarOpen ? "justify-center" : "justify-between"
          )}
        >
          <div className="flex items-center">
            <Icon
              className={classNames(
                hasActiveItem
                  ? "text-[#EC67A1]"
                  : "text-[#5DC3F8] group-hover:text-[#EC67A1]",
                "h-5 w-5 xs:h-5.5 xs:w-5.5 sm:h-6 sm:w-6 flex-shrink-0 transition-all duration-300",
                sidebarOpen ? "mr-2 xs:mr-2.5 sm:mr-3" : ""
              )}
              aria-hidden="true"
            />
            {sidebarOpen && <span className="truncate">{section.name}</span>}
          </div>
          {sidebarOpen && (
            <ChevronDown
              className={classNames(
                "h-3.5 w-3.5 xs:h-4 xs:w-4 transition-transform duration-300",
                isExpanded ? "rotate-180" : ""
              )}
            />
          )}
        </button>
        {sidebarOpen && isExpanded && (
          <div className="ml-4 pl-4 border-l border-[#EC67A1]/30 space-y-1">
            {section.items.map((subItem) => {
              const isActive = isNavItemActive(subItem.href);
              const SubIcon = subItem.icon;
              return (
                <Link
                  key={subItem.name}
                  href={subItem.href}
                  onClick={() => isMobile && setSidebarOpen(false)}
                  className={classNames(
                    isActive
                      ? "bg-gradient-to-r from-[#EC67A1] to-[#F774B9] text-white shadow-md shadow-[#EC67A1]/25 border-2 border-[#EC67A1]/30"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground hover:border-[#EC67A1]/20 border-2 border-transparent",
                    "group flex items-center px-3 py-2 text-xs xs:text-sm font-medium rounded-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-md"
                  )}
                >
                  <SubIcon
                    className={classNames(
                      isActive ? "text-white" : "text-[#5DC3F8] group-hover:text-[#EC67A1]",
                      "h-4 w-4 xs:h-5 xs:w-5 flex-shrink-0 mr-2 transition-all duration-300"
                    )}
                    aria-hidden="true"
                  />
                  <span className="truncate">{subItem.name}</span>
                </Link>
              );
            })}
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
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h1 className="text-xl font-bold text-sidebar-foreground">
                      Admin Panel
                    </h1>
                    <p className="text-xs text-sidebar-foreground/60">System Control</p>
                  </div>
                </div>
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#EC67A1] via-[#F774B9] to-[#5DC3F8] flex items-center justify-center shadow-lg shadow-[#EC67A1]/30 mx-auto">
                  <Shield className="w-6 h-6 text-white" />
                </div>
              )}
              {sidebarOpen && (
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="p-2 rounded-xl hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground transition-all duration-200 hover:rotate-180"
                  aria-label="Collapse sidebar"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}
            </div>
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-xl hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground transition-all duration-200 mt-3 mx-auto"
                aria-label="Expand sidebar"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto custom-scrollbar">
            {navigation.map((item) => {
              if ("items" in item) {
                return renderNavSection(item);
              } else {
                return renderNavItem(item);
              }
            })}
          </nav>

          {/* Theme toggle and footer */}
          <div className="border-t border-sidebar-border p-4">
            <div className="flex items-center justify-end">
              <div className="transform transition-transform duration-300 hover:scale-110">
                <ThemeToggle />
              </div>
            </div>
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
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />

        {/* Mobile Sidebar */}
        <div
          className={classNames(
            "w-72 xs:w-80 h-full p-3 transition-all duration-300 ease-out",
            sidebarOpen
              ? "transform translate-x-0 opacity-100"
              : "transform -translate-x-full opacity-0"
          )}
        >
          <div className="h-full rounded-3xl bg-background backdrop-blur-2xl border border-sidebar-border flex flex-col overflow-hidden shadow-xl">
            {/* Mobile Sidebar Header */}
            <div className="p-5 border-b border-sidebar-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#EC67A1] via-[#F774B9] to-[#5DC3F8] flex items-center justify-center shadow-lg shadow-[#EC67A1]/30 flex-shrink-0">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h1 className="text-xl font-bold text-sidebar-foreground">Admin Panel</h1>
                    <p className="text-xs text-sidebar-foreground/60">System Control</p>
                  </div>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-2 rounded-xl hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground transition-all duration-200"
                  aria-label="Close sidebar"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto custom-scrollbar">
              {navigation.map((item) => {
                if ("items" in item) {
                  return renderNavSection(item);
                } else {
                  return renderNavItem(item);
                }
              })}
            </nav>

            {/* Theme toggle */}
            <div className="border-t border-sidebar-border p-4">
              <div className="flex items-center justify-end">
                <ThemeToggle />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        {/* Mobile menu button */}
        <div className="lg:hidden bg-card/95 backdrop-blur-md shadow-lg border-b border-border px-4 py-2.5">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 text-foreground/70 hover:text-foreground hover:bg-accent transition-all duration-300 active:scale-95 rounded-lg"
            aria-label="Open menu"
          >
            <div className="flex items-center space-x-2">
              <Shield className="h-5 w-5 text-[#EC67A1]" />
              <span className="text-sm font-medium">Admin Menu</span>
            </div>
          </button>
        </div>

        {/* Content area */}
        <main className="flex-1 overflow-y-auto bg-transparent custom-scrollbar">
          {/* Modern Top Header */}
          <div className="sticky top-0 z-20 backdrop-blur-2xl bg-background border-b border-header-border rounded-b-2xl">
            <div className="px-6 lg:px-8 py-4">
              <div className="flex items-center justify-between">
                {/* Left Side - Page Title */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 bg-gradient-to-r from-[#EC67A1]/10 to-[#F774B9]/10 px-4 py-2.5 rounded-2xl border-2 border-[#EC67A1]/30">
                    <Shield className="w-5 h-5 text-[#EC67A1]" />
                    <h2 className="text-base font-semibold text-header-foreground">Admin Control Panel</h2>
                  </div>
                </div>

                {/* Right Side - Compact Controls */}
                <div className="hidden lg:flex items-center gap-3">
                  {/* Theme Toggle */}
                  <ThemeToggle />

                  {/* User Menu */}
                  <div className="relative group">
                    <button className="flex items-center gap-3 pl-3 pr-4 py-2 rounded-2xl bg-sidebar-accent hover:bg-sidebar-accent/80 border-2 border-transparent hover:border-[#EC67A1]/30 transition-all duration-200">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#EC67A1] via-[#F774B9] to-[#5DC3F8] flex items-center justify-center ring-2 ring-[#EC67A1]/20">
                        <span className="text-white text-xs font-bold">{initials}</span>
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium text-header-foreground">{firstName}</p>
                        <p className="text-[10px] text-header-muted truncate max-w-[120px]">{email}</p>
                      </div>
                      <ChevronDown className="w-4 h-4 text-[#EC67A1] transition-all duration-200 group-hover:rotate-180" />
                    </button>

                    {/* User Dropdown */}
                    <div className="absolute right-0 mt-2 w-72 py-2 bg-sidebar rounded-2xl border border-sidebar-border shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                      <div className="px-4 py-3 border-b border-sidebar-border">
                        <p className="text-sm font-semibold text-sidebar-foreground">{firstName}</p>
                        <p className="text-xs text-sidebar-foreground/60 truncate">{email}</p>
                        <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-[#EC67A1] to-[#F774B9] rounded-full">
                          <Shield className="w-3 h-3 text-white" />
                          <span className="text-xs text-white font-semibold">Admin</span>
                        </div>
                      </div>

                      <div className="py-1">
                        <Link
                          href={`/${tenant}/dashboard`}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-sidebar-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all rounded-lg mx-2"
                        >
                          <Home className="w-4 h-4 text-[#5DC3F8]" />
                          User Dashboard
                        </Link>
                        <Link
                          href={`/${tenant}/settings`}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-sidebar-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all rounded-lg mx-2"
                        >
                          <Settings className="w-4 h-4 text-[#5DC3F8]" />
                          Settings
                        </Link>
                      </div>
                      <div className="border-t border-sidebar-border pt-1 mt-1">
                        <button
                          onClick={() => signOut({ redirectUrl: "/" })}
                          className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-500/10 transition-all rounded-lg mx-2"
                        >
                          <LogOut className="w-4 h-4" />
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
          <div className="px-2.5 py-2.5 xs:px-3 xs:py-3 sm:px-4 sm:py-4 lg:px-6 xl:px-8 animate-fadeIn">
            {children}
          </div>
        </main>
      </div>

      {/* Tooltip for collapsed sidebar */}
      {!sidebarOpen && hoveredItem && (
        <div
          className="hidden lg:block fixed z-50 px-3 py-2 bg-sidebar text-sidebar-foreground text-sm rounded-xl shadow-xl border border-sidebar-border pointer-events-none animate-fadeIn"
          style={{
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y}px`,
            transform: 'translateY(-50%)'
          }}
        >
          {hoveredItem}
          <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 bg-sidebar rotate-45 border-l border-b border-sidebar-border" />
        </div>
      )}
    </div>
  );
}
