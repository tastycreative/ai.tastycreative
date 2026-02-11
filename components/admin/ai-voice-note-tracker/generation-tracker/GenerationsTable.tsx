"use client";

import { useState, useRef, useEffect } from "react";
import {
  Search,
  Filter,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  User,
  Mic,
  FileText,
  Clock,
  Play,
  Pause,
  X,
  Eye,
} from "lucide-react";

interface GenerationData {
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

interface VoiceModel {
  id: string;
  name: string;
  generationCount: number;
}

interface GenerationsTableProps {
  generations: GenerationData[];
  loading: boolean;
  voiceModels: VoiceModel[];
  selectedUser: string;
  selectedVoice: string;
  searchQuery: string;
  onUserChange: (userId: string) => void;
  onVoiceChange: (voiceId: string) => void;
  onSearchChange: (query: string) => void;
  onSearch: () => void;
  page: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (page: number) => void;
}

export function GenerationsTable({
  generations,
  loading,
  voiceModels,
  selectedUser,
  selectedVoice,
  searchQuery,
  onUserChange,
  onVoiceChange,
  onSearchChange,
  onSearch,
  page,
  totalPages,
  totalCount,
  onPageChange,
}: GenerationsTableProps) {
  const [isVoiceDropdownOpen, setIsVoiceDropdownOpen] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [expandedText, setExpandedText] = useState<string | null>(null);
  const voiceDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        voiceDropdownRef.current &&
        !voiceDropdownRef.current.contains(e.target as Node)
      ) {
        setIsVoiceDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const truncateText = (text: string, maxLength: number = 80) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  const handlePlayAudio = async (generation: GenerationData) => {
    if (!generation.audioUrl) return;

    if (playingId === generation.id) {
      audioElement?.pause();
      setPlayingId(null);
      setAudioElement(null);
    } else {
      audioElement?.pause();

      const audio = new Audio(generation.audioUrl);
      audio.onended = () => {
        setPlayingId(null);
        setAudioElement(null);
      };
      audio.onerror = () => {
        setPlayingId(null);
        setAudioElement(null);
      };
      audio.play();
      setPlayingId(generation.id);
      setAudioElement(audio);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      onSearch();
    }
  };

  const clearFilters = () => {
    onUserChange("");
    onVoiceChange("");
    onSearchChange("");
    onSearch();
  };

  const hasActiveFilters = selectedUser || selectedVoice || searchQuery;

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-6 border-b border-border">
          <div className="flex items-center space-x-4">
            <div className="h-10 w-64 bg-muted rounded-lg animate-pulse" />
            <div className="h-10 w-40 bg-muted rounded-lg animate-pulse" />
          </div>
        </div>
        <div className="p-6 space-y-4">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-16 bg-muted rounded-lg animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header with filters */}
      <div className="p-6 border-b border-border">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center space-x-3">
            <FileText className="h-5 w-5 text-brand-mid-pink" />
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                All Generations
              </h2>
              <p className="text-xs text-muted-foreground">
                {totalCount.toLocaleString()} total generations
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search text or voice..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-mid-pink focus:border-brand-mid-pink"
              />
            </div>

            {/* User Filter */}
            <div className="relative min-w-[180px]">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Filter by User ID..."
                value={selectedUser}
                onChange={(e) => onUserChange(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-mid-pink focus:border-brand-mid-pink"
              />
            </div>

            {/* Voice Filter */}
            <div className="relative" ref={voiceDropdownRef}>
              <button
                onClick={() => setIsVoiceDropdownOpen(!isVoiceDropdownOpen)}
                className="flex items-center space-x-2 px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground hover:bg-muted/80 transition-colors"
              >
                <Mic className="h-4 w-4 text-muted-foreground" />
                <span className="max-w-[120px] truncate">
                  {selectedVoice
                    ? voiceModels.find((v) => v.id === selectedVoice)?.name ||
                      "Unknown Voice"
                    : "All Voices"}
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform ${
                    isVoiceDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isVoiceDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 max-h-72 overflow-y-auto bg-card border border-border rounded-lg shadow-xl z-20">
                  <button
                    onClick={() => {
                      onVoiceChange("");
                      setIsVoiceDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-muted transition-colors ${
                      !selectedVoice ? "text-brand-mid-pink bg-muted" : "text-foreground"
                    }`}
                  >
                    All Voices
                  </button>
                  {voiceModels.map((voice) => (
                    <button
                      key={voice.id}
                      onClick={() => {
                        onVoiceChange(voice.id);
                        setIsVoiceDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-muted transition-colors flex items-center justify-between ${
                        selectedVoice === voice.id
                          ? "text-brand-mid-pink bg-muted"
                          : "text-foreground"
                      }`}
                    >
                      <span className="truncate">{voice.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {voice.generationCount}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Search Button */}
            <button
              onClick={onSearch}
              className="px-4 py-2 bg-gradient-to-r from-brand-blue to-brand-mid-pink hover:from-brand-blue/90 hover:to-brand-mid-pink/90 rounded-lg text-sm text-white font-medium transition-all shadow-lg shadow-brand-blue/25"
            >
              Search
            </button>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center space-x-1 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-sm text-red-500 transition-colors"
              >
                <X className="h-4 w-4" />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-muted border-b border-border">
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                User
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Voice
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Text
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Credits
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Model
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {generations.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-foreground">No generations found</p>
                  <p className="text-sm text-muted-foreground">
                    Try adjusting your filters
                  </p>
                </td>
              </tr>
            ) : (
              generations.map((generation) => (
                <tr
                  key={generation.id}
                  className="hover:bg-muted transition-colors"
                >
                  {/* User */}
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-brand-blue to-brand-mid-pink rounded-full flex items-center justify-center flex-shrink-0 shadow-lg shadow-brand-blue/25">
                        <span className="text-white text-xs font-semibold">
                          {generation.userName?.charAt(0)?.toUpperCase() || "?"}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate max-w-[120px]">
                          {generation.userName || "Unknown"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate max-w-[120px]">
                          {generation.userEmail || generation.userId}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Voice */}
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-2">
                      <Mic className="h-4 w-4 text-brand-mid-pink flex-shrink-0" />
                      <span className="text-sm text-foreground truncate max-w-[100px]">
                        {generation.voiceName}
                      </span>
                    </div>
                  </td>

                  {/* Text */}
                  <td className="px-4 py-3">
                    <div className="max-w-xs">
                      <p className="text-sm text-foreground truncate">
                        {truncateText(generation.text, 60)}
                      </p>
                      {generation.text.length > 60 && (
                        <button
                          onClick={() =>
                            setExpandedText(
                              expandedText === generation.id
                                ? null
                                : generation.id
                            )
                          }
                          className="text-xs text-brand-mid-pink hover:text-brand-light-pink mt-1"
                        >
                          {expandedText === generation.id
                            ? "Show less"
                            : "Show more"}
                        </button>
                      )}
                      {expandedText === generation.id && (
                        <div className="mt-2 p-2 bg-muted rounded-lg">
                          <p className="text-sm text-foreground whitespace-pre-wrap">
                            {generation.text}
                          </p>
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Credits */}
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-yellow-400">
                      {generation.characterCount.toLocaleString()}
                    </span>
                  </td>

                  {/* Model */}
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-1 bg-purple-500/20 text-purple-400 rounded-full">
                      {generation.modelId.replace("eleven_", "")}
                    </span>
                  </td>

                  {/* Date */}
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{formatDate(generation.createdAt)}</span>
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-2">
                      {generation.audioUrl && (
                        <button
                          onClick={() => handlePlayAudio(generation)}
                          className="p-2 hover:bg-muted rounded-lg transition-colors"
                          title={
                            playingId === generation.id ? "Pause" : "Play"
                          }
                        >
                          {playingId === generation.id ? (
                            <Pause className="h-4 w-4 text-brand-mid-pink" />
                          ) : (
                            <Play className="h-4 w-4 text-muted-foreground hover:text-brand-mid-pink" />
                          )}
                        </button>
                      )}
                      <button
                        onClick={() =>
                          setExpandedText(
                            expandedText === generation.id
                              ? null
                              : generation.id
                          )
                        }
                        className="p-2 hover:bg-muted rounded-lg transition-colors"
                        title="View details"
                      >
                        <Eye className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-4 border-t border-border flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * 20 + 1} -{" "}
            {Math.min(page * 20, totalCount)} of {totalCount.toLocaleString()}
          </p>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="p-2 hover:bg-muted rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-5 w-5 text-muted-foreground" />
            </button>

            <div className="flex items-center space-x-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => onPageChange(pageNum)}
                    className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                      page === pageNum
                        ? "bg-brand-mid-pink text-white shadow-lg shadow-brand-mid-pink/25"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="p-2 hover:bg-muted rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
