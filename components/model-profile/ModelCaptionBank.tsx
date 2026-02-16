"use client";

import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  X,
  Check,
  Star,
  TrendingUp,
  DollarSign,
  Tag,
  MessageSquare,
  Filter,
  Copy,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
  Eye,
} from "lucide-react";
import {
  useModelCaptions,
  useContentTypes,
  useMessageTypes,
  useCreateCaption,
  useUpdateCaption,
  useDeleteCaption,
  useCreateContentType,
  useCreateMessageType,
} from "@/lib/hooks/useModelCaptions.query";
import { useInstagramProfile } from "@/hooks/useInstagramProfile";

interface ModelCaptionBankProps {
  profileId: string;
  profileName: string;
}

export function ModelCaptionBank({
  profileId,
  profileName,
}: ModelCaptionBankProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContentTypes, setSelectedContentTypes] = useState<string[]>(
    [],
  );
  const [selectedMessageTypes, setSelectedMessageTypes] = useState<string[]>(
    [],
  );
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showContentTypeModal, setShowContentTypeModal] = useState(false);
  const [showMessageTypeModal, setShowMessageTypeModal] = useState(false);
  const [editingCaption, setEditingCaption] = useState<any>(null);
  const [viewingCaption, setViewingCaption] = useState<any>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Form states
  const [captionForm, setCaptionForm] = useState({
    caption: "",
    contentTypeIds: [] as string[],
    messageTypeIds: [] as string[],
    originalModelName: profileName,
    notes: "",
  });
  const [newContentType, setNewContentType] = useState("");
  const [newMessageType, setNewMessageType] = useState("");

  // Queries
  const {
    data: captions = [],
    isLoading: loadingCaptions,
    error: captionsError,
  } = useModelCaptions(
    profileId,
    selectedContentTypes,
    selectedMessageTypes,
    searchQuery,
  );

  const { data: contentTypes = [] } = useContentTypes();
  const { data: messageTypes = [] } = useMessageTypes();
  const { profiles } = useInstagramProfile();

  // Mutations
  const createCaption = useCreateCaption();
  const updateCaption = useUpdateCaption();
  const deleteCaption = useDeleteCaption();
  const createContentType = useCreateContentType();
  const createMessageType = useCreateMessageType();

  // Handle SSR - only render portals on client
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Lock body scroll when detail modal is open
  useEffect(() => {
    if (
      showDetailModal ||
      showAddModal ||
      showEditModal ||
      showContentTypeModal ||
      showMessageTypeModal
    ) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [
    showDetailModal,
    showAddModal,
    showEditModal,
    showContentTypeModal,
    showMessageTypeModal,
  ]);

  // Filtered data
  const filteredCaptions = useMemo(() => {
    return captions;
  }, [captions]);

  // Analytics summary
  const analytics = useMemo(() => {
    const totalCaptions = filteredCaptions.length;
    const totalUsage = filteredCaptions.reduce(
      (sum, c) => sum + c.usageCount,
      0,
    );
    const totalRevenue = filteredCaptions.reduce(
      (sum, c) => sum + Number(c.totalRevenue),
      0,
    );
    const avgRevenuePerCaption =
      totalCaptions > 0 ? totalRevenue / totalCaptions : 0;

    return {
      totalCaptions,
      totalUsage,
      totalRevenue,
      avgRevenuePerCaption,
    };
  }, [filteredCaptions]);

  // Handlers
  const handleAddCaption = async () => {
    if (!captionForm.caption.trim()) return;

    try {
      await createCaption.mutateAsync({
        profileId,
        caption: captionForm.caption,
        contentTypeIds:
          captionForm.contentTypeIds.length > 0
            ? captionForm.contentTypeIds
            : undefined,
        messageTypeIds:
          captionForm.messageTypeIds.length > 0
            ? captionForm.messageTypeIds
            : undefined,
        originalModelName: captionForm.originalModelName || undefined,
        notes: captionForm.notes || undefined,
      });

      // Reset form and close modal
      setCaptionForm({
        caption: "",
        contentTypeIds: [],
        messageTypeIds: [],
        originalModelName: profileName,
        notes: "",
      });
      setShowAddModal(false);
    } catch (error) {
      console.error("Error creating caption:", error);
    }
  };

  const handleUpdateCaption = async () => {
    if (!editingCaption || !captionForm.caption.trim()) return;

    try {
      await updateCaption.mutateAsync({
        id: editingCaption.id,
        profileId,
        caption: captionForm.caption,
        contentTypeIds: captionForm.contentTypeIds,
        messageTypeIds: captionForm.messageTypeIds,
        originalModelName: captionForm.originalModelName || undefined,
        notes: captionForm.notes || undefined,
      });

      setShowEditModal(false);
      setEditingCaption(null);
      setCaptionForm({
        caption: "",
        contentTypeIds: [],
        messageTypeIds: [],
        originalModelName: profileName,
        notes: "",
      });
    } catch (error) {
      console.error("Error updating caption:", error);
    }
  };

  const handleDeleteCaption = async (id: string) => {
    if (!confirm("Are you sure you want to delete this caption?")) return;

    try {
      await deleteCaption.mutateAsync({ id, profileId });
    } catch (error) {
      console.error("Error deleting caption:", error);
    }
  };

  const openEditModal = (caption: any) => {
    setEditingCaption(caption);
    setCaptionForm({
      caption: caption.caption,
      contentTypeIds:
        caption.contentTypes?.map((ct: any) => ct.contentType.id) || [],
      messageTypeIds:
        caption.messageTypes?.map((mt: any) => mt.messageType.id) || [],
      originalModelName: caption.originalModelName || "",
      notes: caption.notes || "",
    });
    setShowEditModal(true);
  };

  const handleCopyCaption = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleAddContentType = async () => {
    if (!newContentType.trim()) return;

    try {
      await createContentType.mutateAsync(newContentType);
      setNewContentType("");
      setShowContentTypeModal(false);
    } catch (error) {
      console.error("Error creating content type:", error);
    }
  };

  const handleAddMessageType = async () => {
    if (!newMessageType.trim()) return;

    try {
      await createMessageType.mutateAsync(newMessageType);
      setNewMessageType("");
      setShowMessageTypeModal(false);
    } catch (error) {
      console.error("Error creating message type:", error);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  const openDetailModal = (caption: any) => {
    setViewingCaption(caption);
    setShowDetailModal(true);
  };

  const getTruncatedCaption = (text: string, maxLines: number = 3) => {
    const lines = text.split("\n");
    if (lines.length > maxLines) {
      return lines.slice(0, maxLines).join("\n") + "...";
    }
    // If no newlines, truncate by characters (roughly 3 lines = 150 chars)
    if (text.length > 150) {
      return text.substring(0, 150) + "...";
    }
    return text;
  };

  return (
    <div className="space-y-6">
      {/* Header with Analytics */}
      <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-brand-mid-pink/20 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-brand-off-white mb-4">
          Caption Bank for {profileName}
        </h2>

        {/* Analytics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 dark:bg-brand-dark-pink/5 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-4 h-4 text-brand-light-pink" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Total Captions
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-brand-off-white">
              {analytics.totalCaptions}
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-brand-dark-pink/5 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-brand-blue" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Times Used
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-brand-off-white">
              {analytics.totalUsage}
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-brand-dark-pink/5 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-brand-mid-pink" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Total Revenue
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-brand-off-white">
              {formatCurrency(analytics.totalRevenue)}
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-brand-dark-pink/5 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Star className="w-4 h-4 text-brand-light-pink" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Avg per Caption
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-brand-off-white">
              {formatCurrency(analytics.avgRevenuePerCaption)}
            </p>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-brand-mid-pink/20 rounded-lg p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search captions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-brand-mid-pink/30 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-brand-off-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-light-pink"
              />
            </div>
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-brand-mid-pink/30 rounded-lg hover:bg-gray-50 dark:hover:bg-brand-dark-pink/5 text-gray-700 dark:text-brand-off-white transition-colors"
          >
            <Filter className="w-4 h-4" />
            Filters
            {(selectedContentTypes.length > 0 ||
              selectedMessageTypes.length > 0) && (
              <span className="bg-brand-light-pink text-white text-xs px-2 py-0.5 rounded-full">
                {selectedContentTypes.length + selectedMessageTypes.length}
              </span>
            )}
          </button>

          {/* Add Caption Button */}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-light-pink hover:bg-brand-mid-pink text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Caption
          </button>
        </div>

        {/* Filter Checkboxes */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-brand-mid-pink/20">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Content Type Filter */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Content Type
                  </label>
                  <button
                    onClick={() => setShowContentTypeModal(true)}
                    className="p-1 text-xs text-brand-light-pink hover:text-brand-mid-pink transition-colors"
                    title="Add new content type"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-2 border border-gray-200 dark:border-brand-mid-pink/30 rounded-lg p-3 bg-gray-50 dark:bg-gray-900/50">
                  {contentTypes.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
                      No content types yet
                    </p>
                  ) : (
                    contentTypes.map((type) => {
                      const isSelected = selectedContentTypes.includes(type.id);
                      const toggleSelection = () => {
                        setSelectedContentTypes((prev) =>
                          prev.includes(type.id)
                            ? prev.filter((id) => id !== type.id)
                            : [...prev, type.id],
                        );
                      };

                      return (
                        <div
                          key={type.id}
                          onClick={toggleSelection}
                          className="flex items-center gap-2 cursor-pointer hover:bg-white dark:hover:bg-gray-800 p-2 rounded transition-colors"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-brand-light-pink flex-shrink-0" />
                          ) : (
                            <Square className="w-5 h-5 text-gray-400 dark:text-gray-600 flex-shrink-0" />
                          )}
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {type.name}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Message Type Filter */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Message Type
                  </label>
                  <button
                    onClick={() => setShowMessageTypeModal(true)}
                    className="p-1 text-xs text-brand-light-pink hover:text-brand-mid-pink transition-colors"
                    title="Add new message type"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-2 border border-gray-200 dark:border-brand-mid-pink/30 rounded-lg p-3 bg-gray-50 dark:bg-gray-900/50">
                  {messageTypes.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
                      No message types yet
                    </p>
                  ) : (
                    messageTypes.map((type) => {
                      const isSelected = selectedMessageTypes.includes(type.id);
                      const toggleSelection = () => {
                        setSelectedMessageTypes((prev) =>
                          prev.includes(type.id)
                            ? prev.filter((id) => id !== type.id)
                            : [...prev, type.id],
                        );
                      };

                      return (
                        <div
                          key={type.id}
                          onClick={toggleSelection}
                          className="flex items-center gap-2 cursor-pointer hover:bg-white dark:hover:bg-gray-800 p-2 rounded transition-colors"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-brand-blue flex-shrink-0" />
                          ) : (
                            <Square className="w-5 h-5 text-gray-400 dark:text-gray-600 flex-shrink-0" />
                          )}
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {type.name}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Clear Filters Button */}
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  setSelectedContentTypes([]);
                  setSelectedMessageTypes([]);
                }}
                disabled={
                  selectedContentTypes.length === 0 &&
                  selectedMessageTypes.length === 0
                }
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-brand-off-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Clear All Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Captions List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loadingCaptions ? (
          <div className="col-span-full text-center py-12 text-gray-500 dark:text-gray-400">
            Loading captions...
          </div>
        ) : filteredCaptions.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500 dark:text-gray-400">
            {searchQuery ||
            selectedContentTypes.length > 0 ||
            selectedMessageTypes.length > 0
              ? "No captions match your filters"
              : "No captions yet. Add your first caption to get started!"}
          </div>
        ) : (
          filteredCaptions.map((caption) => (
            <div
              key={caption.id}
              className="relative bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-brand-mid-pink/20 rounded-lg p-4 hover:shadow-lg transition-all flex flex-col h-[280px] cursor-pointer group"
              onClick={() => openDetailModal(caption)}
            >
              {/* Caption Preview */}
              <div className="flex-1 min-h-0 mb-3">
                <p className="text-sm text-gray-900 dark:text-brand-off-white line-clamp-3 whitespace-pre-wrap break-words">
                  {getTruncatedCaption(caption.caption)}
                </p>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5 mb-3 min-h-[28px]">
                {caption.contentTypes &&
                  caption.contentTypes.length > 0 &&
                  caption.contentTypes.slice(0, 2).map((ct: any) => (
                    <span
                      key={ct.contentType.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-light-pink/10 text-brand-light-pink dark:bg-brand-light-pink/20 dark:text-brand-light-pink text-xs rounded-full"
                    >
                      <Tag className="w-3 h-3" />
                      {ct.contentType.name}
                    </span>
                  ))}
                {caption.contentTypes && caption.contentTypes.length > 2 && (
                  <span className="inline-flex items-center px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs rounded-full">
                    +{caption.contentTypes.length - 2}
                  </span>
                )}
                {caption.messageTypes &&
                  caption.messageTypes.length > 0 &&
                  caption.messageTypes.slice(0, 2).map((mt: any) => (
                    <span
                      key={mt.messageType.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-blue/10 text-brand-blue dark:bg-brand-blue/20 dark:text-brand-blue text-xs rounded-full"
                    >
                      <MessageSquare className="w-3 h-3" />
                      {mt.messageType.name}
                    </span>
                  ))}
                {caption.messageTypes && caption.messageTypes.length > 2 && (
                  <span className="inline-flex items-center px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs rounded-full">
                    +{caption.messageTypes.length - 2}
                  </span>
                )}
              </div>

              {/* Mini Stats */}
              <div className="grid grid-cols-2 gap-3 text-xs border-t border-gray-200 dark:border-brand-mid-pink/20 pt-3">
                <div>
                  <span className="text-gray-600 dark:text-gray-400 block">
                    Used
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-brand-off-white">
                    {caption.usageCount}x
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400 block">
                    Revenue
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-brand-off-white">
                    {formatCurrency(Number(caption.totalRevenue))}
                  </span>
                </div>
              </div>

              {/* Hover Actions Overlay - Top Right */}
              <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <div
                  className="flex items-center gap-1 pointer-events-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyCaption(caption.caption);
                    }}
                    className="p-2 bg-white dark:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-400 hover:text-brand-blue dark:hover:text-brand-blue shadow-lg transition-colors"
                    title="Copy caption"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditModal(caption);
                    }}
                    className="p-2 bg-white dark:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-400 hover:text-brand-light-pink dark:hover:text-brand-light-pink shadow-lg transition-colors"
                    title="Edit caption"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCaption(caption.id);
                    }}
                    className="p-2 bg-white dark:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-400 hover:text-red-500 shadow-lg transition-colors"
                    title="Delete caption"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Caption Modal */}
      {isMounted &&
        (showAddModal || showEditModal) &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => {
              setShowAddModal(false);
              setShowEditModal(false);
              setEditingCaption(null);
              setCaptionForm({
                caption: "",
                contentTypeIds: [],
                messageTypeIds: [],
                originalModelName: profileName,
                notes: "",
              });
            }}
          >
            <div
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-brand-mid-pink/20 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-brand-off-white">
                    {showAddModal ? "Add New Caption" : "Edit Caption"}
                  </h3>
                  <button
                    onClick={() => {
                      setShowAddModal(false);
                      setShowEditModal(false);
                      setEditingCaption(null);
                      setCaptionForm({
                        caption: "",
                        contentTypeIds: [],
                        messageTypeIds: [],
                        originalModelName: "",
                        notes: "",
                      });
                    }}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-brand-off-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Caption Text *
                    </label>
                    <textarea
                      value={captionForm.caption}
                      onChange={(e) =>
                        setCaptionForm({
                          ...captionForm,
                          caption: e.target.value,
                        })
                      }
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-brand-mid-pink/30 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-brand-off-white focus:outline-none focus:ring-2 focus:ring-brand-light-pink"
                      placeholder="Enter caption text..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Content Types
                      </label>
                      <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 dark:border-brand-mid-pink/30 rounded-lg p-3 bg-gray-50 dark:bg-gray-900/50">
                        {contentTypes.map((type) => {
                          const isSelected =
                            captionForm.contentTypeIds.includes(type.id);
                          const toggleSelection = () => {
                            setCaptionForm((prev) => ({
                              ...prev,
                              contentTypeIds: isSelected
                                ? prev.contentTypeIds.filter(
                                    (id) => id !== type.id,
                                  )
                                : [...prev.contentTypeIds, type.id],
                            }));
                          };

                          return (
                            <div
                              key={type.id}
                              onClick={toggleSelection}
                              className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 p-2 rounded transition-colors"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-brand-light-pink flex-shrink-0" />
                              ) : (
                                <Square className="w-4 h-4 text-gray-400 dark:text-gray-600 flex-shrink-0" />
                              )}
                              <span className="text-sm text-gray-700 dark:text-gray-300">
                                {type.name}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Message Types
                      </label>
                      <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 dark:border-brand-mid-pink/30 rounded-lg p-3 bg-gray-50 dark:bg-gray-900/50">
                        {messageTypes.map((type) => {
                          const isSelected =
                            captionForm.messageTypeIds.includes(type.id);
                          const toggleSelection = () => {
                            setCaptionForm((prev) => ({
                              ...prev,
                              messageTypeIds: isSelected
                                ? prev.messageTypeIds.filter(
                                    (id) => id !== type.id,
                                  )
                                : [...prev.messageTypeIds, type.id],
                            }));
                          };

                          return (
                            <div
                              key={type.id}
                              onClick={toggleSelection}
                              className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 p-2 rounded transition-colors"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-brand-light-pink flex-shrink-0" />
                              ) : (
                                <Square className="w-4 h-4 text-gray-400 dark:text-gray-600 flex-shrink-0" />
                              )}
                              <span className="text-sm text-gray-700 dark:text-gray-300">
                                {type.name}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Originally Written For
                    </label>
                    <select
                      value={captionForm.originalModelName}
                      onChange={(e) =>
                        setCaptionForm({
                          ...captionForm,
                          originalModelName: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-200 dark:border-brand-mid-pink/30 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-brand-off-white focus:outline-none focus:ring-2 focus:ring-brand-light-pink"
                    >
                      <option value="">-- Select Profile --</option>
                      {profiles
                        .filter((p) => p.id !== "all")
                        .map((profile) => (
                          <option key={profile.id} value={profile.name}>
                            {profile.name}
                            {profile.isDefault ? " ⭐ (Default)" : ""}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Notes
                    </label>
                    <textarea
                      value={captionForm.notes}
                      onChange={(e) =>
                        setCaptionForm({
                          ...captionForm,
                          notes: e.target.value,
                        })
                      }
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-brand-mid-pink/30 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-brand-off-white focus:outline-none focus:ring-2 focus:ring-brand-light-pink"
                      placeholder="Optional notes about this caption..."
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => {
                      setShowAddModal(false);
                      setShowEditModal(false);
                      setEditingCaption(null);
                      setCaptionForm({
                        caption: "",
                        contentTypeIds: [],
                        messageTypeIds: [],
                        originalModelName: profileName,
                        notes: "",
                      });
                    }}
                    className="px-4 py-2 border border-gray-200 dark:border-brand-mid-pink/30 rounded-lg text-gray-700 dark:text-brand-off-white hover:bg-gray-50 dark:hover:bg-brand-dark-pink/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={
                      showAddModal ? handleAddCaption : handleUpdateCaption
                    }
                    disabled={
                      !captionForm.caption.trim() ||
                      createCaption.isPending ||
                      updateCaption.isPending
                    }
                    className="px-4 py-2 bg-brand-light-pink hover:bg-brand-mid-pink text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {createCaption.isPending || updateCaption.isPending
                      ? "Saving..."
                      : showAddModal
                        ? "Add Caption"
                        : "Update Caption"}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Add Content Type Modal */}
      {isMounted &&
        showContentTypeModal &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => {
              setShowContentTypeModal(false);
              setNewContentType("");
            }}
          >
            <div
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-brand-mid-pink/20 rounded-lg max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-brand-off-white">
                    Add Content Type
                  </h3>
                  <button
                    onClick={() => {
                      setShowContentTypeModal(false);
                      setNewContentType("");
                    }}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-brand-off-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Content Type Name
                    </label>
                    <input
                      type="text"
                      value={newContentType}
                      onChange={(e) => setNewContentType(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-brand-mid-pink/30 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-brand-off-white focus:outline-none focus:ring-2 focus:ring-brand-light-pink"
                      placeholder="e.g., Fully Nude"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => {
                      setShowContentTypeModal(false);
                      setNewContentType("");
                    }}
                    className="px-4 py-2 border border-gray-200 dark:border-brand-mid-pink/30 rounded-lg text-gray-700 dark:text-brand-off-white hover:bg-gray-50 dark:hover:bg-brand-dark-pink/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddContentType}
                    disabled={
                      !newContentType.trim() || createContentType.isPending
                    }
                    className="px-4 py-2 bg-brand-light-pink hover:bg-brand-mid-pink text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {createContentType.isPending ? "Adding..." : "Add Type"}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Add Message Type Modal */}
      {isMounted &&
        showMessageTypeModal &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => {
              setShowMessageTypeModal(false);
              setNewMessageType("");
            }}
          >
            <div
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-brand-mid-pink/20 rounded-lg max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-brand-off-white">
                    Add Message Type
                  </h3>
                  <button
                    onClick={() => {
                      setShowMessageTypeModal(false);
                      setNewMessageType("");
                    }}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-brand-off-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Message Type Name
                    </label>
                    <input
                      type="text"
                      value={newMessageType}
                      onChange={(e) => setNewMessageType(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-brand-mid-pink/30 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-brand-off-white focus:outline-none focus:ring-2 focus:ring-brand-light-pink"
                      placeholder="e.g., Mass DM"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => {
                      setShowMessageTypeModal(false);
                      setNewMessageType("");
                    }}
                    className="px-4 py-2 border border-gray-200 dark:border-brand-mid-pink/30 rounded-lg text-gray-700 dark:text-brand-off-white hover:bg-gray-50 dark:hover:bg-brand-dark-pink/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddMessageType}
                    disabled={
                      !newMessageType.trim() || createMessageType.isPending
                    }
                    className="px-4 py-2 bg-brand-light-pink hover:bg-brand-mid-pink text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {createMessageType.isPending ? "Adding..." : "Add Type"}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Caption Detail Modal */}
      {isMounted &&
        showDetailModal &&
        viewingCaption &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => {
              setShowDetailModal(false);
              setViewingCaption(null);
            }}
          >
            <div
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-brand-mid-pink/20 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-brand-off-white">
                    Caption Details
                  </h3>
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      setViewingCaption(null);
                    }}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-brand-off-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Full Caption Text */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Caption Text
                  </label>
                  <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-brand-mid-pink/20 rounded-lg p-4 max-h-60 overflow-y-auto">
                    <p className="text-gray-900 dark:text-brand-off-white whitespace-pre-wrap break-words">
                      {viewingCaption.caption}
                    </p>
                  </div>
                </div>

                {/* Tags Section */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Tags
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {viewingCaption.contentTypes &&
                    viewingCaption.contentTypes.length > 0
                      ? viewingCaption.contentTypes.map((ct: any) => (
                          <span
                            key={ct.contentType.id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-brand-light-pink/10 text-brand-light-pink dark:bg-brand-light-pink/20 dark:text-brand-light-pink text-sm rounded-full"
                          >
                            <Tag className="w-3.5 h-3.5" />
                            {ct.contentType.name}
                          </span>
                        ))
                      : null}
                    {viewingCaption.messageTypes &&
                    viewingCaption.messageTypes.length > 0
                      ? viewingCaption.messageTypes.map((mt: any) => (
                          <span
                            key={mt.messageType.id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-brand-blue/10 text-brand-blue dark:bg-brand-blue/20 dark:text-brand-blue text-sm rounded-full"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            {mt.messageType.name}
                          </span>
                        ))
                      : null}
                    {(!viewingCaption.contentTypes ||
                      viewingCaption.contentTypes.length === 0) &&
                      (!viewingCaption.messageTypes ||
                        viewingCaption.messageTypes.length === 0) && (
                        <span className="text-sm text-gray-500 dark:text-gray-400 italic">
                          No tags
                        </span>
                      )}
                  </div>
                </div>

                {/* Analytics Grid */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Analytics
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-50 dark:bg-brand-dark-pink/5 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="w-4 h-4 text-brand-light-pink" />
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          Times Used
                        </span>
                      </div>
                      <p className="text-xl font-bold text-gray-900 dark:text-brand-off-white">
                        {viewingCaption.usageCount}
                      </p>
                    </div>
                    <div className="bg-gray-50 dark:bg-brand-dark-pink/5 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <DollarSign className="w-4 h-4 text-brand-blue" />
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          Total Revenue
                        </span>
                      </div>
                      <p className="text-xl font-bold text-gray-900 dark:text-brand-off-white">
                        {formatCurrency(Number(viewingCaption.totalRevenue))}
                      </p>
                    </div>
                    <div className="bg-gray-50 dark:bg-brand-dark-pink/5 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <DollarSign className="w-4 h-4 text-brand-mid-pink" />
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          Avg Revenue
                        </span>
                      </div>
                      <p className="text-xl font-bold text-gray-900 dark:text-brand-off-white">
                        {formatCurrency(viewingCaption.averageRevenuePerUse)}
                      </p>
                    </div>
                    {viewingCaption.originalModelName && (
                      <div className="bg-gray-50 dark:bg-brand-dark-pink/5 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <Star className="w-4 h-4 text-brand-light-pink" />
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            Originally For
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-brand-off-white truncate">
                          {viewingCaption.originalModelName}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Notes */}
                {viewingCaption.notes && (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Notes
                    </label>
                    <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-brand-mid-pink/20 rounded-lg p-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400 italic break-words">
                        {viewingCaption.notes}
                      </p>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-brand-mid-pink/20">
                  <button
                    onClick={() => {
                      handleCopyCaption(viewingCaption.caption);
                      setShowDetailModal(false);
                      setViewingCaption(null);
                    }}
                    className="px-4 py-2 bg-brand-blue hover:bg-brand-blue/90 text-white rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    Copy Caption
                  </button>
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      openEditModal(viewingCaption);
                      setViewingCaption(null);
                    }}
                    className="px-4 py-2 bg-brand-light-pink hover:bg-brand-mid-pink text-white rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Edit className="w-4 h-4" />
                    Edit Caption
                  </button>
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      handleDeleteCaption(viewingCaption.id);
                      setViewingCaption(null);
                    }}
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
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
