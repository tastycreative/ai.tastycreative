'use client';

import { useState, useEffect } from 'react';
import { Users, Settings, BarChart, Shield, Activity } from 'lucide-react';
import UsersTab from './UsersTab';
import ProductionTrackerTab from './ProductionTrackerTab';
import SettingsTab from './SettingsTab';
import AnalyticsTab from './AnalyticsTab';
import SecurityTab from './SecurityTab';

const tabs = [
  { id: 'users', label: 'Users', icon: Users },
  { id: 'production', label: 'Master Production Tracker', icon: Activity },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'analytics', label: 'Analytics', icon: BarChart },
  { id: 'security', label: 'Security', icon: Shield },
];

interface AdminStats {
  totalUsers: number;
  activeJobs: number;
  totalContent: number;
  storageUsed: string;
}

export default function AdminContent() {
  const [activeTab, setActiveTab] = useState('users');
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    activeJobs: 0,
    totalContent: 0,
    storageUsed: '0 GB'
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminStats();
  }, []);

  const fetchAdminStats = async () => {
    try {
      const response = await fetch('/api/admin/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch admin stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'users':
        return <UsersTab />;
      case 'production':
        return <ProductionTrackerTab stats={stats} />;
      case 'settings':
        return <SettingsTab />;
      case 'analytics':
        return <AnalyticsTab />;
      case 'security':
        return <SecurityTab />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-3 xs:space-y-4 sm:space-y-6">
      {/* Admin Header */}
      <div className="space-y-2 xs:space-y-3">
        <div>
          <h1 className="text-lg xs:text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
          <p className="text-xs xs:text-sm sm:text-base text-gray-600 dark:text-gray-300">Manage users and system settings</p>
        </div>
      </div>

      {/* Admin Stats Cards */}
      <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        <div className="bg-gradient-to-br from-white to-blue-50/50 dark:from-gray-900/30 dark:to-blue-900/20 shadow-xl rounded-lg sm:rounded-xl p-3 xs:p-3.5 sm:p-4 border border-blue-200/30 dark:border-blue-700/20 backdrop-blur-sm hover:shadow-2xl transition-all duration-300 active:scale-[0.99]">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs xs:text-sm sm:text-base font-medium text-gray-900 dark:text-white">Total Users</h3>
              <p className="text-lg xs:text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 dark:from-blue-400 dark:to-cyan-400 bg-clip-text text-transparent">
                {loading ? '...' : stats.totalUsers}
              </p>
            </div>
            <div className="p-1.5 xs:p-2 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg shadow-lg">
              <Users className="w-4 h-4 xs:w-4.5 xs:h-4.5 sm:w-5 sm:h-5 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-white to-purple-50/50 dark:from-gray-900/30 dark:to-purple-900/20 shadow-xl rounded-lg sm:rounded-xl p-3 xs:p-3.5 sm:p-4 border border-purple-200/30 dark:border-purple-700/20 backdrop-blur-sm hover:shadow-2xl transition-all duration-300 active:scale-[0.99]">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs xs:text-sm sm:text-base font-medium text-gray-900 dark:text-white">Active Jobs</h3>
              <p className="text-lg xs:text-xl sm:text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-500 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
                {loading ? '...' : stats.activeJobs}
              </p>
            </div>
            <div className="p-1.5 xs:p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg shadow-lg">
              <BarChart className="w-4 h-4 xs:w-4.5 xs:h-4.5 sm:w-5 sm:h-5 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-white to-emerald-50/50 dark:from-gray-900/30 dark:to-emerald-900/20 shadow-xl rounded-lg sm:rounded-xl p-3 xs:p-3.5 sm:p-4 border border-emerald-200/30 dark:border-emerald-700/20 backdrop-blur-sm hover:shadow-2xl transition-all duration-300 active:scale-[0.99]">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs xs:text-sm sm:text-base font-medium text-gray-900 dark:text-white">Total Content</h3>
              <p className="text-lg xs:text-xl sm:text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-500 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">
                {loading ? '...' : stats.totalContent}
              </p>
            </div>
            <div className="p-1.5 xs:p-2 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg shadow-lg">
              <Shield className="w-4 h-4 xs:w-4.5 xs:h-4.5 sm:w-5 sm:h-5 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-white to-orange-50/50 dark:from-gray-900/30 dark:to-orange-900/20 shadow-xl rounded-lg sm:rounded-xl p-3 xs:p-3.5 sm:p-4 border border-orange-200/30 dark:border-orange-700/20 backdrop-blur-sm hover:shadow-2xl transition-all duration-300 active:scale-[0.99]">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs xs:text-sm sm:text-base font-medium text-gray-900 dark:text-white">Storage Used</h3>
              <p className="text-lg xs:text-xl sm:text-2xl font-bold bg-gradient-to-r from-orange-600 to-red-500 dark:from-orange-400 dark:to-red-400 bg-clip-text text-transparent">
                {loading ? '...' : stats.storageUsed}
              </p>
            </div>
            <div className="p-1.5 xs:p-2 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg shadow-lg">
              <Settings className="w-4 h-4 xs:w-4.5 xs:h-4.5 sm:w-5 sm:h-5 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900/30 dark:to-gray-800/20 border border-gray-200/50 dark:border-gray-700/30 rounded-lg sm:rounded-xl shadow-lg backdrop-blur-sm overflow-hidden">
        <div className="border-b border-gray-200/50 dark:border-gray-700/30">
          <nav className="flex space-x-4 xs:space-x-6 sm:space-x-8 px-3 xs:px-4 sm:px-6 overflow-x-auto" aria-label="Tabs">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`${
                    isActive
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                  } whitespace-nowrap py-3 xs:py-3.5 sm:py-4 px-1 border-b-2 font-medium text-xs xs:text-sm flex items-center space-x-1.5 xs:space-x-2 transition-all duration-200 active:scale-95`}
                >
                  <Icon className="w-3.5 h-3.5 xs:w-4 xs:h-4" />
                  <span className="hidden xs:inline">{tab.label}</span>
                  <span className="xs:hidden">{tab.label.split(' ')[0]}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-3 xs:p-4 sm:p-6">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
}