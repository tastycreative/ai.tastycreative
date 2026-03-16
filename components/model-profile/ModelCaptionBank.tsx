"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Search,
  X,
  TrendingUp,
  DollarSign,
  Tag,
  MessageSquare,
  Filter,
  Copy,
  Check,
  Folder,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface GalleryCaption {
  id: string;
  captionUsed: string;
  contentType: string | null;
  platform: string | null;
  postOrigin: string | null;
  pricingTier: string | null;
  title: string | null;
  tags: string[] | null;
  revenue: number | null;
  salesCount: number | null;
  postedAt: string | null;
  createdAt: string;
  profileId: string | null;
  profile: { id: string; name: string; profileImageUrl: string | null } | null;
}

interface ModelCaptionBankProps {
  profileId: string;
  profileName: string;
}

function getCategoryStyle(category: string) {
  const hash = category.split("").reduce((a, b) => a + b.charCodeAt(0), 0);
  const variants = [
    { bg: "bg-brand-light-pink/10 dark:bg-brand-light-pink/15", text: "text-brand-light-pink", border: "border-brand-light-pink/25" },
    { bg: "bg-brand-blue/10 dark:bg-brand-blue/15", text: "text-brand-blue", border: "border-brand-blue/25" },
    { bg: "bg-brand-mid-pink/10 dark:bg-brand-mid-pink/15", text: "text-brand-mid-pink", border: "border-brand-mid-pink/25" },
    { bg: "bg-brand-dark-pink/10 dark:bg-brand-dark-pink/15", text: "text-brand-dark-pink", border: "border-brand-dark-pink/25" },
    { bg: "bg-emerald-500/10 dark:bg-emerald-500/15", text: "text-emerald-500 dark:text-emerald-400", border: "border-emerald-500/25" },
    { bg: "bg-amber-500/10 dark:bg-amber-500/15", text: "text-amber-500 dark:text-amber-400", border: "border-amber-500/25" },
  ];
  return variants[hash % variants.length];
}

export function ModelCaptionBank({
  profileId,
  profileName,
}: ModelCaptionBankProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContentType, setSelectedContentType] = useState("all");
  const [selectedPlatform, setSelectedPlatform] = useState("all");
  const [selectedPostOrigin, setSelectedPostOrigin] = useState("all");
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [viewingCaption, setViewingCaption] = useState<GalleryCaption | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  // Data state
  const [captions, setCaptions] = useState<GalleryCaption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dynamicContentTypes, setDynamicContentTypes] = useState<string[]>([]);
  const [dynamicPlatforms, setDynamicPlatforms] = useState<string[]>([]);
  const [dynamicPostOrigins, setDynamicPostOrigins] = useState<string[]>([]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (showDetailModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [showDetailModal]);

  const fetchCaptions = useCallback(async () => {
    if (!profileId) return;
    try {
      setLoading(true);
      const params = new URLSearchParams({
        profileId,
        sortBy: "postedAt",
        sortOrder: "desc",
        pageSize: "500",
      });
      const response = await fetch(`/api/gallery/captions?${params}`);
      if (response.ok) {
        const data = await response.json();
        setCaptions(data.captions || []);
        if (data.filters) {
          setDynamicContentTypes(data.filters.contentTypes || []);
          setDynamicPlatforms(data.filters.platforms || []);
          setDynamicPostOrigins(data.filters.postOrigins || []);
        }
      }
    } catch (error) {
      console.error("Failed to fetch gallery captions:", error);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    fetchCaptions();
  }, [fetchCaptions]);

  const filteredCaptions = useMemo(() => {
    return captions.filter((c) => {
      const matchesSearch =
        !searchQuery ||
        c.captionUsed?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.title?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesContentType =
        selectedContentType === "all" || c.contentType === selectedContentType;
      const matchesPlatform =
        selectedPlatform === "all" || c.platform === selectedPlatform;
      const matchesPostOrigin =
        selectedPostOrigin === "all" || c.postOrigin === selectedPostOrigin;
      return matchesSearch && matchesContentType && matchesPlatform && matchesPostOrigin;
    });
  }, [captions, searchQuery, selectedContentType, selectedPlatform, selectedPostOrigin]);

  const analytics = useMemo(() => {
    const totalCaptions = filteredCaptions.length;
    const totalSales = filteredCaptions.reduce(
      (sum, c) => sum + (c.salesCount || 0),
      0,
    );
    const totalRevenue = filteredCaptions.reduce(
      (sum, c) => sum + (c.revenue || 0),
      0,
    );
    const avgRevenuePerCaption =
      totalCaptions > 0 ? totalRevenue / totalCaptions : 0;
    return { totalCaptions, totalSales, totalRevenue, avgRevenuePerCaption };
  }, [filteredCaptions]);

  const handleCopyCaption = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  const openDetailModal = (caption: GalleryCaption) => {
    setViewingCaption(caption);
    setShowDetailModal(true);
  };

  const toggleExpand = (id: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isLongCaption = (text: string) =>
    text.length > 220 || text.split("\n").length > 4;

  const activeFilterCount = [
    selectedContentType !== "all",
    selectedPlatform !== "all",
    selectedPostOrigin !== "all",
  ].filter(Boolean).length;

  return (
    <div className="min-h-[40vh] bg-white dark:bg-[#0a0a0f] border border-gray-200 dark:border-brand-mid-pink/15 rounded-2xl overflow-hidden">
      {/* Vault Header + Analytics */}
      <div className="px-6 sm:px-8 pt-8 pb-6 border-b border-gray-100 dark:border-white/[0.06]">
        <p className="font-mono text-[11px] tracking-[0.2em] text-brand-light-pink uppercase mb-1">
          caption vault
        </p>
        <h2 className="text-[24px] sm:text-[28px] font-extrabold tracking-tight text-gray-900 dark:text-brand-off-white leading-none">
          {profileName}
        </h2>

        {/* Analytics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          <div className="bg-gray-50/80 dark:bg-white/[0.03] rounded-xl p-4 border border-gray-100 dark:border-white/[0.06]">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-3.5 h-3.5 text-brand-light-pink" />
              <span className="font-mono text-[10px] tracking-[0.1em] text-gray-500 dark:text-gray-500 uppercase">
                Captions
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-brand-off-white">
              {analytics.totalCaptions}
            </p>
          </div>

          <div className="bg-gray-50/80 dark:bg-white/[0.03] rounded-xl p-4 border border-gray-100 dark:border-white/[0.06]">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-3.5 h-3.5 text-brand-blue" />
              <span className="font-mono text-[10px] tracking-[0.1em] text-gray-500 dark:text-gray-500 uppercase">
                Sales
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-brand-off-white">
              {analytics.totalSales}
            </p>
          </div>

          <div className="bg-gray-50/80 dark:bg-white/[0.03] rounded-xl p-4 border border-gray-100 dark:border-white/[0.06]">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-3.5 h-3.5 text-brand-mid-pink" />
              <span className="font-mono text-[10px] tracking-[0.1em] text-gray-500 dark:text-gray-500 uppercase">
                Revenue
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-brand-off-white">
              {formatCurrency(analytics.totalRevenue)}
            </p>
          </div>

          <div className="bg-gray-50/80 dark:bg-white/[0.03] rounded-xl p-4 border border-gray-100 dark:border-white/[0.06]">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-3.5 h-3.5 text-brand-light-pink" />
              <span className="font-mono text-[10px] tracking-[0.1em] text-gray-500 dark:text-gray-500 uppercase">
                Avg/Caption
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-brand-off-white">
              {formatCurrency(analytics.avgRevenuePerCaption)}
            </p>
          </div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="px-6 sm:px-8 py-4 border-b border-gray-100 dark:border-white/[0.06]">
        <div className="flex gap-3 flex-wrap items-center">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
            <input
              type="text"
              placeholder="search captions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-lg text-gray-900 dark:text-brand-off-white font-mono text-[13px] py-2.5 pl-9 pr-3 outline-none transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:border-brand-light-pink/50 dark:focus:border-brand-light-pink/40"
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`h-10 px-4 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
              showFilters || activeFilterCount > 0
                ? "bg-brand-light-pink/10 dark:bg-brand-light-pink/15 text-brand-light-pink border border-brand-light-pink/30"
                : "bg-gray-50 dark:bg-white/[0.04] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-white/[0.08] hover:bg-gray-100 dark:hover:bg-white/[0.08]"
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="w-5 h-5 bg-brand-light-pink text-white text-xs rounded-full flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/[0.06]">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-mono text-[11px] tracking-[0.12em] text-gray-500 dark:text-gray-500 uppercase mb-2">
                  Content Type
                </label>
                <select
                  value={selectedContentType}
                  onChange={(e) => setSelectedContentType(e.target.value)}
                  className="w-full h-10 px-3 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-lg text-sm text-gray-900 dark:text-brand-off-white focus:outline-none focus:border-brand-light-pink/50"
                >
                  <option value="all">All Content Types</option>
                  {dynamicContentTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-mono text-[11px] tracking-[0.12em] text-gray-500 dark:text-gray-500 uppercase mb-2">
                  Platform
                </label>
                <select
                  value={selectedPlatform}
                  onChange={(e) => setSelectedPlatform(e.target.value)}
                  className="w-full h-10 px-3 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-lg text-sm text-gray-900 dark:text-brand-off-white focus:outline-none focus:border-brand-light-pink/50"
                >
                  <option value="all">All Platforms</option>
                  {dynamicPlatforms.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-mono text-[11px] tracking-[0.12em] text-gray-500 dark:text-gray-500 uppercase mb-2">
                  Post Origin
                </label>
                <select
                  value={selectedPostOrigin}
                  onChange={(e) => setSelectedPostOrigin(e.target.value)}
                  className="w-full h-10 px-3 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-lg text-sm text-gray-900 dark:text-brand-off-white focus:outline-none focus:border-brand-light-pink/50"
                >
                  <option value="all">All Origins</option>
                  {dynamicPostOrigins.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {activeFilterCount > 0 && (
              <button
                onClick={() => {
                  setSelectedContentType("all");
                  setSelectedPlatform("all");
                  setSelectedPostOrigin("all");
                }}
                className="mt-3 text-sm font-mono text-brand-light-pink hover:text-brand-mid-pink transition-colors tracking-wide"
              >
                clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Stats Bar */}
      <div className="px-6 sm:px-8 pt-4 flex gap-6 flex-wrap">
        <span className="font-mono text-[11px] tracking-[0.08em] text-gray-400 dark:text-gray-600">
          <span className="text-gray-600 dark:text-gray-400">
            {filteredCaptions.length}
          </span>{" "}
          caption{filteredCaptions.length !== 1 ? "s" : ""} from gallery
        </span>
        {analytics.totalSales > 0 && (
          <span className="font-mono text-[11px] tracking-[0.08em] text-gray-400 dark:text-gray-600">
            <span className="text-gray-600 dark:text-gray-400">
              {analytics.totalSales}
            </span>{" "}
            sales
          </span>
        )}
      </div>

      {/* Content Grid */}
      <div className="px-6 sm:px-8 py-5">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-brand-light-pink/30 border-t-brand-light-pink rounded-full animate-spin" />
          </div>
        ) : filteredCaptions.length === 0 ? (
          <div className="text-center py-16 font-mono text-[13px] tracking-[0.05em] text-gray-400 dark:text-gray-600">
            {searchQuery || activeFilterCount > 0
              ? "no captions match your filters"
              : "no gallery items with captions found"}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredCaptions.map((caption) => {
              const catStyle = caption.contentType
                ? getCategoryStyle(caption.contentType)
                : null;
              const long = isLongCaption(caption.captionUsed);
              const expanded = expandedCards.has(caption.id);

              return (
                <div
                  key={caption.id}
                  className="group bg-gray-50/50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.06] rounded-[14px] p-5 flex flex-col gap-3.5 transition-all duration-200 hover:border-gray-300 dark:hover:border-white/[0.12] hover:-translate-y-0.5 relative overflow-hidden cursor-pointer"
                  onClick={() => openDetailModal(caption)}
                >
                  <div className="absolute top-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-brand-light-pink to-brand-mid-pink" />

                  {/* Caption Text */}
                  <div
                    className={`font-mono text-[13px] leading-[1.75] text-gray-600 dark:text-gray-300 font-light italic whitespace-pre-wrap break-words ${
                      long && !expanded ? "line-clamp-4" : ""
                    }`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {caption.captionUsed}
                  </div>

                  {long && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(caption.id);
                      }}
                      className="font-mono text-[11px] text-brand-light-pink hover:text-brand-mid-pink transition-colors tracking-[0.05em] text-left flex items-center gap-1"
                    >
                      {expanded ? (
                        <>
                          <ChevronUp className="w-3 h-3" /> show less
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3 h-3" /> show more
                        </>
                      )}
                    </button>
                  )}

                  {/* Tags + Copy */}
                  <div className="flex items-center justify-between gap-2 flex-wrap mt-auto">
                    <div className="flex gap-1.5 flex-wrap flex-1">
                      {caption.contentType && catStyle && (
                        <span
                          className={`font-mono text-[10px] tracking-[0.1em] uppercase px-2.5 py-1 rounded-full border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}
                        >
                          {caption.contentType}
                        </span>
                      )}
                      {caption.postOrigin && (
                        <span className="font-mono text-[10px] tracking-[0.1em] uppercase px-2.5 py-1 rounded-full border bg-brand-blue/10 dark:bg-brand-blue/15 text-brand-blue border-brand-blue/25">
                          {caption.postOrigin}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyCaption(caption.captionUsed, caption.id);
                      }}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border font-mono text-[11px] tracking-[0.05em] transition-all flex-shrink-0 ${
                        copiedId === caption.id
                          ? "border-emerald-500/40 text-emerald-500 dark:text-emerald-400"
                          : "border-gray-200 dark:border-white/[0.08] text-gray-400 dark:text-gray-600 hover:border-brand-light-pink/40 hover:text-brand-light-pink"
                      }`}
                    >
                      {copiedId === caption.id ? (
                        <>
                          <Check className="w-3 h-3" /> copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" /> copy
                        </>
                      )}
                    </button>
                  </div>

                  {/* Mini Stats Footer */}
                  <div className="flex items-center gap-4 text-[10px] font-mono text-gray-400 dark:text-gray-600 tracking-[0.05em]">
                    {(caption.salesCount || 0) > 0 && (
                      <span className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        {caption.salesCount} sales
                      </span>
                    )}
                    {(caption.revenue || 0) > 0 && (
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        {formatCurrency(caption.revenue || 0)}
                      </span>
                    )}
                    {caption.platform && (
                      <span className="flex items-center gap-1">
                        <Folder className="w-3 h-3" />
                        {caption.platform}
                      </span>
                    )}
                    {caption.postedAt && (
                      <span>
                        {new Date(caption.postedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Caption Detail Modal */}
      {isMounted &&
        showDetailModal &&
        viewingCaption &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => {
              setShowDetailModal(false);
              setViewingCaption(null);
            }}
          >
            <div
              className="bg-white dark:bg-[#111] border border-gray-200 dark:border-white/[0.1] rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand-light-pink/10 dark:bg-brand-light-pink/15 rounded-xl flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-brand-light-pink" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-brand-off-white">
                    Caption Details
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    setViewingCaption(null);
                  }}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-white/[0.04] rounded-lg"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-100px)]">
                {/* Full Caption Text */}
                <div>
                  <label className="block font-mono text-[11px] tracking-[0.12em] text-gray-500 uppercase mb-2">
                    Caption Text
                  </label>
                  <div className="bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/[0.06] rounded-xl p-5 max-h-60 overflow-y-auto">
                    <p className="font-mono text-[13px] leading-[1.75] text-gray-700 dark:text-gray-300 font-light italic whitespace-pre-wrap break-words">
                      {viewingCaption.captionUsed}
                    </p>
                  </div>
                </div>

                {/* Detail Tags */}
                <div>
                  <label className="block font-mono text-[11px] tracking-[0.12em] text-gray-500 uppercase mb-3">
                    Details
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {viewingCaption.contentType && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-light-pink/10 dark:bg-brand-light-pink/15 text-brand-light-pink text-sm font-mono rounded-full border border-brand-light-pink/25">
                        <Tag className="w-3.5 h-3.5" />
                        {viewingCaption.contentType}
                      </span>
                    )}
                    {viewingCaption.postOrigin && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-blue/10 dark:bg-brand-blue/15 text-brand-blue text-sm font-mono rounded-full border border-brand-blue/25">
                        <MessageSquare className="w-3.5 h-3.5" />
                        {viewingCaption.postOrigin}
                      </span>
                    )}
                    {viewingCaption.platform && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-white/[0.04] text-gray-600 dark:text-gray-400 text-sm font-mono rounded-full border border-gray-200 dark:border-white/[0.08]">
                        <Folder className="w-3.5 h-3.5" />
                        {viewingCaption.platform}
                      </span>
                    )}
                    {viewingCaption.pricingTier && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-sm font-mono rounded-full border border-emerald-500/25">
                        <DollarSign className="w-3.5 h-3.5" />
                        {viewingCaption.pricingTier}
                      </span>
                    )}
                    {!viewingCaption.contentType &&
                      !viewingCaption.postOrigin &&
                      !viewingCaption.platform && (
                        <span className="text-sm font-mono text-gray-400 dark:text-gray-600 italic tracking-wide">
                          No details available
                        </span>
                      )}
                  </div>
                </div>

                {/* Analytics Grid */}
                <div>
                  <label className="block font-mono text-[11px] tracking-[0.12em] text-gray-500 uppercase mb-3">
                    Analytics
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="bg-gray-50 dark:bg-white/[0.03] rounded-xl p-4 border border-gray-100 dark:border-white/[0.06] text-center">
                      <p className="text-xl font-bold text-gray-900 dark:text-brand-off-white">
                        {viewingCaption.salesCount || 0}
                      </p>
                      <p className="text-[10px] font-mono tracking-[0.1em] text-gray-500 mt-1 uppercase flex items-center justify-center gap-1">
                        <TrendingUp className="w-3 h-3 text-brand-light-pink" />
                        Sales
                      </p>
                    </div>
                    <div className="bg-gray-50 dark:bg-white/[0.03] rounded-xl p-4 border border-gray-100 dark:border-white/[0.06] text-center">
                      <p className="text-xl font-bold text-gray-900 dark:text-brand-off-white">
                        {formatCurrency(viewingCaption.revenue || 0)}
                      </p>
                      <p className="text-[10px] font-mono tracking-[0.1em] text-gray-500 mt-1 uppercase flex items-center justify-center gap-1">
                        <DollarSign className="w-3 h-3 text-brand-blue" />
                        Revenue
                      </p>
                    </div>
                    {viewingCaption.postedAt && (
                      <div className="bg-gray-50 dark:bg-white/[0.03] rounded-xl p-4 border border-gray-100 dark:border-white/[0.06] text-center">
                        <p className="text-sm font-bold text-gray-900 dark:text-brand-off-white">
                          {new Date(
                            viewingCaption.postedAt,
                          ).toLocaleDateString()}
                        </p>
                        <p className="text-[10px] font-mono tracking-[0.1em] text-gray-500 mt-1 uppercase flex items-center justify-center gap-1">
                          <MessageSquare className="w-3 h-3 text-brand-mid-pink" />
                          Posted
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Copy Action */}
                <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-white/[0.06]">
                  <button
                    onClick={() => {
                      handleCopyCaption(
                        viewingCaption.captionUsed,
                        viewingCaption.id,
                      );
                      setShowDetailModal(false);
                      setViewingCaption(null);
                    }}
                    className="px-5 py-2.5 bg-brand-light-pink hover:bg-brand-mid-pink text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    Copy Caption
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
