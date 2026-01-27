"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Eye,
  Heart,
  MessageCircle,
  Users,
  Video,
  Plus,
  Calendar,
  BarChart3,
  Activity,
  X,
  Save,
  User,
  Info,
} from "lucide-react";
import { format, subDays, startOfWeek, endOfWeek } from "date-fns";
import { useUser } from "@clerk/nextjs";

interface PerformanceTrackerViewProps {
  profileId?: string | null;
}

interface PerformanceMetric {
  id: string;
  date: Date;
  reelsPosted: number;
  storiesPosted: number;
  feedPostsPosted: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalSaves: number;
  storyViews: number;
  storyReplies: number;
  followersStart: number;
  followersEnd: number;
  followersGained: number;
  followersLost: number;
  engagementRate?: number;
  averageViews?: number;
  profileName?: string;
}

interface WeeklySummary {
  reelsPosted: number;
  averageViews: number;
  storyViews: number;
  engagementRate: number;
  followersGained: number;
}

export default function PerformanceTrackerView({ profileId }: PerformanceTrackerViewProps) {
  const { user, isLoaded } = useUser();
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  
  // All Profiles mode
  const isAllProfiles = profileId === "all";
  const [formData, setFormData] = useState({
    reelsPosted: 0,
    storiesPosted: 0,
    feedPostsPosted: 0,
    totalViews: 0,
    totalLikes: 0,
    totalComments: 0,
    totalShares: 0,
    totalSaves: 0,
    storyViews: 0,
    storyReplies: 0,
    followersGained: 0,
    followersLost: 0,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isLoaded || !user) return;
    fetchMetrics();
  }, [isLoaded, user, profileId]);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

      const params = new URLSearchParams({
        startDate: format(weekStart, "yyyy-MM-dd"),
        endDate: format(weekEnd, "yyyy-MM-dd"),
      });
      
      if (profileId) {
        params.append("profileId", profileId);
      }

      const response = await fetch(`/api/instagram/performance?${params}`);
      const data = await response.json();

      if (data.metrics) {
        const metricsData = data.metrics.map((m: any) => ({
          ...m,
          date: new Date(m.date),
        }));
        setMetrics(metricsData);
        calculateWeeklySummary(metricsData);
      }
    } catch (error) {
      console.error("Error fetching metrics:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateWeeklySummary = (metricsData: PerformanceMetric[]) => {
    if (metricsData.length === 0) {
      setWeeklySummary({
        reelsPosted: 0,
        averageViews: 0,
        storyViews: 0,
        engagementRate: 0,
        followersGained: 0,
      });
      return;
    }

    const totals = metricsData.reduce(
      (acc, m) => ({
        reelsPosted: acc.reelsPosted + m.reelsPosted,
        totalViews: acc.totalViews + m.totalViews,
        storyViews: acc.storyViews + m.storyViews,
        totalLikes: acc.totalLikes + m.totalLikes,
        totalComments: acc.totalComments + m.totalComments,
        totalShares: acc.totalShares + m.totalShares,
        followersGained: acc.followersGained + m.followersGained,
      }),
      {
        reelsPosted: 0,
        totalViews: 0,
        storyViews: 0,
        totalLikes: 0,
        totalComments: 0,
        totalShares: 0,
        followersGained: 0,
      }
    );

    const totalContent = metricsData.reduce(
      (acc, m) => acc + m.reelsPosted + m.storiesPosted + m.feedPostsPosted,
      0
    );

    const averageViews = totalContent > 0 ? totals.totalViews / totalContent : 0;

    const totalEngagements =
      totals.totalLikes + totals.totalComments + totals.totalShares;
    const engagementRate =
      totals.totalViews > 0 ? (totalEngagements / totals.totalViews) * 100 : 0;

    setWeeklySummary({
      reelsPosted: totals.reelsPosted,
      averageViews: Math.round(averageViews),
      storyViews: totals.storyViews,
      engagementRate: parseFloat(engagementRate.toFixed(2)),
      followersGained: totals.followersGained,
    });
  };

  const handleSave = async () => {
    try {
      setLoading(true);

      const response = await fetch("/api/instagram/performance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          date: selectedDate,
          profileId: profileId || "",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("API Error:", errorData);
        throw new Error(errorData.error || "Failed to save metrics");
      }

      setShowModal(false);
      fetchMetrics();
      
      // Reset form
      setFormData({
        reelsPosted: 0,
        storiesPosted: 0,
        feedPostsPosted: 0,
        totalViews: 0,
        totalLikes: 0,
        totalComments: 0,
        totalShares: 0,
        totalSaves: 0,
        storyViews: 0,
        storyReplies: 0,
        followersGained: 0,
        followersLost: 0,
      });
    } catch (error: any) {
      console.error("Error saving metrics:", error);
      alert(error.message || "Failed to save metrics. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({
    icon: Icon,
    label,
    value,
    trend,
    color,
  }: {
    icon: any;
    label: string;
    value: string | number;
    trend?: number;
    color: string;
  }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, scale: 1.02 }}
      className="bg-gradient-to-br from-[#1a1a1a] to-[#252525] border-2 border-[#2a2a2a] rounded-2xl p-6 hover:border-blue-500/30 transition-all shadow-xl hover:shadow-2xl hover:shadow-blue-600/10"
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl bg-gradient-to-br from-${color}-600/30 to-${color}-600/10 border border-${color}-500/30`}>
          <Icon className={`w-7 h-7 text-${color}-400`} />
        </div>
        {trend !== undefined && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className={`flex items-center gap-1 text-sm font-semibold px-2 py-1 rounded-lg ${
              trend >= 0 ? "text-green-400 bg-green-600/20" : "text-red-400 bg-red-600/20"
            }`}
          >
            {trend >= 0 ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <TrendingDown className="w-4 h-4" />
            )}
            <span>{Math.abs(trend)}%</span>
          </motion.div>
        )}
      </div>
      <div className="text-4xl font-bold mb-2 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
      <div className="text-sm text-gray-400 font-medium">{label}</div>
    </motion.div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-blue-500/30">
              <Activity className="w-7 h-7 text-blue-400" />
            </div>
            Performance Tracker
            {isAllProfiles && (
              <span className="ml-2 px-3 py-1 bg-pink-600/20 border border-pink-500/30 rounded-full text-sm font-medium text-pink-400 flex items-center gap-1">
                <Users className="w-4 h-4" />
                All Profiles
              </span>
            )}
          </h2>
          <p className="text-gray-400 mt-2">
            Track your weekly Instagram performance metrics
          </p>
        </div>
        {!isAllProfiles && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl transition-all shadow-lg shadow-blue-600/30"
          >
            <Plus className="w-5 h-5" />
            Add Metrics
          </motion.button>
        )}
      </div>

      {/* All Profiles Info Banner */}
      {isAllProfiles && (
        <div className="bg-gradient-to-r from-pink-600/10 via-purple-600/10 to-blue-600/10 border border-pink-500/30 rounded-xl p-4 flex items-center gap-3">
          <Info className="w-5 h-5 text-pink-400 flex-shrink-0" />
          <p className="text-sm text-gray-300">
            <span className="font-medium text-pink-400">All Profiles Mode:</span> Viewing aggregated metrics from all profiles. Select a specific profile to add new metrics.
          </p>
        </div>
      )}

      {/* Weekly Summary Cards */}
      {loading && !weeklySummary ? (
        <div className="text-center py-16">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="inline-block"
          >
            <Activity className="w-12 h-12 text-blue-400" />
          </motion.div>
          <p className="text-gray-400 mt-4">Loading metrics...</p>
        </div>
      ) : weeklySummary ? (
        <>
          <div className="bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-pink-600/20 border-2 border-blue-500/30 rounded-2xl p-6 shadow-xl shadow-blue-600/10">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Calendar className="w-6 h-6 text-blue-400" />
              </div>
              <span className="text-white font-bold text-lg">This Week's Summary</span>
              {isAllProfiles && (
                <span className="px-2 py-1 bg-pink-600/20 rounded-lg text-xs text-pink-400 font-medium">
                  All Profiles Combined
                </span>
              )}
              <span className="text-gray-400">
                {format(startOfWeek(new Date(), { weekStartsOn: 1 }), "MMM d")} -{" "}
                {format(endOfWeek(new Date(), { weekStartsOn: 1 }), "MMM d")}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard
              icon={Video}
              label="Reels Posted This Week"
              value={weeklySummary.reelsPosted}
              color="purple"
            />
            <StatCard
              icon={Eye}
              label="Average Views"
              value={weeklySummary.averageViews}
              color="blue"
            />
            <StatCard
              icon={Activity}
              label="Story Views"
              value={weeklySummary.storyViews}
              color="pink"
            />
            <StatCard
              icon={Heart}
              label="Engagement Rate"
              value={`${weeklySummary.engagementRate}%`}
              color="red"
            />
            <StatCard
              icon={Users}
              label="New Followers"
              value={weeklySummary.followersGained}
              color="green"
            />
          </div>
        </>
      ) : (
        <div className="bg-gradient-to-br from-[#1a1a1a] via-[#1a1a1a] to-blue-950/20 border-2 border-dashed border-[#2a2a2a] rounded-2xl p-16 text-center">
          <motion.div
            animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="inline-block p-6 rounded-3xl bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-blue-500/30 mb-6"
          >
            <BarChart3 className="w-20 h-20 text-blue-400" />
          </motion.div>
          <h3 className="text-2xl font-bold text-white mb-3">
            No metrics yet
          </h3>
          <p className="text-gray-400 mb-8 text-lg">
            {isAllProfiles 
              ? "No performance metrics found for any profile. Select a specific profile to add metrics."
              : "Start tracking your Instagram performance by adding your first metrics"}
          </p>
          {!isAllProfiles && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowModal(true)}
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl transition-all shadow-lg shadow-blue-600/30 font-semibold"
            >
              Add First Metrics
            </motion.button>
          )}
        </div>
      )}

      {/* Daily Metrics Table */}
      {metrics.length > 0 && (
        <div className="bg-gradient-to-br from-[#1a1a1a] to-[#1a1a1a] border-2 border-[#2a2a2a] rounded-2xl overflow-hidden shadow-xl">
          <div className="p-6 border-b-2 border-[#2a2a2a] bg-gradient-to-r from-blue-600/10 to-purple-600/10">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-blue-400" />
              Daily Breakdown
              {isAllProfiles && (
                <span className="ml-2 px-2 py-1 bg-pink-600/20 rounded-lg text-xs text-pink-400 font-medium">
                  All Profiles
                </span>
              )}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-[#2a2a2a] to-[#252525]">
                <tr>
                  {isAllProfiles && (
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-300 uppercase tracking-wider">
                      Profile
                    </th>
                  )}
                  <th className="px-6 py-4 text-left text-sm font-bold text-gray-300 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-gray-300 uppercase tracking-wider">
                    Reels
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-gray-300 uppercase tracking-wider">
                    Stories
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-gray-300 uppercase tracking-wider">
                    Views
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-gray-300 uppercase tracking-wider">
                    Engagement
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-gray-300 uppercase tracking-wider">
                    Followers
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2a2a]">
                {metrics.map((metric) => (
                  <tr key={metric.id} className="hover:bg-gradient-to-r hover:from-blue-600/5 hover:to-purple-600/5 transition-all">
                    {isAllProfiles && (
                      <td className="px-4 py-3 text-sm">
                        <span className="flex items-center gap-1.5 text-pink-400">
                          <User className="w-3.5 h-3.5" />
                          {metric.profileName || "Unknown"}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-3 text-sm text-white">
                      {format(metric.date, "MMM d, yyyy")}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {metric.reelsPosted}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {metric.storiesPosted}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {metric.totalViews.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {metric.engagementRate?.toFixed(2)}%
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`${
                          metric.followersGained >= 0
                            ? "text-green-400"
                            : "text-red-400"
                        }`}
                      >
                        {metric.followersGained >= 0 ? "+" : ""}
                        {metric.followersGained}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Metrics Modal */}
      {showModal && mounted && createPortal(
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="bg-gradient-to-br from-[#1a1a1a] to-[#252525] border-2 border-[#2a2a2a] rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl shadow-blue-600/20"
          >
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-blue-500/30">
                  <BarChart3 className="w-6 h-6 text-blue-400" />
                </div>
                Add Daily Metrics
              </h3>
              <motion.button
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-[#2a2a2a] rounded-xl transition-colors"
              >
                <X className="w-6 h-6 text-gray-400" />
              </motion.button>
            </div>

            <div className="space-y-6">
              {/* Date */}
              <div>
                <label className="block text-sm font-bold text-gray-300 mb-2">
                  📅 Date *
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  max={format(new Date(), "yyyy-MM-dd")}
                  className="w-full px-4 py-3 bg-[#2a2a2a] border-2 border-[#3a3a3a] rounded-xl text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>

              {/* Content Posted */}
              <div>
                <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <Video className="w-4 h-4 text-purple-400" />
                  Content Posted
                </h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-300 mb-2">
                      🎬 Reels
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.reelsPosted}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          reelsPosted: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-full px-4 py-3 bg-[#2a2a2a] border-2 border-[#3a3a3a] rounded-xl text-white focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-300 mb-2">
                      📸 Stories
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.storiesPosted}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          storiesPosted: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-full px-4 py-3 bg-[#2a2a2a] border-2 border-[#3a3a3a] rounded-xl text-white focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-300 mb-2">
                      🖼️ Feed Posts
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.feedPostsPosted}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          feedPostsPosted: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-full px-4 py-3 bg-[#2a2a2a] border-2 border-[#3a3a3a] rounded-xl text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Engagement Metrics */}
              <div>
                <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <Heart className="w-4 h-4 text-red-400" />
                  Engagement Metrics
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-300 mb-2">
                      👁️ Total Views
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.totalViews}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          totalViews: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-full px-4 py-3 bg-[#2a2a2a] border-2 border-[#3a3a3a] rounded-xl text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-300 mb-2">
                      📱 Story Views
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.storyViews}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          storyViews: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-full px-4 py-3 bg-[#2a2a2a] border-2 border-[#3a3a3a] rounded-xl text-white focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-300 mb-2">
                      ❤️ Likes
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.totalLikes}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          totalLikes: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-full px-4 py-3 bg-[#2a2a2a] border-2 border-[#3a3a3a] rounded-xl text-white focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-300 mb-2">
                      💬 Comments
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.totalComments}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          totalComments: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-full px-4 py-3 bg-[#2a2a2a] border-2 border-[#3a3a3a] rounded-xl text-white focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-300 mb-2">
                      🔄 Shares
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.totalShares}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          totalShares: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-full px-4 py-3 bg-[#2a2a2a] border-2 border-[#3a3a3a] rounded-xl text-white focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-300 mb-2">
                      🔖 Saves
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.totalSaves}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          totalSaves: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-full px-4 py-3 bg-[#2a2a2a] border-2 border-[#3a3a3a] rounded-xl text-white focus:outline-none focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/20 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Follower Metrics */}
              <div>
                <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4 text-green-400" />
                  Follower Metrics
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-300 mb-2">
                      ➕ Followers Gained
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.followersGained}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          followersGained: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-full px-4 py-3 bg-[#2a2a2a] border-2 border-[#3a3a3a] rounded-xl text-white focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-300 mb-2">
                      ➖ Followers Lost
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.followersLost}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          followersLost: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-full px-4 py-3 bg-[#2a2a2a] border-2 border-[#3a3a3a] rounded-xl text-white focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4 mt-8 pt-6 border-t-2 border-[#2a2a2a]">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowModal(false)}
                className="flex-1 px-6 py-3 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white rounded-xl transition-all font-semibold"
              >
                Cancel
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSave}
                disabled={loading}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-blue-600/30 font-semibold"
              >
                <Save className="w-5 h-5" />
                {loading ? "Saving..." : "Save Metrics"}
              </motion.button>
            </div>
          </motion.div>
        </div>,
        document.body
      )}
    </div>
  );
}
