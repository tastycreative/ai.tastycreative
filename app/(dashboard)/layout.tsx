'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  ChevronUp
} from 'lucide-react';
import { ThemeToggle } from '@/components/ui/theme-toggle';

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
    name: 'Dashboard',
    href: '/dashboard',
    icon: Home,
  },
  {
    name: 'Workspace',
    collapsible: true,
    items: [
      {
        name: 'My Influencers',
        href: '/workspace/my-influencers',
        icon: Users,
      },
      {
        name: 'Generated Content',
        href: '/workspace/generated-content',
        icon: FileText,
      },
      {
        name: 'Social Media',
        href: '/workspace/social-media',
        icon: Share2,
      },
      {
        name: 'Generate Content',
        href: '/workspace/generate-content',
        icon: PlusCircle,
      },
    ],
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
  },
  {
    name: 'Billing',
    href: '/billing',
    icon: CreditCard,
  },
  {
    name: 'Team',
    href: '/team',
    icon: UserCheck,
  },
];

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [workspaceOpen, setWorkspaceOpen] = useState(true);
  const pathname = usePathname();

  const isNavItemActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(href);
  };

  const renderNavItem = (item: NavItem, isInSection = false) => {
    const isActive = isNavItemActive(item.href);
    const Icon = item.icon;

    return (
      <Link
        key={item.name}
        href={item.href}
        className={classNames(
          isActive
            ? 'bg-blue-600 dark:bg-blue-600 text-white shadow-md'
            : 'text-gray-300 dark:text-gray-300 hover:bg-gray-700 dark:hover:bg-gray-800 hover:text-white dark:hover:text-white',
          'group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-all duration-200',
          isInSection ? 'pl-8' : '',
          !sidebarOpen ? 'justify-center' : ''
        )}
      >
        <Icon
          className={classNames(
            isActive ? 'text-white' : 'text-gray-400 dark:text-gray-400 group-hover:text-gray-300 dark:group-hover:text-white',
            'h-6 w-6 flex-shrink-0',
            sidebarOpen ? 'mr-3' : ''
          )}
          aria-hidden="true"
        />
        {sidebarOpen && item.name}
      </Link>
    );
  };

  const renderNavSection = (section: NavSection) => {
    const isWorkspaceSection = section.name === 'Workspace';
    const isExpanded = isWorkspaceSection ? workspaceOpen : true;

    return (
      <div key={section.name} className="space-y-1">
        {section.collapsible && sidebarOpen ? (
          <button
            onClick={() => setWorkspaceOpen(!workspaceOpen)}
            className="w-full flex items-center justify-between px-2 py-2 text-sm font-medium text-gray-300 dark:text-gray-300 hover:bg-gray-700 dark:hover:bg-gray-800 hover:text-white dark:hover:text-white rounded-md transition-all duration-200"
          >
            <span className="flex items-center">
              <Users className="h-6 w-6 flex-shrink-0 mr-3 text-gray-400 dark:text-gray-400" />
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
          <div className={classNames(
            section.collapsible ? 'space-y-1' : 'space-y-1'
          )}>
            {section.items.map((item) => renderNavItem(item, section.collapsible))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-black">
      {/* Sidebar */}
      <div className={classNames(
        'bg-gray-800 dark:bg-gray-900/50 transition-all duration-300 ease-in-out flex flex-col shadow-lg border-r border-gray-200 dark:border-gray-800',
        sidebarOpen ? 'w-64' : 'w-16'
      )}>
        {/* Sidebar header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700 dark:border-gray-800">
          {sidebarOpen && (
            <h1 className="text-white text-lg font-semibold">Dashboard</h1>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 text-gray-400 hover:text-white dark:text-gray-400 dark:hover:text-white transition-colors duration-200"
          >
            {sidebarOpen ? (
              <ChevronLeft className="h-5 w-5" />
            ) : (
              <ChevronRight className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-2 overflow-y-auto">
          {navigation.map((item) => {
            if ('items' in item) {
              return renderNavSection(item);
            } else {
              return renderNavItem(item);
            }
          })}
        </nav>

        {/* Theme toggle and footer */}
        <div className="border-t border-gray-700 dark:border-gray-800 p-4">
          <div className="flex items-center justify-end">
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile menu button */}
        <div className="lg:hidden bg-white dark:bg-gray-900/30 shadow-sm border-b border-gray-200 dark:border-gray-800 px-4 py-2">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white"
          >
            {sidebarOpen ? (
              <ChevronLeft className="h-6 w-6" />
            ) : (
              <div className="flex items-center space-x-2">
                <ChevronRight className="h-6 w-6" />
                <span className="text-sm font-medium">Menu</span>
              </div>
            )}
          </button>
        </div>

        {/* Content area */}
        <main className="flex-1 overflow-y-auto bg-white dark:bg-black">
          <div className="px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}