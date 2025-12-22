'use client';

import { useState, useEffect } from 'react';
import { Users, Settings, BarChart, Shield, Activity, ShoppingBag, TrendingUp, Clock, Database, Zap, Sparkles, Cpu, HardDrive, Cloud } from 'lucide-react';
import UsersTab from './UsersTab';
import ProductionTrackerTab from './ProductionTrackerTab';
import SettingsTab from './SettingsTab';
import AnalyticsTab from './AnalyticsTab';
import SecurityTab from './SecurityTab';
import AIMarketplaceTab from './AIMarketplaceTab';

const tabs = [
  { id: 'overview', label: 'Overview', icon: Shield },
  { id: 'users', label: 'Users Management', icon: Users },
  { id: 'production', label: 'Production Tracker', icon: Activity },
  { id: 'marketplace', label: 'AI Marketplace', icon: ShoppingBag },
  { id: 'analytics', label: 'Analytics', icon: BarChart },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'settings', label: 'System Settings', icon: Settings },
];

interface AdminStats {
  totalUsers: number;
  activeJobs: number;
  totalContent: number;
  storageUsed: string;
}
export default function AdminContent() {
  const [activeTab, setActiveTab] = useState('overview');
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
      case 'overview':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">System Overview</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Platform Status</span>
                    <span className="text-sm font-medium text-green-600 dark:text-green-400">Operational</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Server Uptime</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">99.9%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">API Response Time</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">127ms</span>
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Stats</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">New Users Today</span>
                    <span className="text-sm font-medium text-blue-600 dark:text-blue-400">+24</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Active Sessions</span>
                    <span className="text-sm font-medium text-purple-600 dark:text-purple-400">1,234</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Content Generated Today</span>
                    <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">5,678</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Activity</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Monitor system-wide activities and events in real-time.</p>
            </div>
          </div>
        );
      case 'users':
        return <UsersTab />;
      case 'production':
        return <ProductionTrackerTab stats={stats} />;
      case 'marketplace':
        return <AIMarketplaceTab />;
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
    <div className="min-h-screen space-y-6">
      {/* Animated Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 dark:bg-blue-500/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 dark:bg-purple-500/5 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-pink-500/10 dark:bg-pink-500/5 rounded-full blur-3xl animate-pulse delay-2000" />
      </div>

      {/* Admin Header with Glass Effect */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-pink-600/20 dark:from-blue-600/10 dark:via-purple-600/10 dark:to-pink-600/10 rounded-2xl blur-xl" />
        <div className="relative bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-gray-700/30 shadow-2xl p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-xl blur-lg opacity-75 animate-pulse" />
                  <div className="relative bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 p-3 rounded-xl shadow-lg">
                    <Shield className="w-8 h-8 text-white" />
                  </div>
                </div>
                <div>
                  <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 dark:from-blue-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
                    Admin Dashboard
                  </h1>
                  <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 flex items-center space-x-2 mt-1">
                    <Sparkles className="w-4 h-4" />
                    <span>Complete system control & management</span>
                  </p>
                </div>
              </div>
            </div>
            
            {/* Real-time System Status */}
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200/50 dark:border-green-700/30 rounded-xl px-4 py-2 flex items-center space-x-2">
                <div className="relative">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-ping absolute" />
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                </div>
                <span className="text-xs font-medium text-green-700 dark:text-green-400">System Online</span>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border border-blue-200/50 dark:border-blue-700/30 rounded-xl px-4 py-2 flex items-center space-x-2">
                <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-medium text-blue-700 dark:text-blue-400">
                  {new Date().toLocaleTimeString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Stats Grid with Animations */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Total Users Card */}
        <div className="group relative">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity duration-300" />
          <div className="relative bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-gray-700/30 shadow-xl p-6 hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl shadow-lg">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div className="flex items-center space-x-1 text-xs font-medium text-green-600 dark:text-green-400">
                <TrendingUp className="w-3 h-3" />
                <span>+12%</span>
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Users</h3>
              <p className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 dark:from-blue-400 dark:to-cyan-400 bg-clip-text text-transparent">
                {loading ? (
                  <span className="inline-block animate-pulse">...</span>
                ) : (
                  stats.totalUsers.toLocaleString()
                )}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500">Active accounts</p>
            </div>
          </div>
        </div>

        {/* Active Jobs Card */}
        <div className="group relative">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity duration-300" />
          <div className="relative bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-gray-700/30 shadow-xl p-6 hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl shadow-lg">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Jobs</h3>
              <p className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-500 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
                {loading ? (
                  <span className="inline-block animate-pulse">...</span>
                ) : (
                  stats.activeJobs.toLocaleString()
                )}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500">Processing now</p>
            </div>
          </div>
        </div>

        {/* Total Content Card */}
        <div className="group relative">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity duration-300" />
          <div className="relative bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-gray-700/30 shadow-xl p-6 hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl shadow-lg">
                <Database className="w-6 h-6 text-white" />
              </div>
              <div className="flex items-center space-x-1 text-xs font-medium text-green-600 dark:text-green-400">
                <TrendingUp className="w-3 h-3" />
                <span>+8%</span>
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Content</h3>
              <p className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-500 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">
                {loading ? (
                  <span className="inline-block animate-pulse">...</span>
                ) : (
                  stats.totalContent.toLocaleString()
                )}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500">Generated items</p>
            </div>
          </div>
        </div>

        {/* Storage Card */}
        <div className="group relative">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity duration-300" />
          <div className="relative bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-gray-700/30 shadow-xl p-6 hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl shadow-lg">
                <HardDrive className="w-6 h-6 text-white" />
              </div>
              <div className="flex items-center space-x-1">
                <Cloud className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Storage Used</h3>
              <p className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-red-500 dark:from-orange-400 dark:to-red-400 bg-clip-text text-transparent">
                {loading ? (
                  <span className="inline-block animate-pulse">...</span>
                ) : (
                  stats.storageUsed
                )}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500">Cloud storage</p>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Tab Navigation */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 rounded-2xl blur-2xl" />
        <div className="relative bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border border-white/20 dark:border-gray-700/30 rounded-2xl shadow-2xl overflow-hidden">
          {/* Tab Headers */}
          <div className="border-b border-gray-200/50 dark:border-gray-700/30 bg-gradient-to-r from-gray-50/50 to-white/50 dark:from-gray-800/50 dark:to-gray-900/50">
            <nav className="flex space-x-1 px-4 py-2 overflow-x-auto scrollbar-hide" aria-label="Tabs">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      relative group flex items-center space-x-2 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-300 whitespace-nowrap
                      ${isActive
                        ? 'bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 text-white shadow-lg scale-105'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                      }
                    `}
                  >
                    {isActive && (
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-xl blur-lg opacity-50" />
                    )}
                    <Icon className={`w-4 h-4 relative z-10 ${isActive ? 'animate-pulse' : ''}`} />
                    <span className="relative z-10 hidden sm:inline">{tab.label}</span>
                    <span className="relative z-10 sm:hidden">{tab.label.split(' ')[0]}</span>
                    {isActive && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full" />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Tab Content with Animation */}
          <div className="p-6 sm:p-8 animate-fadeIn">
            {renderTabContent()}
          </div>
        </div>
      </div>

      {/* Quick Actions Floating Panel */}
      <div className="fixed bottom-8 right-8 z-40 hidden xl:block">
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity duration-300" />
          <div className="relative bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-gray-700/30 shadow-2xl p-4 space-y-2">
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-3">Quick Actions</p>
            <button className="w-full flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-lg text-sm font-medium transition-all duration-300 shadow-lg hover:shadow-xl active:scale-95">
              <Zap className="w-4 h-4" />
              <span>Run Backup</span>
            </button>
            <button className="w-full flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg text-sm font-medium transition-all duration-300 shadow-lg hover:shadow-xl active:scale-95">
              <Cpu className="w-4 h-4" />
              <span>System Health</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}