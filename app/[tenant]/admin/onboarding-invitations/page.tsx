"use client";

import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/nextjs";
import {
  Plus,
  Copy,
  Check,
  X,
  ExternalLink,
  Calendar,
  Users,
  Link as LinkIcon,
  Trash2,
  Search,
  Filter,
  MoreVertical,
  TrendingUp,
  Clock,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  CheckSquare,
  Square,
} from "lucide-react";
import { toast } from "sonner";

export default function OnboardingInvitationsPage() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "expired" | "used-up"
  >("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "expiring-soon">(
    "newest",
  );

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Fetch invitations
  const { data: invitations, isLoading } = useQuery({
    queryKey: ["onboarding-invitations"],
    queryFn: async () => {
      const response = await fetch("/api/onboarding-invitations");
      if (!response.ok) throw new Error("Failed to fetch invitations");
      return response.json();
    },
    enabled: !!user,
  });

  // Create invitation mutation
  const createInvitation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/onboarding-invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create invitation");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-invitations"] });
      toast.success("Invitation created successfully!");
      setShowCreateModal(false);
    },
    onError: () => {
      toast.error("Failed to create invitation");
    },
  });

  // Revoke invitation mutation
  const revokeInvitation = useMutation({
    mutationFn: async (invitationId: string) => {
      const response = await fetch(
        `/api/onboarding-invitations/${invitationId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: false }),
        },
      );
      if (!response.ok) throw new Error("Failed to revoke invitation");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-invitations"] });
      toast.success("Invitation revoked");
    },
  });

  // Delete invitation mutation
  const deleteInvitation = useMutation({
    mutationFn: async (invitationId: string) => {
      const response = await fetch(
        `/api/onboarding-invitations/${invitationId}`,
        {
          method: "DELETE",
        },
      );
      if (!response.ok) throw new Error("Failed to delete invitation");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-invitations"] });
      toast.success("Invitation deleted");
    },
  });

  // Extend expiration mutation
  const extendExpiration = useMutation({
    mutationFn: async ({
      invitationId,
      days,
    }: {
      invitationId: string;
      days: number;
    }) => {
      const currentInvitation = invitations?.find(
        (inv: any) => inv.id === invitationId,
      );
      if (!currentInvitation) throw new Error("Invitation not found");

      const currentExpiry = currentInvitation.expiresAt
        ? new Date(currentInvitation.expiresAt)
        : new Date();
      const newExpiry = new Date(
        currentExpiry.getTime() + days * 24 * 60 * 60 * 1000,
      );

      const response = await fetch(
        `/api/onboarding-invitations/${invitationId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expiresAt: newExpiry.toISOString() }),
        },
      );
      if (!response.ok) throw new Error("Failed to extend expiration");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-invitations"] });
      toast.success("Expiration extended successfully!");
    },
  });

  // Bulk delete mutation
  const bulkDelete = useMutation({
    mutationFn: async (invitationIds: string[]) => {
      await Promise.all(
        invitationIds.map((id) =>
          fetch(`/api/onboarding-invitations/${id}`, {
            method: "DELETE",
          }),
        ),
      );
    },
    onSuccess: (_, invitationIds) => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-invitations"] });
      setSelectedIds(new Set());
      toast.success(`${invitationIds.length} invitation(s) deleted`);
    },
  });

  // Bulk revoke mutation
  const bulkRevoke = useMutation({
    mutationFn: async (invitationIds: string[]) => {
      await Promise.all(
        invitationIds.map((id) =>
          fetch(`/api/onboarding-invitations/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isActive: false }),
          }),
        ),
      );
    },
    onSuccess: (_, invitationIds) => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-invitations"] });
      setSelectedIds(new Set());
      toast.success(`${invitationIds.length} invitation(s) revoked`);
    },
  });

  const copyToClipboard = (url: string, token: string) => {
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    toast.success("Link copied to clipboard!");
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleCreateInvitation = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    createInvitation.mutate({
      email: formData.get("email") || undefined,
      modelName: formData.get("modelName") || undefined,
      notes: formData.get("notes") || undefined,
      expiresInDays: parseInt(formData.get("expiresInDays") as string) || 7,
      maxUses: parseInt(formData.get("maxUses") as string) || 1,
    });
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const isUsedUp = (invitation: any) => {
    return invitation.usedCount >= invitation.maxUses;
  };

  const getInvitationStatus = (invitation: any) => {
    if (!invitation.isActive) return "revoked";
    if (isExpired(invitation.expiresAt)) return "expired";
    if (isUsedUp(invitation)) return "used-up";
    return "active";
  };

  // Filter and sort invitations
  const filteredAndSortedInvitations = useMemo(() => {
    if (!invitations) return [];

    let filtered = invitations.filter((inv: any) => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        inv.email?.toLowerCase().includes(searchLower) ||
        inv.modelName?.toLowerCase().includes(searchLower) ||
        inv.notes?.toLowerCase().includes(searchLower);

      // Status filter
      const status = getInvitationStatus(inv);
      const matchesStatus = statusFilter === "all" || status === statusFilter;

      return matchesSearch && matchesStatus;
    });

    // Sort
    filtered.sort((a: any, b: any) => {
      if (sortBy === "newest") {
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      } else if (sortBy === "oldest") {
        return (
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      } else if (sortBy === "expiring-soon") {
        if (!a.expiresAt) return 1;
        if (!b.expiresAt) return -1;
        return (
          new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime()
        );
      }
      return 0;
    });

    return filtered;
  }, [invitations, searchQuery, statusFilter, sortBy]);

  // Calculate stats
  const stats = useMemo(() => {
    if (!invitations)
      return { total: 0, active: 0, expired: 0, totalUses: 0, usedUp: 0 };

    const total = invitations.length;
    const active = invitations.filter(
      (inv: any) => getInvitationStatus(inv) === "active",
    ).length;
    const expired = invitations.filter((inv: any) =>
      isExpired(inv.expiresAt),
    ).length;
    const usedUp = invitations.filter((inv: any) => isUsedUp(inv)).length;
    const totalUses = invitations.reduce(
      (sum: number, inv: any) => sum + inv.usedCount,
      0,
    );

    return { total, active, expired, totalUses, usedUp };
  }, [invitations]);

  // Paginated invitations
  const paginatedInvitations = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredAndSortedInvitations.slice(startIndex, endIndex);
  }, [filteredAndSortedInvitations, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(
    filteredAndSortedInvitations.length / itemsPerPage,
  );

  // Bulk selection handlers
  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (
      selectedIds.size === paginatedInvitations.length &&
      paginatedInvitations.length > 0
    ) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedInvitations.map((inv: any) => inv.id)));
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;

    if (
      confirm(
        `Are you sure you want to delete ${selectedIds.size} invitation(s)?`,
      )
    ) {
      bulkDelete.mutate(Array.from(selectedIds));
    }
  };

  const handleBulkRevoke = () => {
    if (selectedIds.size === 0) return;

    if (
      confirm(
        `Are you sure you want to revoke ${selectedIds.size} invitation(s)?`,
      )
    ) {
      bulkRevoke.mutate(Array.from(selectedIds));
    }
  };

  // Reset to page 1 when filters change
  useMemo(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, sortBy]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-brand-off-white to-gray-50 dark:from-gray-900 dark:via-brand-dark-pink/5 dark:to-gray-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-brand-dark-pink via-brand-mid-pink to-brand-light-pink bg-clip-text text-transparent">
              Onboarding Invitations
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Generate and manage public onboarding links for models
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-brand-light-pink to-brand-mid-pink text-white rounded-xl hover:from-brand-mid-pink hover:to-brand-dark-pink transition-all duration-200 shadow-lg shadow-brand-light-pink/25 hover:shadow-xl hover:shadow-brand-mid-pink/30 font-medium min-h-[44px]"
          >
            <Plus className="w-5 h-5" />
            <span>Create Invitation</span>
          </button>
        </div>

        {/* Enhanced Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-200 dark:border-brand-mid-pink/20 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-gradient-to-br from-brand-light-pink/10 to-brand-mid-pink/10 dark:from-brand-light-pink/5 dark:to-brand-mid-pink/5 rounded-lg">
                <LinkIcon className="w-6 h-6 text-brand-mid-pink" />
              </div>
              <TrendingUp className="w-4 h-4 text-green-500" />
            </div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
              Total Links
            </p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {stats.total}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-200 dark:border-brand-mid-pink/20 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/20 dark:to-green-900/10 rounded-lg">
                <Check className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <span className="text-xs font-semibold text-green-600 dark:text-green-400 px-2 py-1 bg-green-50 dark:bg-green-900/20 rounded-full">
                Active
              </span>
            </div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
              Active Links
            </p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {stats.active}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-200 dark:border-brand-mid-pink/20 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-gradient-to-br from-brand-blue/10 to-brand-blue/5 dark:from-brand-blue/5 dark:to-brand-blue/5 rounded-lg">
                <Users className="w-6 h-6 text-brand-blue" />
              </div>
              <Clock className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
              Total Uses
            </p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {stats.totalUses}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-200 dark:border-brand-mid-pink/20 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-gradient-to-br from-red-100 to-red-50 dark:from-red-900/20 dark:to-red-900/10 rounded-lg">
                <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <span className="text-xs font-semibold text-red-600 dark:text-red-400 px-2 py-1 bg-red-50 dark:bg-red-900/20 rounded-full">
                {stats.expired + stats.usedUp}
              </span>
            </div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
              Expired/Used
            </p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {stats.expired + stats.usedUp}
            </p>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-brand-mid-pink/20 shadow-sm p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by email, model name, or notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand-light-pink focus:border-transparent transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-light-pink focus:border-transparent transition-all cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="used-up">Used Up</option>
              </select>
            </div>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-light-pink focus:border-transparent transition-all cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="expiring-soon">Expiring Soon</option>
            </select>
          </div>

          {/* Active Filter Badges */}
          {(searchQuery || statusFilter !== "all") && (
            <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Active filters:
              </span>
              {searchQuery && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-brand-light-pink/10 dark:bg-brand-light-pink/20 text-brand-dark-pink dark:text-brand-light-pink text-sm rounded-md">
                  Search: "{searchQuery}"
                  <button
                    onClick={() => setSearchQuery("")}
                    className="hover:bg-brand-light-pink/20 rounded"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {statusFilter !== "all" && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-brand-blue/10 dark:bg-brand-blue/20 text-brand-blue text-sm rounded-md">
                  Status: {statusFilter}
                  <button
                    onClick={() => setStatusFilter("all")}
                    className="hover:bg-brand-blue/20 rounded"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              <button
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                }}
                className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 underline"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Results Count and Bulk Actions */}
        {filteredAndSortedInvitations.length > 0 && (
          <div className="flex items-center justify-between mb-4 gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title={
                  selectedIds.size === paginatedInvitations.length &&
                  paginatedInvitations.length > 0
                    ? "Deselect all"
                    : "Select all"
                }
              >
                {selectedIds.size === paginatedInvitations.length &&
                paginatedInvitations.length > 0 ? (
                  <CheckSquare className="w-5 h-5 text-brand-mid-pink" />
                ) : (
                  <Square className="w-5 h-5" />
                )}
                <span>Select All</span>
              </button>

              <div className="text-sm text-gray-600 dark:text-gray-400">
                {selectedIds.size > 0 ? (
                  <span className="font-semibold text-brand-mid-pink">
                    {selectedIds.size} selected
                  </span>
                ) : (
                  <span>
                    Showing {(currentPage - 1) * itemsPerPage + 1}-
                    {Math.min(
                      currentPage * itemsPerPage,
                      filteredAndSortedInvitations.length,
                    )}{" "}
                    of {filteredAndSortedInvitations.length}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Floating Bulk Actions Bar */}
        {selectedIds.size > 0 && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5 duration-200">
            <div className="bg-white dark:bg-gray-800 border-2 border-brand-mid-pink/30 dark:border-brand-mid-pink/50 rounded-2xl shadow-2xl shadow-brand-mid-pink/20 px-6 py-4 flex items-center gap-4">
              <div className="flex items-center gap-2 pr-4 border-r border-gray-200 dark:border-gray-700">
                <div className="w-8 h-8 bg-gradient-to-br from-brand-light-pink to-brand-mid-pink rounded-full flex items-center justify-center text-white font-bold text-sm">
                  {selectedIds.size}
                </div>
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Selected
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleBulkRevoke}
                  disabled={bulkRevoke.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:hover:bg-yellow-900/50 text-yellow-700 dark:text-yellow-400 rounded-lg transition-colors font-medium disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                  Revoke
                </button>

                <button
                  onClick={handleBulkDelete}
                  disabled={bulkDelete.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 rounded-lg transition-colors font-medium disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>

                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Invitations List - Modern Card Layout */}
        {isLoading ? (
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-brand-mid-pink/20 p-6 animate-pulse"
              >
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        ) : filteredAndSortedInvitations.length > 0 ? (
          <div className="grid gap-4">
            {paginatedInvitations.map((invitation: any) => {
              const status = getInvitationStatus(invitation);
              const isSelected = selectedIds.has(invitation.id);
              const usagePercentage =
                (invitation.usedCount / invitation.maxUses) * 100;

              const statusConfig = {
                active: {
                  badge:
                    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
                  label: "Active",
                  border: "border-green-200 dark:border-green-900/30",
                },
                expired: {
                  badge:
                    "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
                  label: "Expired",
                  border: "border-red-200 dark:border-red-900/30",
                },
                "used-up": {
                  badge:
                    "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
                  label: "Used Up",
                  border: "border-orange-200 dark:border-orange-900/30",
                },
                revoked: {
                  badge:
                    "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400",
                  label: "Revoked",
                  border: "border-gray-200 dark:border-gray-700",
                },
              };

              const config = statusConfig[status as keyof typeof statusConfig];

              return (
                <div
                  key={invitation.id}
                  className={`bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-xl border-2 ${
                    isSelected
                      ? "border-brand-mid-pink dark:border-brand-light-pink ring-2 ring-brand-light-pink/30"
                      : config.border
                  } shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden group`}
                >
                  <div className="p-5 sm:p-6">
                    {/* Checkbox and Header with Status and Actions */}
                    <div className="flex items-start gap-4 mb-4">
                      {/* Selection Checkbox */}
                      <button
                        onClick={() => toggleSelection(invitation.id)}
                        className="flex-shrink-0 mt-1 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5 text-brand-mid-pink" />
                        ) : (
                          <Square className="w-5 h-5 text-gray-400" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <span
                            className={`px-3 py-1 text-xs font-bold rounded-full ${config.badge} uppercase tracking-wide`}
                          >
                            {config.label}
                          </span>
                          {invitation.modelName && (
                            <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                              <Users className="w-4 h-4 text-brand-mid-pink" />
                              {invitation.modelName}
                            </h3>
                          )}
                        </div>
                        {invitation.email && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                            <span className="text-brand-blue">✉</span>
                            {invitation.email}
                          </p>
                        )}
                      </div>

                      {/* Actions Menu */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            copyToClipboard(invitation.url, invitation.token)
                          }
                          className="p-2.5 sm:p-3 bg-gradient-to-r from-brand-light-pink/10 to-brand-mid-pink/10 hover:from-brand-light-pink/20 hover:to-brand-mid-pink/20 dark:from-brand-light-pink/5 dark:to-brand-mid-pink/5 dark:hover:from-brand-light-pink/10 dark:hover:to-brand-mid-pink/10 rounded-lg transition-all duration-200 min-w-[44px] min-h-[44px] flex items-center justify-center"
                          title="Copy link"
                        >
                          {copiedToken === invitation.token ? (
                            <Check className="w-5 h-5 text-green-500" />
                          ) : (
                            <Copy className="w-5 h-5 text-brand-mid-pink" />
                          )}
                        </button>
                        <a
                          href={invitation.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2.5 sm:p-3 bg-brand-blue/10 hover:bg-brand-blue/20 dark:bg-brand-blue/5 dark:hover:bg-brand-blue/10 rounded-lg transition-all duration-200 min-w-[44px] min-h-[44px] flex items-center justify-center"
                          title="Open link"
                        >
                          <ExternalLink className="w-5 h-5 text-brand-blue" />
                        </a>
                        <div className="relative group/menu">
                          <button
                            className="p-2.5 sm:p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all min-w-[44px] min-h-[44px] flex items-center justify-center"
                            title="More options"
                          >
                            <MoreVertical className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                          </button>
                          {/* Dropdown Menu */}
                          <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all duration-200 z-10">
                            {status === "active" && (
                              <>
                                <button
                                  onClick={() =>
                                    extendExpiration.mutate({
                                      invitationId: invitation.id,
                                      days: 7,
                                    })
                                  }
                                  className="w-full px-4 py-3 text-left text-sm text-brand-mid-pink dark:text-brand-light-pink hover:bg-brand-light-pink/10 dark:hover:bg-brand-light-pink/5 transition-colors flex items-center gap-2"
                                >
                                  <RefreshCw className="w-4 h-4" />
                                  Extend 7 Days
                                </button>
                                <button
                                  onClick={() =>
                                    revokeInvitation.mutate(invitation.id)
                                  }
                                  className="w-full px-4 py-3 text-left text-sm text-yellow-700 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-colors flex items-center gap-2 border-t border-gray-200 dark:border-gray-700"
                                >
                                  <X className="w-4 h-4" />
                                  Revoke
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => {
                                if (
                                  confirm(
                                    "Are you sure you want to delete this invitation?",
                                  )
                                ) {
                                  deleteInvitation.mutate(invitation.id);
                                }
                              }}
                              className="w-full px-4 py-3 text-left text-sm text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2 border-t border-gray-200 dark:border-gray-700"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Invitation URL */}
                    <div className="mb-4 p-3 bg-gradient-to-r from-gray-50 to-brand-off-white dark:from-gray-900/50 dark:to-brand-dark-pink/5 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                      <code className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 font-mono break-all">
                        {invitation.url}
                      </code>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                      <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <div className="min-w-0">
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Created
                          </p>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                            {new Date(invitation.createdAt).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                              },
                            )}
                          </p>
                        </div>
                      </div>

                      {invitation.expiresAt && (
                        <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <div className="min-w-0">
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Expires
                            </p>
                            <p
                              className={`text-sm font-semibold truncate ${
                                isExpired(invitation.expiresAt)
                                  ? "text-red-600 dark:text-red-400"
                                  : "text-gray-900 dark:text-white"
                              }`}
                            >
                              {new Date(
                                invitation.expiresAt,
                              ).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })}
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-2 p-3 bg-gradient-to-br from-brand-blue/5 to-brand-blue/10 dark:from-brand-blue/10 dark:to-brand-blue/5 rounded-lg">
                        <LinkIcon className="w-4 h-4 text-brand-blue" />
                        <div className="min-w-0">
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Usage
                          </p>
                          <p className="text-sm font-bold text-brand-blue">
                            {invitation.usedCount} / {invitation.maxUses}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 p-3 bg-gradient-to-br from-brand-light-pink/5 to-brand-mid-pink/10 dark:from-brand-light-pink/10 dark:to-brand-mid-pink/5 rounded-lg">
                        <Users className="w-4 h-4 text-brand-mid-pink" />
                        <div className="min-w-0">
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Drafts
                          </p>
                          <p className="text-sm font-bold text-brand-mid-pink">
                            {invitation.draftsCount || 0}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Usage Progress Bar */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1.5">
                        <span className="font-medium">Usage Progress</span>
                        <span className="font-bold">
                          {Math.round(usagePercentage)}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 rounded-full ${
                            usagePercentage >= 100
                              ? "bg-gradient-to-r from-red-500 to-red-600"
                              : usagePercentage >= 80
                                ? "bg-gradient-to-r from-yellow-500 to-orange-500"
                                : usagePercentage >= 50
                                  ? "bg-gradient-to-r from-brand-blue to-brand-light-pink"
                                  : "bg-gradient-to-r from-green-500 to-green-600"
                          }`}
                          style={{
                            width: `${Math.min(usagePercentage, 100)}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Notes */}
                    {invitation.notes && (
                      <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                        <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                          💡 {invitation.notes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-gradient-to-br from-brand-light-pink/20 to-brand-mid-pink/20 dark:from-brand-light-pink/10 dark:to-brand-mid-pink/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <LinkIcon className="w-8 h-8 text-brand-mid-pink" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                {searchQuery || statusFilter !== "all"
                  ? "No matching invitations"
                  : "No invitations yet"}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {searchQuery || statusFilter !== "all"
                  ? "Try adjusting your search or filters"
                  : "Create your first invitation link to get started with onboarding models"}
              </p>
              {!searchQuery && statusFilter === "all" && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-brand-light-pink to-brand-mid-pink text-white rounded-xl hover:from-brand-mid-pink hover:to-brand-dark-pink transition-all duration-200 shadow-lg shadow-brand-light-pink/25 font-medium"
                >
                  <Plus className="w-5 h-5" />
                  Create First Invitation
                </button>
              )}
            </div>
          </div>
        )}

        {/* Pagination Controls */}
        {filteredAndSortedInvitations.length > itemsPerPage && (
          <div className="mt-8 flex items-center justify-between gap-4 flex-wrap">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Page {currentPage} of {totalPages}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>

              {/* Page Numbers */}
              <div className="hidden sm:flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-10 h-10 rounded-lg font-medium transition-all ${
                        currentPage === pageNum
                          ? "bg-gradient-to-r from-brand-light-pink to-brand-mid-pink text-white shadow-lg shadow-brand-light-pink/25"
                          : "bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() =>
                  setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                }
                disabled={currentPage === totalPages}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Enhanced Create Modal */}
      {showCreateModal &&
        createPortal(
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full shadow-2xl border border-gray-200 dark:border-brand-mid-pink/20 overflow-hidden animate-in zoom-in-95 duration-200">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-brand-light-pink/10 via-brand-mid-pink/10 to-brand-blue/10 dark:from-brand-dark-pink/20 dark:via-brand-mid-pink/10 dark:to-brand-blue/10 px-6 py-5 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <div className="p-2 bg-gradient-to-br from-brand-light-pink to-brand-mid-pink rounded-lg">
                        <Plus className="w-5 h-5 text-white" />
                      </div>
                      Create Invitation Link
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Generate a secure onboarding link for a model
                    </p>
                  </div>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleCreateInvitation} className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Model Name{" "}
                    <span className="text-gray-400 font-normal">
                      (Optional)
                    </span>
                  </label>
                  <input
                    type="text"
                    name="modelName"
                    placeholder="e.g., Bella Rose"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand-light-pink focus:border-transparent transition-all"
                  />
                  <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                    Pre-fill the model name for this invitation
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Email{" "}
                    <span className="text-gray-400 font-normal">
                      (Optional)
                    </span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    placeholder="model@example.com"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand-light-pink focus:border-transparent transition-all"
                  />
                  <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                    Track which email this invitation is for
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Expires In (Days)
                    </label>
                    <input
                      type="number"
                      name="expiresInDays"
                      defaultValue={7}
                      min={1}
                      max={365}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-light-pink focus:border-transparent transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Max Uses
                    </label>
                    <input
                      type="number"
                      name="maxUses"
                      defaultValue={1}
                      min={1}
                      max={100}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-light-pink focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Notes{" "}
                    <span className="text-gray-400 font-normal">
                      (Optional)
                    </span>
                  </label>
                  <textarea
                    name="notes"
                    rows={3}
                    placeholder="Internal notes about this invitation..."
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand-light-pink focus:border-transparent transition-all resize-none"
                  />
                  <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                    Add private notes for your reference
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-5 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-all duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createInvitation.isPending}
                    className="flex-1 px-5 py-3 bg-gradient-to-r from-brand-light-pink to-brand-mid-pink text-white rounded-xl hover:from-brand-mid-pink hover:to-brand-dark-pink disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg shadow-brand-light-pink/25 transition-all duration-200"
                  >
                    {createInvitation.isPending ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg
                          className="animate-spin h-5 w-5"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Creating...
                      </span>
                    ) : (
                      "Create Link"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
