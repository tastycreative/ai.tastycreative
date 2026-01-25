"use client";

import { useState, useEffect, useCallback } from "react";
import { AIVoiceAccountsTable } from "@/components/admin/ai-voice-note-tracker/ai-voice-accounts/AIVoiceAccountsTable";
import { AddVoiceModal } from "@/components/admin/ai-voice-note-tracker/ai-voice-accounts/AddVoiceModal";
import { VoiceDetailsModal } from "@/components/admin/ai-voice-note-tracker/ai-voice-accounts/VoiceDetailsModal";
import { 
  Mic, 
  Plus, 
  RefreshCw, 
  Search,
  Volume2 
} from "lucide-react";

interface AIVoiceAccount {
  id: string;
  name: string;
  description: string | null;
  elevenlabsVoiceId: string;
  elevenlabsApiKey: string | null;
  previewUrl: string | null;
  category: string | null;
  gender: string | null;
  age: string | null;
  accent: string | null;
  language: string | null;
  labels: Record<string, string> | null;
  settings: Record<string, unknown> | null;
  isActive: boolean;
  usageCount: number;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export default function AIVoiceAccountsPage() {
  const [voices, setVoices] = useState<AIVoiceAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<AIVoiceAccount | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  const fetchVoices = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/ai-voice-accounts");
      if (response.ok) {
        const data = await response.json();
        setVoices(data.voices || []);
      }
    } catch (error) {
      console.error("Error fetching voices:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVoices();
  }, [fetchVoices]);

  const handleAddVoice = async (voiceData: {
    elevenlabsVoiceId: string;
    name?: string;
    description?: string;
    customApiKey?: string;
  }) => {
    try {
      const response = await fetch("/api/admin/ai-voice-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(voiceData),
      });

      if (response.ok) {
        await fetchVoices();
        setIsAddModalOpen(false);
        return { success: true };
      } else {
        const data = await response.json();
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error("Error adding voice:", error);
      return { success: false, error: "Failed to add voice" };
    }
  };

  const handleDeleteVoice = async (id: string) => {
    if (!confirm("Are you sure you want to delete this voice account?")) return;

    try {
      const response = await fetch(`/api/admin/ai-voice-accounts?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchVoices();
      }
    } catch (error) {
      console.error("Error deleting voice:", error);
    }
  };

  const handleToggleActive = async (voice: AIVoiceAccount) => {
    try {
      const response = await fetch("/api/admin/ai-voice-accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: voice.id,
          isActive: !voice.isActive,
        }),
      });

      if (response.ok) {
        await fetchVoices();
      }
    } catch (error) {
      console.error("Error toggling voice status:", error);
    }
  };

  const handleViewDetails = (voice: AIVoiceAccount) => {
    setSelectedVoice(voice);
    setIsDetailsModalOpen(true);
  };

  const filteredVoices = voices.filter(
    (voice) =>
      voice.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      voice.elevenlabsVoiceId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      voice.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      voice.gender?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-gradient-to-br from-red-600 via-orange-600 to-yellow-600 rounded-xl shadow-lg">
            <Mic className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">AI Voice Accounts</h1>
            <p className="text-sm text-gray-400">
              Manage your ElevenLabs AI voice accounts
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white rounded-lg transition-all duration-300 shadow-lg hover:shadow-red-500/25"
        >
          <Plus className="h-5 w-5" />
          <span>Add Voice</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total Voices</p>
              <p className="text-2xl font-bold text-white">{voices.length}</p>
            </div>
            <div className="p-3 bg-blue-500/20 rounded-lg">
              <Volume2 className="h-6 w-6 text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Active Voices</p>
              <p className="text-2xl font-bold text-green-400">
                {voices.filter((v) => v.isActive).length}
              </p>
            </div>
            <div className="p-3 bg-green-500/20 rounded-lg">
              <Mic className="h-6 w-6 text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Inactive Voices</p>
              <p className="text-2xl font-bold text-red-400">
                {voices.filter((v) => !v.isActive).length}
              </p>
            </div>
            <div className="p-3 bg-red-500/20 rounded-lg">
              <Mic className="h-6 w-6 text-red-400" />
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total Usage</p>
              <p className="text-2xl font-bold text-orange-400">
                {voices.reduce((acc, v) => acc + v.usageCount, 0)}
              </p>
            </div>
            <div className="p-3 bg-orange-500/20 rounded-lg">
              <RefreshCw className="h-6 w-6 text-orange-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search voices by name, ID, category, or gender..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50"
          />
        </div>

        <button
          onClick={fetchVoices}
          className="flex items-center space-x-2 px-4 py-2.5 bg-slate-800/50 border border-slate-700/50 hover:bg-slate-700/50 text-gray-300 rounded-lg transition-all duration-300"
        >
          <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Table */}
      <AIVoiceAccountsTable
        voices={filteredVoices}
        loading={loading}
        onDelete={handleDeleteVoice}
        onToggleActive={handleToggleActive}
        onViewDetails={handleViewDetails}
      />

      {/* Add Voice Modal */}
      <AddVoiceModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddVoice}
      />

      {/* Voice Details Modal */}
      <VoiceDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedVoice(null);
        }}
        voice={selectedVoice}
      />
    </div>
  );
}
