"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useInstagramProfile } from "@/hooks/useInstagramProfile";
import { useUser } from "@clerk/nextjs";
import {
  User,
  Check,
  AlertCircle,
  Sparkles,
  X,
  Info,
  Share2,
  ChevronLeft,
  ChevronRight,
  Database,
  FileSpreadsheet,
  Flame,
} from "lucide-react";

import { useCaptions, useDeleteCaption } from "@/lib/hooks/useCaptions.query";
import type { Caption, DuplicateGroup } from "@/lib/hooks/useCaptions.query";
import {
  computeStats,
  computeTopPerformerIds,
  computeCategoryRank,
  findDuplicates,
  performerScore,
  PAGE_SIZE,
} from "./utils";

import { CaptionHeader } from "./CaptionHeader";
import { CaptionToolbar } from "./CaptionToolbar";
import { CaptionGrid } from "./CaptionGrid";
import { CaptionList } from "./CaptionList";
import { CaptionDetailModal } from "./CaptionDetailModal";
import { CaptionStatsModal } from "./CaptionStatsModal";
import { CaptionImportModal } from "./CaptionImportModal";
import { CaptionDuplicatesModal } from "./CaptionDuplicatesModal";

export function Captions({ masterMode = false }: { masterMode?: boolean } = {}) {
  const { profileId: globalProfileId, profiles: globalProfiles, loadingProfiles } = useInstagramProfile();
  const { user: clerkUser } = useUser();
  const deleteCaption = useDeleteCaption();

  // ── Profile state ────────────────────────────────────────────
  const [selectedProfileId, setSelectedProfileId] = useState<string>(masterMode ? "all" : "");
  const profiles = useMemo(
    () => [...globalProfiles].sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" })),
    [globalProfiles]
  );
  const isAllProfiles = selectedProfileId === "all";

  const isSharedProfile = useMemo(() => {
    if (!selectedProfileId || isAllProfiles || !clerkUser?.id) return false;
    const profile = profiles.find((p) => p.id === selectedProfileId);
    return profile ? profile.clerkId !== clerkUser.id : false;
  }, [selectedProfileId, isAllProfiles, profiles, clerkUser?.id]);

  const sharedProfileOwnerName = useMemo(() => {
    if (!isSharedProfile) return null;
    const profile = profiles.find((p) => p.id === selectedProfileId);
    if (!profile?.user) return null;
    if (profile.user.firstName && profile.user.lastName) return `${profile.user.firstName} ${profile.user.lastName}`;
    return profile.user.firstName || profile.user.name || null;
  }, [isSharedProfile, selectedProfileId, profiles]);

  const selectedProfile = profiles.find((p) => p.id === selectedProfileId) || null;

  // ── Filter / sort / view state ───────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [searchDebounce, setSearchDebounce] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedType, setSelectedType] = useState("All");
  const [selectedBank, setSelectedBank] = useState("All");
  const [selectedSheet, setSelectedSheet] = useState("All");
  const [sourceFilter, setSourceFilter] = useState<"all" | "gallery" | "imported">("all");
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<"createdAt" | "postedAt" | "caption" | "revenue" | "performer">("postedAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [currentPage, setCurrentPage] = useState(1);
  const [quickFilterCategories, setQuickFilterCategories] = useState<string[]>([]);

  // ── UI state ─────────────────────────────────────────────────
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showDuplicatesModal, setShowDuplicatesModal] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [detailCaption, setDetailCaption] = useState<Caption | null>(null);

  // ── Data fetching (TanStack Query) ───────────────────────────
  const apiSortBy = sortBy === "performer" ? "postedAt" : sortBy;
  const { data, isLoading } = useCaptions({
    profileId: selectedProfileId,
    sortBy: apiSortBy as "createdAt" | "postedAt" | "caption" | "revenue",
    sortOrder,
  });

  const captions = data?.captions ?? [];
  const dynamicFilters = data?.filters ?? { contentTypes: [], postOrigins: [], platforms: [] };

  // ── Derived data ─────────────────────────────────────────────
  const stats = useMemo(() => computeStats(captions), [captions]);
  const topPerformerIds = useMemo(() => computeTopPerformerIds(captions), [captions]);
  const topPerformerCount = topPerformerIds.size;

  const detailCategoryRank = useMemo(() => {
    if (!detailCaption) return null;
    return computeCategoryRank(detailCaption, captions);
  }, [detailCaption, captions]);

  const detailTotalInCategory = useMemo(() => {
    if (!detailCaption) return 0;
    return captions.filter((c) => c.captionCategory === detailCaption.captionCategory && c.usageCount > 0).length;
  }, [detailCaption, captions]);

  // ── Sync with global profile selector ────────────────────────
  useEffect(() => {
    if (masterMode) return;
    if (globalProfileId && globalProfileId !== selectedProfileId) {
      setSelectedProfileId(globalProfileId);
    }
  }, [globalProfileId, masterMode]);

  useEffect(() => {
    if (masterMode) return;
    const handleProfileChange = (event: CustomEvent<{ profileId: string }>) => {
      const newProfileId = event.detail.profileId;
      if (newProfileId && newProfileId !== selectedProfileId) setSelectedProfileId(newProfileId);
    };
    window.addEventListener("profileChanged", handleProfileChange as EventListener);
    return () => window.removeEventListener("profileChanged", handleProfileChange as EventListener);
  }, [selectedProfileId, masterMode]);

  // ── Debounce search ──────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounce(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ── Toast auto-dismiss ───────────────────────────────────────
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // ── Reset page on filter change ──────────────────────────────
  useEffect(() => {
    setCurrentPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDebounce, selectedCategory, selectedType, selectedBank, sourceFilter, selectedSheet, quickFilterCategories]);

  useEffect(() => {
    if (sourceFilter !== "imported") setSelectedSheet("All");
  }, [sourceFilter]);

  // ── Handlers ─────────────────────────────────────────────────
  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
  }, []);

  const handleCopyCaption = useCallback(async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      showToast("Copied to clipboard!", "success");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      showToast("Failed to copy", "error");
    }
  }, [showToast]);

  const handleDeleteCaption = useCallback(async (id: string) => {
    try {
      await deleteCaption.mutateAsync(id);
      showToast("Caption deleted", "success");
    } catch {
      showToast("Failed to delete caption", "error");
    }
  }, [deleteCaption, showToast]);

  const handleFindDuplicates = useCallback(() => {
    setIsCheckingDuplicates(true);
    // Defer to allow React to paint the loading spinner before blocking computation
    setTimeout(() => {
      const groups = findDuplicates(captions);
      setDuplicateGroups(groups);
      setIsCheckingDuplicates(false);
      setShowDuplicatesModal(true);
      if (groups.length === 0) showToast("No duplicates found!", "success");
      else showToast(`Found ${groups.length} duplicate group(s)`, "info");
    }, 50);
  }, [captions, showToast]);

  const handleMergeDuplicates = useCallback(async (group: DuplicateGroup, keepOriginal: boolean) => {
    const toDelete = keepOriginal
      ? group.duplicates.map((d) => d.id)
      : [group.original.id, ...group.duplicates.slice(1).map((d) => d.id)];
    let successCount = 0;
    for (const id of toDelete) {
      try {
        await deleteCaption.mutateAsync(id);
        successCount++;
      } catch { /* ignore */ }
    }
    if (successCount > 0) {
      setDuplicateGroups((prev) => prev.filter((g) => g.original.id !== group.original.id));
      showToast(`Removed ${successCount} duplicate(s)`, "success");
    }
  }, [deleteCaption, showToast]);

  const handleDeleteAllDuplicates = useCallback(async () => {
    if (!confirm("Keep first caption from each group and delete the rest?")) return;
    const toDelete: string[] = [];
    duplicateGroups.forEach((group) => group.duplicates.forEach((d) => toDelete.push(d.id)));
    let successCount = 0;
    for (const id of toDelete) {
      try {
        await deleteCaption.mutateAsync(id);
        successCount++;
      } catch { /* ignore */ }
    }
    if (successCount > 0) {
      setDuplicateGroups([]);
      showToast(`Removed ${successCount} duplicates`, "success");
      setShowDuplicatesModal(false);
    }
  }, [duplicateGroups, deleteCaption, showToast]);

  const handleQuickFilterToggle = useCallback((category: string) => {
    setQuickFilterCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  }, []);

  const handleSortChange = useCallback((field: string, order: string) => {
    setSortBy(field as typeof sortBy);
    setSortOrder(order as typeof sortOrder);
  }, []);

  // ── Filtering ────────────────────────────────────────────────
  const filteredCaptions = useMemo(() => {
    let result = captions.filter((caption) => {
      const q = searchDebounce.toLowerCase();
      const matchesSearch = !q ||
        caption.caption.toLowerCase().includes(q) ||
        caption.captionCategory.toLowerCase().includes(q) ||
        caption.captionTypes.toLowerCase().includes(q) ||
        caption.captionBanks.toLowerCase().includes(q) ||
        (caption.tags && caption.tags.toLowerCase().includes(q));
      const matchesCategory = selectedCategory === "All" || caption.captionCategory === selectedCategory;
      const matchesType = selectedType === "All" || caption.captionTypes === selectedType;
      const matchesBank = selectedBank === "All" || caption.captionBanks === selectedBank;
      const matchesSource = sourceFilter === "all" || caption.source === sourceFilter;
      const matchesSheet = selectedSheet === "All" || caption.captionTypes === selectedSheet;
      const matchesQuickFilter = quickFilterCategories.length === 0 || quickFilterCategories.includes(caption.captionCategory);
      return matchesSearch && matchesCategory && matchesType && matchesBank && matchesSource && matchesSheet && matchesQuickFilter;
    });

    if (sortBy === "performer") {
      result = [...result].sort((a, b) => performerScore(b) - performerScore(a));
    }

    return result;
  }, [captions, searchDebounce, selectedCategory, selectedType, selectedBank, sourceFilter, selectedSheet, quickFilterCategories, sortBy]);

  const totalPages = Math.ceil(filteredCaptions.length / PAGE_SIZE);
  const paginatedCaptions = filteredCaptions.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // ── Loading / empty states ───────────────────────────────────
  if (loadingProfiles && profiles.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-brand-light-pink/30 border-t-brand-light-pink rounded-full animate-spin" />
          <p className="text-sm font-mono text-gray-500 dark:text-gray-400 tracking-wider">Loading...</p>
        </div>
      </div>
    );
  }

  if (profiles.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-gray-400 dark:text-gray-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-brand-off-white mb-2">No profiles found</h3>
          <p className="text-sm font-mono text-gray-500 dark:text-gray-400 tracking-wide">Create an Instagram profile first</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] bg-white dark:bg-[#0a0a0f] border border-gray-200 dark:border-brand-mid-pink/15 rounded-2xl overflow-hidden">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 duration-300">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border backdrop-blur-sm ${
            toast.type === "success" ? "bg-emerald-50/90 dark:bg-emerald-950/90 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300" :
            toast.type === "error" ? "bg-red-50/90 dark:bg-red-950/90 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300" :
            "bg-brand-blue/5 dark:bg-brand-blue/10 border-brand-blue/30 text-brand-blue"
          }`}>
            {toast.type === "success" && <Check className="w-5 h-5" />}
            {toast.type === "error" && <AlertCircle className="w-5 h-5" />}
            {toast.type === "info" && <Sparkles className="w-5 h-5" />}
            <span className="font-medium text-sm">{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-2 hover:opacity-70"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {/* Header */}
      <CaptionHeader
        masterMode={masterMode}
        isAllProfiles={isAllProfiles}
        isSharedProfile={isSharedProfile}
        selectedProfile={selectedProfile ? { id: selectedProfile.id, name: selectedProfile.name } : null}
        sharedProfileOwnerName={sharedProfileOwnerName}
        isCheckingDuplicates={isCheckingDuplicates}
        captionCount={captions.length}
        onImportClick={() => setShowImportModal(true)}
        onStatsClick={() => setShowStatsModal(true)}
        onDuplicatesClick={handleFindDuplicates}
      />

      {/* Toolbar */}
      <CaptionToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(!showFilters)}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={handleSortChange}
        sourceFilter={sourceFilter}
        onSourceFilterChange={setSourceFilter}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        selectedType={selectedType}
        onTypeChange={setSelectedType}
        selectedBank={selectedBank}
        onBankChange={setSelectedBank}
        selectedSheet={selectedSheet}
        onSheetChange={setSelectedSheet}
        selectedProfileId={selectedProfileId}
        onProfileChange={setSelectedProfileId}
        profiles={profiles}
        masterMode={masterMode}
        dynamicFilters={dynamicFilters}
        captions={captions}
        quickFilterCategories={quickFilterCategories}
        onQuickFilterToggle={handleQuickFilterToggle}
      />

      {/* Info Banners */}
      {isAllProfiles && (
        <div className="mx-6 sm:mx-8 mt-4 bg-brand-light-pink/5 dark:bg-brand-light-pink/[0.06] border border-brand-light-pink/15 rounded-xl p-4 flex items-center gap-3">
          <Info className="w-5 h-5 text-brand-light-pink flex-shrink-0" />
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {masterMode
              ? <><span className="font-semibold text-brand-light-pink">Master Caption Bank:</span> Showing captions from gallery items and spreadsheet imports across all profiles. Use the source filter to separate them, or the Profile dropdown to drill into a specific model.</>
              : <><span className="font-semibold text-brand-light-pink">All Profiles Mode:</span> Viewing gallery and imported captions from all profiles. Select a specific profile to filter.</>
            }
          </p>
        </div>
      )}
      {isSharedProfile && !isAllProfiles && (
        <div className="mx-6 sm:mx-8 mt-4 bg-brand-blue/5 dark:bg-brand-blue/[0.06] border border-brand-blue/15 rounded-xl p-4 flex items-center gap-3">
          <Share2 className="w-5 h-5 text-brand-blue flex-shrink-0" />
          <p className="text-sm text-gray-700 dark:text-gray-300">
            <span className="font-semibold text-brand-blue">Shared Profile:</span> This profile was shared with you{sharedProfileOwnerName && ` by ${sharedProfileOwnerName}`}. You can view and manage captions collaboratively.
          </p>
        </div>
      )}

      {/* Stats Bar */}
      <div className="px-6 sm:px-8 pt-4 flex gap-4 flex-wrap items-center">
        <span className="font-mono text-[11px] tracking-[0.08em] text-gray-400 dark:text-gray-600">
          <span className="text-gray-600 dark:text-gray-400">{filteredCaptions.length}</span> caption{filteredCaptions.length !== 1 ? "s" : ""}
          {searchDebounce && ` matching "${searchDebounce}"`}
        </span>
        <span className="font-mono text-[11px] tracking-[0.08em] text-gray-400 dark:text-gray-600">
          <span className="text-gray-600 dark:text-gray-400">{captions.length}</span> total
        </span>
        <span className="font-mono text-[11px] tracking-[0.08em] text-brand-blue/60">
          <Database className="w-3 h-3 inline mr-0.5" />
          <span className="text-brand-blue">{captions.filter((c) => c.source === "gallery").length}</span> gallery
        </span>
        <span className="font-mono text-[11px] tracking-[0.08em] text-emerald-500/60">
          <FileSpreadsheet className="w-3 h-3 inline mr-0.5" />
          <span className="text-emerald-500">{captions.filter((c) => c.source === "imported").length}</span> imported
        </span>
        {topPerformerCount > 0 && (
          <span className="font-mono text-[11px] tracking-[0.08em] text-amber-500/60">
            <Flame className="w-3 h-3 inline mr-0.5" />
            <span className="text-amber-500">{topPerformerCount}</span> top performers
          </span>
        )}
        {stats.totalUsage > 0 && (
          <span className="font-mono text-[11px] tracking-[0.08em] text-gray-400 dark:text-gray-600">
            <span className="text-gray-600 dark:text-gray-400">{stats.totalUsage}</span> total sales
          </span>
        )}
      </div>

      {/* Content */}
      <div className="px-6 sm:px-8 py-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-brand-light-pink/30 border-t-brand-light-pink rounded-full animate-spin" />
          </div>
        ) : filteredCaptions.length === 0 ? (
          <div className="text-center py-16 font-mono text-[13px] tracking-[0.05em] text-gray-400 dark:text-gray-600">
            {searchDebounce ? "no captions found" : "no gallery items with captions found"}
          </div>
        ) : viewMode === "grid" ? (
          <CaptionGrid
            captions={paginatedCaptions}
            isAllProfiles={isAllProfiles}
            topPerformerIds={topPerformerIds}
            copiedId={copiedId}
            searchQuery={searchDebounce}
            onCopy={handleCopyCaption}
            onCardClick={setDetailCaption}
          />
        ) : (
          <CaptionList
            captions={paginatedCaptions}
            isAllProfiles={isAllProfiles}
            topPerformerIds={topPerformerIds}
            copiedId={copiedId}
            searchQuery={searchDebounce}
            onCopy={handleCopyCaption}
            onRowClick={setDetailCaption}
          />
        )}

        {/* Pagination */}
        {totalPages > 1 && !isLoading && (
          <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-white/[0.06] mt-4">
            <span className="font-mono text-[11px] tracking-[0.05em] text-gray-400 dark:text-gray-600">
              Showing {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, filteredCaptions.length)} of {filteredCaptions.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-2.5 py-1.5 rounded-lg font-mono text-[11px] border border-gray-200 dark:border-white/[0.08] text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                First
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-gray-200 dark:border-white/[0.08] text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let page: number;
                if (totalPages <= 5) {
                  page = i + 1;
                } else if (currentPage <= 3) {
                  page = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  page = totalPages - 4 + i;
                } else {
                  page = currentPage - 2 + i;
                }
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 rounded-lg font-mono text-[11px] transition-colors ${
                      currentPage === page
                        ? "bg-brand-light-pink text-white"
                        : "border border-gray-200 dark:border-white/[0.08] text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06]"
                    }`}
                  >
                    {page}
                  </button>
                );
              })}

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-gray-200 dark:border-white/[0.08] text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1.5 rounded-lg font-mono text-[11px] border border-gray-200 dark:border-white/[0.08] text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Last
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <CaptionDetailModal
        open={!!detailCaption}
        caption={detailCaption}
        onClose={() => setDetailCaption(null)}
        isTopPerformer={detailCaption ? topPerformerIds.has(detailCaption.id) : false}
        categoryRank={detailCategoryRank}
        totalInCategory={detailTotalInCategory}
        onCopy={handleCopyCaption}
        copiedId={copiedId}
      />

      <CaptionStatsModal
        open={showStatsModal}
        onClose={() => setShowStatsModal(false)}
        stats={stats}
      />

      <CaptionImportModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportComplete={() => {}}
        showToast={showToast}
      />

      <CaptionDuplicatesModal
        open={showDuplicatesModal}
        onClose={() => setShowDuplicatesModal(false)}
        duplicateGroups={duplicateGroups}
        onDeleteCaption={handleDeleteCaption}
        onMergeDuplicates={handleMergeDuplicates}
        onDeleteAllDuplicates={handleDeleteAllDuplicates}
        setDuplicateGroups={setDuplicateGroups}
      />
    </div>
  );
}
