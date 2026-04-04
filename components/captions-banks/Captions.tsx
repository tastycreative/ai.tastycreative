"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useInstagramProfile } from "@/hooks/useInstagramProfile";
import { useUser } from "@clerk/nextjs";
import {
  Search,
  Copy,
  Trash2,
  X,
  Check,
  User,
  Users,
  FileText,
  AlertCircle,
  BarChart3,
  Sparkles,
  Tag,
  Layers,
  Merge,
  Filter,
  SortAsc,
  Folder,
  TrendingUp,
  Info,
  Share2,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Upload,
  Database,
  FileSpreadsheet,
} from "lucide-react";

interface Caption {
  id: string;
  caption: string;
  captionCategory: string;
  captionTypes: string;
  captionBanks: string;
  profileId: string;
  usageCount: number;
  isFavorite: boolean;
  lastUsedAt: string | null;
  cooldownDays: number;
  notes: string | null;
  tags: string | null;
  createdAt: string;
  profileName?: string;
  isSharedProfile?: boolean;
  source: "gallery" | "imported";
}

interface ImportResult {
  success: boolean;
  imported: number;
  duplicatesSkipped: number;
  totalProcessed: number;
  sheetStats: Record<string, number>;
  message?: string;
}

interface DuplicateGroup {
  original: Caption;
  duplicates: Caption[];
  similarity: number;
}

interface CaptionStats {
  totalCaptions: number;
  favoriteCaptions: number;
  totalUsage: number;
  mostUsed: Array<{id: string; caption: string; usageCount: number; captionCategory: string}>;
  recentlyUsed: Array<{id: string; caption: string; lastUsedAt: string; usageCount: number; captionCategory: string}>;
  captionsInCooldown: Array<{id: string; caption: string; lastUsedAt: string; cooldownDays: number; cooldownEndsAt: string; captionCategory: string}>;
  categoryStats: Array<{category: string; count: number; totalUsage: number}>;
}

interface InstagramProfile {
  id: string;
  name: string;
  instagramUsername: string | null;
  profileImageUrl: string | null;
  isDefault: boolean;
  clerkId?: string;
  user?: {
    clerkId: string;
    firstName?: string;
    lastName?: string;
    name?: string;
  };
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

export function Captions({ masterMode = false }: { masterMode?: boolean } = {}) {
  const { profileId: globalProfileId, profiles: globalProfiles, loadingProfiles } = useInstagramProfile();
  const { user: clerkUser } = useUser();

  const [captions, setCaptions] = useState<Caption[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>(masterMode ? "all" : "");
  const profiles = useMemo(() =>
    [...globalProfiles].sort((a, b) =>
      (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" })
    ),
    [globalProfiles]
  );

  const isSharedProfile = useMemo(() => {
    if (!selectedProfileId || selectedProfileId === "all" || !clerkUser?.id) return false;
    const profile = profiles.find(p => p.id === selectedProfileId);
    if (!profile) return false;
    return profile.clerkId !== clerkUser.id;
  }, [selectedProfileId, profiles, clerkUser?.id]);

  const getSharedProfileOwnerName = useMemo(() => {
    if (!isSharedProfile) return null;
    const profile = profiles.find(p => p.id === selectedProfileId);
    if (!profile?.user) return null;
    if (profile.user.firstName && profile.user.lastName) return `${profile.user.firstName} ${profile.user.lastName}`;
    if (profile.user.firstName) return profile.user.firstName;
    if (profile.user.name) return profile.user.name;
    return null;
  }, [isSharedProfile, selectedProfileId, profiles]);

  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedType, setSelectedType] = useState("All");
  const [selectedBank, setSelectedBank] = useState("All");
  const [showFilters, setShowFilters] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [searchDebounce, setSearchDebounce] = useState("");
  const [sortBy, setSortBy] = useState<"createdAt" | "postedAt" | "caption" | "revenue">("postedAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [stats, setStats] = useState<CaptionStats | null>(null);
  const [showDuplicatesModal, setShowDuplicatesModal] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const isAllProfiles = selectedProfileId === "all";
  const [dynamicContentTypes, setDynamicContentTypes] = useState<string[]>([]);
  const [dynamicPostOrigins, setDynamicPostOrigins] = useState<string[]>([]);
  const [dynamicPlatforms, setDynamicPlatforms] = useState<string[]>([]);
  const [sourceFilter, setSourceFilter] = useState<"all" | "gallery" | "imported">("all");
  const [selectedSheet, setSelectedSheet] = useState("All");
  const importedSheets = [
    "Short", "Descriptive", "Bundle", "Winner", "List", "Holiday",
    "Short (GF)", "Descriptive (GF)", "Bundle (GF)", "List (GF)", "Winner (GF)",
    "Tip Me CTA", "Tip Me Post", "New Sub", "Expired Sub",
    "Livestream", "VIP Membership", "Holiday Non-PPV", "1 Fan Tip Campaign", "Games",
    "DM Funnel", "GIF Bumps", "Renew Post",
    "Holiday (GF)", "Tip Me Post (GF)", "Tip Me CTA (GF)", "Livestream (GF)",
    "GIF Bump (GF)", "Holiday Non-PPV (GF)", "Renew Post (GF)",
    "New Sub (GF)", "Expired Sub (GF)",
    "GF Non-Explicit", "Public Captions", "Timebound", "SOP Captions",
  ];
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 30;

  const captionCategories = [
    "Dick rating", "Solo DILDO", "Solo FINGERS", "Solo VIBRATOR", "JOI",
    "Squirting", "Cream Pie", "BG", "BJ", "GG", "GGG", "BGG", "BBG",
    "ORGY", "ANAL butt plug", "Anal SOLO", "Anal BG", "Lives",
  ];
  const captionTypes = [
    "Bundle Unlocks", "Tip Me", "BIO", "VIP GIFT", "Short Unlocks",
    "Solo Unlocks", "Follow up Normal", "Mass Message Bumps", "Wall Bumps",
    "DM Funnels", "GIF Bumps", "Renew On", "VIP Post", "Link Drop",
    "Live Streams", "Live Mass Message", "Holiday Unlocks", "Live Preview",
    "Games", "New Sub Promo", "Winner Unlocks", "Descriptive", "OTP Style",
    "List Unlocks", "Model Specific", "SOP", "Holiday Non-PPV", "Timebound",
    "Follow Up Incentives", "Collab", "Tip Me Post", "Tip Me CTA",
    "MM Renew", "Renew Post", "Porn Post", "1 Person Tip Campaign",
    "VIP Membership", "DM Funnel (GF)", "Expired Sub Promo",
  ];
  const captionBanks = [
    "Main Porn Caption Bank", "Post Generation Caption Bank",
    "High Sales Caption", "Better Bump Bank", "Custom",
    "Borrowed Captions", "CST - Post Generation Harvest Caption Bank",
  ];

  const categories = dynamicContentTypes.length > 0 ? dynamicContentTypes : captionCategories;
  const types = dynamicPostOrigins.length > 0 ? dynamicPostOrigins : captionTypes;
  const banks = dynamicPlatforms.length > 0 ? dynamicPlatforms : captionBanks;

  // Sync with global profile selector (only when NOT in master mode)
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

  useEffect(() => {
    if (selectedProfileId) { fetchCaptions(); } else { setCaptions([]); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProfileId, sortBy, sortOrder]);

  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounce(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (toast) { const timer = setTimeout(() => setToast(null), 3000); return () => clearTimeout(timer); }
  }, [toast]);

  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
  }, []);

  const fetchCaptions = async () => {
    if (!selectedProfileId) return;
    try {
      setLoading(true);

      // Fetch gallery captions and imported captions in parallel
      const galleryParams = new URLSearchParams({ profileId: selectedProfileId, sortBy, sortOrder, pageSize: "500" });
      const importedParams = new URLSearchParams({ sourceType: "spreadsheet_import", sortBy: sortBy === "postedAt" ? "createdAt" : sortBy, sortOrder });

      const [galleryRes, importedRes] = await Promise.all([
        fetch(`/api/gallery/captions?${galleryParams}`),
        fetch(`/api/captions?${importedParams}`),
      ]);

      let galleryCaptions: Caption[] = [];
      let importedCaptions: Caption[] = [];

      if (galleryRes.ok) {
        const data = await galleryRes.json();
        galleryCaptions = (data.captions || []).map((item: Record<string, unknown>) => ({
          id: item.id as string,
          caption: (item.captionUsed as string) || "",
          captionCategory: (item.contentType as string) || "Uncategorized",
          captionTypes: (item.postOrigin as string) || "Unknown",
          captionBanks: (item.platform as string) || "Unknown",
          profileId: (item.profileId as string) || "",
          usageCount: (item.salesCount as number) || 0,
          isFavorite: false,
          lastUsedAt: (item.postedAt as string) || null,
          cooldownDays: 0,
          notes: (item.title as string) || null,
          tags: Array.isArray(item.tags) ? (item.tags as string[]).join(", ") : (item.tags as string) || null,
          createdAt: item.createdAt as string,
          profileName: (item.profile as { name?: string })?.name || undefined,
          isSharedProfile: false,
          source: "gallery" as const,
        }));
        if (data.filters) {
          setDynamicContentTypes(data.filters.contentTypes || []);
          setDynamicPostOrigins(data.filters.postOrigins || []);
          setDynamicPlatforms(data.filters.platforms || []);
        }
      }

      if (importedRes.ok) {
        const rawData = await importedRes.json();
        // API returns array directly or { captions: [...] }
        const items = Array.isArray(rawData) ? rawData : (rawData.captions || []);
        importedCaptions = items.map((item: Record<string, unknown>) => ({
          id: item.id as string,
          caption: (item.caption as string) || "",
          captionCategory: (item.captionCategory as string) || "Uncategorized",
          captionTypes: (item.captionTypes as string) || "Unknown",
          captionBanks: (item.captionBanks as string) || "Unknown",
          profileId: (item.profileId as string) || "",
          usageCount: (item.usageCount as number) || 0,
          isFavorite: (item.isFavorite as boolean) || false,
          lastUsedAt: (item.lastUsedAt as string) || null,
          cooldownDays: (item.cooldownDays as number) || 0,
          notes: (item.notes as string) || null,
          tags: (item.tags as string) || null,
          createdAt: item.createdAt as string,
          profileName: (item.profileName as string) || undefined,
          isSharedProfile: (item.isSharedProfile as boolean) || false,
          source: "imported" as const,
        }));
      }

      setCaptions([...galleryCaptions, ...importedCaptions]);
    } catch (error) {
      console.error("Failed to fetch captions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleImportXlsx = () => {
    if (!importFile) return;
    setImporting(true);
    setImportResult(null);
    setImportProgress(0);

    const formData = new FormData();
    formData.append("file", importFile);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/captions/import-xlsx");

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        // Upload is 0-50%, server processing is 50-100%
        setImportProgress(Math.round((e.loaded / e.total) * 50));
      }
    };

    xhr.upload.onload = () => {
      // Upload done, now waiting for server to process
      setImportProgress(60);
      const tick = setInterval(() => {
        setImportProgress((prev) => {
          if (prev >= 90) { clearInterval(tick); return 90; }
          return prev + 5;
        });
      }, 500);
      (xhr as any)._progressTick = tick;
    };

    xhr.onload = () => {
      if ((xhr as any)._progressTick) clearInterval((xhr as any)._progressTick);
      setImportProgress(100);
      try {
        const result = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          setImportResult(result);
          if (result.imported > 0) {
            showToast(`Imported ${result.imported} captions`, "success");
            fetchCaptions();
          }
        } else {
          showToast(result.error || "Import failed", "error");
        }
      } catch {
        showToast("Failed to parse response", "error");
      }
      setImporting(false);
    };

    xhr.onerror = () => {
      if ((xhr as any)._progressTick) clearInterval((xhr as any)._progressTick);
      showToast("Failed to import file", "error");
      setImporting(false);
      setImportProgress(0);
    };

    xhr.send(formData);
  };

  const filteredCaptions = captions.filter((caption) => {
    const matchesSearch =
      caption.caption.toLowerCase().includes(searchDebounce.toLowerCase()) ||
      caption.captionCategory.toLowerCase().includes(searchDebounce.toLowerCase()) ||
      caption.captionTypes.toLowerCase().includes(searchDebounce.toLowerCase()) ||
      caption.captionBanks.toLowerCase().includes(searchDebounce.toLowerCase()) ||
      (caption.tags && caption.tags.toLowerCase().includes(searchDebounce.toLowerCase()));
    const matchesCategory = selectedCategory === "All" || caption.captionCategory === selectedCategory;
    const matchesType = selectedType === "All" || caption.captionTypes === selectedType;
    const matchesBank = selectedBank === "All" || caption.captionBanks === selectedBank;
    const matchesSource = sourceFilter === "all" || caption.source === sourceFilter;
    const matchesSheet = selectedSheet === "All" || caption.captionTypes === selectedSheet;
    return matchesSearch && matchesCategory && matchesType && matchesBank && matchesSource && matchesSheet;
  });

  const totalPages = Math.ceil(filteredCaptions.length / PAGE_SIZE);
  const paginatedCaptions = filteredCaptions.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchDebounce, selectedCategory, selectedType, selectedBank, sourceFilter, selectedSheet, captions]);

  // Reset sheet filter when leaving imported view
  useEffect(() => {
    if (sourceFilter !== "imported") setSelectedSheet("All");
  }, [sourceFilter]);

  const handleCopyCaption = async (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast("Copied to clipboard!", "success");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleExpand = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const isLongCaption = (text: string) => text.length > 220 || text.split("\n").length > 4;

  const calculateSimilarity = (str1: string, str2: string): number => {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    if (s1 === s2) return 100;
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    if (longer.length === 0) return 100;
    const costs: number[] = [];
    for (let i = 0; i <= shorter.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= longer.length; j++) {
        if (i === 0) costs[j] = j;
        else if (j > 0) {
          let newValue = costs[j - 1];
          if (shorter.charAt(i - 1) !== longer.charAt(j - 1))
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[longer.length] = lastValue;
    }
    return Math.round(((longer.length - costs[longer.length]) / longer.length) * 100);
  };

  const findDuplicates = () => {
    setIsCheckingDuplicates(true);
    const groups: DuplicateGroup[] = [];
    const processed = new Set<string>();
    for (let i = 0; i < captions.length; i++) {
      if (processed.has(captions[i].id)) continue;
      const duplicates: Caption[] = [];
      let maxSimilarity = 0;
      for (let j = i + 1; j < captions.length; j++) {
        if (processed.has(captions[j].id)) continue;
        const similarity = calculateSimilarity(captions[i].caption, captions[j].caption);
        if (similarity >= 70) {
          duplicates.push(captions[j]);
          maxSimilarity = Math.max(maxSimilarity, similarity);
          processed.add(captions[j].id);
        }
      }
      if (duplicates.length > 0) {
        processed.add(captions[i].id);
        groups.push({ original: captions[i], duplicates, similarity: maxSimilarity });
      }
    }
    setDuplicateGroups(groups);
    setIsCheckingDuplicates(false);
    setShowDuplicatesModal(true);
    if (groups.length === 0) showToast("No duplicates found!", "success");
    else showToast(`Found ${groups.length} duplicate group(s)`, "info");
  };

  const handleDeleteCaption = async (id: string) => {
    try {
      const response = await fetch(`/api/captions?id=${id}`, { method: "DELETE" });
      if (response.ok) {
        setCaptions(prev => prev.filter(c => c.id !== id));
        showToast("Caption deleted", "success");
      }
    } catch {
      showToast("Failed to delete caption", "error");
    }
  };

  const mergeDuplicates = async (group: DuplicateGroup, keepOriginal: boolean) => {
    const toDelete = keepOriginal
      ? group.duplicates.map(d => d.id)
      : [group.original.id, ...group.duplicates.slice(1).map(d => d.id)];
    let successCount = 0;
    for (const id of toDelete) {
      try {
        const response = await fetch(`/api/captions?id=${id}`, { method: "DELETE" });
        if (response.ok) successCount++;
      } catch { /* ignore */ }
    }
    if (successCount > 0) {
      setCaptions(prev => prev.filter(c => !toDelete.includes(c.id)));
      setDuplicateGroups(prev => prev.filter(g => g.original.id !== group.original.id));
      showToast(`Removed ${successCount} duplicate(s)`, "success");
    }
  };

  const deleteAllDuplicates = async () => {
    if (!confirm("Keep first caption from each group and delete the rest?")) return;
    const toDelete: string[] = [];
    duplicateGroups.forEach(group => group.duplicates.forEach(d => toDelete.push(d.id)));
    let successCount = 0;
    for (const id of toDelete) {
      try {
        const response = await fetch(`/api/captions?id=${id}`, { method: "DELETE" });
        if (response.ok) successCount++;
      } catch { /* ignore */ }
    }
    if (successCount > 0) {
      setCaptions(prev => prev.filter(c => !toDelete.includes(c.id)));
      setDuplicateGroups([]);
      showToast(`Removed ${successCount} duplicates`, "success");
      setShowDuplicatesModal(false);
    }
  };

  const selectedProfile = profiles.find(p => p.id === selectedProfileId);
  const activeFilterCount = [selectedCategory !== "All", selectedType !== "All", selectedBank !== "All"].filter(Boolean).length;

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

      {/* Vault Header */}
      <div className="px-6 sm:px-8 pt-8 pb-6 border-b border-gray-100 dark:border-white/[0.06]">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="font-mono text-[11px] tracking-[0.2em] text-brand-light-pink uppercase mb-1">
              {masterMode ? "caption vault" : "caption bank"}
            </p>
            <h1 className="text-[28px] sm:text-[30px] font-extrabold tracking-tight text-gray-900 dark:text-brand-off-white leading-none flex items-center gap-3">
              {masterMode ? "The Bank" : "Captions"}
              {isAllProfiles && (
                <span className="px-3 py-1 bg-brand-light-pink/10 dark:bg-brand-light-pink/15 border border-brand-light-pink/25 rounded-full text-sm font-medium text-brand-light-pink flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  All
                </span>
              )}
              {isSharedProfile && !isAllProfiles && (
                <span className="px-3 py-1 bg-brand-blue/10 dark:bg-brand-blue/15 border border-brand-blue/25 rounded-full text-sm font-medium text-brand-blue flex items-center gap-1">
                  <Share2 className="w-3.5 h-3.5" />
                  Shared
                </span>
              )}
            </h1>
            {selectedProfile && !isAllProfiles && (
              <p className="mt-1 text-sm font-mono text-gray-500 dark:text-gray-400 tracking-wide">
                {isSharedProfile
                  ? <>captions for <span className="text-brand-light-pink">{selectedProfile.name}</span> {getSharedProfileOwnerName && <span className="text-brand-blue">(shared by {getSharedProfileOwnerName})</span>}</>
                  : <>gallery captions for <span className="text-brand-light-pink">{selectedProfile.name}</span></>
                }
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => { setShowImportModal(true); setImportFile(null); setImportResult(null); }}
              className="h-9 px-4 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-lg text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Import</span>
            </button>
            <button
              onClick={() => {
                const categoryStats = Object.entries(
                  captions.reduce((acc, c) => {
                    const cat = c.captionCategory || "Unknown";
                    if (!acc[cat]) acc[cat] = { count: 0, totalUsage: 0 };
                    acc[cat].count++;
                    acc[cat].totalUsage += c.usageCount;
                    return acc;
                  }, {} as Record<string, { count: number; totalUsage: number }>)
                ).map(([category, data]) => ({ category, ...data }));
                setStats({
                  totalCaptions: captions.length,
                  favoriteCaptions: 0,
                  totalUsage: captions.reduce((acc, c) => acc + c.usageCount, 0),
                  mostUsed: [...captions].sort((a, b) => b.usageCount - a.usageCount).slice(0, 5),
                  recentlyUsed: [...captions].filter((c): c is Caption & { lastUsedAt: string } => !!c.lastUsedAt).sort((a, b) => new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime()).slice(0, 5),
                  captionsInCooldown: [],
                  categoryStats,
                });
                setShowStatsModal(true);
              }}
              disabled={isAllProfiles}
              className="h-9 px-4 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-lg text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Stats</span>
            </button>
            <button
              onClick={findDuplicates}
              disabled={isCheckingDuplicates || captions.length < 2 || isAllProfiles}
              className="h-9 px-4 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-lg text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isCheckingDuplicates ? (
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Layers className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">Duplicates</span>
            </button>
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
              <span className="w-5 h-5 bg-brand-light-pink text-white text-xs rounded-full flex items-center justify-center">{activeFilterCount}</span>
            )}
          </button>

          <div className="relative">
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split("-");
                setSortBy(field as typeof sortBy);
                setSortOrder(order as typeof sortOrder);
              }}
              className="h-10 pl-3 pr-8 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-lg text-sm font-mono text-gray-600 dark:text-gray-400 appearance-none cursor-pointer focus:outline-none focus:border-brand-light-pink/50"
            >
              <option value="postedAt-desc">Latest Posted</option>
              <option value="postedAt-asc">Earliest Posted</option>
              <option value="createdAt-desc">Newest First</option>
              <option value="createdAt-asc">Oldest First</option>
              <option value="revenue-desc">Highest Revenue</option>
              <option value="revenue-asc">Lowest Revenue</option>
              <option value="caption-asc">A to Z</option>
              <option value="caption-desc">Z to A</option>
            </select>
            <SortAsc className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          </div>

          <div className="flex items-center bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-lg p-0.5">
            <button
              onClick={() => setSourceFilter("all")}
              className={`px-2.5 py-1.5 rounded-md text-[11px] font-mono tracking-[0.05em] transition-colors ${sourceFilter === "all" ? "bg-white dark:bg-white/10 shadow-sm text-gray-900 dark:text-brand-off-white" : "text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}
            >
              All
            </button>
            <button
              onClick={() => setSourceFilter("gallery")}
              className={`px-2.5 py-1.5 rounded-md text-[11px] font-mono tracking-[0.05em] transition-colors flex items-center gap-1 ${sourceFilter === "gallery" ? "bg-white dark:bg-white/10 shadow-sm text-brand-blue" : "text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}
            >
              <Database className="w-3 h-3" />
              Gallery
            </button>
            <button
              onClick={() => setSourceFilter("imported")}
              className={`px-2.5 py-1.5 rounded-md text-[11px] font-mono tracking-[0.05em] transition-colors flex items-center gap-1 ${sourceFilter === "imported" ? "bg-white dark:bg-white/10 shadow-sm text-emerald-500" : "text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}
            >
              <FileSpreadsheet className="w-3 h-3" />
              Imported
            </button>
          </div>

          <div className="flex items-center bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-lg p-0.5">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 rounded-md transition-colors ${viewMode === "grid" ? "bg-white dark:bg-white/10 shadow-sm" : ""}`}
            >
              <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 rounded-md transition-colors ${viewMode === "list" ? "bg-white dark:bg-white/10 shadow-sm" : ""}`}
            >
              <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/[0.06]">
            <div className={`grid grid-cols-1 gap-4 ${sourceFilter === "imported" ? "sm:grid-cols-5" : masterMode ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
              {masterMode && (
                <div>
                  <label className="block font-mono text-[11px] tracking-[0.12em] text-gray-500 dark:text-gray-500 uppercase mb-2">Profile</label>
                  <select
                    value={selectedProfileId}
                    onChange={(e) => setSelectedProfileId(e.target.value)}
                    className="w-full h-10 px-3 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-lg text-sm text-gray-900 dark:text-brand-off-white focus:outline-none focus:border-brand-light-pink/50"
                  >
                    <option value="all">All Profiles</option>
                    {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block font-mono text-[11px] tracking-[0.12em] text-gray-500 dark:text-gray-500 uppercase mb-2">Content Type</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full h-10 px-3 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-lg text-sm text-gray-900 dark:text-brand-off-white focus:outline-none focus:border-brand-light-pink/50"
                >
                  <option value="All">All Content Types</option>
                  {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div>
                <label className="block font-mono text-[11px] tracking-[0.12em] text-gray-500 dark:text-gray-500 uppercase mb-2">Post Origin</label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full h-10 px-3 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-lg text-sm text-gray-900 dark:text-brand-off-white focus:outline-none focus:border-brand-light-pink/50"
                >
                  <option value="All">All Post Origins</option>
                  {types.map(type => <option key={type} value={type}>{type}</option>)}
                </select>
              </div>
              <div>
                <label className="block font-mono text-[11px] tracking-[0.12em] text-gray-500 dark:text-gray-500 uppercase mb-2">Platform</label>
                <select
                  value={selectedBank}
                  onChange={(e) => setSelectedBank(e.target.value)}
                  className="w-full h-10 px-3 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-lg text-sm text-gray-900 dark:text-brand-off-white focus:outline-none focus:border-brand-light-pink/50"
                >
                  <option value="All">All Platforms</option>
                  {banks.map(bank => <option key={bank} value={bank}>{bank}</option>)}
                </select>
              </div>
              {sourceFilter === "imported" && (
                <div>
                  <label className="block font-mono text-[11px] tracking-[0.12em] text-emerald-500 dark:text-emerald-400 uppercase mb-2">Sheet</label>
                  <select
                    value={selectedSheet}
                    onChange={(e) => setSelectedSheet(e.target.value)}
                    className="w-full h-10 px-3 bg-emerald-500/5 dark:bg-emerald-500/[0.06] border border-emerald-500/20 dark:border-emerald-500/15 rounded-lg text-sm text-gray-900 dark:text-brand-off-white focus:outline-none focus:border-emerald-500/50"
                  >
                    <option value="All">All Sheets</option>
                    {importedSheets.map(sheet => <option key={sheet} value={sheet}>{sheet}</option>)}
                  </select>
                </div>
              )}
            </div>
            {(activeFilterCount > 0 || selectedSheet !== "All") && (
              <button
                onClick={() => { setSelectedCategory("All"); setSelectedType("All"); setSelectedBank("All"); setSelectedSheet("All"); }}
                className="mt-3 text-sm font-mono text-brand-light-pink hover:text-brand-mid-pink transition-colors tracking-wide"
              >
                clear all filters
              </button>
            )}
          </div>
        )}
      </div>

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
            <span className="font-semibold text-brand-blue">Shared Profile:</span> This profile was shared with you{getSharedProfileOwnerName && ` by ${getSharedProfileOwnerName}`}. You can view and manage captions collaboratively.
          </p>
        </div>
      )}

      {/* Stats Bar */}
      <div className="px-6 sm:px-8 pt-4 flex gap-6 flex-wrap">
        <span className="font-mono text-[11px] tracking-[0.08em] text-gray-400 dark:text-gray-600">
          <span className="text-gray-600 dark:text-gray-400">{filteredCaptions.length}</span> caption{filteredCaptions.length !== 1 ? "s" : ""}
          {searchDebounce && ` matching "${searchDebounce}"`}
        </span>
        <span className="font-mono text-[11px] tracking-[0.08em] text-gray-400 dark:text-gray-600">
          <span className="text-gray-600 dark:text-gray-400">{captions.length}</span> total
        </span>
        <span className="font-mono text-[11px] tracking-[0.08em] text-brand-blue/60">
          <Database className="w-3 h-3 inline mr-0.5" />
          <span className="text-brand-blue">{captions.filter(c => c.source === "gallery").length}</span> gallery
        </span>
        <span className="font-mono text-[11px] tracking-[0.08em] text-emerald-500/60">
          <FileSpreadsheet className="w-3 h-3 inline mr-0.5" />
          <span className="text-emerald-500">{captions.filter(c => c.source === "imported").length}</span> imported
        </span>
        {captions.reduce((acc, c) => acc + c.usageCount, 0) > 0 && (
          <span className="font-mono text-[11px] tracking-[0.08em] text-gray-400 dark:text-gray-600">
            <span className="text-gray-600 dark:text-gray-400">{captions.reduce((acc, c) => acc + c.usageCount, 0)}</span> sales
          </span>
        )}
      </div>

      {/* Content */}
      <div className="px-6 sm:px-8 py-5">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-brand-light-pink/30 border-t-brand-light-pink rounded-full animate-spin" />
          </div>
        ) : filteredCaptions.length === 0 ? (
          <div className="text-center py-16 font-mono text-[13px] tracking-[0.05em] text-gray-400 dark:text-gray-600">
            {searchDebounce ? "no captions found" : "no gallery items with captions found"}
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {paginatedCaptions.map((caption) => {
              const catStyle = getCategoryStyle(caption.captionCategory);
              const long = isLongCaption(caption.caption);
              const expanded = expandedCards.has(caption.id);
              return (
                <div
                  key={caption.id}
                  className="group bg-gray-50/50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.06] rounded-[14px] p-5 flex flex-col gap-3.5 transition-all duration-200 hover:border-gray-300 dark:hover:border-white/[0.12] hover:-translate-y-0.5 relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-brand-light-pink to-brand-mid-pink" />

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {isAllProfiles && caption.profileName && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-brand-light-pink/10 text-brand-light-pink text-[10px] font-mono tracking-[0.05em] rounded-full">
                        <User className="w-3 h-3" />
                        {caption.profileName}
                      </span>
                    )}
                    <span className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] font-mono tracking-[0.05em] rounded-full ${
                      caption.source === "gallery"
                        ? "bg-brand-blue/10 text-brand-blue"
                        : "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400"
                    }`}>
                      {caption.source === "gallery" ? <Database className="w-3 h-3" /> : <FileSpreadsheet className="w-3 h-3" />}
                      {caption.source === "gallery" ? "Gallery" : "Imported"}
                    </span>
                  </div>

                  <div className={`font-mono text-[13px] leading-[1.75] text-gray-600 dark:text-gray-300 font-light italic whitespace-pre-wrap break-words ${long && !expanded ? "line-clamp-4" : ""}`}>
                    {caption.caption}
                  </div>

                  {long && (
                    <button
                      onClick={() => toggleExpand(caption.id)}
                      className="font-mono text-[11px] text-brand-light-pink hover:text-brand-mid-pink transition-colors tracking-[0.05em] text-left flex items-center gap-1"
                    >
                      {expanded ? <><ChevronUp className="w-3 h-3" /> show less</> : <><ChevronDown className="w-3 h-3" /> show more</>}
                    </button>
                  )}

                  <div className="flex items-center justify-between gap-2 flex-wrap mt-auto">
                    <div className="flex gap-1.5 flex-wrap flex-1">
                      <span className={`font-mono text-[10px] tracking-[0.1em] uppercase px-2.5 py-1 rounded-full border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}>
                        {caption.captionCategory}
                      </span>
                      {caption.captionTypes && caption.captionTypes !== "Unknown" && caption.captionTypes !== caption.captionCategory && (
                        <span className="font-mono text-[10px] tracking-[0.1em] uppercase px-2.5 py-1 rounded-full border bg-brand-blue/10 dark:bg-brand-blue/15 text-brand-blue border-brand-blue/25">
                          {caption.captionTypes}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleCopyCaption(caption.caption, caption.id)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border font-mono text-[11px] tracking-[0.05em] transition-all flex-shrink-0 ${
                        copiedId === caption.id
                          ? "border-emerald-500/40 text-emerald-500 dark:text-emerald-400"
                          : "border-gray-200 dark:border-white/[0.08] text-gray-400 dark:text-gray-600 hover:border-brand-light-pink/40 hover:text-brand-light-pink"
                      }`}
                    >
                      {copiedId === caption.id ? (
                        <><Check className="w-3 h-3" /> copied</>
                      ) : (
                        <><Copy className="w-3 h-3" /> copy</>
                      )}
                    </button>
                  </div>

                  {(caption.usageCount > 0 || caption.captionBanks !== "Unknown") && (
                    <div className="flex items-center gap-4 text-[10px] font-mono text-gray-400 dark:text-gray-600 tracking-[0.05em]">
                      {caption.usageCount > 0 && (
                        <span className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          {caption.usageCount} sales
                        </span>
                      )}
                      {caption.captionBanks !== "Unknown" && (
                        <span className="flex items-center gap-1">
                          <Folder className="w-3 h-3" />
                          {caption.captionBanks}
                        </span>
                      )}
                      {caption.lastUsedAt && (
                        <span>{new Date(caption.lastUsedAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-gray-50/50 dark:bg-white/[0.02] rounded-[14px] border border-gray-200 dark:border-white/[0.06] overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-white/[0.06] bg-gray-100/50 dark:bg-white/[0.02]">
                  {isAllProfiles && <th className="px-4 py-3 text-left font-mono text-[10px] tracking-[0.12em] text-gray-500 uppercase">Profile</th>}
                  <th className="px-4 py-3 text-left font-mono text-[10px] tracking-[0.12em] text-gray-500 uppercase">Caption</th>
                  <th className="px-4 py-3 text-left font-mono text-[10px] tracking-[0.12em] text-gray-500 uppercase">Source</th>
                  <th className="px-4 py-3 text-left font-mono text-[10px] tracking-[0.12em] text-gray-500 uppercase">Content Type</th>
                  <th className="px-4 py-3 text-left font-mono text-[10px] tracking-[0.12em] text-gray-500 uppercase">Platform</th>
                  <th className="px-4 py-3 text-left font-mono text-[10px] tracking-[0.12em] text-gray-500 uppercase">Posted</th>
                  <th className="px-4 py-3 text-right font-mono text-[10px] tracking-[0.12em] text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/[0.04]">
                {paginatedCaptions.map((caption) => (
                  <tr key={caption.id} className="group transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                    {isAllProfiles && (
                      <td className="px-4 py-4">
                        {caption.profileName && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-brand-light-pink/10 text-brand-light-pink text-[10px] font-mono rounded-full whitespace-nowrap">
                            <User className="w-3 h-3" />
                            {caption.profileName}
                          </span>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-4">
                      <p className="text-sm text-gray-900 dark:text-brand-off-white line-clamp-2 font-mono text-[13px] font-light italic">{caption.caption}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] font-mono tracking-[0.05em] rounded-full whitespace-nowrap ${
                        caption.source === "gallery"
                          ? "bg-brand-blue/10 text-brand-blue"
                          : "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400"
                      }`}>
                        {caption.source === "gallery" ? <Database className="w-3 h-3" /> : <FileSpreadsheet className="w-3 h-3" />}
                        {caption.source === "gallery" ? "Gallery" : "Imported"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="font-mono text-[10px] tracking-[0.1em] uppercase px-2.5 py-1 rounded-full border bg-brand-light-pink/10 text-brand-light-pink border-brand-light-pink/25">
                        {caption.captionCategory}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm font-mono text-gray-600 dark:text-gray-400">{caption.captionBanks}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-xs font-mono text-gray-400 dark:text-gray-500">{caption.lastUsedAt ? new Date(caption.lastUsedAt).toLocaleDateString() : "—"}</span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end">
                        <button
                          onClick={() => handleCopyCaption(caption.caption, caption.id)}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border font-mono text-[11px] tracking-[0.05em] transition-all ${
                            copiedId === caption.id
                              ? "border-emerald-500/40 text-emerald-500"
                              : "border-gray-200 dark:border-white/[0.08] text-gray-400 dark:text-gray-600 hover:border-brand-light-pink/40 hover:text-brand-light-pink"
                          }`}
                        >
                          {copiedId === caption.id ? <><Check className="w-3 h-3" /> copied</> : <><Copy className="w-3 h-3" /> copy</>}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && !loading && (
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

      {/* Stats Modal */}
      {showStatsModal && typeof window !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-white/[0.1] rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-brand-light-pink/10 dark:bg-brand-light-pink/15 rounded-xl flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-brand-light-pink" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-brand-off-white">Statistics</h2>
              </div>
              <button onClick={() => setShowStatsModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/[0.04] rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-100px)]">
              {stats ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-gray-50 dark:bg-white/[0.03] rounded-xl p-4 text-center border border-gray-100 dark:border-white/[0.06]">
                      <p className="text-2xl font-bold text-gray-900 dark:text-brand-off-white">{stats.totalCaptions}</p>
                      <p className="text-[10px] font-mono tracking-[0.1em] text-gray-500 mt-1 uppercase">Total</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-white/[0.03] rounded-xl p-4 text-center border border-gray-100 dark:border-white/[0.06]">
                      <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.favoriteCaptions}</p>
                      <p className="text-[10px] font-mono tracking-[0.1em] text-gray-500 mt-1 uppercase">Favorites</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-white/[0.03] rounded-xl p-4 text-center border border-gray-100 dark:border-white/[0.06]">
                      <p className="text-2xl font-bold text-brand-light-pink">{stats.totalUsage}</p>
                      <p className="text-[10px] font-mono tracking-[0.1em] text-gray-500 mt-1 uppercase">Total Usage</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-white/[0.03] rounded-xl p-4 text-center border border-gray-100 dark:border-white/[0.06]">
                      <p className="text-2xl font-bold text-brand-blue">{stats.captionsInCooldown?.length || 0}</p>
                      <p className="text-[10px] font-mono tracking-[0.1em] text-gray-500 mt-1 uppercase">In Cooldown</p>
                    </div>
                  </div>

                  {stats.mostUsed && stats.mostUsed.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-brand-off-white mb-3 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-brand-light-pink" /> Most Used
                      </h3>
                      <div className="space-y-2">
                        {stats.mostUsed.slice(0, 5).map((item, i) => (
                          <div key={item.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-white/[0.03] rounded-xl border border-gray-100 dark:border-white/[0.06]">
                            <span className="w-6 h-6 bg-brand-light-pink/10 text-brand-light-pink text-xs font-bold rounded-full flex items-center justify-center">{i + 1}</span>
                            <p className="flex-1 text-sm text-gray-900 dark:text-brand-off-white truncate font-mono font-light italic">{item.caption}</p>
                            <span className="text-sm font-semibold text-brand-light-pink font-mono">{item.usageCount}x</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {stats.categoryStats && stats.categoryStats.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-brand-off-white mb-3 flex items-center gap-2">
                        <Tag className="w-4 h-4 text-brand-blue" /> By Category
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {stats.categoryStats.map(cat => (
                          <div key={cat.category} className="p-3 bg-gray-50 dark:bg-white/[0.03] rounded-xl border border-gray-100 dark:border-white/[0.06]">
                            <p className="text-sm font-medium text-gray-900 dark:text-brand-off-white truncate">{cat.category}</p>
                            <p className="text-[10px] font-mono text-gray-500 tracking-[0.05em]">{cat.count} captions · {cat.totalUsage} uses</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-4 border-brand-light-pink/30 border-t-brand-light-pink rounded-full animate-spin" />
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Import Modal */}
      {showImportModal && typeof window !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-white/[0.1] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/10 dark:bg-emerald-500/15 rounded-xl flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-brand-off-white">Import Captions</h2>
                  <p className="text-xs font-mono text-gray-500 tracking-wide">Upload .xlsx spreadsheet</p>
                </div>
              </div>
              <button onClick={() => { setShowImportModal(false); setImportFile(null); setImportResult(null); }} className="p-2 hover:bg-gray-100 dark:hover:bg-white/[0.04] rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
                <>

                  <div
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                    onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                    onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDragging(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file && (file.name.endsWith(".xlsx") || file.name.endsWith(".xls"))) {
                        setImportFile(file);
                        setImportResult(null);
                      }
                    }}
                    className={`relative rounded-xl p-8 text-center transition-all duration-200 border-2 border-dashed ${
                      isDragging
                        ? "border-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/[0.08] scale-[1.02]"
                        : importFile
                          ? "border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-500/[0.04]"
                          : "border-gray-300 dark:border-white/[0.12] bg-gray-50 dark:bg-white/[0.03] hover:border-brand-light-pink/40 hover:bg-brand-light-pink/5 dark:hover:bg-brand-light-pink/[0.04]"
                    }`}
                  >
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={(e) => { setImportFile(e.target.files?.[0] || null); setImportResult(null); }}
                      className="hidden"
                      id="xlsx-upload"
                    />
                    <label htmlFor="xlsx-upload" className="cursor-pointer block">
                      {isDragging ? (
                        <>
                          <div className="w-14 h-14 bg-emerald-500/15 rounded-2xl flex items-center justify-center mx-auto mb-3">
                            <FileSpreadsheet className="w-7 h-7 text-emerald-500 animate-bounce" />
                          </div>
                          <p className="text-sm font-semibold text-emerald-500">Drop your file here</p>
                        </>
                      ) : importFile ? (
                        <>
                          <div className="w-14 h-14 bg-emerald-500/15 rounded-2xl flex items-center justify-center mx-auto mb-3">
                            <FileSpreadsheet className="w-7 h-7 text-emerald-500" />
                          </div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-brand-off-white">{importFile.name}</p>
                          <p className="text-[11px] font-mono text-gray-500 dark:text-gray-400 mt-1">
                            {(importFile.size / 1024).toFixed(0)} KB
                          </p>
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); setImportFile(null); setImportResult(null); }}
                            className="mt-2 text-[11px] font-mono text-brand-light-pink hover:text-brand-mid-pink transition-colors tracking-wide"
                          >
                            remove file
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="w-14 h-14 bg-gray-100 dark:bg-white/[0.06] rounded-2xl flex items-center justify-center mx-auto mb-3">
                            <Upload className="w-7 h-7 text-gray-400 dark:text-gray-500" />
                          </div>
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Drag & drop your <span className="text-emerald-500 font-semibold">.xlsx</span> file here
                          </p>
                          <p className="text-[11px] font-mono text-gray-400 dark:text-gray-600 mt-1.5 tracking-wide">
                            or click to browse
                          </p>
                          <p className="text-[10px] font-mono text-gray-400 dark:text-gray-600 mt-3 tracking-wide">CST - Post Generation Harvest Caption Bank</p>
                        </>
                      )}
                    </label>
                  </div>

                  <div className="bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.08] rounded-xl p-4">
                    <p className="text-[10px] font-mono text-gray-500 dark:text-gray-400 tracking-[0.1em] uppercase mb-2">Sheets to import</p>
                    <div className="flex flex-wrap gap-1.5">
                      {importedSheets.map(sheet => (
                        <span key={sheet} className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono rounded-full">{sheet}</span>
                      ))}
                    </div>
                    <p className="text-[10px] font-mono text-gray-400 dark:text-gray-600 mt-2 tracking-wide">Only Edited Caption column is imported. Duplicates are auto-skipped.</p>
                  </div>

                  {importResult && (
                    <div className={`rounded-xl p-4 border ${importResult.imported > 0 ? "bg-emerald-50/80 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40" : "bg-gray-50 dark:bg-white/[0.03] border-gray-200 dark:border-white/[0.08]"}`}>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div>
                          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{importResult.imported}</p>
                          <p className="text-[10px] font-mono text-gray-500 tracking-wide">Imported</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{importResult.duplicatesSkipped}</p>
                          <p className="text-[10px] font-mono text-gray-500 tracking-wide">Skipped</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-gray-600 dark:text-gray-400">{importResult.totalProcessed}</p>
                          <p className="text-[10px] font-mono text-gray-500 tracking-wide">Total</p>
                        </div>
                      </div>
                      {importResult.sheetStats && (
                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-white/[0.06]">
                          <p className="text-[10px] font-mono text-gray-500 tracking-[0.1em] uppercase mb-1.5">Per sheet</p>
                          <div className="space-y-1">
                            {Object.entries(importResult.sheetStats).filter(([, count]) => count > 0).map(([sheet, count]) => (
                              <div key={sheet} className="flex items-center justify-between text-[11px] font-mono">
                                <span className="text-gray-600 dark:text-gray-400">{sheet}</span>
                                <span className="text-gray-900 dark:text-brand-off-white font-medium">{count}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {importing && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-gray-500 dark:text-gray-400 tracking-wide">
                          {importProgress < 50 ? "Uploading file..." : importProgress < 90 ? "Processing sheets..." : importProgress < 100 ? "Saving captions..." : "Complete!"}
                        </span>
                        <span className="text-emerald-500 font-medium">{importProgress}%</span>
                      </div>
                      <div className="h-2 bg-gray-200 dark:bg-white/[0.08] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-300 ease-out"
                          style={{ width: `${importProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleImportXlsx}
                    disabled={!importFile || importing || !!importResult}
                    className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white font-semibold text-sm rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    {importing ? (
                      <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Importing...</>
                    ) : (
                      <><Upload className="w-4 h-4" /> Import Captions</>
                    )}
                  </button>
                </>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Duplicates Modal */}
      {showDuplicatesModal && typeof window !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-white/[0.1] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-brand-dark-pink/10 dark:bg-brand-dark-pink/15 rounded-xl flex items-center justify-center">
                  <Layers className="w-5 h-5 text-brand-dark-pink" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-brand-off-white">Duplicates</h2>
                  <p className="text-sm font-mono text-gray-500 tracking-wide">{duplicateGroups.length > 0 ? `${duplicateGroups.length} group(s) found` : "No duplicates"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {duplicateGroups.length > 0 && (
                  <button onClick={deleteAllDuplicates} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2 transition-colors">
                    <Trash2 className="w-4 h-4" />
                    Remove All
                  </button>
                )}
                <button onClick={() => setShowDuplicatesModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/[0.04] rounded-lg">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-100px)]">
              {duplicateGroups.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Check className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-brand-off-white">All Clear!</h3>
                  <p className="text-sm font-mono text-gray-500 mt-1 tracking-wide">No duplicate captions found.</p>
                </div>
              ) : (
                duplicateGroups.map((group, idx) => (
                  <div key={group.original.id} className="border border-gray-200 dark:border-white/[0.08] rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-white/[0.03]">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-gray-900 dark:text-brand-off-white">Group {idx + 1}</span>
                        <span className="px-2 py-0.5 bg-brand-dark-pink/10 text-brand-dark-pink text-xs font-mono rounded-full">{group.similarity}% similar</span>
                      </div>
                      <button onClick={() => mergeDuplicates(group, true)} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors">
                        <Merge className="w-3 h-3" /> Keep First
                      </button>
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-white/[0.04]">
                      <div className="p-4 bg-emerald-50/50 dark:bg-emerald-900/10 flex items-start gap-3">
                        <span className="px-2 py-0.5 bg-emerald-600 text-white text-xs font-bold rounded">KEEP</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-mono font-light italic text-gray-900 dark:text-brand-off-white line-clamp-2">{group.original.caption}</p>
                          <p className="text-[10px] font-mono text-gray-500 mt-1 tracking-wide">{group.original.captionCategory} · Used {group.original.usageCount}x</p>
                        </div>
                      </div>
                      {group.duplicates.map(dup => (
                        <div key={dup.id} className="p-4 bg-red-50/30 dark:bg-red-900/10 flex items-start gap-3">
                          <span className="px-2 py-0.5 bg-red-600 text-white text-xs font-bold rounded">DUP</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-mono font-light italic text-gray-900 dark:text-brand-off-white line-clamp-2">{dup.caption}</p>
                            <p className="text-[10px] font-mono text-gray-500 mt-1 tracking-wide">{dup.captionCategory} · Used {dup.usageCount}x</p>
                          </div>
                          <button
                            onClick={() => {
                              handleDeleteCaption(dup.id);
                              setDuplicateGroups(prev => prev.map(g => g.original.id === group.original.id ? { ...g, duplicates: g.duplicates.filter(d => d.id !== dup.id) } : g).filter(g => g.duplicates.length > 0));
                            }}
                            className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
