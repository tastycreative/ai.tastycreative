'use client';

import { useState, useEffect, useRef } from 'react';
import { useOrganization } from '@/lib/hooks/useOrganization.query';
import { usePermissions } from '@/lib/hooks/usePermissions.query';
import {
  ChevronDown,
  Building2,
  Users,
  Check,
  Plus,
  Crown,
  Shield,
  User,
  Loader2
} from 'lucide-react';

export function OrganizationSwitcher() {
  const { currentOrganization, organizations, loading, switchOrganization } = useOrganization();
  const { subscriptionInfo } = usePermissions();
  const [isOpen, setIsOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSwitch = async (organizationId: string) => {
    if (organizationId === currentOrganization?.id) {
      setIsOpen(false);
      return;
    }

    setSwitching(true);
    await switchOrganization(organizationId);
    setSwitching(false);
    setIsOpen(false);
  };

  const getRoleIcon = (role: string) => {
    switch (role.toUpperCase()) {
      case 'OWNER':
        return <Crown className="w-3 h-3 text-yellow-500" />;
      case 'ADMIN':
        return <Shield className="w-3 h-3 text-blue-500" />;
      case 'MANAGER':
        return <Users className="w-3 h-3 text-purple-500" />;
      default:
        return <User className="w-3 h-3 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const statusUpper = status.toUpperCase();

    if (statusUpper === 'TRIAL') {
      return (
        <span className="text-[8px] xs:text-[9px] px-1 xs:px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
          Trial
        </span>
      );
    }

    if (statusUpper === 'ACTIVE') {
      return (
        <span className="text-[8px] xs:text-[9px] px-1 xs:px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30">
          Active
        </span>
      );
    }

    if (statusUpper === 'PAST_DUE') {
      return (
        <span className="text-[8px] xs:text-[9px] px-1 xs:px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
          Past Due
        </span>
      );
    }

    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center space-x-2 px-2 xs:px-3 py-1.5 xs:py-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
        <span className="text-xs xs:text-sm text-gray-500 dark:text-gray-400">Loading...</span>
      </div>
    );
  }

  // Solo mode - no organization
  if (!currentOrganization && organizations.length === 0) {
    return (
      <div className="flex items-center space-x-1.5 xs:space-x-2 px-2 xs:px-3 py-1.5 xs:py-2 bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-700 rounded-lg border border-gray-200/50 dark:border-gray-600/30">
        <User className="w-4 h-4 xs:w-5 xs:h-5 text-gray-600 dark:text-gray-400" />
        <span className="text-xs xs:text-sm font-medium text-gray-700 dark:text-gray-300">
          Personal
        </span>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Organization Switcher Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={switching}
        className="flex items-center space-x-1.5 xs:space-x-2 px-2 xs:px-3 py-1.5 xs:py-2 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 hover:from-blue-100 hover:to-purple-100 dark:hover:from-blue-900/40 dark:hover:to-purple-900/40 border border-blue-200/50 dark:border-blue-700/30 rounded-lg transition-all duration-300 shadow-sm hover:shadow-md group disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {currentOrganization?.logoUrl ? (
          <img
            src={currentOrganization.logoUrl}
            alt={currentOrganization.name}
            className="w-5 h-5 xs:w-6 xs:h-6 rounded object-cover"
          />
        ) : (
          <Building2 className="w-4 h-4 xs:w-5 xs:h-5 text-blue-600 dark:text-blue-400" />
        )}

        <div className="flex flex-col items-start min-w-0">
          <div className="flex items-center space-x-1.5">
            <span className="text-xs xs:text-sm font-semibold text-gray-900 dark:text-white truncate max-w-[120px] xs:max-w-[150px]">
              {currentOrganization?.name || 'Personal'}
            </span>
            {subscriptionInfo && getStatusBadge(subscriptionInfo.status)}
          </div>
          {subscriptionInfo && (
            <span className="text-[9px] xs:text-[10px] text-gray-500 dark:text-gray-400">
              {subscriptionInfo.planDisplayName}
            </span>
          )}
        </div>

        {switching ? (
          <Loader2 className="w-3 h-3 xs:w-4 xs:h-4 animate-spin text-blue-600 dark:text-blue-400" />
        ) : (
          <ChevronDown className={`w-3 h-3 xs:w-4 xs:h-4 text-gray-500 dark:text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-72 xs:w-80 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 z-50 animate-fadeIn">
          {/* Header */}
          <div className="px-3 xs:px-4 py-2.5 xs:py-3 border-b border-gray-200 dark:border-gray-700">
            <p className="text-[10px] xs:text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Switch Organization
            </p>
          </div>

          {/* Organizations List */}
          <div className="max-h-80 overflow-y-auto py-2">
            {organizations.map((org) => {
              const isActive = org.id === currentOrganization?.id;

              return (
                <button
                  key={org.id}
                  onClick={() => handleSwitch(org.id)}
                  disabled={switching}
                  className={`w-full text-left px-3 xs:px-4 py-2.5 xs:py-3 transition-all duration-200 flex items-center justify-between group disabled:opacity-50 disabled:cursor-not-allowed ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-900/20'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 xs:space-x-3 min-w-0 flex-1">
                    {org.logoUrl ? (
                      <img
                        src={org.logoUrl}
                        alt={org.name}
                        className="w-8 h-8 xs:w-9 xs:h-9 rounded object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 xs:w-9 xs:h-9 rounded bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs xs:text-sm font-bold">
                          {org.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}

                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center space-x-1.5">
                        <span className={`text-xs xs:text-sm font-medium truncate ${
                          isActive
                            ? 'text-blue-700 dark:text-blue-300'
                            : 'text-gray-900 dark:text-white'
                        }`}>
                          {org.name}
                        </span>
                        {getRoleIcon(org.role)}
                      </div>
                      <span className="text-[9px] xs:text-[10px] text-gray-500 dark:text-gray-400">
                        {org.role}
                      </span>
                    </div>
                  </div>

                  {isActive && (
                    <Check className="w-4 h-4 xs:w-5 xs:h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 ml-2" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer - Create New Organization */}
          <div className="border-t border-gray-200 dark:border-gray-700 p-2">
            <button
              onClick={() => {
                // Navigate to create organization page
                window.location.href = '/organizations/new';
              }}
              className="w-full text-left px-3 xs:px-4 py-2 xs:py-2.5 text-xs xs:text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all duration-200 flex items-center space-x-2 group"
            >
              <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
              <span className="font-medium">Create New Organization</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
