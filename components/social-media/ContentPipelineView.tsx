"use client";

import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import {
  Filter,
  Plus,
  Edit2,
  Trash2,
  Search,
  X,
  Calendar,
  User,
  Tag,
  AlertCircle,
  CheckCircle2,
  Clock,
  Video,
  Image as ImageIcon,
  TrendingUp,
  Eye,
  Sparkles,
  Hash,
  MessageSquare,
  FileText,
  Music,
  Lightbulb,
  MapPin,
  Users,
  ChevronDown,
} from "lucide-react";

const CalendarIcon = Calendar;
import { useUser } from "@clerk/nextjs";
import { createPortal } from "react-dom";

interface ContentPipelineViewProps {
  profileId?: string | null;
}

type PipelineStatus = "IDEA" | "FILMING" | "EDITING" | "REVIEW" | "APPROVED" | "SCHEDULED" | "POSTED" | "ARCHIVED";
type ContentType = "REEL" | "POST" | "STORY" | "CAROUSEL" | "VIDEO";

interface PipelineItem {
  id: string;
  contentId: string;
  title: string;
  contentType: ContentType;
  status: PipelineStatus;
  notes?: string | null;
  dateCreated?: string | null;
  datePosted?: string | null;
  ideaDate?: string | null;
  filmingDate?: string | null;
  editingDate?: string | null;
  reviewDate?: string | null;
  approvedDate?: string | null;
  scheduledDate?: string | null;
  createdAt: string;
  updatedAt: string;
  linkedPost?: {
    id: string;
    fileName: string;
    awsS3Url?: string | null;
    driveFileUrl?: string | null;
    caption: string;
    status: string;
    postType: string;
    scheduledDate?: string | null;
  } | null;
  storySlot?: {
    id: string;
    date: string;
    timeSlot: string | null;
    storyType: string;
    interactiveElement?: string | null;
    notes?: string | null;
    caption?: string | null;
    hashtags: string[];
    awsS3Url?: string | null;
    fileName?: string | null;
    mimeType?: string | null;
    isPosted: boolean;
    postedAt?: string | null;
    linkedPost?: {
      id: string;
      fileName: string;
      awsS3Url?: string | null;
      driveFileUrl?: string | null;
    } | null;
  } | null;
  reelSlot?: {
    id: string;
    date: string;
    timeSlot: string | null;
    reelType: string;
    hookIdea?: string | null;
    trendingAudio?: string | null;
    notes?: string | null;
    caption?: string | null;
    hashtags: string[];
    awsS3Url?: string | null;
    fileName?: string | null;
    mimeType?: string | null;
    isPosted: boolean;
    postedAt?: string | null;
  } | null;
  feedPostSlot?: {
    id: string;
    date: string;
    timeSlot: string | null;
    postType: string;
    caption?: string | null;
    hashtags: string[];
    location?: string | null;
    collaborators: string[];
    notes?: string | null;
    files?: Array<{
      awsS3Key: string;
      awsS3Url: string;
      fileName: string;
      mimeType: string;
    }> | null;
    isPosted: boolean;
    postedAt?: string | null;
  } | null;
}

export default function ContentPipelineView({ profileId }: ContentPipelineViewProps) {
  const { user, isLoaded } = useUser();
  const [items, setItems] = useState<PipelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<PipelineItem | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingItem, setViewingItem] = useState<PipelineItem | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [contentTypeFilter, setContentTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Form state
  const [itemForm, setItemForm] = useState({
    contentId: "",
    title: "",
    contentType: "REEL" as ContentType,
    status: "IDEA" as PipelineStatus,
    notes: "",
    dateCreated: "",
  });

  useEffect(() => {
    if (!isLoaded || !user) return;
    loadPipelineItems();
  }, [isLoaded, user, statusFilter, contentTypeFilter, profileId]);

  const loadPipelineItems = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (contentTypeFilter !== "all") params.append("contentType", contentTypeFilter);
      if (profileId && profileId !== "all") params.append("profileId", profileId);

      const response = await fetch(`/api/instagram/pipeline?${params}`);
      if (!response.ok) throw new Error("Failed to load pipeline items");

      const data = await response.json();
      setItems(data.items || []);
    } catch (error) {
      console.error("Error loading pipeline items:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateItem = async () => {
    try {
      const response = await fetch("/api/instagram/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(itemForm),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || "Failed to create item");
        return;
      }

      const { item } = await response.json();
      setItems((prev) => [item, ...prev]);
      setShowCreateModal(false);
      resetForm();
      alert("✅ Pipeline item created successfully!");
    } catch (error) {
      console.error("Error creating item:", error);
      alert("❌ Failed to create item. Please try again.");
    }
  };

  const handleUpdateItem = async () => {
    if (!editingItem) return;

    try {
      const response = await fetch(`/api/instagram/pipeline/${editingItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(itemForm),
      });

      if (!response.ok) throw new Error("Failed to update item");

      const { item } = await response.json();
      setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
      setShowEditModal(false);
      setEditingItem(null);
      alert("✅ Item updated successfully!");
    } catch (error) {
      console.error("Error updating item:", error);
      alert("❌ Failed to update item. Please try again.");
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm("Are you sure you want to delete this item?")) return;

    try {
      const response = await fetch(`/api/instagram/pipeline/${itemId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete item");

      setItems((prev) => prev.filter((i) => i.id !== itemId));
      setShowViewModal(false);
      alert("✅ Item deleted successfully!");
    } catch (error) {
      console.error("Error deleting item:", error);
      alert("❌ Failed to delete item. Please try again.");
    }
  };

  const handleQuickStatusUpdate = async (itemId: string, newStatus: PipelineStatus) => {
    try {
      const response = await fetch(`/api/instagram/pipeline/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) throw new Error("Failed to update status");

      const { item } = await response.json();
      setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Failed to update status");
    }
  };

  const resetForm = () => {
    setItemForm({
      contentId: "",
      title: "",
      contentType: "REEL",
      status: "IDEA",
      notes: "",
      dateCreated: "",
    });
  };

  const openEditModal = (item: PipelineItem) => {
    setEditingItem(item);
    setItemForm({
      contentId: item.contentId,
      title: item.title,
      contentType: item.contentType,
      status: item.status,
      notes: item.notes || "",
      dateCreated: item.dateCreated ? new Date(item.dateCreated).toISOString().slice(0, 10) : "",
    });
    setShowEditModal(true);
  };

  const getStatusColor = (status: PipelineStatus) => {
    switch (status) {
      case "IDEA":
        return "bg-gray-500";
      case "FILMING":
        return "bg-blue-500";
      case "EDITING":
        return "bg-yellow-500";
      case "REVIEW":
        return "bg-orange-500";
      case "APPROVED":
        return "bg-green-500";
      case "SCHEDULED":
        return "bg-purple-500";
      case "POSTED":
        return "bg-pink-500";
      case "ARCHIVED":
        return "bg-gray-400";
      default:
        return "bg-gray-400";
    }
  };

  const getContentTypeIcon = (type: ContentType) => {
    switch (type) {
      case "REEL":
      case "VIDEO":
        return Video;
      case "POST":
      case "CAROUSEL":
        return ImageIcon;
      case "STORY":
        return Clock;
    }
  };

  const filteredItems = items.filter((item) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        item.contentId.toLowerCase().includes(query) ||
        item.title.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Group items by status
  const itemsByStatus = filteredItems.reduce((acc, item) => {
    if (!acc[item.status]) acc[item.status] = [];
    acc[item.status].push(item);
    return acc;
  }, {} as Record<PipelineStatus, PipelineItem[]>);

  const statuses: PipelineStatus[] = ["IDEA", "FILMING", "EDITING", "REVIEW", "APPROVED", "SCHEDULED", "POSTED"];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-brand-blue)]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-[var(--color-brand-dark-pink)]/20 to-[var(--color-brand-blue)]/20 border border-[var(--color-brand-dark-pink)]/30">
              <TrendingUp className="w-7 h-7 text-[var(--color-brand-mid-pink)]" />
            </div>
            Content Pipeline
          </h2>
          <p className="text-muted-foreground mt-2">
            Track your posted stories and content
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Content ID or Title..."
            className="w-full pl-12 pr-4 py-3 bg-background border-2 border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:border-[var(--color-brand-mid-pink)]/50 focus:ring-2 focus:ring-[var(--color-brand-mid-pink)]/20 transition-all"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-3 bg-background border-2 border-border rounded-xl text-foreground focus:outline-none focus:border-[var(--color-brand-mid-pink)]/50 focus:ring-2 focus:ring-[var(--color-brand-mid-pink)]/20 transition-all"
        >
          <option value="all">All Statuses</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <select
          value={contentTypeFilter}
          onChange={(e) => setContentTypeFilter(e.target.value)}
          className="px-4 py-3 bg-background border-2 border-border rounded-xl text-foreground focus:outline-none focus:border-[var(--color-brand-mid-pink)]/50 focus:ring-2 focus:ring-[var(--color-brand-mid-pink)]/20 transition-all"
        >
          <option value="all">All Types</option>
          <option value="REEL">Reels</option>
          <option value="POST">Posts</option>
          <option value="STORY">Stories</option>
          <option value="CAROUSEL">Carousels</option>
          <option value="VIDEO">Videos</option>
        </select>
      </div>

      {/* Pipeline Table */}
      <div className="bg-card border-2 border-border rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-[var(--color-brand-light-pink)]/10 via-[var(--color-brand-blue)]/10 to-[var(--color-brand-blue)]/10 border-b-2 border-border">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-foreground uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-[var(--color-brand-mid-pink)]" />
                    Content ID
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-foreground uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[var(--color-brand-mid-pink)]" />
                    Title
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-foreground uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <Video className="w-4 h-4 text-[var(--color-brand-blue)]" />
                    Type
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-foreground uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                    Status
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-foreground uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-6 rounded-2xl bg-gradient-to-br from-[var(--color-brand-mid-pink)]/10 to-[var(--color-brand-blue)]/10 border-2 border-[var(--color-brand-mid-pink)]/20">
                        <Sparkles className="w-16 h-16 text-[var(--color-brand-mid-pink)]" />
                      </div>
                      <div>
                        <p className="text-foreground font-semibold text-lg mb-1">No content yet</p>
                        <p className="text-muted-foreground text-sm">
                          Post stories in the Stories Planner to see them here
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const Icon = getContentTypeIcon(item.contentType);
                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-muted transition-all cursor-pointer group"
                      onClick={() => {
                        setViewingItem(item);
                        setShowViewModal(true);
                      }}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-lg bg-gradient-to-br from-[var(--color-brand-mid-pink)]/20 to-[var(--color-brand-blue)]/20 border border-[var(--color-brand-mid-pink)]/30 group-hover:border-[var(--color-brand-mid-pink)]/50 transition-all">
                            <Tag className="w-4 h-4 text-[var(--color-brand-mid-pink)]" />
                          </div>
                          <span className="font-mono text-sm font-bold text-[var(--color-brand-mid-pink)]">
                            {item.contentId}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-foreground font-medium">{item.title}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-[var(--color-brand-blue)]/20 border border-[var(--color-brand-blue)]/30">
                            <Icon className="w-4 h-4 text-[var(--color-brand-blue)]" />
                          </div>
                          <span className="text-sm text-foreground">{item.contentType}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full text-white ${getStatusColor(item.status)}`}>
                          <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewingItem(item);
                              setShowViewModal(true);
                            }}
                            className="p-2 hover:bg-[var(--color-brand-blue)]/20 rounded-lg transition-all border border-transparent hover:border-[var(--color-brand-blue)]/30 group/btn"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4 text-[var(--color-brand-blue)] group-hover/btn:scale-110 transition-transform" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteItem(item.id);
                            }}
                            className="p-2 hover:bg-red-600/20 rounded-lg transition-all border border-transparent hover:border-red-500/30 group/btn"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4 text-red-400 group-hover/btn:scale-110 transition-transform" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || showEditModal) && typeof window !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-modal-overlay-bg backdrop-blur-sm"
            onClick={() => {
              setShowCreateModal(false);
              setShowEditModal(false);
            }}
          />

          <div
            className="relative bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative bg-gradient-to-r from-[var(--color-brand-blue)] to-[var(--color-brand-mid-pink)] p-6 text-white">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                }}
                className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-xl font-bold">{showCreateModal ? "Create Content Item" : "Edit Content Item"}</h3>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)] space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Content ID *
                  </label>
                  <input
                    type="text"
                    value={itemForm.contentId}
                    onChange={(e) => setItemForm({ ...itemForm, contentId: e.target.value })}
                    disabled={showEditModal}
                    placeholder="e.g., REEL-2025-001"
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-mid-pink)]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Content Type *
                  </label>
                  <select
                    value={itemForm.contentType}
                    onChange={(e) => setItemForm({ ...itemForm, contentType: e.target.value as ContentType })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-mid-pink)]"
                  >
                    <option value="REEL">Reel</option>
                    <option value="POST">Post</option>
                    <option value="STORY">Story</option>
                    <option value="CAROUSEL">Carousel</option>
                    <option value="VIDEO">Video</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Title *</label>
                <input
                  type="text"
                  value={itemForm.title}
                  onChange={(e) => setItemForm({ ...itemForm, title: e.target.value })}
                  placeholder="Content title or description"
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-mid-pink)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Status</label>
                  <select
                    value={itemForm.status}
                    onChange={(e) => setItemForm({ ...itemForm, status: e.target.value as PipelineStatus })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-mid-pink)]"
                  >
                    {statuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Date Created</label>
                <input
                  type="date"
                  value={itemForm.dateCreated}
                  onChange={(e) => setItemForm({ ...itemForm, dateCreated: e.target.value })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-mid-pink)]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Notes</label>
                <textarea
                  value={itemForm.notes}
                  onChange={(e) => setItemForm({ ...itemForm, notes: e.target.value })}
                  placeholder="Add notes, requirements, or additional details..."
                  rows={4}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-mid-pink)]"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-border flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                }}
                className="px-6 py-2.5 bg-card hover:bg-muted border border-border text-foreground rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={showCreateModal ? handleCreateItem : handleUpdateItem}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[var(--color-brand-blue)] to-[var(--color-brand-mid-pink)] hover:from-[var(--color-brand-blue)]/90 hover:to-[var(--color-brand-mid-pink)]/90 text-white rounded-xl font-medium transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                {showCreateModal ? "Create" : "Update"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* View Modal - Detailed view with timeline */}
      {showViewModal && viewingItem && typeof window !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-modal-overlay-bg backdrop-blur-lg"
            onClick={() => setShowViewModal(false)}
          />

          <div
            className="relative bg-card rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border-2 border-border"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative bg-gradient-to-r from-[var(--color-brand-light-pink)] via-[var(--color-brand-mid-pink)] to-[var(--color-brand-blue)] p-5 text-white">
              <button
                onClick={() => setShowViewModal(false)}
                className="absolute top-4 right-4 p-1.5 hover:bg-white/20 rounded-lg transition-all hover:rotate-90 duration-300"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-start justify-between pr-10">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="p-1.5 rounded-lg bg-white/20 backdrop-blur-sm border border-white/30">
                      <Tag className="w-4 h-4" />
                    </div>
                    <p className="text-xs font-mono font-bold opacity-90">{viewingItem.contentId}</p>
                  </div>
                  <h3 className="text-xl font-bold mb-2">{viewingItem.title}</h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs px-2.5 py-1 bg-white/20 backdrop-blur-sm rounded-full border border-white/30 flex items-center gap-1.5">
                      {React.createElement(getContentTypeIcon(viewingItem.contentType), { className: "w-3.5 h-3.5" })}
                      {viewingItem.contentType}
                    </span>
                    <span className={`text-xs px-2.5 py-1 rounded-full ${getStatusColor(viewingItem.status)} text-white flex items-center gap-1.5`}>
                      <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      {viewingItem.status}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-5 overflow-y-auto max-h-[calc(90vh-200px)] space-y-4">
              {viewingItem.reelSlot ? (
                <>
                  {/* Reel Video Preview */}
                  {viewingItem.reelSlot.awsS3Url && (
                    <div className="bg-muted border-2 border-border rounded-xl p-4 hover:border-[var(--color-brand-mid-pink)]/30 transition-all">
                      <div className="flex items-center gap-2 mb-3">
                        <Video className="w-4 h-4 text-[var(--color-brand-mid-pink)]" />
                        <h4 className="font-bold text-foreground text-sm">Video Preview</h4>
                      </div>
                      <div className="flex justify-center bg-background rounded-lg p-3">
                        <div className="relative aspect-[9/16] max-h-96 bg-black rounded-lg overflow-hidden">
                          <video
                            src={viewingItem.reelSlot.awsS3Url}
                            controls
                            className="w-full h-full object-contain"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Reel Details Grid */}
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="bg-muted border-2 border-border rounded-xl p-4 space-y-3 hover:border-[var(--color-brand-mid-pink)]/30 transition-all">
                      <div className="flex items-center gap-2 pb-2 border-b border-border">
                        <Video className="w-4 h-4 text-[var(--color-brand-mid-pink)]" />
                        <h4 className="font-bold text-foreground text-sm">Reel Details</h4>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <p className="text-xs font-bold text-[var(--color-brand-mid-pink)] uppercase tracking-wide mb-1">Reel Type</p>
                          <p className="text-foreground text-sm">{viewingItem.reelSlot.reelType}</p>
                        </div>
                        {viewingItem.reelSlot.hookIdea && (
                          <div>
                            <p className="text-xs font-bold text-[var(--color-brand-mid-pink)] uppercase tracking-wide mb-1 flex items-center gap-1">
                              <TrendingUp className="w-3 h-3" />
                              Hook Idea
                            </p>
                            <p className="text-foreground text-sm">{viewingItem.reelSlot.hookIdea}</p>
                          </div>
                        )}
                        {viewingItem.reelSlot.trendingAudio && (
                          <div>
                            <p className="text-xs font-bold text-[var(--color-brand-mid-pink)] uppercase tracking-wide mb-1 flex items-center gap-1">
                              <Music className="w-3 h-3" />
                              Trending Audio
                            </p>
                            <p className="text-foreground text-sm">{viewingItem.reelSlot.trendingAudio}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-muted border-2 border-border rounded-xl p-4 space-y-3 hover:border-green-500/30 transition-all">
                      <div className="flex items-center gap-2 pb-2 border-b border-border">
                        <Clock className="w-4 h-4 text-green-400" />
                        <h4 className="font-bold text-foreground text-sm">Schedule Info</h4>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <p className="text-xs font-bold text-green-400 uppercase tracking-wide mb-1">Date</p>
                          <p className="text-foreground text-sm">
                            {new Date(viewingItem.reelSlot.date).toLocaleDateString('en-US', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>
                        </div>
                        {viewingItem.reelSlot.timeSlot && (
                          <div>
                            <p className="text-xs font-bold text-green-400 uppercase tracking-wide mb-1">Time Slot</p>
                            <p className="text-foreground text-sm">
                              {new Date(viewingItem.reelSlot.timeSlot).toLocaleTimeString('en-US', {
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: true
                              })}
                            </p>
                          </div>
                        )}
                        <div>
                          <p className="text-xs font-bold text-green-400 uppercase tracking-wide mb-1">Status</p>
                          <div className="flex items-center gap-2">
                            {viewingItem.reelSlot.isPosted ? (
                              <>
                                <CheckCircle2 className="w-4 h-4 text-green-400" />
                                <span className="text-green-400 text-sm font-semibold">Posted</span>
                              </>
                            ) : (
                              <>
                                <Clock className="w-4 h-4 text-yellow-400" />
                                <span className="text-yellow-400 text-sm font-semibold">Scheduled</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Caption */}
                  {viewingItem.reelSlot.caption && (
                    <div className="bg-muted border-2 border-border rounded-xl p-4 hover:border-[var(--color-brand-mid-pink)]/30 transition-all">
                      <div className="flex items-center gap-2 mb-2">
                        <MessageSquare className="w-4 h-4 text-[var(--color-brand-mid-pink)]" />
                        <h4 className="font-bold text-foreground text-sm">Caption</h4>
                      </div>
                      <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap bg-background rounded-lg p-3 border border-border">
                        {viewingItem.reelSlot.caption}
                      </p>
                    </div>
                  )}

                  {/* Hashtags */}
                  {viewingItem.reelSlot.hashtags && viewingItem.reelSlot.hashtags.length > 0 && (
                    <div className="bg-muted border-2 border-border rounded-xl p-4 hover:border-[var(--color-brand-blue)]/30 transition-all">
                      <div className="flex items-center gap-2 mb-2">
                        <Hash className="w-4 h-4 text-[var(--color-brand-blue)]" />
                        <h4 className="font-bold text-foreground text-sm">Hashtags</h4>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {viewingItem.reelSlot.hashtags.map((tag, i) => (
                          <span
                            key={i}
                            className="text-xs px-3 py-1.5 bg-[var(--color-brand-blue)]/10 text-[var(--color-brand-blue)] rounded-full border border-[var(--color-brand-blue)]/30 font-medium"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {viewingItem.reelSlot.notes && (
                    <div className="bg-muted border-2 border-border rounded-xl p-4 hover:border-yellow-500/30 transition-all">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-4 h-4 text-yellow-400" />
                        <h4 className="font-bold text-foreground text-sm">Notes & Ideas</h4>
                      </div>
                      <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap bg-background rounded-lg p-3 border border-border">
                        {viewingItem.reelSlot.notes}
                      </p>
                    </div>
                  )}
                </>
              ) : viewingItem.storySlot ? (
                <>
                  {/* Story Media Preview */}
                  {(viewingItem.storySlot.awsS3Url || viewingItem.storySlot.linkedPost?.awsS3Url) && (
                    <div className="bg-muted border-2 border-border rounded-xl p-4 hover:border-[var(--color-brand-mid-pink)]/30 transition-all">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-1.5 rounded-lg bg-gradient-to-br from-[var(--color-brand-mid-pink)]/20 to-[var(--color-brand-blue)]/20 border border-[var(--color-brand-mid-pink)]/30">
                          <ImageIcon className="w-4 h-4 text-[var(--color-brand-mid-pink)]" />
                        </div>
                        <h4 className="font-bold text-foreground text-sm">Story Media</h4>
                      </div>
                      <div className="flex justify-center bg-background rounded-lg p-3">
                        {viewingItem.storySlot.mimeType?.startsWith('video') ? (
                          <video
                            src={viewingItem.storySlot.awsS3Url || viewingItem.storySlot.linkedPost?.awsS3Url || ''}
                            controls
                            className="max-h-[320px] rounded-lg shadow-2xl"
                          />
                        ) : (
                          <img
                            src={viewingItem.storySlot.awsS3Url || viewingItem.storySlot.linkedPost?.awsS3Url || ''}
                            alt="Story"
                            className="max-h-[320px] rounded-lg object-cover shadow-2xl"
                          />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Story Details Grid */}
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="bg-muted border-2 border-border rounded-xl p-4 space-y-3 hover:border-[var(--color-brand-blue)]/30 transition-all">
                      <div className="flex items-center gap-2 pb-2 border-b border-border">
                        <div className="p-1.5 rounded-lg bg-gradient-to-br from-[var(--color-brand-blue)]/20 to-[var(--color-brand-mid-pink)]/20 border border-[var(--color-brand-blue)]/30">
                          <Clock className="w-4 h-4 text-[var(--color-brand-blue)]" />
                        </div>
                        <h4 className="font-bold text-foreground text-sm">Story Details</h4>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between p-2 rounded-lg bg-background border border-border">
                          <span className="text-muted-foreground text-xs">Time Slot</span>
                          <span className="font-bold text-foreground text-sm">
                            {viewingItem.storySlot.timeSlot ? format(new Date(viewingItem.storySlot.timeSlot), "h:mm a") : "No time set"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-lg bg-background border border-border">
                          <span className="text-muted-foreground text-xs">Story Type</span>
                          <span className="font-bold text-foreground text-sm">
                            {viewingItem.storySlot.storyType.replace('_', ' ')}
                          </span>
                        </div>
                        {viewingItem.storySlot.interactiveElement && viewingItem.storySlot.interactiveElement !== 'NONE' && (
                          <div className="flex items-center justify-between p-2 rounded-lg bg-background border border-border">
                            <span className="text-muted-foreground text-xs flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-[var(--color-brand-mid-pink)]" />
                              Interactive
                            </span>
                            <span className="font-bold text-foreground text-sm">
                              {viewingItem.storySlot.interactiveElement.replace('_', ' ')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-muted border-2 border-border rounded-xl p-4 space-y-3 hover:border-green-500/30 transition-all">
                      <div className="flex items-center gap-2 pb-2 border-b border-border">
                        <div className="p-1.5 rounded-lg bg-gradient-to-br from-green-600/20 to-[var(--color-brand-blue)]/20 border border-green-500/30">
                          <Calendar className="w-4 h-4 text-green-400" />
                        </div>
                        <h4 className="font-bold text-foreground text-sm">Publishing Info</h4>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between p-2 rounded-lg bg-background border border-border">
                          <span className="text-muted-foreground text-xs">Date</span>
                          <span className="font-bold text-foreground text-sm">
                            {new Date(viewingItem.storySlot.date).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-lg bg-background border border-border">
                          <span className="text-muted-foreground text-xs">Posted Status</span>
                          <span className={`font-bold text-sm ${viewingItem.storySlot.isPosted ? 'text-green-400' : 'text-muted-foreground'}`}>
                            {viewingItem.storySlot.isPosted ? '✓ Yes' : '✗ No'}
                          </span>
                        </div>
                        {viewingItem.storySlot.postedAt && (
                          <div className="flex items-center justify-between p-2 rounded-lg bg-background border border-border">
                            <span className="text-muted-foreground text-xs">Posted At</span>
                            <span className="font-bold text-foreground text-sm">
                              {new Date(viewingItem.storySlot.postedAt).toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Caption */}
                  {viewingItem.storySlot.caption && (
                    <div className="bg-muted border-2 border-border rounded-xl p-4 hover:border-[var(--color-brand-mid-pink)]/30 transition-all">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 rounded-lg bg-gradient-to-br from-[var(--color-brand-mid-pink)]/20 to-[var(--color-brand-light-pink)]/20 border border-[var(--color-brand-mid-pink)]/30">
                          <Tag className="w-4 h-4 text-[var(--color-brand-mid-pink)]" />
                        </div>
                        <h4 className="font-bold text-foreground text-sm">Caption</h4>
                      </div>
                      <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap bg-background rounded-lg p-3 border border-border">
                        {viewingItem.storySlot.caption}
                      </p>
                    </div>
                  )}

                  {/* Hashtags */}
                  {viewingItem.storySlot.hashtags && viewingItem.storySlot.hashtags.length > 0 && (
                    <div className="bg-muted border-2 border-border rounded-xl p-4 hover:border-[var(--color-brand-blue)]/30 transition-all">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 rounded-lg bg-gradient-to-br from-[var(--color-brand-blue)]/20 to-cyan-600/20 border border-[var(--color-brand-blue)]/30">
                          <Tag className="w-4 h-4 text-[var(--color-brand-blue)]" />
                        </div>
                        <h4 className="font-bold text-foreground text-sm">Hashtags</h4>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {viewingItem.storySlot.hashtags.map((tag, index) => (
                          <span
                            key={index}
                            className="px-2.5 py-1 bg-gradient-to-r from-[var(--color-brand-blue)]/20 to-cyan-600/20 border border-[var(--color-brand-blue)]/30 text-[var(--color-brand-blue)] rounded-lg text-xs font-medium hover:border-[var(--color-brand-blue)]/50 transition-all"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {viewingItem.storySlot.notes && (
                    <div className="bg-muted border-2 border-border rounded-xl p-4 hover:border-yellow-500/30 transition-all">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 rounded-lg bg-gradient-to-br from-yellow-600/20 to-orange-600/20 border border-yellow-500/30">
                          <AlertCircle className="w-4 h-4 text-yellow-400" />
                        </div>
                        <h4 className="font-bold text-foreground text-sm">Notes</h4>
                      </div>
                      <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap bg-background rounded-lg p-3 border border-border">
                        {viewingItem.storySlot.notes}
                      </p>
                    </div>
                  )}
                </>
              ) : viewingItem.feedPostSlot ? (
                <>
                  {/* Feed Post Media Preview */}
                  {viewingItem.feedPostSlot.files && viewingItem.feedPostSlot.files.length > 0 && (
                    <div className="bg-muted border-2 border-border rounded-xl p-4 hover:border-[var(--color-brand-blue)]/30 transition-all">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-1.5 rounded-lg bg-gradient-to-br from-[var(--color-brand-blue)]/20 to-cyan-600/20 border border-[var(--color-brand-blue)]/30">
                          <ImageIcon className="w-4 h-4 text-[var(--color-brand-blue)]" />
                        </div>
                        <h4 className="font-bold text-foreground text-sm">Media Files ({viewingItem.feedPostSlot.files.length})</h4>
                      </div>
                      <div className={`grid gap-3 ${viewingItem.feedPostSlot.files.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                        {viewingItem.feedPostSlot.files.map((file, index) => (
                          file.mimeType?.startsWith("video/") ? (
                            <video key={index} src={file.awsS3Url} className="w-full h-48 object-contain bg-black rounded-lg" controls />
                          ) : (
                            <img key={index} src={file.awsS3Url} alt={`Media ${index + 1}`} className="w-full h-48 object-contain bg-black rounded-lg" />
                          )
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Feed Post Details Grid */}
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="bg-muted border-2 border-border rounded-xl p-4 hover:border-[var(--color-brand-blue)]/30 transition-all">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 rounded-lg bg-gradient-to-br from-[var(--color-brand-blue)]/20 to-cyan-600/20 border border-[var(--color-brand-blue)]/30">
                          <ImageIcon className="w-4 h-4 text-[var(--color-brand-blue)]" />
                        </div>
                        <h4 className="font-bold text-foreground text-sm">Post Type</h4>
                      </div>
                      <p className="text-base font-semibold text-foreground">{viewingItem.feedPostSlot.postType.replace('_', ' ')}</p>
                    </div>

                    <div className="bg-muted border-2 border-border rounded-xl p-4 hover:border-[var(--color-brand-mid-pink)]/30 transition-all">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 rounded-lg bg-gradient-to-br from-[var(--color-brand-mid-pink)]/20 to-[var(--color-brand-light-pink)]/20 border border-[var(--color-brand-mid-pink)]/30">
                          <CalendarIcon className="w-4 h-4 text-[var(--color-brand-mid-pink)]" />
                        </div>
                        <h4 className="font-bold text-foreground text-sm">Scheduled</h4>
                      </div>
                      <p className="text-sm text-foreground">
                        {new Date(viewingItem.feedPostSlot.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                      {viewingItem.feedPostSlot.timeSlot && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(viewingItem.feedPostSlot.timeSlot).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                        </p>
                      )}
                    </div>

                    {viewingItem.feedPostSlot.location && (
                      <div className="bg-muted border-2 border-border rounded-xl p-4 hover:border-green-500/30 transition-all">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="p-1.5 rounded-lg bg-gradient-to-br from-green-600/20 to-emerald-600/20 border border-green-500/30">
                            <MapPin className="w-4 h-4 text-green-400" />
                          </div>
                          <h4 className="font-bold text-foreground text-sm">Location</h4>
                        </div>
                        <p className="text-sm text-foreground">{viewingItem.feedPostSlot.location}</p>
                      </div>
                    )}

                    {viewingItem.feedPostSlot.isPosted && viewingItem.feedPostSlot.postedAt && (
                      <div className="bg-muted border-2 border-border rounded-xl p-4 hover:border-green-500/30 transition-all">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="p-1.5 rounded-lg bg-gradient-to-br from-green-600/20 to-emerald-600/20 border border-green-500/30">
                            <CheckCircle2 className="w-4 h-4 text-green-400" />
                          </div>
                          <h4 className="font-bold text-foreground text-sm">Posted</h4>
                        </div>
                        <p className="text-sm text-foreground">
                          {new Date(viewingItem.feedPostSlot.postedAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(viewingItem.feedPostSlot.postedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Caption */}
                  {viewingItem.feedPostSlot.caption && (
                    <div className="bg-muted border-2 border-border rounded-xl p-4 hover:border-cyan-500/30 transition-all">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 rounded-lg bg-gradient-to-br from-cyan-600/20 to-[var(--color-brand-blue)]/20 border border-cyan-500/30">
                          <MessageSquare className="w-4 h-4 text-cyan-400" />
                        </div>
                        <h4 className="font-bold text-foreground text-sm">Caption</h4>
                      </div>
                      <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap bg-background rounded-lg p-3 border border-border">
                        {viewingItem.feedPostSlot.caption}
                      </p>
                    </div>
                  )}

                  {/* Hashtags */}
                  {viewingItem.feedPostSlot.hashtags && viewingItem.feedPostSlot.hashtags.length > 0 && (
                    <div className="bg-muted border-2 border-border rounded-xl p-4 hover:border-[var(--color-brand-mid-pink)]/30 transition-all">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 rounded-lg bg-gradient-to-br from-[var(--color-brand-mid-pink)]/20 to-[var(--color-brand-light-pink)]/20 border border-[var(--color-brand-mid-pink)]/30">
                          <Hash className="w-4 h-4 text-[var(--color-brand-mid-pink)]" />
                        </div>
                        <h4 className="font-bold text-foreground text-sm">Hashtags ({viewingItem.feedPostSlot.hashtags.length})</h4>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {viewingItem.feedPostSlot.hashtags.map((tag, index) => (
                          <span key={index} className="px-2.5 py-1 bg-gradient-to-r from-[var(--color-brand-mid-pink)]/20 to-[var(--color-brand-light-pink)]/20 border border-[var(--color-brand-mid-pink)]/30 text-[var(--color-brand-mid-pink)] rounded-lg text-xs font-medium">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Collaborators */}
                  {viewingItem.feedPostSlot.collaborators && viewingItem.feedPostSlot.collaborators.length > 0 && (
                    <div className="bg-muted border-2 border-border rounded-xl p-4 hover:border-[var(--color-brand-light-pink)]/30 transition-all">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 rounded-lg bg-gradient-to-br from-[var(--color-brand-light-pink)]/20 to-rose-600/20 border border-[var(--color-brand-light-pink)]/30">
                          <Users className="w-4 h-4 text-[var(--color-brand-light-pink)]" />
                        </div>
                        <h4 className="font-bold text-foreground text-sm">Collaborators ({viewingItem.feedPostSlot.collaborators.length})</h4>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {viewingItem.feedPostSlot.collaborators.map((collab, index) => (
                          <span key={index} className="px-2.5 py-1 bg-gradient-to-r from-[var(--color-brand-light-pink)]/20 to-rose-600/20 border border-[var(--color-brand-light-pink)]/30 text-[var(--color-brand-light-pink)] rounded-lg text-xs font-medium">
                            {collab}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {viewingItem.feedPostSlot.notes && (
                    <div className="bg-muted border-2 border-border rounded-xl p-4 hover:border-yellow-500/30 transition-all">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 rounded-lg bg-gradient-to-br from-yellow-600/20 to-orange-600/20 border border-yellow-500/30">
                          <AlertCircle className="w-4 h-4 text-yellow-400" />
                        </div>
                        <h4 className="font-bold text-foreground text-sm">Notes</h4>
                      </div>
                      <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap bg-background rounded-lg p-3 border border-border">
                        {viewingItem.feedPostSlot.notes}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Fallback for non-story items */}
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="bg-muted border-2 border-border rounded-xl p-4 space-y-2">
                      {viewingItem.dateCreated && (
                        <div className="flex items-center justify-between p-2 rounded-lg bg-background">
                          <span className="text-muted-foreground text-xs flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5" />
                            Created
                          </span>
                          <span className="font-bold text-foreground text-sm">
                            {new Date(viewingItem.dateCreated).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      {viewingItem.datePosted && (
                        <div className="flex items-center justify-between p-2 rounded-lg bg-background">
                          <span className="text-muted-foreground text-xs flex items-center gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Posted
                          </span>
                          <span className="font-bold text-foreground text-sm">
                            {new Date(viewingItem.datePosted).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Notes */}
                  {viewingItem.notes && (
                    <div className="bg-muted border-2 border-border rounded-xl p-4">
                      <h4 className="font-bold text-foreground text-sm mb-2">Notes</h4>
                      <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap bg-background rounded-lg p-3">
                        {viewingItem.notes}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t-2 border-border flex justify-between bg-muted">
              <button
                onClick={() => handleDeleteItem(viewingItem.id)}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white rounded-xl font-semibold transition-all shadow-lg shadow-red-600/20 hover:shadow-red-600/40 text-sm"
              >
                <Trash2 className="w-4 h-4" />
                Delete Content
              </button>
              <button
                onClick={() => setShowViewModal(false)}
                className="px-5 py-2.5 bg-card hover:bg-background text-foreground rounded-xl font-semibold transition-all border-2 border-border text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
