"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useInstagramProfile } from "@/hooks/useInstagramProfile";
import { useUser } from "@clerk/nextjs";
import {
  Search,
  Plus,
  Copy,
  Edit,
  Trash2,
  X,
  Check,
  Star,
  User,
  Users,
  FileText,
  AlertCircle,
  Clock,
  Upload,
  Download,
  BarChart3,
  Sparkles,
  Tag,
  CheckSquare,
  Square,
  Layers,
  MoveRight,
  Merge,
  Filter,
  SortAsc,
  Folder,
  TrendingUp,
  Info,
  Share2,
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

export function Captions() {
  // Use global profile selector
  const { profileId: globalProfileId, profiles: globalProfiles, loadingProfiles } = useInstagramProfile();
  const { user: clerkUser } = useUser();
  
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const profiles = useMemo(() => 
    [...globalProfiles].sort((a, b) => 
      (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
    ), 
    [globalProfiles]
  );

  // Helper to check if selected profile is shared (not owned by current user)
  const isSharedProfile = useMemo(() => {
    if (!selectedProfileId || selectedProfileId === "all" || !clerkUser?.id) return false;
    const profile = profiles.find(p => p.id === selectedProfileId);
    if (!profile) return false;
    // Check if the profile's clerkId matches the current user
    return profile.clerkId !== clerkUser.id;
  }, [selectedProfileId, profiles, clerkUser?.id]);

  // Helper to get owner name for shared profiles
  const getSharedProfileOwnerName = useMemo(() => {
    if (!isSharedProfile) return null;
    const profile = profiles.find(p => p.id === selectedProfileId);
    if (!profile?.user) return null;
    if (profile.user.firstName && profile.user.lastName) {
      return `${profile.user.firstName} ${profile.user.lastName}`;
    }
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
  const [showNewCaptionModal, setShowNewCaptionModal] = useState(false);
  const [showEditCaptionModal, setShowEditCaptionModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [editingCaption, setEditingCaption] = useState<Caption | null>(null);
  const [newCaption, setNewCaption] = useState({
    caption: "",
    captionCategory: "",
    captionTypes: "",
    captionBanks: "",
    notes: "",
    tags: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [searchDebounce, setSearchDebounce] = useState("");
  
  // Enhanced features state
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'createdAt' | 'usageCount' | 'lastUsedAt' | 'caption'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [importData, setImportData] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [stats, setStats] = useState<CaptionStats | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Quick Edit Mode state
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [inlineEditValue, setInlineEditValue] = useState("");
  const inlineEditRef = useRef<HTMLTextAreaElement>(null);

  // Bulk Actions state
  const [selectedCaptions, setSelectedCaptions] = useState<Set<string>>(new Set());
  const [showBulkMoveModal, setShowBulkMoveModal] = useState(false);
  const [bulkMoveTarget, setBulkMoveTarget] = useState({ category: "", type: "", bank: "" });

  // Duplicate Detection state
  const [showDuplicatesModal, setShowDuplicatesModal] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);

  // View mode
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // All Profiles mode
  const isAllProfiles = selectedProfileId === "all";

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

  const categories = captionCategories;
  const types = captionTypes;
  const banks = captionBanks;

  // Sync with global profile selector
  useEffect(() => {
    if (globalProfileId && globalProfileId !== selectedProfileId) {
      setSelectedProfileId(globalProfileId);
    }
  }, [globalProfileId]);

  // Listen for profile changes from global selector
  useEffect(() => {
    const handleProfileChange = (event: CustomEvent<{ profileId: string }>) => {
      const newProfileId = event.detail.profileId;
      if (newProfileId && newProfileId !== selectedProfileId) {
        setSelectedProfileId(newProfileId);
      }
    };

    window.addEventListener('profileChanged', handleProfileChange as EventListener);
    return () => window.removeEventListener('profileChanged', handleProfileChange as EventListener);
  }, [selectedProfileId]);

  // Fetch captions when profile changes
  useEffect(() => {
    if (selectedProfileId) {
      fetchCaptions();
    } else {
      setCaptions([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProfileId, sortBy, sortOrder, showFavoritesOnly]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounce(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Auto-hide toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
  }, []);

  const fetchCaptions = async () => {
    if (!selectedProfileId) return;
    try {
      setLoading(true);
      const params = new URLSearchParams({ profileId: selectedProfileId, sortBy, sortOrder });
      if (showFavoritesOnly) params.append("favoritesOnly", "true");
      const response = await fetch(`/api/captions?${params}`);
      if (response.ok) {
        const data = await response.json();
        setCaptions(data);
      }
    } catch (error) {
      console.error("Failed to fetch captions:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    if (!selectedProfileId) return;
    try {
      const response = await fetch(`/api/captions/actions?profileId=${selectedProfileId}`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  };

  const handleToggleFavorite = async (id: string) => {
    try {
      const response = await fetch("/api/captions/actions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "toggleFavorite" }),
      });
      if (response.ok) {
        const updatedCaption = await response.json();
        setCaptions(captions.map((c) => (c.id === id ? updatedCaption : c)));
        showToast(updatedCaption.isFavorite ? "Added to favorites" : "Removed from favorites", "success");
      }
    } catch (error) {
      console.error("Failed to toggle favorite:", error);
      showToast("Failed to update", "error");
    }
  };

  const handleDeleteCaption = async (id: string) => {
    if (!confirm("Delete this caption?")) return;
    try {
      const response = await fetch(`/api/captions?id=${id}`, { method: "DELETE" });
      if (response.ok) {
        setCaptions(captions.filter((c) => c.id !== id));
        showToast("Caption deleted", "success");
      } else {
        showToast("Failed to delete", "error");
      }
    } catch (error) {
      console.error("Failed to delete:", error);
      showToast("Failed to delete", "error");
    }
  };

  const handleAddCaption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCaption.caption || !newCaption.captionCategory || !newCaption.captionTypes || !newCaption.captionBanks) {
      showToast("Please fill all required fields", "error");
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/captions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: selectedProfileId,
          ...newCaption,
          notes: newCaption.notes || null,
          tags: newCaption.tags || null,
        }),
      });
      if (response.ok) {
        const createdCaption = await response.json();
        setCaptions([createdCaption, ...captions]);
        setShowNewCaptionModal(false);
        setNewCaption({ caption: "", captionCategory: "", captionTypes: "", captionBanks: "", notes: "", tags: "" });
        showToast("Caption created!", "success");
      } else {
        showToast("Failed to create", "error");
      }
    } catch (error) {
      console.error("Failed to create:", error);
      showToast("Failed to create", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditCaption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCaption) return;
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/captions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingCaption.id,
          caption: editingCaption.caption,
          captionCategory: editingCaption.captionCategory,
          captionTypes: editingCaption.captionTypes,
          captionBanks: editingCaption.captionBanks,
          notes: editingCaption.notes,
          tags: editingCaption.tags,
        }),
      });
      if (response.ok) {
        const updatedCaption = await response.json();
        setCaptions(captions.map((c) => (c.id === updatedCaption.id ? updatedCaption : c)));
        setShowEditCaptionModal(false);
        setEditingCaption(null);
        showToast("Caption updated!", "success");
      } else {
        showToast("Failed to update", "error");
      }
    } catch (error) {
      console.error("Failed to update:", error);
      showToast("Failed to update", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (caption: Caption) => {
    setEditingCaption(caption);
    setShowEditCaptionModal(true);
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
    return matchesSearch && matchesCategory && matchesType && matchesBank;
  });

  const isCaptionInCooldown = (caption: Caption): { inCooldown: boolean; daysRemaining: number } => {
    if (!caption.lastUsedAt) return { inCooldown: false, daysRemaining: 0 };
    const lastUsed = new Date(caption.lastUsedAt);
    const cooldownEnd = new Date(lastUsed);
    cooldownEnd.setDate(cooldownEnd.getDate() + (caption.cooldownDays || 7));
    const now = new Date();
    if (cooldownEnd > now) {
      const daysRemaining = Math.ceil((cooldownEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return { inCooldown: true, daysRemaining };
    }
    return { inCooldown: false, daysRemaining: 0 };
  };

  const handleCopyCaption = async (text: string, id: string) => {
    const caption = captions.find(c => c.id === id);
    if (caption) {
      const { inCooldown, daysRemaining } = isCaptionInCooldown(caption);
      if (inCooldown) {
        const proceed = confirm(`⚠️ This caption is in cooldown for ${daysRemaining} more day(s). Copy anyway?`);
        if (!proceed) return;
      }
    }
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    try {
      const response = await fetch("/api/captions/actions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "trackUsage" }),
      });
      if (response.ok) {
        const updatedCaption = await response.json();
        setCaptions(captions.map((c) => (c.id === id ? updatedCaption : c)));
      }
    } catch (error) {
      console.error("Failed to track usage:", error);
    }
    showToast("Copied to clipboard!", "success");
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Import/Export
  const handleExportCaptions = async (format: 'json' | 'csv') => {
    if (!selectedProfileId) return;
    const params = new URLSearchParams({ profileId: selectedProfileId, format });
    if (selectedCategory !== "All") params.append("category", selectedCategory);
    if (selectedType !== "All") params.append("type", selectedType);
    if (selectedBank !== "All") params.append("bank", selectedBank);
    if (showFavoritesOnly) params.append("favoritesOnly", "true");
    try {
      const response = await fetch(`/api/captions/bulk?${params}`);
      if (format === 'csv') {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `captions-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } else {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `captions-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      }
      showToast("Export complete!", "success");
    } catch (error) {
      console.error("Failed to export:", error);
      showToast("Export failed", "error");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (file.name.endsWith('.csv')) {
        const lines = content.split('\n');
        const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
        const parsedCaptions = lines.slice(1).filter(line => line.trim()).map(line => {
          const values = line.match(/("([^"]|"")*"|[^,]*)/g) || [];
          const obj: Record<string, string> = {};
          headers.forEach((header, i) => {
            obj[header.toLowerCase().replace(/ /g, '')] = (values[i] || '').replace(/^"|"$/g, '').replace(/""/g, '"').trim();
          });
          return {
            caption: obj.caption || '',
            captionCategory: obj.category || obj.captioncategory || '',
            captionTypes: obj.type || obj.captiontypes || '',
            captionBanks: obj.bank || obj.captionbanks || '',
          };
        });
        setImportData(JSON.stringify(parsedCaptions, null, 2));
      } else {
        try {
          const data = JSON.parse(content);
          const parsedCaptions = data.captions || data;
          setImportData(JSON.stringify(parsedCaptions, null, 2));
        } catch {
          showToast("Invalid JSON file", "error");
        }
      }
    };
    reader.readAsText(file);
  };

  const handleImportCaptions = async () => {
    if (!importData || !selectedProfileId) return;
    setIsImporting(true);
    try {
      const parsedCaptions = JSON.parse(importData);
      const response = await fetch("/api/captions/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: selectedProfileId, captions: parsedCaptions }),
      });
      if (response.ok) {
        const result = await response.json();
        showToast(`Imported ${result.imported} captions!`, "success");
        setShowImportModal(false);
        setImportData("");
        fetchCaptions();
      } else {
        const error = await response.json();
        showToast(error.error || "Import failed", "error");
      }
    } catch (error) {
      console.error("Failed to import:", error);
      showToast("Invalid import data", "error");
    } finally {
      setIsImporting(false);
    }
  };

  // Quick Edit Mode
  const startInlineEdit = (caption: Caption) => {
    setInlineEditId(caption.id);
    setInlineEditValue(caption.caption);
    setTimeout(() => inlineEditRef.current?.focus(), 50);
  };

  const cancelInlineEdit = () => {
    setInlineEditId(null);
    setInlineEditValue("");
  };

  const saveInlineEdit = async () => {
    if (!inlineEditId || !inlineEditValue.trim()) {
      cancelInlineEdit();
      return;
    }
    const caption = captions.find(c => c.id === inlineEditId);
    if (!caption || caption.caption === inlineEditValue.trim()) {
      cancelInlineEdit();
      return;
    }
    try {
      const response = await fetch("/api/captions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: inlineEditId, caption: inlineEditValue.trim() }),
      });
      if (response.ok) {
        setCaptions(prev => prev.map(c => c.id === inlineEditId ? { ...c, caption: inlineEditValue.trim() } : c));
        showToast("Updated!", "success");
      } else {
        showToast("Update failed", "error");
      }
    } catch (error) {
      console.error("Failed to save:", error);
      showToast("Update failed", "error");
    } finally {
      cancelInlineEdit();
    }
  };

  const handleInlineKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") cancelInlineEdit();
    else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) saveInlineEdit();
  };

  // Bulk Actions
  const toggleCaptionSelection = (captionId: string) => {
    setSelectedCaptions(prev => {
      const next = new Set(prev);
      if (next.has(captionId)) next.delete(captionId);
      else next.add(captionId);
      return next;
    });
  };

  const selectAllVisible = () => setSelectedCaptions(new Set(filteredCaptions.map(c => c.id)));
  const clearSelection = () => setSelectedCaptions(new Set());

  const handleBulkDelete = async () => {
    if (selectedCaptions.size === 0) return;
    if (!confirm(`Delete ${selectedCaptions.size} caption(s)?`)) return;
    let successCount = 0;
    for (const id of selectedCaptions) {
      try {
        const response = await fetch(`/api/captions?id=${id}`, { method: "DELETE" });
        if (response.ok) successCount++;
      } catch { /* ignore */ }
    }
    if (successCount > 0) {
      setCaptions(prev => prev.filter(c => !selectedCaptions.has(c.id)));
      showToast(`Deleted ${successCount} caption(s)`, "success");
    }
    clearSelection();
  };

  const handleBulkFavorite = async (favorite: boolean) => {
    if (selectedCaptions.size === 0) return;
    let successCount = 0;
    for (const id of selectedCaptions) {
      try {
        const response = await fetch("/api/captions/actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "toggleFavorite", captionId: id }),
        });
        if (response.ok) successCount++;
      } catch { /* ignore */ }
    }
    if (successCount > 0) {
      setCaptions(prev => prev.map(c => selectedCaptions.has(c.id) ? { ...c, isFavorite: favorite } : c));
      showToast(`Updated ${successCount} caption(s)`, "success");
    }
    clearSelection();
  };

  const handleBulkMove = async () => {
    if (selectedCaptions.size === 0) return;
    if (!bulkMoveTarget.category && !bulkMoveTarget.type && !bulkMoveTarget.bank) {
      showToast("Select at least one field", "error");
      return;
    }
    let successCount = 0;
    for (const id of selectedCaptions) {
      const caption = captions.find(c => c.id === id);
      if (!caption) continue;
      try {
        const response = await fetch("/api/captions", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id,
            captionCategory: bulkMoveTarget.category || caption.captionCategory,
            captionTypes: bulkMoveTarget.type || caption.captionTypes,
            captionBanks: bulkMoveTarget.bank || caption.captionBanks,
          }),
        });
        if (response.ok) successCount++;
      } catch { /* ignore */ }
    }
    if (successCount > 0) {
      setCaptions(prev => prev.map(c => selectedCaptions.has(c.id) ? {
        ...c,
        captionCategory: bulkMoveTarget.category || c.captionCategory,
        captionTypes: bulkMoveTarget.type || c.captionTypes,
        captionBanks: bulkMoveTarget.bank || c.captionBanks,
      } : c));
      showToast(`Moved ${successCount} caption(s)`, "success");
    }
    setShowBulkMoveModal(false);
    setBulkMoveTarget({ category: "", type: "", bank: "" });
    clearSelection();
  };

  // Duplicate Detection
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

  const mergeDuplicates = async (group: DuplicateGroup, keepOriginal: boolean) => {
    const toDelete = keepOriginal ? group.duplicates.map(d => d.id) : [group.original.id, ...group.duplicates.slice(1).map(d => d.id)];
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

  if (loadingProfiles && profiles.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-[#EC67A1]/30 border-t-[#EC67A1] rounded-full animate-spin" />
          <p className="text-sm text-header-muted">Loading...</p>
        </div>
      </div>
    );
  }

  if (profiles.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-zinc-400 dark:text-zinc-500" />
          </div>
          <h3 className="text-lg font-semibold text-sidebar-foreground mb-2">No profiles found</h3>
          <p className="text-sm text-header-muted">Create an Instagram profile first</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-h-[85vh] overflow-y-auto overflow-x-hidden bg-[#F8F8F8] dark:bg-[#0a0a0f] border border-[#EC67A1]/20 dark:border-[#EC67A1]/30 rounded-2xl shadow-lg custom-scrollbar">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 duration-300">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border ${
            toast.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300' :
            toast.type === 'error' ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300' :
            'bg-[#5DC3F8]/5 dark:bg-[#5DC3F8]/10 border-[#5DC3F8]/30 dark:border-[#5DC3F8]/20 text-[#5DC3F8]'
          }`}>
            {toast.type === 'success' && <Check className="w-5 h-5" />}
            {toast.type === 'error' && <AlertCircle className="w-5 h-5" />}
            {toast.type === 'info' && <Sparkles className="w-5 h-5" />}
            <span className="font-medium text-sm">{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-2 hover:opacity-70">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-h-[70vh] overflow-y-auto overflow-x-hidden bg-white dark:bg-white/5 border border-[#EC67A1]/20 rounded-xl p-5 sm:p-6 shadow-lg backdrop-blur-sm">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <h1 className="text-3xl font-bold text-sidebar-foreground tracking-tight flex items-center gap-3">
                Caption Bank
                {isAllProfiles && (
                  <span className="px-3 py-1 bg-pink-100 dark:bg-pink-900/30 border border-pink-200 dark:border-pink-800 rounded-full text-sm font-medium text-pink-600 dark:text-pink-400 flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    All Profiles
                  </span>
                )}
                {isSharedProfile && !isAllProfiles && (
                  <span className="px-3 py-1 bg-[#5DC3F8]/10 dark:bg-[#5DC3F8]/20 border border-[#5DC3F8]/30 dark:border-[#5DC3F8]/20 rounded-full text-sm font-medium text-[#5DC3F8] flex items-center gap-1">
                    <Share2 className="w-4 h-4" />
                    Shared
                  </span>
                )}
              </h1>
              <p className="mt-1 text-header-muted">
                {isAllProfiles 
                  ? "Viewing captions from all profiles"
                  : isSharedProfile
                    ? <>Viewing captions for <span className="text-[#EC67A1] font-medium">{selectedProfile?.name}</span> {getSharedProfileOwnerName && <span className="text-[#5DC3F8]">(shared by {getSharedProfileOwnerName})</span>}</>
                    : <>Manage captions for <span className="text-[#EC67A1] font-medium">{selectedProfile?.name}</span></>
                }
              </p>
            </div>

            {/* Profile Selector & Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => { fetchStats(); setShowStatsModal(true); }}
                disabled={isAllProfiles}
                className="h-10 px-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-medium text-sidebar-foreground hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <BarChart3 className="w-4 h-4" />
                <span className="hidden sm:inline">Stats</span>
              </button>

              {!isAllProfiles && (
                <button
                  onClick={() => setShowImportModal(true)}
                  className="h-10 px-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-medium text-sidebar-foreground hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  <span className="hidden sm:inline">Import</span>
                </button>
              )}

              <button
                onClick={() => handleExportCaptions('csv')}
                className="h-10 px-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-medium text-sidebar-foreground hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Export</span>
              </button>

              <button
                onClick={findDuplicates}
                disabled={isCheckingDuplicates || captions.length < 2 || isAllProfiles}
                className="h-10 px-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-medium text-sidebar-foreground hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCheckingDuplicates ? (
                  <div className="w-4 h-4 border-2 border-zinc-400 dark:border-zinc-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Layers className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">Duplicates</span>
              </button>

              {!isAllProfiles && (
                <button
                  onClick={() => setShowNewCaptionModal(true)}
                  className="h-10 px-5 bg-[#EC67A1] hover:bg-[#E1518E] text-white rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 shadow-lg shadow-[#EC67A1]/25"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Caption</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* All Profiles Info Banner */}
        {isAllProfiles && (
          <div className="mb-6 bg-gradient-to-r from-pink-50 via-violet-50 to-blue-50 dark:from-pink-900/20 dark:via-violet-900/20 dark:to-blue-900/20 border border-pink-200 dark:border-pink-800 rounded-xl p-4 flex items-center gap-3">
            <Info className="w-5 h-5 text-pink-500 flex-shrink-0" />
            <p className="text-sm text-sidebar-foreground">
              <span className="font-medium text-pink-600 dark:text-pink-400">All Profiles Mode:</span> Viewing captions from all profiles. Select a specific profile to add, edit, or delete captions.
            </p>
          </div>
        )}

        {/* Shared Profile Info Banner */}
        {isSharedProfile && !isAllProfiles && (
          <div className="mb-6 bg-gradient-to-r from-[#5DC3F8]/5 via-[#5DC3F8]/10 to-[#5DC3F8]/5 dark:from-[#5DC3F8]/10 dark:via-[#5DC3F8]/20 dark:to-[#5DC3F8]/10 border border-[#5DC3F8]/30 dark:border-[#5DC3F8]/20 rounded-xl p-4 flex items-center gap-3">
            <Share2 className="w-5 h-5 text-[#5DC3F8] flex-shrink-0" />
            <p className="text-sm text-sidebar-foreground">
              <span className="font-medium text-[#5DC3F8]">Shared Profile:</span> This profile was shared with you{getSharedProfileOwnerName && ` by ${getSharedProfileOwnerName}`}. You can view, edit, add, and manage captions collaboratively.
            </p>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-header-muted">Total Captions</p>
                <p className="text-2xl font-bold text-sidebar-foreground mt-1">{captions.length}</p>
              </div>
              <div className="w-12 h-12 bg-[#EC67A1]/10 dark:bg-[#EC67A1]/20 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-[#EC67A1]" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-header-muted">Favorites</p>
                <p className="text-2xl font-bold text-sidebar-foreground mt-1">{captions.filter(c => c.isFavorite).length}</p>
              </div>
              <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
                <Star className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-header-muted">Categories</p>
                <p className="text-2xl font-bold text-sidebar-foreground mt-1">
                  {new Set(captions.map(c => c.captionCategory)).size}
                </p>
              </div>
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
                <Tag className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-header-muted">Total Usage</p>
                <p className="text-2xl font-bold text-sidebar-foreground mt-1">
                  {captions.reduce((acc, c) => acc + c.usageCount, 0)}
                </p>
              </div>
              <div className="w-12 h-12 bg-[#5DC3F8]/10 dark:bg-[#5DC3F8]/20 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-[#5DC3F8]" />
              </div>
            </div>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 dark:text-zinc-500" />
              <input
                type="text"
                placeholder="Search captions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-11 pl-12 pr-4 bg-zinc-50 dark:bg-zinc-800 border-0 rounded-xl text-sidebar-foreground placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#EC67A1]"
              />
            </div>

            {/* Filter Toggles */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                className={`h-11 px-4 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                  showFavoritesOnly
                    ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-2 border-amber-300 dark:border-amber-700'
                    : 'bg-zinc-50 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                }`}
              >
                <Star className={`w-4 h-4 ${showFavoritesOnly ? 'fill-current' : ''}`} />
                Favorites
              </button>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`h-11 px-4 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                  showFilters || selectedCategory !== 'All' || selectedType !== 'All' || selectedBank !== 'All'
                    ? 'bg-[#EC67A1]/10 dark:bg-[#EC67A1]/20 text-[#EC67A1] border-2 border-[#EC67A1]/30 dark:border-[#EC67A1]/40'
                    : 'bg-zinc-50 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                }`}
              >
                <Filter className="w-4 h-4" />
                Filters
                {(selectedCategory !== 'All' || selectedType !== 'All' || selectedBank !== 'All') && (
                  <span className="w-5 h-5 bg-[#EC67A1] text-white text-xs rounded-full flex items-center justify-center">
                    {[selectedCategory !== 'All', selectedType !== 'All', selectedBank !== 'All'].filter(Boolean).length}
                  </span>
                )}
              </button>

              <div className="relative">
                <select
                  value={`${sortBy}-${sortOrder}`}
                  onChange={(e) => {
                    const [field, order] = e.target.value.split('-');
                    setSortBy(field as typeof sortBy);
                    setSortOrder(order as typeof sortOrder);
                  }}
                  className="h-11 pl-4 pr-10 bg-zinc-50 dark:bg-zinc-800 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#EC67A1]"
                >
                  <option value="createdAt-desc">Newest First</option>
                  <option value="createdAt-asc">Oldest First</option>
                  <option value="usageCount-desc">Most Used</option>
                  <option value="usageCount-asc">Least Used</option>
                  <option value="lastUsedAt-desc">Recently Used</option>
                  <option value="caption-asc">A to Z</option>
                  <option value="caption-desc">Z to A</option>
                </select>
                <SortAsc className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500 pointer-events-none" />
              </div>

              <div className="flex items-center bg-zinc-50 dark:bg-zinc-800 rounded-xl p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-white dark:bg-zinc-700 shadow' : ''}`}
                >
                  <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-white dark:bg-gray-700 shadow' : ''}`}
                >
                  <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-header-muted uppercase tracking-wider mb-2">Category</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full h-10 px-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-sidebar-foreground focus:outline-none focus:ring-2 focus:ring-[#EC67A1]"
                  >
                    <option value="All">All Categories</option>
                    {captionCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-header-muted uppercase tracking-wider mb-2">Type</label>
                  <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    className="w-full h-10 px-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-sidebar-foreground focus:outline-none focus:ring-2 focus:ring-[#EC67A1]"
                  >
                    <option value="All">All Types</option>
                    {captionTypes.map(type => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-header-muted uppercase tracking-wider mb-2">Bank</label>
                  <select
                    value={selectedBank}
                    onChange={(e) => setSelectedBank(e.target.value)}
                    className="w-full h-10 px-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-sidebar-foreground focus:outline-none focus:ring-2 focus:ring-[#EC67A1]"
                  >
                    <option value="All">All Banks</option>
                    {captionBanks.map(bank => <option key={bank} value={bank}>{bank}</option>)}
                  </select>
                </div>
              </div>
              {(selectedCategory !== 'All' || selectedType !== 'All' || selectedBank !== 'All') && (
                <button
                  onClick={() => { setSelectedCategory('All'); setSelectedType('All'); setSelectedBank('All'); }}
                  className="mt-3 text-sm text-[#EC67A1] hover:underline"
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Bulk Actions Bar */}
        {selectedCaptions.size > 0 && !isAllProfiles && (
          <div className="bg-[#EC67A1] rounded-2xl p-4 mb-6 flex items-center justify-between shadow-lg shadow-[#EC67A1]/20">
            <div className="flex items-center gap-3 text-white">
              <CheckSquare className="w-5 h-5" />
              <span className="font-semibold">{selectedCaptions.size} selected</span>
              <button onClick={clearSelection} className="text-[#EC67A1]/70 hover:text-white text-sm underline">
                Clear
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleBulkFavorite(true)}
                className="h-9 px-4 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <Star className="w-4 h-4" />
                <span className="hidden sm:inline">Favorite</span>
              </button>
              <button
                onClick={() => setShowBulkMoveModal(true)}
                className="h-9 px-4 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <MoveRight className="w-4 h-4" />
                <span className="hidden sm:inline">Move</span>
              </button>
              <button
                onClick={handleBulkDelete}
                className="h-9 px-4 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Delete</span>
              </button>
            </div>
          </div>
        )}

        {/* Results Count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-header-muted">
            {filteredCaptions.length} caption{filteredCaptions.length !== 1 ? 's' : ''}
            {searchDebounce && ` matching "${searchDebounce}"`}
            {isAllProfiles && " (All Profiles)"}
          </p>
          {filteredCaptions.length > 0 && !isAllProfiles && (
            <button
              onClick={() => selectedCaptions.size === filteredCaptions.length ? clearSelection() : selectAllVisible()}
              className="text-sm text-[#EC67A1] hover:underline"
            >
              {selectedCaptions.size === filteredCaptions.length ? 'Deselect all' : 'Select all'}
            </button>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-[#EC67A1]/30 border-t-[#EC67A1] rounded-full animate-spin" />
          </div>
        ) : filteredCaptions.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-12 text-center">
            <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-zinc-400 dark:text-zinc-500" />
            </div>
            <h3 className="text-lg font-semibold text-sidebar-foreground mb-2">No captions found</h3>
            <p className="text-sm text-header-muted mb-6">
              {searchDebounce ? 'Try a different search term' : 'Get started by adding your first caption'}
            </p>
            {!searchDebounce && (
              <button
                onClick={() => setShowNewCaptionModal(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#EC67A1] hover:bg-[#E1518E] text-white rounded-xl text-sm font-semibold transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Caption
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredCaptions.map((caption) => {
              const cooldownStatus = isCaptionInCooldown(caption);
              const isSelected = selectedCaptions.has(caption.id);
              const isEditing = inlineEditId === caption.id;

              return (
                <div
                  key={caption.id}
                  className={`group bg-white dark:bg-zinc-900 rounded-2xl border transition-all duration-200 ${
                    isSelected
                      ? 'border-[#EC67A1] ring-2 ring-[#EC67A1]/20'
                      : 'border-zinc-100 dark:border-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-700'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between p-4 border-b border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-3">
                      {!isAllProfiles && (
                        <button
                          onClick={() => toggleCaptionSelection(caption.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-[#EC67A1]" />
                          ) : (
                            <Square className="w-5 h-5 text-zinc-400 dark:text-zinc-500" />
                          )}
                        </button>
                      )}
                      {isAllProfiles && caption.profileName && (
                        <span className="flex items-center gap-1 px-2 py-1 bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300 text-xs font-medium rounded-lg">
                          <User className="w-3 h-3" />
                          {caption.profileName}
                        </span>
                      )}
                      <span className="px-2.5 py-1 bg-[#EC67A1]/10 dark:bg-[#EC67A1]/20 text-[#EC67A1] text-xs font-semibold rounded-lg">
                        {caption.captionCategory}
                      </span>
                      {cooldownStatus.inCooldown && (
                        <span className="flex items-center gap-1 px-2 py-1 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-xs font-medium rounded-lg">
                          <Clock className="w-3 h-3" />
                          {cooldownStatus.daysRemaining}d
                        </span>
                      )}
                    </div>
                    {!isAllProfiles && (
                      <button
                        onClick={() => handleToggleFavorite(caption.id)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          caption.isFavorite ? 'text-amber-500' : 'text-gray-300 hover:text-amber-500'
                        }`}
                      >
                        <Star className={`w-5 h-5 ${caption.isFavorite ? 'fill-current' : ''}`} />
                      </button>
                    )}
                    {isAllProfiles && caption.isFavorite && (
                      <Star className="w-5 h-5 text-amber-500 fill-current" />
                    )}
                  </div>

                  {/* Card Body */}
                  <div className="p-4" onDoubleClick={() => !isEditing && startInlineEdit(caption)}>
                    {isEditing ? (
                      <div className="space-y-3">
                        <textarea
                          ref={inlineEditRef}
                          value={inlineEditValue}
                          onChange={(e) => setInlineEditValue(e.target.value)}
                          onKeyDown={handleInlineKeyDown}
                          className="w-full p-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-sidebar-foreground resize-none focus:outline-none focus:ring-2 focus:ring-[#EC67A1]"
                          rows={4}
                          autoFocus
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={saveInlineEdit}
                            className="flex items-center gap-1 px-3 py-1.5 bg-[#EC67A1] text-white text-xs font-medium rounded-lg hover:bg-[#E1518E] transition-colors"
                          >
                            <Check className="w-3 h-3" /> Save
                          </button>
                          <button
                            onClick={cancelInlineEdit}
                            className="flex items-center gap-1 px-3 py-1.5 bg-zinc-200 dark:bg-zinc-700 text-sidebar-foreground text-xs font-medium rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
                          >
                            <X className="w-3 h-3" /> Cancel
                          </button>
                          <span className="text-xs text-zinc-400 dark:text-zinc-500">Ctrl+Enter to save</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-sidebar-foreground line-clamp-4 cursor-pointer" title="Double-click to edit">
                        {caption.caption}
                      </p>
                    )}
                  </div>

                  {/* Card Footer */}
                  <div className="flex items-center justify-between p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 rounded-b-2xl">
                    <div className="flex items-center gap-4 text-xs text-header-muted">
                      <span className="flex items-center gap-1">
                        <Copy className="w-3.5 h-3.5" />
                        {caption.usageCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <Folder className="w-3.5 h-3.5" />
                        {caption.captionBanks.split(' ')[0]}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleCopyCaption(caption.caption, caption.id)}
                        className={`p-2 rounded-lg transition-colors ${
                          copiedId === caption.id
                            ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600'
                            : 'hover:bg-zinc-100 dark:hover:bg-zinc-700 text-gray-500'
                        }`}
                        title="Copy"
                      >
                        {copiedId === caption.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </button>
                      {!isAllProfiles && (
                        <>
                          <button
                            onClick={() => openEditModal(caption)}
                            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-gray-500 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteCaption(caption.id)}
                            className="p-2 hover:bg-red-100 dark:hover:bg-red-900/40 text-gray-500 hover:text-red-600 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* List View */
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
                  {!isAllProfiles && (
                    <th className="w-12 px-4 py-3">
                      <button
                        onClick={() => selectedCaptions.size === filteredCaptions.length ? clearSelection() : selectAllVisible()}
                        className="p-1"
                      >
                        {selectedCaptions.size === filteredCaptions.length && filteredCaptions.length > 0 ? (
                          <CheckSquare className="w-5 h-5 text-[#EC67A1]" />
                        ) : (
                          <Square className="w-5 h-5 text-zinc-400 dark:text-zinc-500" />
                        )}
                      </button>
                    </th>
                  )}
                  {isAllProfiles && (
                    <th className="px-4 py-3 text-left text-xs font-semibold text-header-muted uppercase tracking-wider">Profile</th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-header-muted uppercase tracking-wider">Caption</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-header-muted uppercase tracking-wider">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-header-muted uppercase tracking-wider">Used</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-header-muted uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {filteredCaptions.map((caption) => {
                  const cooldownStatus = isCaptionInCooldown(caption);
                  const isSelected = selectedCaptions.has(caption.id);
                  const isEditing = inlineEditId === caption.id;

                  return (
                    <tr
                      key={caption.id}
                      className={`group transition-colors ${isSelected ? 'bg-[#EC67A1]/5 dark:bg-[#EC67A1]/10' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'}`}
                    >
                      {!isAllProfiles && (
                        <td className="px-4 py-4">
                          <button onClick={() => toggleCaptionSelection(caption.id)} className="p-1">
                            {isSelected ? (
                              <CheckSquare className="w-5 h-5 text-[#EC67A1]" />
                            ) : (
                              <Square className="w-5 h-5 text-zinc-300 dark:text-zinc-600 group-hover:text-zinc-400 dark:group-hover:text-zinc-500" />
                            )}
                          </button>
                        </td>
                      )}
                      {isAllProfiles && (
                        <td className="px-4 py-4">
                          {caption.profileName && (
                            <span className="flex items-center gap-1 px-2 py-1 bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300 text-xs font-medium rounded-lg whitespace-nowrap">
                              <User className="w-3 h-3" />
                              {caption.profileName}
                            </span>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-4" onDoubleClick={() => !isEditing && !isAllProfiles && startInlineEdit(caption)}>
                        <div className="flex items-start gap-3">
                          {!isAllProfiles ? (
                            <button
                              onClick={() => handleToggleFavorite(caption.id)}
                              className={`flex-shrink-0 mt-0.5 ${caption.isFavorite ? 'text-amber-500' : 'text-gray-300 hover:text-amber-500'}`}
                            >
                              <Star className={`w-4 h-4 ${caption.isFavorite ? 'fill-current' : ''}`} />
                            </button>
                          ) : caption.isFavorite ? (
                            <Star className="w-4 h-4 text-amber-500 fill-current flex-shrink-0 mt-0.5" />
                          ) : null}
                          <div className="flex-1 min-w-0">
                            {isEditing && !isAllProfiles ? (
                              <div className="space-y-2">
                                <textarea
                                  ref={inlineEditRef}
                                  value={inlineEditValue}
                                  onChange={(e) => setInlineEditValue(e.target.value)}
                                  onKeyDown={handleInlineKeyDown}
                                  className="w-full p-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-sidebar-foreground resize-none focus:outline-none focus:ring-2 focus:ring-[#EC67A1]"
                                  rows={3}
                                  autoFocus
                                />
                                <div className="flex items-center gap-2">
                                  <button onClick={saveInlineEdit} className="px-2 py-1 bg-[#EC67A1] text-white text-xs rounded hover:bg-[#E1518E]">Save</button>
                                  <button onClick={cancelInlineEdit} className="px-2 py-1 bg-zinc-200 dark:bg-zinc-700 text-sidebar-foreground text-xs rounded">Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <p className={`text-sm text-sidebar-foreground line-clamp-2 ${!isAllProfiles ? 'cursor-pointer' : ''}`} title={!isAllProfiles ? "Double-click to edit" : undefined}>{caption.caption}</p>
                                {cooldownStatus.inCooldown && (
                                  <span className="inline-flex items-center gap-1 mt-1 text-xs text-amber-600 dark:text-amber-400">
                                    <Clock className="w-3 h-3" />
                                    Cooldown: {cooldownStatus.daysRemaining}d
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 text-sidebar-foreground text-xs font-medium rounded-lg">
                          {caption.captionCategory}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-sm font-semibold text-sidebar-foreground">{caption.usageCount}</span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleCopyCaption(caption.caption, caption.id)}
                            className={`p-2 rounded-lg transition-colors ${
                              copiedId === caption.id ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500'
                            }`}
                          >
                            {copiedId === caption.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          </button>
                          {!isAllProfiles && (
                            <>
                              <button onClick={() => openEditModal(caption)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-gray-500 rounded-lg">
                                <Edit className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDeleteCaption(caption.id)} className="p-2 hover:bg-red-100 dark:hover:bg-red-900/40 text-gray-500 hover:text-red-600 rounded-lg">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        </div>
      </div>

      {/* Add Caption Modal */}
      {showNewCaptionModal && typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="text-xl font-bold text-sidebar-foreground">Add Caption</h2>
              <button onClick={() => setShowNewCaptionModal(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleAddCaption} className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-180px)]">
              <div>
                <label className="block text-sm font-medium text-sidebar-foreground mb-2">Caption *</label>
                <textarea
                  value={newCaption.caption}
                  onChange={(e) => setNewCaption({ ...newCaption, caption: e.target.value })}
                  rows={4}
                  placeholder="Enter your caption..."
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sidebar-foreground placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#EC67A1] resize-none"
                  required
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-sidebar-foreground mb-2">Category *</label>
                  <select
                    value={newCaption.captionCategory}
                    onChange={(e) => setNewCaption({ ...newCaption, captionCategory: e.target.value })}
                    className="w-full h-11 px-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sidebar-foreground focus:outline-none focus:ring-2 focus:ring-[#EC67A1]"
                    required
                  >
                    <option value="">Select...</option>
                    {captionCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-sidebar-foreground mb-2">Type *</label>
                  <select
                    value={newCaption.captionTypes}
                    onChange={(e) => setNewCaption({ ...newCaption, captionTypes: e.target.value })}
                    className="w-full h-11 px-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sidebar-foreground focus:outline-none focus:ring-2 focus:ring-[#EC67A1]"
                    required
                  >
                    <option value="">Select...</option>
                    {captionTypes.map(type => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-sidebar-foreground mb-2">Bank *</label>
                  <select
                    value={newCaption.captionBanks}
                    onChange={(e) => setNewCaption({ ...newCaption, captionBanks: e.target.value })}
                    className="w-full h-11 px-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sidebar-foreground focus:outline-none focus:ring-2 focus:ring-[#EC67A1]"
                    required
                  >
                    <option value="">Select...</option>
                    {captionBanks.map(bank => <option key={bank} value={bank}>{bank}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-sidebar-foreground mb-2">Tags</label>
                <input
                  type="text"
                  value={newCaption.tags}
                  onChange={(e) => setNewCaption({ ...newCaption, tags: e.target.value })}
                  placeholder="Add tags separated by commas"
                  className="w-full h-11 px-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sidebar-foreground placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#EC67A1]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-sidebar-foreground mb-2">Notes</label>
                <textarea
                  value={newCaption.notes}
                  onChange={(e) => setNewCaption({ ...newCaption, notes: e.target.value })}
                  rows={2}
                  placeholder="Add any notes..."
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sidebar-foreground placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#EC67A1] resize-none"
                />
              </div>
            </form>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
              <button
                type="button"
                onClick={() => setShowNewCaptionModal(false)}
                className="px-5 py-2.5 text-sidebar-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCaption}
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-[#EC67A1] hover:bg-[#E1518E] disabled:opacity-50 text-white rounded-xl font-semibold transition-colors flex items-center gap-2"
              >
                {isSubmitting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Add Caption
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Caption Modal */}
      {showEditCaptionModal && editingCaption && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="text-xl font-bold text-sidebar-foreground">Edit Caption</h2>
              <button onClick={() => setShowEditCaptionModal(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleEditCaption} className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-180px)]">
              <div>
                <label className="block text-sm font-medium text-sidebar-foreground mb-2">Caption *</label>
                <textarea
                  value={editingCaption.caption}
                  onChange={(e) => setEditingCaption({ ...editingCaption, caption: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sidebar-foreground focus:outline-none focus:ring-2 focus:ring-[#EC67A1] resize-none"
                  required
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-sidebar-foreground mb-2">Category</label>
                  <select
                    value={editingCaption.captionCategory}
                    onChange={(e) => setEditingCaption({ ...editingCaption, captionCategory: e.target.value })}
                    className="w-full h-11 px-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sidebar-foreground focus:outline-none focus:ring-2 focus:ring-[#EC67A1]"
                  >
                    {captionCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-sidebar-foreground mb-2">Type</label>
                  <select
                    value={editingCaption.captionTypes}
                    onChange={(e) => setEditingCaption({ ...editingCaption, captionTypes: e.target.value })}
                    className="w-full h-11 px-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sidebar-foreground focus:outline-none focus:ring-2 focus:ring-[#EC67A1]"
                  >
                    {captionTypes.map(type => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-sidebar-foreground mb-2">Bank</label>
                  <select
                    value={editingCaption.captionBanks}
                    onChange={(e) => setEditingCaption({ ...editingCaption, captionBanks: e.target.value })}
                    className="w-full h-11 px-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sidebar-foreground focus:outline-none focus:ring-2 focus:ring-[#EC67A1]"
                  >
                    {captionBanks.map(bank => <option key={bank} value={bank}>{bank}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-sidebar-foreground mb-2">Tags</label>
                <input
                  type="text"
                  value={editingCaption.tags || ''}
                  onChange={(e) => setEditingCaption({ ...editingCaption, tags: e.target.value })}
                  className="w-full h-11 px-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sidebar-foreground focus:outline-none focus:ring-2 focus:ring-[#EC67A1]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-sidebar-foreground mb-2">Notes</label>
                <textarea
                  value={editingCaption.notes || ''}
                  onChange={(e) => setEditingCaption({ ...editingCaption, notes: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sidebar-foreground focus:outline-none focus:ring-2 focus:ring-[#EC67A1] resize-none"
                />
              </div>
            </form>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
              <button
                type="button"
                onClick={() => setShowEditCaptionModal(false)}
                className="px-5 py-2.5 text-sidebar-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEditCaption}
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-[#EC67A1] hover:bg-[#E1518E] disabled:opacity-50 text-white rounded-xl font-semibold transition-colors flex items-center gap-2"
              >
                {isSubmitting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Import Modal */}
      {showImportModal && typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center">
                  <Upload className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <h2 className="text-xl font-bold text-sidebar-foreground">Import Captions</h2>
              </div>
              <button onClick={() => { setShowImportModal(false); setImportData(""); }} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-180px)]">
              <div>
                <label className="block text-sm font-medium text-sidebar-foreground mb-2">Upload File</label>
                <div className="flex items-center gap-3">
                  <input ref={fileInputRef} type="file" accept=".csv,.json" onChange={handleFileUpload} className="hidden" />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 h-24 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl hover:border-[#EC67A1] dark:hover:border-[#EC67A1] transition-colors flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-[#EC67A1]"
                  >
                    <Upload className="w-6 h-6" />
                    <span className="text-sm font-medium">Click to upload CSV or JSON</span>
                  </button>
                </div>
              </div>
              <div className="p-4 bg-[#5DC3F8]/5 dark:bg-[#5DC3F8]/10 rounded-xl border border-[#5DC3F8]/30 dark:border-[#5DC3F8]/20">
                <h4 className="text-sm font-semibold text-[#5DC3F8] mb-1">Format</h4>
                <p className="text-xs text-[#5DC3F8]">
                  JSON: {`[{"caption": "...", "captionCategory": "...", "captionTypes": "...", "captionBanks": "..."}]`}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-sidebar-foreground mb-2">Preview / Paste Data</label>
                <textarea
                  value={importData}
                  onChange={(e) => setImportData(e.target.value)}
                  rows={8}
                  placeholder="Paste JSON data here..."
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-mono text-sm text-sidebar-foreground focus:outline-none focus:ring-2 focus:ring-[#EC67A1]"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
              <button
                onClick={() => { setShowImportModal(false); setImportData(""); }}
                className="px-5 py-2.5 text-sidebar-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleImportCaptions}
                disabled={isImporting || !importData}
                className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-xl font-semibold transition-colors flex items-center gap-2"
              >
                {isImporting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Import
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Stats Modal */}
      {showStatsModal && typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h2 className="text-xl font-bold text-sidebar-foreground">Statistics</h2>
              </div>
              <button onClick={() => setShowStatsModal(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-100px)]">
              {stats ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-sidebar-foreground">{stats.totalCaptions}</p>
                      <p className="text-xs text-header-muted mt-1">Total</p>
                    </div>
                    <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.favoriteCaptions}</p>
                      <p className="text-xs text-header-muted mt-1">Favorites</p>
                    </div>
                    <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-[#EC67A1]">{stats.totalUsage}</p>
                      <p className="text-xs text-header-muted mt-1">Total Usage</p>
                    </div>
                    <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.captionsInCooldown?.length || 0}</p>
                      <p className="text-xs text-header-muted mt-1">In Cooldown</p>
                    </div>
                  </div>

                  {stats.mostUsed && stats.mostUsed.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-sidebar-foreground mb-3 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" /> Most Used
                      </h3>
                      <div className="space-y-2">
                        {stats.mostUsed.slice(0, 5).map((item, i) => (
                          <div key={item.id} className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
                            <span className="w-6 h-6 bg-[#EC67A1]/10 dark:bg-[#EC67A1]/20 text-[#EC67A1] text-xs font-bold rounded-full flex items-center justify-center">{i + 1}</span>
                            <p className="flex-1 text-sm text-sidebar-foreground truncate">{item.caption}</p>
                            <span className="text-sm font-semibold text-[#EC67A1]">{item.usageCount}x</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {stats.categoryStats && stats.categoryStats.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-sidebar-foreground mb-3 flex items-center gap-2">
                        <Tag className="w-4 h-4" /> By Category
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {stats.categoryStats.map(cat => (
                          <div key={cat.category} className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
                            <p className="text-sm font-medium text-sidebar-foreground truncate">{cat.category}</p>
                            <p className="text-xs text-header-muted">{cat.count} captions · {cat.totalUsage} uses</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Bulk Move Modal */}
      {showBulkMoveModal && typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#EC67A1]/10 dark:bg-[#EC67A1]/20 rounded-xl flex items-center justify-center">
                  <MoveRight className="w-5 h-5 text-[#EC67A1]" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-sidebar-foreground">Move Captions</h2>
                  <p className="text-sm text-gray-500">{selectedCaptions.size} selected</p>
                </div>
              </div>
              <button onClick={() => setShowBulkMoveModal(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">Leave empty to keep current value.</p>
              <div>
                <label className="block text-sm font-medium text-sidebar-foreground mb-2">Category</label>
                <select
                  value={bulkMoveTarget.category}
                  onChange={(e) => setBulkMoveTarget(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full h-11 px-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sidebar-foreground focus:outline-none focus:ring-2 focus:ring-[#EC67A1]"
                >
                  <option value="">Keep current</option>
                  {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-sidebar-foreground mb-2">Type</label>
                <select
                  value={bulkMoveTarget.type}
                  onChange={(e) => setBulkMoveTarget(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full h-11 px-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sidebar-foreground focus:outline-none focus:ring-2 focus:ring-[#EC67A1]"
                >
                  <option value="">Keep current</option>
                  {types.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-sidebar-foreground mb-2">Bank</label>
                <select
                  value={bulkMoveTarget.bank}
                  onChange={(e) => setBulkMoveTarget(prev => ({ ...prev, bank: e.target.value }))}
                  className="w-full h-11 px-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sidebar-foreground focus:outline-none focus:ring-2 focus:ring-[#EC67A1]"
                >
                  <option value="">Keep current</option>
                  {banks.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
              <button onClick={() => setShowBulkMoveModal(false)} className="px-5 py-2.5 text-sidebar-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl font-medium">Cancel</button>
              <button onClick={handleBulkMove} className="px-5 py-2.5 bg-[#EC67A1] hover:bg-[#E1518E] text-white rounded-xl font-semibold">Move</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Duplicates Modal */}
      {showDuplicatesModal && typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-rose-100 dark:bg-rose-900/30 rounded-xl flex items-center justify-center">
                  <Layers className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-sidebar-foreground">Duplicates</h2>
                  <p className="text-sm text-gray-500">{duplicateGroups.length > 0 ? `${duplicateGroups.length} group(s) found` : 'No duplicates'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {duplicateGroups.length > 0 && (
                  <button onClick={deleteAllDuplicates} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-xl flex items-center gap-2">
                    <Trash2 className="w-4 h-4" />
                    Remove All
                  </button>
                )}
                <button onClick={() => setShowDuplicatesModal(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-100px)]">
              {duplicateGroups.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Check className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-sidebar-foreground">All Clear!</h3>
                  <p className="text-sm text-gray-500 mt-1">No duplicate captions found.</p>
                </div>
              ) : (
                duplicateGroups.map((group, idx) => (
                  <div key={group.original.id} className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-sidebar-foreground">Group {idx + 1}</span>
                        <span className="px-2 py-0.5 bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 text-xs font-medium rounded-full">{group.similarity}% similar</span>
                      </div>
                      <button onClick={() => mergeDuplicates(group, true)} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg flex items-center gap-1">
                        <Merge className="w-3 h-3" /> Keep First
                      </button>
                    </div>
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      <div className="p-4 bg-emerald-50/50 dark:bg-emerald-900/10 flex items-start gap-3">
                        <span className="px-2 py-0.5 bg-emerald-600 text-white text-xs font-bold rounded">KEEP</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-sidebar-foreground line-clamp-2">{group.original.caption}</p>
                          <p className="text-xs text-gray-500 mt-1">{group.original.captionCategory} · Used {group.original.usageCount}x</p>
                        </div>
                      </div>
                      {group.duplicates.map(dup => (
                        <div key={dup.id} className="p-4 bg-red-50/30 dark:bg-red-900/10 flex items-start gap-3">
                          <span className="px-2 py-0.5 bg-red-600 text-white text-xs font-bold rounded">DUP</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-sidebar-foreground line-clamp-2">{dup.caption}</p>
                            <p className="text-xs text-gray-500 mt-1">{dup.captionCategory} · Used {dup.usageCount}x</p>
                          </div>
                          <button
                            onClick={() => {
                              handleDeleteCaption(dup.id);
                              setDuplicateGroups(prev => prev.map(g => g.original.id === group.original.id ? { ...g, duplicates: g.duplicates.filter(d => d.id !== dup.id) } : g).filter(g => g.duplicates.length > 0));
                            }}
                            className="p-2 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 rounded-lg"
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
