"use client";

import { useState } from "react";
import {
  Trophy,
  User,
  Zap,
  Clock,
  ChevronDown,
  Medal,
} from "lucide-react";

interface TopUser {
  userId: string;
  userEmail: string;
  userName: string;
  totalGenerations: number;
  totalCreditsUsed: number;
  lastGenerationAt: string;
}

interface TopActiveUsersProps {
  users: TopUser[];
  loading: boolean;
  timeRange: "today" | "week" | "month" | "all";
  onTimeRangeChange: (range: "today" | "week" | "month" | "all") => void;
}

export function TopActiveUsers({
  users,
  loading,
  timeRange,
  onTimeRangeChange,
}: TopActiveUsersProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + "M";
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + "K";
    }
    return num.toLocaleString();
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const getMedalColor = (index: number) => {
    switch (index) {
      case 0:
        return "text-yellow-400";
      case 1:
        return "text-gray-300";
      case 2:
        return "text-amber-600";
      default:
        return "text-slate-500";
    }
  };

  const getRowHighlight = (index: number) => {
    switch (index) {
      case 0:
        return "bg-yellow-500/5 border-yellow-500/30";
      case 1:
        return "bg-gray-400/5 border-gray-400/30";
      case 2:
        return "bg-amber-600/5 border-amber-600/30";
      default:
        return "border-border";
    }
  };

  const timeRangeLabels = {
    today: "Today",
    week: "This Week",
    month: "This Month",
    all: "All Time",
  };

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-muted rounded-lg w-9 h-9 animate-pulse" />
            <div className="h-5 w-40 bg-muted rounded animate-pulse" />
          </div>
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="flex items-center space-x-4 p-3 bg-muted rounded-lg animate-pulse"
            >
              <div className="w-8 h-8 bg-muted rounded-full" />
              <div className="flex-1">
                <div className="h-4 w-32 bg-muted rounded mb-2" />
                <div className="h-3 w-24 bg-muted rounded" />
              </div>
              <div className="h-4 w-16 bg-muted rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gradient-to-br from-brand-blue to-brand-mid-pink rounded-lg shadow-lg">
            <Trophy className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Top 5 Most Active Users
            </h2>
            <p className="text-xs text-muted-foreground">
              Ranked by number of generations
            </p>
          </div>
        </div>

        {/* Time Range Filter */}
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center space-x-2 px-3 py-2 bg-muted hover:bg-muted/80 border border-border rounded-lg text-sm text-foreground transition-all"
          >
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>{timeRangeLabels[timeRange]}</span>
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                isDropdownOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-40 bg-card border border-border rounded-lg shadow-xl z-10">
              {(["today", "week", "month", "all"] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => {
                    onTimeRangeChange(range);
                    setIsDropdownOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-muted transition-colors ${
                    timeRange === range
                      ? "text-brand-mid-pink bg-muted"
                      : "text-foreground"
                  } ${range === "today" ? "rounded-t-lg" : ""} ${
                    range === "all" ? "rounded-b-lg" : ""
                  }`}
                >
                  {timeRangeLabels[range]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Users List */}
      {users.length === 0 ? (
        <div className="text-center py-8">
          <User className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-foreground">No generation data available</p>
          <p className="text-sm text-muted-foreground">
            Users will appear here once they start generating
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((user, index) => (
            <div
              key={user.userId}
              className={`flex items-center space-x-4 p-4 border rounded-lg transition-all hover:bg-muted ${getRowHighlight(
                index
              )}`}
            >
              {/* Rank */}
              <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
                {index < 3 ? (
                  <Medal className={`h-6 w-6 ${getMedalColor(index)}`} />
                ) : (
                  <span className="text-lg font-bold text-muted-foreground">
                    {index + 1}
                  </span>
                )}
              </div>

              {/* User Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-brand-blue to-brand-mid-pink rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm font-semibold">
                      {user.userName?.charAt(0)?.toUpperCase() || "?"}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {user.userName || "Unknown User"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {user.userEmail || "No email"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center space-x-6 text-right">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {formatNumber(user.totalGenerations)}
                  </p>
                  <p className="text-xs text-muted-foreground">generations</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-yellow-500">
                    {formatNumber(user.totalCreditsUsed)}
                  </p>
                  <p className="text-xs text-muted-foreground">credits</p>
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm text-foreground">
                    {formatDate(user.lastGenerationAt)}
                  </p>
                  <p className="text-xs text-muted-foreground">last active</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
