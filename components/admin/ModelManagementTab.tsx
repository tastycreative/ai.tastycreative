'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  User,
  Search,
  Filter,
  Trash2,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  X,
  AlertTriangle,
  Building2,
  Check,
  Loader2,
  Image as ImageIcon,
} from 'lucide-react';
import {
  useAdminModels,
  useAdminCreators,
  useAdminOrganizations,
  useBulkDeleteModels,
  useAssignCreator,
  useUnassignCreator,
  useBulkShareModels,
  useBulkUpdateModels,
  usePrefetchNextPage,
  type ModelProfile,
  type Creator,
  type Organization,
} from '@/lib/hooks/useAdminModels.query';

// Custom hook for debounced value
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

type ModalType = 'delete' | 'assign' | 'share' | 'viewAssignments' | null;

export default function ModelManagementTab() {
  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const limit = 25; // Fixed page size for better performance

  // Debounce search input for 300ms to avoid excessive API calls
  const debouncedSearch = useDebounce(searchTerm, 300);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  // Modal state
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [selectedCreators, setSelectedCreators] = useState<Set<string>>(new Set());
  const [creatorSearchTerm, setCreatorSearchTerm] = useState('');
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null);
  const [selectedOrganization, setSelectedOrganization] = useState<string>('');

  // Success notification
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // React Query hooks for data fetching with caching
  const {
    data: modelsData,
    isLoading: loading,
    error: queryError,
    isFetching,
    refetch,
  } = useAdminModels({
    page,
    limit,
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
    type: typeFilter || undefined,
  });

  const { data: creators = [] } = useAdminCreators();
  const { data: organizations = [] } = useAdminOrganizations();

  // Mutations
  const bulkDeleteMutation = useBulkDeleteModels();
  const assignCreatorMutation = useAssignCreator();
  const unassignCreatorMutation = useUnassignCreator();
  const bulkShareMutation = useBulkShareModels();
  const bulkUpdateMutation = useBulkUpdateModels();

  // Extract data from query response
  const models = modelsData?.data?.profiles || [];
  const pagination = modelsData?.data?.pagination || { total: 0, page: 1, limit, totalPages: 0 };
  const error = queryError?.message || null;

  // Prefetch next page on hover over pagination
  const prefetchNextPage = usePrefetchNextPage(
    { page, limit, search: debouncedSearch, status: statusFilter, type: typeFilter },
    pagination.totalPages
  );

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, typeFilter]);

  // Clear success message after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Selection handlers
  const toggleSelectAll = useCallback(() => {
    if (selectAll) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(models.map((m) => m.id)));
    }
    setSelectAll(!selectAll);
  }, [selectAll, models]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  // Check if all current page items are selected
  useEffect(() => {
    if (models.length > 0) {
      const allSelected = models.every((m) => selectedIds.has(m.id));
      setSelectAll(allSelected);
    } else {
      setSelectAll(false);
    }
  }, [models, selectedIds]);

  // Pagination handlers
  const goToPage = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPage(newPage);
    }
  };

  // Bulk action handlers
  const openModal = (type: ModalType, profileId?: string) => {
    if (type !== 'viewAssignments' && selectedIds.size === 0) return;
    setActiveModal(type);
    setModalError(null);
    setSelectedCreators(new Set());
    setCreatorSearchTerm('');
    setSelectedOrganization('');
    if (profileId) setViewingProfileId(profileId);
  };

  const closeModal = () => {
    if (bulkDeleteMutation.isPending || assignCreatorMutation.isPending) return;
    setActiveModal(null);
    setModalError(null);
    setViewingProfileId(null);
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    bulkDeleteMutation.mutate(Array.from(selectedIds), {
      onSuccess: (data) => {
        setSuccessMessage(data.message);
        setSelectedIds(new Set());
        closeModal();
      },
      onError: (err) => {
        setModalError(err instanceof Error ? err.message : 'Failed to delete models');
      },
    });
  };

  // Assign Multiple Creators
  const handleAssignCreator = async () => {
    if (selectedIds.size === 0 || selectedCreators.size === 0) return;

    const profileIds = Array.from(selectedIds);
    const creatorIds = Array.from(selectedCreators);
    
    // Assign each creator to all selected profiles
    let successCount = 0;
    let errorOccurred = false;

    for (const creatorClerkId of creatorIds) {
      try {
        await assignCreatorMutation.mutateAsync(
          { profileIds, creatorClerkId }
        );
        successCount++;
      } catch (err) {
        errorOccurred = true;
        setModalError(err instanceof Error ? err.message : 'Failed to assign some creators');
      }
    }

    if (!errorOccurred) {
      setSuccessMessage(`Successfully assigned ${successCount} creator(s) to ${profileIds.length} profile(s)`);
      setSelectedIds(new Set());
      closeModal();
    }
  };

  // Unassign Creator
  const handleUnassignCreator = async (profileId: string, creatorClerkId: string) => {
    try {
      await unassignCreatorMutation.mutateAsync(
        { profileIds: [profileId], creatorClerkId }
      );
      setSuccessMessage('Creator unassigned successfully');
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to unassign creator');
    }
  };

  // Toggle creator selection
  const toggleCreatorSelection = (creatorClerkId: string) => {
    setSelectedCreators((prev) => {
      const next = new Set(prev);
      if (next.has(creatorClerkId)) {
        next.delete(creatorClerkId);
      } else {
        next.add(creatorClerkId);
      }
      return next;
    });
  };

  // Bulk Share to Organization
  const handleBulkShare = async () => {
    if (selectedIds.size === 0 || !selectedOrganization) return;

    bulkShareMutation.mutate(
      { profileIds: Array.from(selectedIds), organizationId: selectedOrganization },
      {
        onSuccess: (data) => {
          setSuccessMessage(data.message);
          setSelectedIds(new Set());
          closeModal();
        },
        onError: (err) => {
          setModalError(err instanceof Error ? err.message : 'Failed to share models');
        },
      }
    );
  };

  // Bulk update status
  const handleStatusChange = (profileId: string, newStatus: string) => {
    bulkUpdateMutation.mutate(
      { profileIds: [profileId], updates: { status: newStatus } },
      {
        onSuccess: (data) => {
          setSuccessMessage(data.message);
        },
        onError: (err) => {
          setSuccessMessage(`Error: ${err instanceof Error ? err.message : 'Failed to update status'}`);
        },
      }
    );
  };

  // Bulk update type
  const handleTypeChange = (profileId: string, newType: string) => {
    bulkUpdateMutation.mutate(
      { profileIds: [profileId], updates: { type: newType } },
      {
        onSuccess: (data) => {
          setSuccessMessage(data.message);
        },
        onError: (err) => {
          setSuccessMessage(`Error: ${err instanceof Error ? err.message : 'Failed to update type'}`);
        },
      }
    );
  };

  // Filter creators by search term
  const filteredCreators = useMemo(() => {
    if (!creatorSearchTerm) return creators;
    const search = creatorSearchTerm.toLowerCase();
    return creators.filter(
      (c) =>
        c.firstName?.toLowerCase().includes(search) ||
        c.lastName?.toLowerCase().includes(search) ||
        c.email?.toLowerCase().includes(search)
    );
  }, [creators, creatorSearchTerm]);

  // Helper functions
  const getOwnerName = (model: ModelProfile) => {
    if (!model.user) return 'Unknown';
    const { firstName, lastName, email } = model.user;
    if (firstName || lastName) {
      return `${firstName || ''} ${lastName || ''}`.trim();
    }
    return email || 'Unknown';
  };

  const getAssignedCreators = (model: ModelProfile) => {
    if (!model.assignments || model.assignments.length === 0) {
      return [];
    }
    
    return model.assignments.map((assignment) => {
      const creator = creators.find((c) => c.clerkId === assignment.assignedToClerkId);
      if (!creator) return null;
      
      const { firstName, lastName, email } = creator;
      const name = firstName || lastName
        ? `${firstName || ''} ${lastName || ''}`.trim()
        : email || 'Unknown';
      
      return {
        clerkId: creator.clerkId,
        name,
        assignmentId: assignment.id,
      };
    }).filter(Boolean);
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/10 text-green-500 border-green-500/30';
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30';
      case 'paused':
        return 'bg-orange-500/10 text-orange-500 border-orange-500/30';
      case 'dropped':
        return 'bg-red-500/10 text-red-500 border-red-500/30';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/30';
    }
  };

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'real':
        return 'bg-brand-blue/10 text-brand-blue border-brand-blue/30';
      case 'ai':
        return 'bg-brand-light-pink/10 text-brand-light-pink border-brand-light-pink/30';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/30';
    }
  };

  // Loading state
  if (loading && models.length === 0) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg sm:text-xl font-semibold text-foreground">Model Management</h3>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-brand-light-pink" />
        </div>
      </div>
    );
  }

  // Error state
  if (error && models.length === 0) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg sm:text-xl font-semibold text-foreground">Model Management</h3>
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
          <p className="text-destructive">{error}</p>
          <button
            onClick={() => refetch()}
            className="mt-2 bg-brand-light-pink hover:bg-brand-mid-pink text-white px-4 py-2 rounded-lg text-sm font-medium transition-all"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6" style={{ paddingBottom: selectedIds.size > 0 ? '120px' : '0' }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h3 className="text-lg sm:text-xl font-semibold text-foreground">Model Management</h3>

        {/* Bulk Actions */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-brand-light-pink/10 border border-brand-light-pink/30 rounded-lg">
            <span className="text-sm font-medium text-brand-light-pink">
              {selectedIds.size} selected
            </span>
            <button
              onClick={() => openModal('delete')}
              className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors group"
              title="Delete selected"
            >
              <Trash2 className="w-4 h-4 text-red-500" />
            </button>
            <button
              onClick={() => openModal('assign')}
              className="p-1.5 hover:bg-brand-light-pink/20 rounded-lg transition-colors group"
              title="Assign to creator"
            >
              <UserPlus className="w-4 h-4 text-brand-light-pink" />
            </button>
            <button
              onClick={() => openModal('share')}
              className="p-1.5 hover:bg-brand-blue/20 rounded-lg transition-colors group"
              title="Share to organization"
            >
              <Building2 className="w-4 h-4 text-brand-blue" />
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="p-1.5 hover:bg-accent rounded-lg transition-colors"
              title="Clear selection"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        )}
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3 flex items-center gap-2">
          <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
          <span className="text-sm text-green-500">{successMessage}</span>
          <button
            onClick={() => setSuccessMessage(null)}
            className="ml-auto p-1 hover:bg-green-500/20 rounded"
          >
            <X className="w-4 h-4 text-green-500" />
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search models..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-border bg-card rounded-lg focus:ring-2 focus:ring-brand-light-pink focus:border-transparent text-foreground placeholder-muted-foreground text-sm transition-all"
          />
        </div>

        {/* Status Filter */}
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="pl-10 pr-8 py-2 border border-border bg-card rounded-lg focus:ring-2 focus:ring-brand-light-pink focus:border-transparent text-foreground text-sm appearance-none"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="paused">Paused</option>
            <option value="dropped">Dropped</option>
          </select>
        </div>

        {/* Type Filter */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-4 py-2 border border-border bg-card rounded-lg focus:ring-2 focus:ring-brand-light-pink focus:border-transparent text-foreground text-sm appearance-none"
        >
          <option value="">All Types</option>
          <option value="real">Real</option>
          <option value="ai">AI</option>
        </select>
      </div>

      {/* Stats */}
      <div className="bg-gradient-to-r from-brand-light-pink/5 to-brand-blue/5 border border-brand-light-pink/20 rounded-lg px-4 py-3">
        <p className="text-sm text-foreground/80">
          Showing <span className="font-semibold text-brand-light-pink">{models.length}</span> of{' '}
          <span className="font-semibold text-brand-blue">{pagination.total}</span> total models
          {selectedIds.size > 0 && (
            <span className="ml-2 text-brand-mid-pink">
              ({selectedIds.size} selected)
            </span>
          )}
        </p>
      </div>

      {/* Table */}
      <div className="bg-card/50 backdrop-blur-sm border border-border rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="bg-gradient-to-r from-brand-light-pink/5 to-brand-blue/5 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-border text-brand-light-pink focus:ring-brand-light-pink"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-foreground/70 uppercase tracking-wider">
                  Model
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-foreground/70 uppercase tracking-wider">
                  Owner
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-foreground/70 uppercase tracking-wider">
                  Assigned To
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-foreground/70 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-foreground/70 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-foreground/70 uppercase tracking-wider">
                  Organization
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-foreground/70 uppercase tracking-wider">
                  Activity
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-foreground/70 uppercase tracking-wider">
                  Updated
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {models.map((model, index) => (
                <tr
                  key={model.id}
                  className={`${
                    index % 2 === 0 ? 'bg-card/30' : 'bg-accent/30'
                  } ${
                    selectedIds.has(model.id) ? 'bg-brand-light-pink/10' : ''
                  } hover:bg-brand-light-pink/5 transition-colors`}
                >
                  {/* Checkbox */}
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(model.id)}
                      onChange={() => toggleSelect(model.id)}
                      className="w-4 h-4 rounded border-border text-brand-light-pink focus:ring-brand-light-pink"
                    />
                  </td>

                  {/* Model Info */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-brand-light-pink to-brand-mid-pink flex items-center justify-center flex-shrink-0 shadow-md">
                        {model.profileImageUrl ? (
                          <img
                            src={model.profileImageUrl}
                            alt={model.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-5 h-5 text-white" />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground text-sm">{model.name}</p>
                        {model.instagramUsername && (
                          <p className="text-xs text-muted-foreground">@{model.instagramUsername}</p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Owner */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full overflow-hidden bg-accent flex items-center justify-center flex-shrink-0">
                        {model.user?.imageUrl ? (
                          <img
                            src={model.user.imageUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-3 h-3 text-muted-foreground" />
                        )}
                      </div>
                      <span className="text-sm text-foreground/80">{getOwnerName(model)}</span>
                    </div>
                  </td>

                  {/* Assigned To */}
                  <td className="px-4 py-3">
                    {(() => {
                      const assignedCreators = getAssignedCreators(model);
                      if (assignedCreators.length === 0) {
                        return <span className="text-sm text-muted-foreground">—</span>;
                      }
                      
                      return (
                        <button
                          onClick={() => openModal('viewAssignments', model.id)}
                          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg bg-brand-blue/10 text-brand-blue border border-brand-blue/20 hover:bg-brand-blue/20 transition-colors"
                        >
                          <UserPlus className="w-4 h-4" />
                          {assignedCreators.length} {assignedCreators.length === 1 ? 'creator' : 'creators'}
                        </button>
                      );
                    })()}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <select
                      value={model.status}
                      onChange={(e) => handleStatusChange(model.id, e.target.value)}
                      disabled={bulkUpdateMutation.isPending}
                      className={`px-2 py-1 text-xs font-medium rounded-md border bg-background transition-colors disabled:opacity-50 ${getStatusBadgeClass(
                        model.status
                      )}`}
                    >
                      <option value="active">active</option>
                      <option value="inactive">inactive</option>
                      <option value="pending">pending</option>
                      <option value="archived">archived</option>
                    </select>
                  </td>

                  {/* Type */}
                  <td className="px-4 py-3">
                    <select
                      value={model.type}
                      onChange={(e) => handleTypeChange(model.id, e.target.value)}
                      disabled={bulkUpdateMutation.isPending}
                      className={`px-2 py-1 text-xs font-medium rounded-md border bg-background transition-colors disabled:opacity-50 ${getTypeBadgeClass(
                        model.type
                      )}`}
                    >
                      <option value="real">real</option>
                      <option value="ai">ai</option>
                    </select>
                  </td>

                  {/* Organization */}
                  <td className="px-4 py-3">
                    {model.organization ? (
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-brand-blue" />
                        <span className="text-sm text-foreground/80">{model.organization.name}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </td>

                  {/* Activity */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 text-xs">
                      <div className="flex items-center gap-1">
                        <ImageIcon className="w-3.5 h-3.5 text-brand-light-pink" />
                        <span className="text-foreground/70">{model._count.posts}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-foreground/70">{model._count.feedPosts} posts</span>
                      </div>
                    </div>
                  </td>

                  {/* Updated */}
                  <td className="px-4 py-3">
                    <span className="text-sm text-foreground/70">
                      {new Date(model.updatedAt).toLocaleDateString()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-card/50">
            <p className="text-sm text-muted-foreground">
              Page {pagination.page} of {pagination.totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => goToPage(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="p-2 rounded-lg border border-border hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => goToPage(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className="p-2 rounded-lg border border-border hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Empty State */}
      {models.length === 0 && !loading && (
        <div className="text-center py-12">
          <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No models found</h3>
          <p className="text-sm text-muted-foreground">
            {searchTerm || statusFilter || typeFilter
              ? 'Try adjusting your filters'
              : 'No models have been created yet'}
          </p>
        </div>
      )}

      {/* Sticky Bottom Action Bar - Appears when items are selected */}
      {selectedIds.size > 0 && createPortal(
        <div className="fixed bottom-0 left-0 right-0 z-40 animate-in slide-in-from-bottom duration-300">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
            <div className="bg-card dark:bg-gray-900 border border-border shadow-lg rounded-lg p-3">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                {/* Selection Count */}
                <div className="flex items-center gap-3">
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{selectedIds.size}</span> {selectedIds.size === 1 ? 'item' : 'items'} selected
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openModal('delete')}
                    className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-md text-sm font-medium transition-colors flex items-center gap-1.5"
                    title="Delete selected"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Delete</span>
                  </button>
                  <button
                    onClick={() => openModal('assign')}
                    className="px-3 py-1.5 border border-border hover:bg-accent text-foreground rounded-md text-sm font-medium transition-colors flex items-center gap-1.5"
                    title="Assign to creator"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span className="hidden sm:inline">Assign</span>
                  </button>
                  <button
                    onClick={() => openModal('share')}
                    className="px-3 py-1.5 border border-border hover:bg-accent text-foreground rounded-md text-sm font-medium transition-colors flex items-center gap-1.5"
                    title="Share to organization"
                  >
                    <Building2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Share</span>
                  </button>
                  <button
                    onClick={() => setSelectedIds(new Set())}
                    className="px-3 py-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md text-sm font-medium transition-colors flex items-center gap-1.5"
                    title="Clear selection"
                  >
                    <X className="w-4 h-4" />
                    <span className="hidden sm:inline">Clear</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation Modal */}
      {activeModal === 'delete' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-card border border-border rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Delete Models</h3>
                <p className="text-sm text-muted-foreground">This action cannot be undone</p>
              </div>
            </div>

            <p className="text-sm text-foreground/80 mb-6">
              Are you sure you want to delete{' '}
              <span className="font-semibold text-red-500">{selectedIds.size}</span> selected
              model(s)? All associated data including posts, captions, and vault folders will be
              permanently removed.
            </p>

            {modalError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-500">
                {modalError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={closeModal}
                disabled={bulkDeleteMutation.isPending}
                className="flex-1 px-4 py-2 border border-border rounded-lg text-foreground hover:bg-accent transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleteMutation.isPending}
                className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {bulkDeleteMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Assign Creator Modal */}
      {activeModal === 'assign' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-card border border-border rounded-2xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-brand-light-pink/10 flex items-center justify-center">
                <UserPlus className="w-6 h-6 text-brand-light-pink" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Assign to Creators</h3>
                <p className="text-sm text-muted-foreground">
                  Assign {selectedIds.size} model(s) to creators
                </p>
              </div>
            </div>

            {/* Current Assignments Section */}
            {(() => {
              const currentAssignments = Array.from(selectedIds)
                .flatMap((profileId) => {
                  const model = models.find((m) => m.id === profileId);
                  if (!model) return [];
                  return getAssignedCreators(model).map((creator) => ({
                    profileId,
                    profileName: model.name || model.instagramUsername || 'Unnamed',
                    ...creator,
                  }));
                })
                .reduce((acc, item) => {
                  // Group by creator
                  const existing = acc.find((a) => a.clerkId === item.clerkId);
                  if (existing) {
                    existing.profiles.push({
                      profileId: item.profileId,
                      profileName: item.profileName,
                    });
                  } else {
                    acc.push({
                      clerkId: item.clerkId!,
                      name: item.name!,
                      profiles: [{ profileId: item.profileId, profileName: item.profileName }],
                    });
                  }
                  return acc;
                }, [] as Array<{ clerkId: string; name: string; profiles: Array<{ profileId: string; profileName: string }> }>);

              return currentAssignments.length > 0 ? (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-foreground/80 mb-2">
                    Currently Assigned Creators
                  </label>
                  <div className="border border-border rounded-lg divide-y divide-border bg-background/50">
                    {currentAssignments.map((assignment) => (
                      <div key={assignment.clerkId} className="p-3 flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{assignment.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {assignment.profiles.length} profile(s) assigned
                          </p>
                        </div>
                        <button
                          onClick={async () => {
                            // Unassign from all selected profiles
                            for (const profile of assignment.profiles) {
                              await handleUnassignCreator(profile.profileId, assignment.clerkId);
                            }
                          }}
                          className="p-1.5 hover:bg-red-500/10 rounded-lg transition-colors group"
                          title="Remove assignment"
                        >
                          <X className="w-4 h-4 text-muted-foreground group-hover:text-red-500" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null;
            })()}

            <div className="mb-6">
              <label className="block text-sm font-medium text-foreground/80 mb-2">
                Select Creators to Assign
              </label>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={creatorSearchTerm}
                  onChange={(e) => setCreatorSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-border bg-background rounded-lg focus:ring-2 focus:ring-brand-light-pink focus:border-transparent text-foreground placeholder-muted-foreground text-sm"
                />
              </div>

              <div className="max-h-48 overflow-y-auto border border-border rounded-lg divide-y divide-border">
                {filteredCreators.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    {creators.length === 0
                      ? 'No creators found. Users must have CREATOR role in an organization.'
                      : 'No creators match your search.'}
                  </div>
                ) : (
                  filteredCreators.map((creator) => {
                    const isSelected = selectedCreators.has(creator.clerkId);
                    return (
                      <button
                        key={creator.clerkId}
                        onClick={() => toggleCreatorSelection(creator.clerkId)}
                        className={`w-full flex items-center gap-3 p-3 text-left hover:bg-accent transition-colors ${
                          isSelected ? 'bg-brand-light-pink/10' : ''
                        }`}
                      >
                        <div className="flex items-center justify-center flex-shrink-0">
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'bg-brand-light-pink border-brand-light-pink'
                              : 'border-border bg-background'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </div>
                        </div>
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-brand-light-pink to-brand-mid-pink flex items-center justify-center flex-shrink-0">
                          {creator.imageUrl ? (
                            <img
                              src={creator.imageUrl}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User className="w-4 h-4 text-white" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {creator.firstName || ''} {creator.lastName || ''}{' '}
                            {!creator.firstName && !creator.lastName && creator.email}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{creator.email}</p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {modalError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-500">
                {modalError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={closeModal}
                disabled={assignCreatorMutation.isPending}
                className="flex-1 px-4 py-2 border border-border rounded-lg text-foreground hover:bg-accent transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignCreator}
                disabled={assignCreatorMutation.isPending || selectedCreators.size === 0}
                className="flex-1 px-4 py-2 bg-brand-light-pink hover:bg-brand-mid-pink text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {assignCreatorMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    Assign {selectedCreators.size > 0 ? `(${selectedCreators.size})` : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Share to Organization Modal */}
      {activeModal === 'share' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-card border border-border rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-brand-blue/10 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-brand-blue" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Share to Organization</h3>
                <p className="text-sm text-muted-foreground">
                  Share {selectedIds.size} model(s) with an organization
                </p>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-foreground/80 mb-2">
                Select Organization
              </label>
              <div className="max-h-64 overflow-y-auto border border-border rounded-lg divide-y divide-border">
                {organizations.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No organizations found.
                  </div>
                ) : (
                  organizations.map((org) => (
                    <button
                      key={org.id}
                      onClick={() => setSelectedOrganization(org.id)}
                      className={`w-full flex items-center gap-3 p-3 text-left hover:bg-accent transition-colors ${
                        selectedOrganization === org.id ? 'bg-brand-blue/10' : ''
                      }`}
                    >
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-gradient-to-br from-brand-blue to-brand-light-pink flex items-center justify-center shrink-0">
                        {org.logoUrl ? (
                          <img
                            src={org.logoUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Building2 className="w-5 h-5 text-white" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{org.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {org._count.members} member{org._count.members !== 1 ? 's' : ''} • {org._count.profiles} profile{org._count.profiles !== 1 ? 's' : ''}
                        </p>
                      </div>
                      {selectedOrganization === org.id && (
                        <Check className="w-5 h-5 text-brand-blue shrink-0" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>

            {modalError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-500">
                {modalError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={closeModal}
                disabled={bulkShareMutation.isPending}
                className="flex-1 px-4 py-2 border border-border rounded-lg text-foreground hover:bg-accent transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkShare}
                disabled={bulkShareMutation.isPending || !selectedOrganization}
                className="flex-1 px-4 py-2 bg-brand-blue hover:bg-brand-blue/90 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {bulkShareMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sharing...
                  </>
                ) : (
                  <>
                    <Building2 className="w-4 h-4" />
                    Share
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* View Assignments Modal */}
      {activeModal === 'viewAssignments' && viewingProfileId && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-card border border-border rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-brand-blue/10 flex items-center justify-center">
                  <UserPlus className="w-6 h-6 text-brand-blue" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Assigned Creators</h3>
                  <p className="text-sm text-muted-foreground">
                    {(() => {
                      const model = models.find((m) => m.id === viewingProfileId);
                      return model?.name || model?.instagramUsername || 'Profile';
                    })()}
                  </p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-accent rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="border border-border rounded-lg divide-y divide-border max-h-96 overflow-y-auto">
              {(() => {
                const model = models.find((m) => m.id === viewingProfileId);
                if (!model) return null;
                
                const assignedCreators = getAssignedCreators(model);
                
                if (assignedCreators.length === 0) {
                  return (
                    <div className="p-8 text-center">
                      <UserPlus className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">No creators assigned yet</p>
                    </div>
                  );
                }
                
                return assignedCreators.map((creator: any) => (
                  <div key={creator.clerkId} className="p-4 flex items-center gap-3 hover:bg-accent/50 transition-colors">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-linear-to-br from-brand-light-pink to-brand-mid-pink flex items-center justify-center shrink-0">
                      {creator.imageUrl ? (
                        <img
                          src={creator.imageUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-5 h-5 text-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{creator.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{creator.email}</p>
                    </div>
                    <button
                      onClick={async () => {
                        await handleUnassignCreator(viewingProfileId, creator.clerkId);
                      }}
                      disabled={unassignCreatorMutation.isPending}
                      className="p-2 hover:bg-red-500/10 rounded-lg transition-colors group disabled:opacity-50"
                      title="Remove assignment"
                    >
                      {unassignCreatorMutation.isPending ? (
                        <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
                      ) : (
                        <X className="w-4 h-4 text-muted-foreground group-hover:text-red-500" />
                      )}
                    </button>
                  </div>
                ));
              })()}
            </div>

            {modalError && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-500">
                {modalError}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
