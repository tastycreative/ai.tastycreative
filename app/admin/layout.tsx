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
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";

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

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const pathname = usePathname();
  const { signOut } = useClerk();
  const { user } = useUser();

  // Admin navigation
  const navigation: (NavItem | NavSection)[] = [
    {
      name: "Overview",
      href: "/admin",
      icon: Home,
    },
    {
      name: "Users Management",
      href: "/admin/users",
      icon: Users,
    },
    {
      name: "Organizations",
      href: "/admin/organizations",
      icon: Building2,
    },
    {
      name: "Production Tracker",
      href: "/admin/production",
      icon: Activity,
    },
    {
      name: "AI Marketplace",
      href: "/admin/marketplace",
      icon: ShoppingBag,
    },
    {
      name: "Analytics",
      href: "/admin/analytics",
      icon: BarChart,
    },
    {
      name: "Security",
      href: "/admin/security",
      icon: Shield,
    },
    {
      name: "System Settings",
      href: "/admin/settings",
      icon: Settings,
    },
    {
      name: "Database",
      href: "/admin/database",
      icon: Database,
    },
    {
      name: "Notifications",
      href: "/admin/notifications",
      icon: Bell,
    },
    {
      name: "Billing & Plans",
      href: "/admin/billing",
      icon: CreditCard,
    },
    {
      name: "Activity Logs",
      href: "/admin/logs",
      icon: FileText,
    },
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
    if (href === "/admin") {
      return pathname === "/admin";
    }
    return pathname.startsWith(href);
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
            ? "bg-gradient-to-r from-red-600 to-orange-600 text-white shadow-lg shadow-red-500/25 scale-[1.02]"
            : "text-gray-300 hover:bg-gradient-to-r hover:from-red-900/50 hover:to-orange-900/50 hover:text-white hover:scale-[1.02] hover:shadow-md",
          "group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-300 active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-slate-900",
          !sidebarOpen ? "justify-center" : ""
        )}
      >
        <Icon
          className={classNames(
            isActive
              ? "text-white"
              : "text-gray-400 dark:text-gray-400 group-hover:text-gray-300 dark:group-hover:text-white",
            "h-6 w-6 flex-shrink-0 transition-transform duration-300",
            sidebarOpen ? "mr-3" : "",
            isActive ? "scale-110" : "group-hover:scale-110"
          )}
          aria-hidden="true"
        />
        {sidebarOpen && <span className="truncate">{item.name}</span>}
      </Link>
    );
  };

  return (
    <div className="flex h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 relative overflow-hidden">
      {/* Animated Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 right-1/4 w-96 h-96 bg-yellow-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Desktop Sidebar */}
      <div
        className={classNames(
          "hidden lg:flex bg-gradient-to-b from-slate-900/95 to-slate-950/95 backdrop-blur-xl transition-all duration-300 ease-in-out flex-col shadow-2xl border-r border-red-900/30 relative z-10",
          sidebarOpen ? "w-64" : "w-16"
        )}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between p-4 border-b border-red-900/50">
          {sidebarOpen && (
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-gradient-to-br from-red-600 via-orange-600 to-yellow-600 rounded-lg shadow-lg">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-white text-lg font-bold bg-gradient-to-r from-red-400 via-orange-400 to-yellow-400 bg-clip-text text-transparent">
                  Admin Panel
                </h1>
                <p className="text-xs text-gray-400">System Control</p>
              </div>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 text-gray-400 hover:text-white transition-all duration-200 active:scale-95 hover:rotate-180 hover:bg-gray-700/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            {sidebarOpen ? (
              <ChevronLeft className="h-5 w-5" />
            ) : (
              <ChevronRight className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-2 overflow-y-auto custom-scrollbar">
          {navigation.map((item) => {
            if ("items" in item) {
              return null; // No sections for now, can add later
            } else {
              return renderNavItem(item);
            }
          })}
        </nav>

        {/* Theme toggle and footer */}
        <div className="border-t border-red-900/50 p-4 bg-gradient-to-t from-slate-950/50 to-transparent">
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
          sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-all duration-300"
          onClick={() => setSidebarOpen(false)}
        />

        {/* Mobile Sidebar */}
        <div
          className={classNames(
            "relative w-64 h-full bg-gradient-to-b from-slate-900/95 to-slate-950/95 backdrop-blur-xl flex flex-col shadow-2xl border-r border-red-900/30 transition-all duration-300 ease-out",
            sidebarOpen
              ? "transform translate-x-0 opacity-100"
              : "transform -translate-x-full opacity-0"
          )}
        >
          {/* Mobile Sidebar Header */}
          <div className="flex items-center justify-between p-4 border-b border-red-900/50">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-gradient-to-br from-red-600 via-orange-600 to-yellow-600 rounded-lg shadow-lg">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-white text-lg font-bold bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">Admin Panel</h1>
                <p className="text-xs text-gray-400">System Control</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1 text-gray-400 hover:text-white transition-all duration-200 active:scale-95 hover:bg-gray-700/50 rounded-lg"
              aria-label="Close sidebar"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-2 py-4 space-y-2 overflow-y-auto">
            {navigation.map((item) => {
              if ("items" in item) {
                return null;
              } else {
                return renderNavItem(item);
              }
            })}
          </nav>

          {/* Theme toggle */}
          <div className="border-t border-red-900/50 p-4">
            <div className="flex items-center justify-end">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        {/* Mobile menu button */}
        <div className="lg:hidden bg-slate-900/90 backdrop-blur-md shadow-lg border-b border-red-900/30 px-4 py-2">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 text-gray-400 hover:text-white transition-all duration-300 active:scale-95 hover:bg-red-900/50 rounded-lg"
            aria-label="Open menu"
          >
            <div className="flex items-center space-x-2">
              <Shield className="h-5 w-5 text-red-400" />
              <span className="text-sm font-medium">Admin Menu</span>
            </div>
          </button>
        </div>

        {/* Content area */}
        <main className="flex-1 h-full overflow-y-auto bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 custom-scrollbar">
          {/* Sticky Header with user info */}
          <div className="sticky top-0 z-20 bg-slate-900/90 backdrop-blur-md border-b border-red-900/30 px-4 lg:px-8 py-3 shadow-lg">
            <div className="flex items-center justify-between">
              {/* Left Side - Page Title */}
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2 bg-gradient-to-r from-red-950/50 to-orange-950/50 px-3 py-2 rounded-lg border border-red-900/30">
                  <Shield className="w-6 h-6 text-red-400" />
                  <h2 className="text-lg font-semibold bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">Admin Control Panel</h2>
                </div>
              </div>

              {/* Right Side - User Info */}
              <div className="flex items-center space-x-4">
                {/* Theme Toggle */}
                <ThemeToggle />

                {/* User Dropdown */}
                <div className="relative group">
                  <button className="flex items-center space-x-2 bg-red-950/50 hover:bg-red-900/50 border border-red-900/50 px-3 py-2 rounded-lg transition-all duration-300 shadow-sm hover:shadow-md">
                    <div className="w-8 h-8 bg-gradient-to-br from-red-600 via-orange-600 to-yellow-600 rounded-full flex items-center justify-center shadow-md">
                      <span className="text-white text-sm font-semibold">
                        {initials}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-white hidden sm:block">
                      {firstName}
                    </span>
                    <ChevronDown className="w-4 h-4 text-gray-400 transition-transform duration-300 group-hover:rotate-180" />
                  </button>

                  {/* Dropdown Menu */}
                  <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-red-900/50 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                    <div className="py-2">
                      <div className="px-4 py-2 border-b border-red-900/50 bg-red-950/30">
                        <p className="text-sm font-medium text-white truncate">{firstName}</p>
                        <p className="text-xs text-orange-400 truncate">{email}</p>
                        <p className="text-xs text-red-400 mt-1 font-semibold">Admin Access</p>
                      </div>
                      <Link
                        href="/dashboard"
                        className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-slate-700 transition-all duration-200 block flex items-center space-x-2"
                      >
                        <Home className="w-4 h-4" />
                        <span>User Dashboard</span>
                      </Link>
                      <Link
                        href="/settings"
                        className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-slate-700 transition-all duration-200 block flex items-center space-x-2"
                      >
                        <Settings className="w-4 h-4" />
                        <span>Settings</span>
                      </Link>
                      <div className="border-t border-red-900/50 mt-2 pt-2">
                        <button
                          onClick={() => signOut({ redirectUrl: "/" })}
                          className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-900/20 transition-all duration-200 flex items-center space-x-2"
                        >
                          <LogOut className="w-4 h-4" />
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
          <div className="px-4 py-6 lg:px-8 animate-fadeIn h-full">
            {children}
          </div>
        </main>
      </div>
      {/* Tooltip for collapsed sidebar */}
      {!sidebarOpen && hoveredItem && (
        <div
          className="hidden lg:block fixed z-50 px-3 py-2 bg-slate-800 text-white text-sm rounded-lg shadow-lg border border-red-900/50 pointer-events-none animate-fadeIn"
          style={{
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y}px`,
            transform: 'translateY(-50%)'
          }}
        >
          {hoveredItem}
          <div className="absolute left-0 top-1/2 transform -translate-x-1 -translate-y-1/2 w-2 h-2 bg-slate-800 rotate-45 border-l border-b border-red-900/50"></div>
        </div>
      )}
    </div>
  );
}
