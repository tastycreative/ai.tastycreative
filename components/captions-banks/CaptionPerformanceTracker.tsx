"use client";

import { useState } from "react";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Calendar,
  Filter,
} from "lucide-react";

interface CaptionPerformance {
  id: string;
  caption: string;
  platform: string;
  postDate: Date;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  engagementRate: number;
  trend: "up" | "down" | "stable";
}

export function CaptionPerformanceTracker() {
  const [performances, setPerformances] = useState<CaptionPerformance[]>([
    {
      id: "1",
      caption: "Transform your creative vision into reality ✨",
      platform: "Instagram",
      postDate: new Date("2024-01-15"),
      impressions: 5420,
      likes: 342,
      comments: 28,
      shares: 15,
      engagementRate: 7.1,
      trend: "up",
    },
    {
      id: "2",
      caption: "Behind every masterpiece is a story waiting to be told 🎨",
      platform: "Twitter",
      postDate: new Date("2024-01-18"),
      impressions: 3210,
      likes: 189,
      comments: 12,
      shares: 45,
      engagementRate: 7.7,
      trend: "up",
    },
    {
      id: "3",
      caption: "Creating magic one pixel at a time 💫",
      platform: "Instagram",
      postDate: new Date("2024-01-20"),
      impressions: 6890,
      likes: 428,
      comments: 35,
      shares: 22,
      engagementRate: 7.0,
      trend: "down",
    },
  ]);

  const [selectedPlatform, setSelectedPlatform] = useState("All");
  const [sortBy, setSortBy] = useState("date");

  const platforms = ["All", "Instagram", "Twitter", "Facebook", "LinkedIn"];

  const filteredPerformances = performances
    .filter((perf) => selectedPlatform === "All" || perf.platform === selectedPlatform)
    .sort((a, b) => {
      if (sortBy === "date") return b.postDate.getTime() - a.postDate.getTime();
      if (sortBy === "engagement") return b.engagementRate - a.engagementRate;
      if (sortBy === "impressions") return b.impressions - a.impressions;
      return 0;
    });

  const totalImpressions = performances.reduce((sum, perf) => sum + perf.impressions, 0);
  const totalLikes = performances.reduce((sum, perf) => sum + perf.likes, 0);
  const totalComments = performances.reduce((sum, perf) => sum + perf.comments, 0);
  const avgEngagement = (
    performances.reduce((sum, perf) => sum + perf.engagementRate, 0) / performances.length
  ).toFixed(1);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
            Caption Performance Tracker
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Track and analyze the performance of your captions across platforms
          </p>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Impressions</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                {formatNumber(totalImpressions)}
              </p>
            </div>
            <Eye className="w-8 h-8 text-blue-600 dark:text-blue-400 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-900/20 dark:to-pink-800/20 rounded-lg p-4 border border-pink-200 dark:border-pink-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Likes</p>
              <p className="text-2xl font-bold text-pink-600 dark:text-pink-400 mt-1">
                {formatNumber(totalLikes)}
              </p>
            </div>
            <Heart className="w-8 h-8 text-pink-600 dark:text-pink-400 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Comments</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
                {formatNumber(totalComments)}
              </p>
            </div>
            <MessageCircle className="w-8 h-8 text-purple-600 dark:text-purple-400 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Avg Engagement</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                {avgEngagement}%
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-600 dark:text-green-400 opacity-50" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Platform Filter */}
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <label className="text-sm text-gray-700 dark:text-gray-300">Platform:</label>
            <select
              value={selectedPlatform}
              onChange={(e) => setSelectedPlatform(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              {platforms.map((platform) => (
                <option key={platform} value={platform}>
                  {platform}
                </option>
              ))}
            </select>
          </div>

          {/* Sort By */}
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <label className="text-sm text-gray-700 dark:text-gray-300">Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              <option value="date">Date</option>
              <option value="engagement">Engagement Rate</option>
              <option value="impressions">Impressions</option>
            </select>
          </div>
        </div>
      </div>

      {/* Performance List */}
      <div className="space-y-4">
        {filteredPerformances.map((performance) => (
          <div
            key={performance.id}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 sm:p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-300"
          >
            <div className="space-y-4">
              {/* Caption and Platform */}
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex-1">
                  <p className="text-gray-900 dark:text-white font-medium leading-relaxed">
                    {performance.caption}
                  </p>
                  <div className="flex items-center space-x-3 mt-2">
                    <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-full">
                      {performance.platform}
                    </span>
                    <span className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                      <Calendar className="w-3 h-3 mr-1" />
                      {formatDate(performance.postDate)}
                    </span>
                  </div>
                </div>

                {/* Trend Indicator */}
                <div className="flex items-center space-x-2">
                  {performance.trend === "up" && (
                    <div className="flex items-center space-x-1 text-green-600 dark:text-green-400">
                      <TrendingUp className="w-4 h-4" />
                      <span className="text-xs font-medium">Trending</span>
                    </div>
                  )}
                  {performance.trend === "down" && (
                    <div className="flex items-center space-x-1 text-red-600 dark:text-red-400">
                      <TrendingDown className="w-4 h-4" />
                      <span className="text-xs font-medium">Declining</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex flex-col">
                  <span className="text-xs text-gray-500 dark:text-gray-400 mb-1">Impressions</span>
                  <span className="text-lg font-semibold text-gray-900 dark:text-white">
                    {formatNumber(performance.impressions)}
                  </span>
                </div>

                <div className="flex flex-col">
                  <span className="text-xs text-gray-500 dark:text-gray-400 mb-1">Likes</span>
                  <span className="text-lg font-semibold text-pink-600 dark:text-pink-400">
                    {formatNumber(performance.likes)}
                  </span>
                </div>

                <div className="flex flex-col">
                  <span className="text-xs text-gray-500 dark:text-gray-400 mb-1">Comments</span>
                  <span className="text-lg font-semibold text-purple-600 dark:text-purple-400">
                    {formatNumber(performance.comments)}
                  </span>
                </div>

                <div className="flex flex-col">
                  <span className="text-xs text-gray-500 dark:text-gray-400 mb-1">Shares</span>
                  <span className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                    {formatNumber(performance.shares)}
                  </span>
                </div>

                <div className="flex flex-col">
                  <span className="text-xs text-gray-500 dark:text-gray-400 mb-1">Engagement</span>
                  <span className="text-lg font-semibold text-green-600 dark:text-green-400">
                    {performance.engagementRate}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}

        {filteredPerformances.length === 0 && (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-gray-400">No performance data found</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
              Try adjusting your filters
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
