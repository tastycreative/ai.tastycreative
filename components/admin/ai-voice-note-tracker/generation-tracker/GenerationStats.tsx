"use client";

import {
  TrendingUp,
  Zap,
  Users,
  Calculator,
  Calendar,
  CalendarDays,
  CalendarRange,
} from "lucide-react";

interface StatsData {
  totalGenerations: number;
  totalCreditsUsed: number;
  activeUsers: number;
  avgCreditsPerGeneration: number;
  generationsToday: number;
  generationsThisWeek: number;
  generationsThisMonth: number;
}

interface GenerationStatsProps {
  stats: StatsData | null;
  loading: boolean;
}

export function GenerationStats({ stats, loading }: GenerationStatsProps) {
  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + "M";
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + "K";
    }
    return num.toLocaleString();
  };

  const statCards = [
    {
      name: "Total Generations",
      value: stats?.totalGenerations || 0,
      icon: TrendingUp,
      gradient: "from-blue-600 to-cyan-600",
      bgGlow: "bg-blue-500/10",
      description: "All time",
    },
    {
      name: "Total Credits Used",
      value: stats?.totalCreditsUsed || 0,
      icon: Zap,
      gradient: "from-yellow-600 to-orange-600",
      bgGlow: "bg-yellow-500/10",
      description: "Characters generated",
    },
    {
      name: "Active Users",
      value: stats?.activeUsers || 0,
      icon: Users,
      gradient: "from-green-600 to-emerald-600",
      bgGlow: "bg-green-500/10",
      description: "Users with generations",
    },
    {
      name: "Avg Credits/Generation",
      value: stats?.avgCreditsPerGeneration || 0,
      icon: Calculator,
      gradient: "from-purple-600 to-pink-600",
      bgGlow: "bg-purple-500/10",
      description: "Average characters",
    },
    {
      name: "Today",
      value: stats?.generationsToday || 0,
      icon: Calendar,
      gradient: "from-red-600 to-rose-600",
      bgGlow: "bg-red-500/10",
      description: "Generations today",
    },
    {
      name: "This Week",
      value: stats?.generationsThisWeek || 0,
      icon: CalendarDays,
      gradient: "from-indigo-600 to-violet-600",
      bgGlow: "bg-indigo-500/10",
      description: "Last 7 days",
    },
    {
      name: "This Month",
      value: stats?.generationsThisMonth || 0,
      icon: CalendarRange,
      gradient: "from-teal-600 to-cyan-600",
      bgGlow: "bg-teal-500/10",
      description: "Last 30 days",
    },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {[...Array(7)].map((_, i) => (
          <div
            key={i}
            className="bg-muted border border-border rounded-xl p-4 animate-pulse"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-muted rounded-lg" />
              <div className="flex-1">
                <div className="h-3 w-16 bg-muted rounded mb-2" />
                <div className="h-6 w-12 bg-muted rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
      {statCards.map((stat) => (
        <div
          key={stat.name}
          className={`relative overflow-hidden bg-card border border-border rounded-xl p-4 hover:border-brand-mid-pink/50 transition-all group`}
        >
          {/* Background glow effect */}
          <div
            className={`absolute inset-0 ${stat.bgGlow} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
          />

          <div className="relative z-10">
            <div className="flex items-center space-x-3">
              <div
                className={`p-2 bg-gradient-to-br ${stat.gradient} rounded-lg shadow-lg`}
              >
                <stat.icon className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground truncate">{stat.name}</p>
                <p className="text-xl font-bold text-foreground">
                  {formatNumber(stat.value)}
                </p>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{stat.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
