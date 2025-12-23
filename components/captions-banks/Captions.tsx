"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { FileText, Plus, Search, Filter, Edit, Trash2, Copy, Tag, User, X, Check, AlertCircle, Sparkles } from "lucide-react";
import { createPortal } from "react-dom";

interface Caption {
  id: string;
  caption: string;
  captionCategory: string;
  captionTypes: string;
  captionBanks: string;
  profileId: string;
  usageCount: number;
  createdAt: string;
}

interface InstagramProfile {
  id: string;
  name: string;
  instagramUsername: string | null;
  profileImageUrl: string | null;
  isDefault: boolean;
}

export function Captions() {
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [profiles, setProfiles] = useState<InstagramProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedType, setSelectedType] = useState("All");
  const [selectedBank, setSelectedBank] = useState("All");
  const [openFilterDropdown, setOpenFilterDropdown] = useState<'category' | 'type' | 'bank' | null>(null);
  const categoryButtonRef = useRef<HTMLButtonElement>(null);
  const typeButtonRef = useRef<HTMLButtonElement>(null);
  const bankButtonRef = useRef<HTMLButtonElement>(null);
  const [showNewCaptionModal, setShowNewCaptionModal] = useState(false);
  const [showEditCaptionModal, setShowEditCaptionModal] = useState(false);
  const [editingCaption, setEditingCaption] = useState<Caption | null>(null);
  const [newCaption, setNewCaption] = useState({
    caption: "",
    captionCategory: "",
    captionTypes: "",
    captionBanks: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [searchDebounce, setSearchDebounce] = useState("");
  const [swipedCard, setSwipedCard] = useState<string | null>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const captionCategories = [
    "Dick rating",
    "Solo DILDO",
    "Solo FINGERS",
    "Solo VIBRATOR",
    "JOI",
    "Squirting",
    "Cream Pie",
    "BG",
    "BJ",
    "GG",
    "GGG",
    "BGG",
    "BBG",
    "ORGY",
    "ANAL butt plug",
    "Anal SOLO",
    "Anal BG",
    "Lives",
  ];

  const filterCategories = ["All", ...captionCategories];

  const captionTypes = [
    "Bundle Unlocks",
    "Tip Me",
    "BIO",
    "VIP GIFT",
    "Short Unlocks",
    "Solo Unlocks",
    "Follow up Normal",
    "Mass Message Bumps",
    "Wall Bumps",
    "DM Funnels",
    "GIF Bumps",
    "Renew On",
    "VIP Post",
    "Link Drop",
    "Live Streams",
    "Live Mass Message",
    "Holiday Unlocks",
    "Live Preview",
    "Games",
    "New Sub Promo",
    "Winner Unlocks",
    "Descriptive",
    "OTP Style",
    "List Unlocks",
    "Model Specific",
    "SOP",
    "Holiday Non-PPV",
    "Timebound",
    "Follow Up Incentives",
    "Collab",
    "Tip Me Post",
    "Tip Me CTA",
    "MM Renew",
    "Renew Post",
    "Porn Post",
    "1 Person Tip Campaign",
    "VIP Membership",
    "DM Funnel (GF)",
    "Expired Sub Promo",
  ];

  const filterTypes = ["All", ...captionTypes];

  const captionBanks = [
    "Main Porn Caption Bank",
    "Post Generation Caption Bank",
    "High Sales Caption",
    "Better Bump Bank",
    "Custom",
    "Borrowed Captions",
    "CST - Post Generation Harvest Caption Bank",
  ];

  const filterBanks = ["All", ...captionBanks];

  // Fetch profiles on mount
  useEffect(() => {
    fetchProfiles();
  }, []);

  // Fetch captions when profile is selected
  useEffect(() => {
    if (selectedProfileId) {
      fetchCaptions();
    } else {
      setCaptions([]);
    }
  }, [selectedProfileId]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebounce(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Auto-hide toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.filter-dropdown-container')) {
        setOpenFilterDropdown(null);
      }
    };

    if (openFilterDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [openFilterDropdown]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
  }, []);

  const fetchProfiles = async () => {
    try {
      const response = await fetch("/api/instagram-profiles");
      if (response.ok) {
        const data = await response.json();
        setProfiles(data);
        // Auto-select default profile or first profile
        const defaultProfile = data.find((p: InstagramProfile) => p.isDefault) || data[0];
        if (defaultProfile) {
          setSelectedProfileId(defaultProfile.id);
        }
      }
    } catch (error) {
      console.error("Failed to fetch profiles:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCaptions = async () => {
    if (!selectedProfileId) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/captions?profileId=${selectedProfileId}`);
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

  const handleDeleteCaption = async (id: string) => {
    if (!confirm("Are you sure you want to delete this caption?")) return;

    try {
      const response = await fetch(`/api/captions?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setCaptions(captions.filter((c) => c.id !== id));
        showToast("Caption deleted successfully", "success");
      } else {
        showToast("Failed to delete caption", "error");
      }
    } catch (error) {
      console.error("Failed to delete caption:", error);
      showToast("Failed to delete caption", "error");
    }
  };

  const handleAddCaption = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newCaption.caption || !newCaption.captionCategory || !newCaption.captionTypes || !newCaption.captionBanks) {
      alert("Please fill in all fields");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/captions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          profileId: selectedProfileId,
          caption: newCaption.caption,
          captionCategory: newCaption.captionCategory,
          captionTypes: newCaption.captionTypes,
          captionBanks: newCaption.captionBanks,
        }),
      });

      if (response.ok) {
        const createdCaption = await response.json();
        setCaptions([createdCaption, ...captions]);
        setShowNewCaptionModal(false);
        setNewCaption({
          caption: "",
          captionCategory: "",
          captionTypes: "",
          captionBanks: "",
        });
        showToast("Caption added successfully!", "success");
      } else {
        showToast("Failed to create caption", "error");
      }
    } catch (error) {
      console.error("Failed to create caption:", error);
      showToast("Failed to create caption", "error");
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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: editingCaption.id,
          caption: editingCaption.caption,
          captionCategory: editingCaption.captionCategory,
          captionTypes: editingCaption.captionTypes,
          captionBanks: editingCaption.captionBanks,
        }),
      });

      if (response.ok) {
        const updatedCaption = await response.json();
        setCaptions(captions.map((c) => (c.id === updatedCaption.id ? updatedCaption : c)));
        setShowEditCaptionModal(false);
        setEditingCaption(null);
        showToast("Caption updated successfully!", "success");
      } else {
        showToast("Failed to update caption", "error");
      }
    } catch (error) {
      console.error("Failed to update caption:", error);
      showToast("Failed to update caption", "error");
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
      caption.captionBanks.toLowerCase().includes(searchDebounce.toLowerCase());
    const matchesCategory = selectedCategory === "All" || caption.captionCategory === selectedCategory;
    const matchesType = selectedType === "All" || caption.captionTypes === selectedType;
    const matchesBank = selectedBank === "All" || caption.captionBanks === selectedBank;
    return matchesSearch && matchesCategory && matchesType && matchesBank;
  });

  const handleCopyCaption = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast("Caption copied to clipboard!", "success");
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Swipe gesture handlers
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = (captionId: string) => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe) {
      setSwipedCard(captionId);
    }
    if (isRightSwipe) {
      setSwipedCard(null);
    }
  };

  const selectedProfile = profiles.find(p => p.id === selectedProfileId);

  if (loading && profiles.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading profiles...</p>
        </div>
      </div>
    );
  }

  if (profiles.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">No Instagram profiles found</p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
            Please create an Instagram profile first
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-slideInRight">
          <div className={`flex items-center space-x-3 px-4 py-3 rounded-lg shadow-2xl backdrop-blur-md border ${
            toast.type === 'success' 
              ? 'bg-green-50/90 dark:bg-green-900/90 border-green-200 dark:border-green-700' 
              : toast.type === 'error'
              ? 'bg-red-50/90 dark:bg-red-900/90 border-red-200 dark:border-red-700'
              : 'bg-blue-50/90 dark:bg-blue-900/90 border-blue-200 dark:border-blue-700'
          }`}>
            {toast.type === 'success' && <Check className="w-5 h-5 text-green-600 dark:text-green-400" />}
            {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />}
            {toast.type === 'info' && <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
            <p className={`text-sm font-medium ${
              toast.type === 'success' 
                ? 'text-green-800 dark:text-green-200' 
                : toast.type === 'error'
                ? 'text-red-800 dark:text-red-200'
                : 'text-blue-800 dark:text-blue-200'
            }`}>
              {toast.message}
            </p>
            <button onClick={() => setToast(null)} className="ml-2">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl shadow-lg">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 dark:from-blue-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
              Caption Banks
            </h1>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 ml-14">
            Manage and organize your social media captions for <span className="font-semibold text-purple-600 dark:text-purple-400">{selectedProfile?.name}</span>
          </p>
        </div>
        <button
          onClick={() => setShowNewCaptionModal(true)}
          className="group relative flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-white rounded-xl transition-all duration-300 shadow-lg hover:shadow-2xl hover:scale-105 active:scale-95 overflow-hidden"
        >
          <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
          <Plus className="w-5 h-5 relative z-10" />
          <span className="font-semibold relative z-10">Add Caption</span>
          <Sparkles className="w-4 h-4 relative z-10 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </div>

      {/* Profile Selector */}
      <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-xl opacity-30 group-hover:opacity-50 blur transition-all duration-300"></div>
        <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl p-5 border border-gray-200 dark:border-gray-700 backdrop-blur-sm">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-lg">
              <User className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                Instagram Profile
              </label>
              <select
                value={selectedProfileId}
                onChange={(e) => setSelectedProfileId(e.target.value)}
                className="w-full px-4 py-2.5 border-2 border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all font-medium cursor-pointer hover:border-purple-300 dark:hover:border-purple-600"
              >
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name} {profile.instagramUsername ? `(@${profile.instagramUsername})` : ""}
                    {profile.isDefault ? " ⭐" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-pink-600 via-purple-600 to-blue-600 rounded-xl opacity-20 group-hover:opacity-40 blur transition-all duration-300"></div>
        <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl p-5 border border-gray-200 dark:border-gray-700 backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative group/search">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within/search:text-purple-500 transition-colors" />
              <input
                type="text"
                placeholder="Search captions, categories, types..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-10 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-all"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </div>

            {/* Modern Pill-Style Filters */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Category Filter Pill */}
              <div className="relative filter-dropdown-container">
                <button
                  ref={categoryButtonRef}
                  onClick={() => setOpenFilterDropdown(openFilterDropdown === 'category' ? null : 'category')}
                  className={`group flex items-center gap-2 px-4 py-2.5 rounded-full font-medium text-sm transition-all duration-300 ${
                    selectedCategory !== "All"
                      ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 border-2 border-gray-300 dark:border-gray-600"
                  }`}
                >
                  <Tag className="w-4 h-4" />
                  <span>Category</span>
                  {selectedCategory !== "All" && (
                    <span className="flex items-center justify-center w-5 h-5 bg-white/20 rounded-full text-xs font-bold">
                      1
                    </span>
                  )}
                  <X 
                    className={`w-4 h-4 transition-transform duration-300 ${
                      openFilterDropdown === 'category' ? 'rotate-90' : ''
                    }`}
                  />
                </button>
                
                {openFilterDropdown === 'category' && categoryButtonRef.current && createPortal(
                  <div 
                    className="fixed w-64 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 max-h-80 overflow-y-auto animate-slideIn"
                    style={{
                      top: `${categoryButtonRef.current.getBoundingClientRect().bottom + 8}px`,
                      left: categoryButtonRef.current.getBoundingClientRect().left + 256 > window.innerWidth
                        ? `${window.innerWidth - 256 - 16}px`
                        : `${categoryButtonRef.current.getBoundingClientRect().left}px`,
                      zIndex: 9999
                    }}
                  >
                    <div className="p-2">
                      {filterCategories.map((category) => (
                        <button
                          key={category}
                          onClick={() => {
                            setSelectedCategory(category);
                            setOpenFilterDropdown(null);
                          }}
                          className={`w-full text-left px-4 py-2.5 rounded-lg transition-all ${
                            selectedCategory === category
                              ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium"
                              : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          {category}
                        </button>
                      ))}
                    </div>
                  </div>,
                  document.body
                )}
              </div>

              {/* Type Filter Pill */}
              <div className="relative filter-dropdown-container">
                <button
                  ref={typeButtonRef}
                  onClick={() => setOpenFilterDropdown(openFilterDropdown === 'type' ? null : 'type')}
                  className={`group flex items-center gap-2 px-4 py-2.5 rounded-full font-medium text-sm transition-all duration-300 ${
                    selectedType !== "All"
                      ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 border-2 border-gray-300 dark:border-gray-600"
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Type</span>
                  {selectedType !== "All" && (
                    <span className="flex items-center justify-center w-5 h-5 bg-white/20 rounded-full text-xs font-bold">
                      1
                    </span>
                  )}
                  <X 
                    className={`w-4 h-4 transition-transform duration-300 ${
                      openFilterDropdown === 'type' ? 'rotate-90' : ''
                    }`}
                  />
                </button>
                
                {openFilterDropdown === 'type' && typeButtonRef.current && createPortal(
                  <div 
                    className="fixed w-64 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 max-h-80 overflow-y-auto animate-slideIn"
                    style={{
                      top: `${typeButtonRef.current.getBoundingClientRect().bottom + 8}px`,
                      left: typeButtonRef.current.getBoundingClientRect().left + 256 > window.innerWidth
                        ? `${window.innerWidth - 256 - 16}px`
                        : `${typeButtonRef.current.getBoundingClientRect().left}px`,
                      zIndex: 9999
                    }}
                  >
                    <div className="p-2">
                      {filterTypes.map((type) => (
                        <button
                          key={type}
                          onClick={() => {
                            setSelectedType(type);
                            setOpenFilterDropdown(null);
                          }}
                          className={`w-full text-left px-4 py-2.5 rounded-lg transition-all ${
                            selectedType === type
                              ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium"
                              : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>,
                  document.body
                )}
              </div>

              {/* Bank Filter Pill */}
              <div className="relative filter-dropdown-container">
                <button
                  ref={bankButtonRef}
                  onClick={() => setOpenFilterDropdown(openFilterDropdown === 'bank' ? null : 'bank')}
                  className={`group flex items-center gap-2 px-4 py-2.5 rounded-full font-medium text-sm transition-all duration-300 ${
                    selectedBank !== "All"
                      ? "bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-lg shadow-pink-500/30 hover:shadow-xl hover:shadow-pink-500/40"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 border-2 border-gray-300 dark:border-gray-600"
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Bank</span>
                  {selectedBank !== "All" && (
                    <span className="flex items-center justify-center w-5 h-5 bg-white/20 rounded-full text-xs font-bold">
                      1
                    </span>
                  )}
                  <X 
                    className={`w-4 h-4 transition-transform duration-300 ${
                      openFilterDropdown === 'bank' ? 'rotate-90' : ''
                    }`}
                  />
                </button>
                
                {openFilterDropdown === 'bank' && bankButtonRef.current && createPortal(
                  <div 
                    className="fixed w-64 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 max-h-80 overflow-y-auto animate-slideIn"
                    style={{
                      top: `${bankButtonRef.current.getBoundingClientRect().bottom + 8}px`,
                      left: bankButtonRef.current.getBoundingClientRect().left + 256 > window.innerWidth
                        ? `${window.innerWidth - 256 - 16}px`
                        : `${bankButtonRef.current.getBoundingClientRect().left}px`,
                      zIndex: 9999
                    }}
                  >
                    <div className="p-2">
                      {filterBanks.map((bank) => (
                        <button
                          key={bank}
                          onClick={() => {
                            setSelectedBank(bank);
                            setOpenFilterDropdown(null);
                          }}
                          className={`w-full text-left px-4 py-2.5 rounded-lg transition-all ${
                            selectedBank === bank
                              ? "bg-gradient-to-r from-pink-600 to-rose-600 text-white font-medium"
                              : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          {bank}
                        </button>
                      ))}
                    </div>
                  </div>,
                  document.body
                )}
              </div>

              {/* Clear All Filters Button */}
              {(selectedCategory !== "All" || selectedType !== "All" || selectedBank !== "All") && (
                <button
                  onClick={() => {
                    setSelectedCategory("All");
                    setSelectedType("All");
                    setSelectedBank("All");
                    setOpenFilterDropdown(null);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-full font-medium text-sm bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 border-2 border-red-200 dark:border-red-800 transition-all duration-300 hover:scale-105"
                >
                  <X className="w-4 h-4" />
                  <span>Clear All</span>
                </button>
              )}
            </div>
          </div>
          {searchDebounce && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 ml-1">
              Found {filteredCaptions.length} caption{filteredCaptions.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="group relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-cyan-600 opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
          <div className="relative bg-gradient-to-br from-blue-50 via-cyan-50 to-blue-100 dark:from-blue-900/30 dark:via-cyan-900/30 dark:to-blue-800/30 rounded-xl p-6 border-2 border-blue-200 dark:border-blue-800 shadow-lg group-hover:shadow-xl group-hover:scale-105 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Total Captions</p>
                <p className="text-3xl font-bold text-blue-700 dark:text-blue-300 mt-2">
                  {captions.length}
                </p>
              </div>
              <div className="p-3 bg-blue-600 dark:bg-blue-500 rounded-xl shadow-lg group-hover:rotate-12 transition-transform">
                <FileText className="w-7 h-7 text-white" />
              </div>
            </div>
          </div>
        </div>

        <div className="group relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-600 to-pink-600 opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
          <div className="relative bg-gradient-to-br from-purple-50 via-fuchsia-50 to-purple-100 dark:from-purple-900/30 dark:via-fuchsia-900/30 dark:to-purple-800/30 rounded-xl p-6 border-2 border-purple-200 dark:border-purple-800 shadow-lg group-hover:shadow-xl group-hover:scale-105 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Categories</p>
                <p className="text-3xl font-bold text-purple-700 dark:text-purple-300 mt-2">
                  {new Set(captions.map(c => c.captionCategory)).size}
                </p>
              </div>
              <div className="p-3 bg-purple-600 dark:bg-purple-500 rounded-xl shadow-lg group-hover:rotate-12 transition-transform">
                <Tag className="w-7 h-7 text-white" />
              </div>
            </div>
          </div>
        </div>

        <div className="group relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-pink-600 to-rose-600 opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
          <div className="relative bg-gradient-to-br from-pink-50 via-rose-50 to-pink-100 dark:from-pink-900/30 dark:via-rose-900/30 dark:to-pink-800/30 rounded-xl p-6 border-2 border-pink-200 dark:border-pink-800 shadow-lg group-hover:shadow-xl group-hover:scale-105 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-pink-600 dark:text-pink-400 uppercase tracking-wider">Caption Banks</p>
                <p className="text-3xl font-bold text-pink-700 dark:text-pink-300 mt-2">
                  {new Set(captions.map(c => c.captionBanks)).size}
                </p>
              </div>
              <div className="p-3 bg-pink-600 dark:bg-pink-500 rounded-xl shadow-lg group-hover:rotate-12 transition-transform">
                <Copy className="w-7 h-7 text-white" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Table / Card View */}
      <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-xl opacity-20 blur transition-all duration-300"></div>
        <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden backdrop-blur-sm">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="relative">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-200 dark:border-purple-900 border-t-purple-600 dark:border-t-purple-400 mx-auto mb-4"></div>
                  <Sparkles className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-5 h-5 text-purple-600 dark:text-purple-400 animate-pulse" />
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">Loading captions...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 dark:from-blue-900/30 dark:via-purple-900/30 dark:to-pink-900/30 border-b-2 border-purple-200 dark:border-purple-800">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      #
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Caption
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Bank
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filteredCaptions.map((caption, index) => (
                    <tr 
                      key={caption.id}
                      className="group/row hover:bg-gradient-to-r hover:from-purple-50/50 hover:via-blue-50/50 hover:to-pink-50/50 dark:hover:from-purple-900/10 dark:hover:via-blue-900/10 dark:hover:to-pink-900/10 transition-all duration-200"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/40 dark:to-blue-900/40 text-purple-700 dark:text-purple-300 text-xs font-bold">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white max-w-md">
                        <div className="line-clamp-2 font-medium">
                          {caption.caption}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-3 py-1.5 bg-gradient-to-r from-blue-100 to-cyan-100 dark:from-blue-900/40 dark:to-cyan-900/40 text-blue-700 dark:text-blue-300 text-xs font-semibold rounded-full border border-blue-200 dark:border-blue-800">
                          {caption.captionCategory}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 font-medium">
                        {caption.captionTypes}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 font-medium">
                        {caption.captionBanks}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => handleCopyCaption(caption.caption, caption.id)}
                            className={`p-2.5 rounded-lg transition-all duration-200 ${
                              copiedId === caption.id
                                ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400'
                                : 'hover:bg-blue-100 dark:hover:bg-blue-900/40 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
                            }`}
                            title="Copy caption"
                          >
                            {copiedId === caption.id ? (
                              <Check className="w-4 h-4" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            className="p-2.5 hover:bg-purple-100 dark:hover:bg-purple-900/40 rounded-lg transition-all duration-200 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400"
                            title="Edit caption"
                            onClick={() => openEditModal(caption)}
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteCaption(caption.id)}
                            className="p-2.5 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition-all duration-200 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                            title="Delete caption"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-700">
              {filteredCaptions.map((caption, index) => (
                <div
                  key={caption.id}
                  className="relative"
                  style={{ overflow: 'hidden' }}
                >
                  {/* Swipe Action Buttons (Behind) */}
                  <div className="absolute right-0 top-0 h-full flex items-center">
                    <button
                      onClick={() => {
                        openEditModal(caption);
                        setSwipedCard(null);
                      }}
                      className="h-full w-16 flex items-center justify-center bg-purple-500 hover:bg-purple-600 text-white transition-colors"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => {
                        handleDeleteCaption(caption.id);
                        setSwipedCard(null);
                      }}
                      className="h-full w-16 flex items-center justify-center bg-red-500 hover:bg-red-600 text-white transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Main Card Content (Slides over buttons) */}
                  <div
                    className={`relative bg-white dark:bg-gray-800 transition-transform duration-300 ${
                      swipedCard === caption.id ? '-translate-x-32' : 'translate-x-0'
                    }`}
                    onTouchStart={onTouchStart}
                    onTouchMove={onTouchMove}
                    onTouchEnd={() => onTouchEnd(caption.id)}
                  >
                    <div className="p-4 space-y-3">
                      {/* Header with Index and Copy */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/40 dark:to-blue-900/40 text-purple-700 dark:text-purple-300 text-xs font-bold">
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2 flex-1">
                            {caption.caption}
                          </p>
                        </div>
                        <button
                          onClick={() => handleCopyCaption(caption.caption, caption.id)}
                          className={`flex-shrink-0 p-2 rounded-lg transition-all ${
                            copiedId === caption.id
                              ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                          }`}
                        >
                          {copiedId === caption.id ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>

                      {/* Badges */}
                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex items-center px-2.5 py-1 bg-gradient-to-r from-blue-100 to-cyan-100 dark:from-blue-900/40 dark:to-cyan-900/40 text-blue-700 dark:text-blue-300 text-xs font-semibold rounded-full border border-blue-200 dark:border-blue-800">
                          <Tag className="w-3 h-3 mr-1" />
                          {caption.captionCategory}
                        </span>
                        <span className="inline-flex items-center px-2.5 py-1 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-xs font-semibold rounded-full border border-purple-200 dark:border-purple-800">
                          <Sparkles className="w-3 h-3 mr-1" />
                          {caption.captionTypes}
                        </span>
                        <span className="inline-flex items-center px-2.5 py-1 bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300 text-xs font-semibold rounded-full border border-pink-200 dark:border-pink-800">
                          <FileText className="w-3 h-3 mr-1" />
                          {caption.captionBanks}
                        </span>
                      </div>

                      {/* Swipe Hint */}
                      {swipedCard !== caption.id && (
                        <div className="flex items-center justify-center pt-2">
                          <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                            <span>← Swipe for actions</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            </>
          )}

        {!loading && filteredCaptions.length === 0 && (
          <div className="text-center py-16 px-4">
            <div className="relative inline-block">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full blur-2xl opacity-20 animate-pulse"></div>
              <div className="relative p-6 bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-full">
                <FileText className="w-16 h-16 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-6">No captions found</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 max-w-md mx-auto">
              {searchQuery || selectedCategory !== "All" || selectedType !== "All" || selectedBank !== "All" 
                ? "Try adjusting your search filters to find what you're looking for"
                : "Get started by creating your first caption to organize your content"}
            </p>
            {!searchQuery && selectedCategory === "All" && selectedType === "All" && selectedBank === "All" && (
              <button
                onClick={() => setShowNewCaptionModal(true)}
                className="mt-6 inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
              >
                <Plus className="w-5 h-5" />
                <span className="font-semibold">Create First Caption</span>
              </button>
            )}
          </div>
        )}
        </div>
      </div>

      {/* Add Caption Modal */}
      {showNewCaptionModal && typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden animate-slideIn">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
                Add New Caption
              </h2>
              <button
                onClick={() => setShowNewCaptionModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all duration-200"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleAddCaption} className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-140px)]">
              {/* Caption Text */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Caption <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={newCaption.caption}
                  onChange={(e) => setNewCaption({ ...newCaption, caption: e.target.value })}
                  rows={4}
                  placeholder="Enter your caption here..."
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                  required
                />
              </div>

              {/* Caption Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Caption Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={newCaption.captionCategory}
                  onChange={(e) => setNewCaption({ ...newCaption, captionCategory: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  style={{ maxHeight: '200px', overflowY: 'auto' }}
                  required
                >
                  <option value="">Select a category</option>
                  {captionCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              {/* Caption Types */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Caption Types <span className="text-red-500">*</span>
                </label>
                <select
                  value={newCaption.captionTypes}
                  onChange={(e) => setNewCaption({ ...newCaption, captionTypes: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  style={{ maxHeight: '200px', overflowY: 'auto' }}
                  required
                >
                  <option value="">Select a type</option>
                  {captionTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              {/* Caption Banks */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Caption Banks <span className="text-red-500">*</span>
                </label>
                <select
                  value={newCaption.captionBanks}
                  onChange={(e) => setNewCaption({ ...newCaption, captionBanks: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  style={{ maxHeight: '200px', overflowY: 'auto' }}
                  required
                >
                  <option value="">Select a bank</option>
                  {captionBanks.map((bank) => (
                    <option key={bank} value={bank}>
                      {bank}
                    </option>
                  ))}
                </select>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowNewCaptionModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Adding...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Add Caption</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Caption Modal */}
      {showEditCaptionModal && editingCaption && createPortal(
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn"
          onClick={() => setShowEditCaptionModal(false)}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden animate-slideIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-purple-500/10 to-blue-500/10 dark:from-purple-900/20 dark:to-blue-900/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg shadow-lg">
                    <Edit className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit Caption</h2>
                </div>
                <button 
                  onClick={() => setShowEditCaptionModal(false)}
                  className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-all duration-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleEditCaption} className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-120px)]">
              {/* Caption Textarea */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Caption <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={editingCaption.caption}
                  onChange={(e) => setEditingCaption({ ...editingCaption, caption: e.target.value })}
                  rows={6}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 text-gray-900 dark:text-white"
                  placeholder="Enter your caption here..."
                  required
                />
              </div>

              {/* Caption Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Caption Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={editingCaption.captionCategory}
                  onChange={(e) => setEditingCaption({ ...editingCaption, captionCategory: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 text-gray-900 dark:text-white"
                  style={{ maxHeight: '200px', overflowY: 'auto' }}
                  required
                >
                  <option value="">Select category...</option>
                  {captionCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              {/* Caption Types */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Caption Types <span className="text-red-500">*</span>
                </label>
                <select
                  value={editingCaption.captionTypes}
                  onChange={(e) => setEditingCaption({ ...editingCaption, captionTypes: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 text-gray-900 dark:text-white"
                  style={{ maxHeight: '200px', overflowY: 'auto' }}
                  required
                >
                  <option value="">Select type...</option>
                  {captionTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              {/* Caption Banks */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Caption Banks <span className="text-red-500">*</span>
                </label>
                <select
                  value={editingCaption.captionBanks}
                  onChange={(e) => setEditingCaption({ ...editingCaption, captionBanks: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 text-gray-900 dark:text-white"
                  style={{ maxHeight: '200px', overflowY: 'auto' }}
                  required
                >
                  <option value="">Select bank...</option>
                  {captionBanks.map((bank) => (
                    <option key={bank} value={bank}>
                      {bank}
                    </option>
                  ))}
                </select>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditCaptionModal(false);
                    setEditingCaption(null);
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Updating...</span>
                    </>
                  ) : (
                    <>
                      <Edit className="w-4 h-4" />
                      <span>Update Caption</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
