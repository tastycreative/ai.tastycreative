"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { GenerationStats } from "@/components/admin/ai-voice-note-tracker/generation-tracker/GenerationStats";
import { TopActiveUsers } from "@/components/admin/ai-voice-note-tracker/generation-tracker/TopActiveUsers";
import { GenerationsTable } from "@/components/admin/ai-voice-note-tracker/generation-tracker/GenerationsTable";
import {
  TrendingUp,
  RefreshCw,
  Calendar,
  Download,
} from "lucide-react";

export interface GenerationData {
  id: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  voiceAccountId: string;
  voiceName: string;
  text: string;
  characterCount: number;
  modelId: string;
  outputFormat: string;
  audioUrl: string | null;
  audioSize: number | null;
  voiceSettings: Record<string, unknown> | null;
  createdAt: string;
}

export interface GenerationStats {
  totalGenerations: number;
  totalCreditsUsed: number;
  activeUsers: number;
  avgCreditsPerGeneration: number;
  generationsToday: number;
  generationsThisWeek: number;
  generationsThisMonth: number;
}

export interface TopUser {
  userId: string;
  userEmail: string;
  userName: string;
  totalGenerations: number;
  totalCreditsUsed: number;
  lastGenerationAt: string;
}

export interface VoiceModel {
  id: string;
  name: string;
  generationCount: number;
}

export default function GenerationTrackerPage() {
  const params = useParams();
  const tenant = params.tenant as string;
  const [stats, setStats] = useState<GenerationStats | null>(null);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [generations, setGenerations] = useState<GenerationData[]>([]);
  const [voiceModels, setVoiceModels] = useState<VoiceModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [dateRange, setDateRange] = useState<"today" | "week" | "month" | "all">("all");
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [topUsersTimeRange, setTopUsersTimeRange] = useState<"today" | "week" | "month" | "all">("month");

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 20;

  const fetchData = useCallback(async (isRefresh = false) => {
    if (!tenant) return;
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      // Build query params
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", limit.toString());
      if (dateRange !== "all") params.set("dateRange", dateRange);
      if (selectedUser) params.set("userId", selectedUser);
      if (selectedVoice) params.set("voiceAccountId", selectedVoice);
      if (searchQuery) params.set("search", searchQuery);
      params.set("topUsersTimeRange", topUsersTimeRange);

      const response = await fetch(`/api/tenant/${tenant}/ai-voice-generations?${params.toString()}`);
      
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
        setTopUsers(data.topUsers || []);
        setGenerations(data.generations || []);
        setVoiceModels(data.voiceModels || []);
        setTotalPages(data.totalPages || 1);
        setTotalCount(data.totalCount || 0);
      }
    } catch (error) {
      console.error("Error fetching generation data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tenant, page, dateRange, selectedUser, selectedVoice, searchQuery, topUsersTimeRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    fetchData(true);
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      params.set("export", "true");
      if (dateRange !== "all") params.set("dateRange", dateRange);
      if (selectedUser) params.set("userId", selectedUser);
      if (selectedVoice) params.set("voiceAccountId", selectedVoice);
      if (searchQuery) params.set("search", searchQuery);

      const response = await fetch(`/api/tenant/${tenant}/ai-voice-generations?${params.toString()}`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `voice-generations-${new Date().toISOString().split("T")[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error("Error exporting data:", error);
    }
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleFilterChange = () => {
    setPage(1); // Reset to first page when filters change
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gradient-to-br from-green-600 to-emerald-600 rounded-lg shadow-lg">
            <TrendingUp className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Generation Tracker</h1>
            <p className="text-sm text-gray-400">
              Track and analyze AI voice generations across all users
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Date Range Filter */}
          <div className="flex items-center space-x-2 bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <select
              value={dateRange}
              onChange={(e) => {
                setDateRange(e.target.value as typeof dateRange);
                handleFilterChange();
              }}
              className="bg-transparent text-sm text-white border-none focus:outline-none focus:ring-0"
            >
              <option value="all" className="bg-slate-800">All Time</option>
              <option value="today" className="bg-slate-800">Today</option>
              <option value="week" className="bg-slate-800">This Week</option>
              <option value="month" className="bg-slate-800">This Month</option>
            </select>
          </div>

          {/* Export Button */}
          <button
            onClick={handleExport}
            className="flex items-center space-x-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 rounded-lg text-white transition-all duration-200"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-lg text-white transition-all duration-200 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <GenerationStats stats={stats} loading={loading} />

      {/* Top Active Users */}
      <TopActiveUsers 
        users={topUsers} 
        loading={loading}
        timeRange={topUsersTimeRange}
        onTimeRangeChange={(range: "today" | "week" | "month" | "all") => {
          setTopUsersTimeRange(range);
        }}
      />

      {/* Generations Table */}
      <GenerationsTable
        generations={generations}
        loading={loading}
        voiceModels={voiceModels}
        selectedUser={selectedUser}
        selectedVoice={selectedVoice}
        searchQuery={searchQuery}
        onUserChange={(user: string) => {
          setSelectedUser(user);
          handleFilterChange();
        }}
        onVoiceChange={(voice: string) => {
          setSelectedVoice(voice);
          handleFilterChange();
        }}
        onSearchChange={setSearchQuery}
        onSearch={() => {
          handleFilterChange();
          fetchData();
        }}
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        onPageChange={handlePageChange}
      />
    </div>
  );
}
