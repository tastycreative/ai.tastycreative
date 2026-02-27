'use client';

import { useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Plus,
  Pencil,
  Trash2,
  DollarSign,
  X,
  ArrowLeft,
  Search,
  ChevronDown,
  ChevronRight,
  Globe,
} from 'lucide-react';
import {
  useContentTypeAdmin,
  useCreateContentType,
  useUpdateContentType,
  useDeleteContentType,
  formatContentTypePrice,
  type ContentTypeOption,
  type CreateContentTypePayload,
} from '@/lib/hooks/useContentTypeOptions.query';
import { useOfModels, type OfModel } from '@/lib/hooks/useOfModels.query';

const CATEGORIES = [
  { value: 'PORN_ACCURATE', label: 'Porn Accurate' },
  { value: 'PORN_SCAM', label: 'Porn Scam' },
  { value: 'GF_ACCURATE', label: 'GF Accurate' },
  { value: 'GF_SCAM', label: 'GF Scam' },
] as const;

const PAGE_TYPES = [
  { value: 'ALL_PAGES', label: 'All Pages' },
  { value: 'FREE', label: 'Free' },
  { value: 'PAID', label: 'Paid' },
  { value: 'VIP', label: 'VIP' },
] as const;

const PRICE_TYPES = [
  { value: 'FIXED', label: 'Fixed Price' },
  { value: 'RANGE', label: 'Price Range' },
  { value: 'MINIMUM', label: 'Minimum Price' },
] as const;

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  PORN_ACCURATE: { bg: 'bg-red-500/20', text: 'text-red-400' },
  PORN_SCAM: { bg: 'bg-orange-500/20', text: 'text-orange-400' },
  GF_ACCURATE: { bg: 'bg-green-500/20', text: 'text-green-400' },
  GF_SCAM: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
};

const PAGE_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  ALL_PAGES: { bg: 'bg-zinc-500/20', text: 'text-zinc-400' },
  FREE: { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  PAID: { bg: 'bg-amber-500/20', text: 'text-amber-400' },
  VIP: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
};

interface FormState {
  label: string;
  value: string;
  description: string;
  category: string;
  pageType: string;
  modelId: string;
  isFree: boolean;
  priceType: string;
  priceFixed: string;
  priceMin: string;
  priceMax: string;
}

const EMPTY_FORM: FormState = {
  label: '',
  value: '',
  description: '',
  category: 'PORN_ACCURATE',
  pageType: 'ALL_PAGES',
  modelId: '',
  isFree: false,
  priceType: 'FIXED',
  priceFixed: '',
  priceMin: '',
  priceMax: '',
};

export default function ContentTypePricingPage() {
  const params = useParams();
  const tenant = params.tenant as string;

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterPageType, setFilterPageType] = useState('');
  const [filterModel, setFilterModel] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Dialogs
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedOption, setSelectedOption] = useState<ContentTypeOption | null>(null);
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);

  // Data
  const { data: options = [], isLoading } = useContentTypeAdmin();
  const { data: modelsData } = useOfModels();
  const models = modelsData?.data ?? [];

  // Mutations
  const createMutation = useCreateContentType();
  const updateMutation = useUpdateContentType();
  const deleteMutation = useDeleteContentType();

  // Group options by model
  const grouped = useMemo(() => {
    let filtered = options;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (o) =>
          o.label.toLowerCase().includes(q) ||
          o.value.toLowerCase().includes(q) ||
          (o.description && o.description.toLowerCase().includes(q)) ||
          (o.model?.name && o.model.name.toLowerCase().includes(q)) ||
          (o.model?.displayName && o.model.displayName.toLowerCase().includes(q))
      );
    }
    if (filterCategory) {
      filtered = filtered.filter((o) => o.category === filterCategory);
    }
    if (filterPageType) {
      filtered = filtered.filter((o) => o.pageType === filterPageType);
    }
    if (filterModel === '__global__') {
      filtered = filtered.filter((o) => !o.modelId);
    } else if (filterModel) {
      filtered = filtered.filter((o) => o.modelId === filterModel);
    }

    const groups: Record<string, { model: OfModel | null; items: ContentTypeOption[] }> = {};

    // Global group
    const globalItems = filtered.filter((o) => !o.modelId);
    if (globalItems.length > 0) {
      groups['__global__'] = { model: null, items: globalItems };
    }

    // Per-model groups
    for (const option of filtered) {
      if (!option.modelId) continue;
      if (!groups[option.modelId]) {
        const model = models.find((m) => m.id === option.modelId) || null;
        groups[option.modelId] = { model, items: [] };
      }
      groups[option.modelId].items.push(option);
    }

    return groups;
  }, [options, models, searchQuery, filterCategory, filterPageType, filterModel]);

  // Stats
  const stats = useMemo(() => {
    const total = options.length;
    const active = options.filter((o) => o.isActive).length;
    const modelIds = new Set(options.map((o) => o.modelId).filter(Boolean));
    return { total, active, modelCount: modelIds.size };
  }, [options]);

  const toggleGroup = useCallback((key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // Form handlers
  const openAddDialog = useCallback(() => {
    setFormData(EMPTY_FORM);
    setShowAddDialog(true);
  }, []);

  const openEditDialog = useCallback((option: ContentTypeOption) => {
    setSelectedOption(option);
    setFormData({
      label: option.label,
      value: option.value,
      description: option.description || '',
      category: option.category,
      pageType: option.pageType || 'ALL_PAGES',
      modelId: option.modelId || '',
      isFree: option.isFree,
      priceType: option.priceType || 'FIXED',
      priceFixed: option.priceFixed != null ? String(option.priceFixed) : '',
      priceMin: option.priceMin != null ? String(option.priceMin) : '',
      priceMax: option.priceMax != null ? String(option.priceMax) : '',
    });
    setShowEditDialog(true);
  }, []);

  const openDeleteDialog = useCallback((option: ContentTypeOption) => {
    setSelectedOption(option);
    setShowDeleteDialog(true);
  }, []);

  const handleCreate = useCallback(async () => {
    const payload: CreateContentTypePayload = {
      value: formData.value.trim(),
      label: formData.label.trim(),
      category: formData.category,
      pageType: formData.pageType,
      isFree: formData.isFree,
      description: formData.description.trim() || undefined,
      modelId: formData.modelId || null,
      priceType: formData.isFree ? undefined : formData.priceType,
      priceFixed: formData.isFree ? null : (formData.priceFixed ? parseFloat(formData.priceFixed) : null),
      priceMin: formData.isFree ? null : (formData.priceMin ? parseFloat(formData.priceMin) : null),
      priceMax: formData.isFree ? null : (formData.priceMax ? parseFloat(formData.priceMax) : null),
    };

    try {
      await createMutation.mutateAsync(payload);
      toast.success('Content type created');
      setShowAddDialog(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create');
    }
  }, [formData, createMutation]);

  const handleUpdate = useCallback(async () => {
    if (!selectedOption) return;

    try {
      await updateMutation.mutateAsync({
        id: selectedOption.id,
        value: formData.value.trim(),
        label: formData.label.trim(),
        pageType: formData.pageType,
        isFree: formData.isFree,
        description: formData.description.trim() || undefined,
        modelId: formData.modelId || null,
        priceType: formData.isFree ? undefined : formData.priceType,
        priceFixed: formData.isFree ? null : (formData.priceFixed ? parseFloat(formData.priceFixed) : null),
        priceMin: formData.isFree ? null : (formData.priceMin ? parseFloat(formData.priceMin) : null),
        priceMax: formData.isFree ? null : (formData.priceMax ? parseFloat(formData.priceMax) : null),
      });
      toast.success('Content type updated');
      setShowEditDialog(false);
      setSelectedOption(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update');
    }
  }, [selectedOption, formData, updateMutation]);

  const handleDelete = useCallback(async () => {
    if (!selectedOption) return;

    try {
      await deleteMutation.mutateAsync(selectedOption.id);
      toast.success('Content type deactivated');
      setShowDeleteDialog(false);
      setSelectedOption(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete');
    }
  }, [selectedOption, deleteMutation]);

  const updateField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const formValid = formData.label.trim() && formData.value.trim() && formData.category;

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href={`/${tenant}/settings`}
              className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white">Content Type Pricing</h1>
              <p className="text-sm text-zinc-400">
                Manage content type options and pricing for submission forms
              </p>
            </div>
          </div>
          <button
            onClick={openAddDialog}
            className="flex items-center gap-2 rounded-lg bg-brand-light-pink px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-mid-pink"
          >
            <Plus className="h-4 w-4" />
            Add New
          </button>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search label, code, description, model..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2 pl-10 pr-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-brand-light-pink"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white outline-none focus:border-brand-light-pink"
          >
            <option value="">All Tiers</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <select
            value={filterPageType}
            onChange={(e) => setFilterPageType(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white outline-none focus:border-brand-light-pink"
          >
            <option value="">All Page Types</option>
            {PAGE_TYPES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <select
            value={filterModel}
            onChange={(e) => setFilterModel(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white outline-none focus:border-brand-light-pink"
          >
            <option value="">All Models</option>
            <option value="__global__">Global Only</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayName || m.name}
              </option>
            ))}
          </select>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 text-sm text-zinc-400">
          <span>
            <span className="font-medium text-white">{stats.total}</span> Total Types
          </span>
          <span className="text-zinc-700">|</span>
          <span>
            <span className="font-medium text-green-400">{stats.active}</span> Active
          </span>
          <span className="text-zinc-700">|</span>
          <span>
            <span className="font-medium text-brand-blue">{stats.modelCount}</span> Models
          </span>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-light-pink border-t-transparent" />
          </div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-12 text-center">
            <DollarSign className="mx-auto mb-3 h-12 w-12 text-zinc-600" />
            <p className="text-lg font-medium text-zinc-400">No content types found</p>
            <p className="mt-1 text-sm text-zinc-500">
              {searchQuery || filterCategory || filterPageType || filterModel
                ? 'Try adjusting your filters'
                : 'Create your first content type to get started'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([key, group]) => {
              const isCollapsed = collapsedGroups.has(key);
              const isGlobal = key === '__global__';
              const model = group.model;

              return (
                <div
                  key={key}
                  className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50"
                >
                  {/* Group Header */}
                  <button
                    onClick={() => toggleGroup(key)}
                    className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-zinc-800/50"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4 text-zinc-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-zinc-500" />
                    )}
                    {isGlobal ? (
                      <>
                        <Globe className="h-5 w-5 text-brand-blue" />
                        <span className="text-sm font-semibold text-white">Global</span>
                      </>
                    ) : (
                      <>
                        {model?.profileImageUrl ? (
                          <img
                            src={model.profileImageUrl}
                            alt={model.displayName || model.name}
                            className="h-6 w-6 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-light-pink/20 text-xs font-bold text-brand-light-pink">
                            {(model?.displayName || model?.name || '?')[0]}
                          </div>
                        )}
                        <span className="text-sm font-semibold text-white">
                          {model?.displayName || model?.name || 'Unknown Model'}
                        </span>
                      </>
                    )}
                    <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-xs text-zinc-300">
                      {group.items.length}
                    </span>
                  </button>

                  {/* Items */}
                  {!isCollapsed && (
                    <div className="border-t border-zinc-800">
                      {group.items.map((item) => (
                        <ItemRow
                          key={item.id}
                          item={item}
                          onEdit={openEditDialog}
                          onDelete={openDeleteDialog}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Dialog */}
      {showAddDialog &&
        typeof document !== 'undefined' &&
        createPortal(
          <DialogBackdrop onClose={() => setShowAddDialog(false)}>
            <ContentTypeFormDialog
              title="Add Content Type"
              formData={formData}
              models={models}
              updateField={updateField}
              onSubmit={handleCreate}
              onClose={() => setShowAddDialog(false)}
              isSubmitting={createMutation.isPending}
              submitLabel="Create"
              formValid={!!formValid}
              showCategory
            />
          </DialogBackdrop>,
          document.body
        )}

      {/* Edit Dialog */}
      {showEditDialog &&
        typeof document !== 'undefined' &&
        createPortal(
          <DialogBackdrop onClose={() => setShowEditDialog(false)}>
            <ContentTypeFormDialog
              title="Edit Content Type"
              formData={formData}
              models={models}
              updateField={updateField}
              onSubmit={handleUpdate}
              onClose={() => setShowEditDialog(false)}
              isSubmitting={updateMutation.isPending}
              submitLabel="Save Changes"
              formValid={!!formValid}
              showCategory={false}
            />
          </DialogBackdrop>,
          document.body
        )}

      {/* Delete Dialog */}
      {showDeleteDialog &&
        selectedOption &&
        typeof document !== 'undefined' &&
        createPortal(
          <DialogBackdrop onClose={() => setShowDeleteDialog(false)}>
            <div
              className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-semibold text-white">Deactivate Content Type</h2>
              <p className="mt-2 text-sm text-zinc-400">
                Are you sure you want to deactivate{' '}
                <span className="font-medium text-white">&quot;{selectedOption.label}&quot;</span>?
                It will no longer appear in submission forms.
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteDialog(false)}
                  className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                >
                  {deleteMutation.isPending ? 'Deactivating...' : 'Deactivate'}
                </button>
              </div>
            </div>
          </DialogBackdrop>,
          document.body
        )}
    </div>
  );
}

// --- Sub-components ---

function ItemRow({
  item,
  onEdit,
  onDelete,
}: {
  item: ContentTypeOption;
  onEdit: (item: ContentTypeOption) => void;
  onDelete: (item: ContentTypeOption) => void;
}) {
  const catColors = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.PORN_ACCURATE;
  const ptColors = PAGE_TYPE_COLORS[item.pageType || 'ALL_PAGES'] || PAGE_TYPE_COLORS.ALL_PAGES;
  const catLabel = CATEGORIES.find((c) => c.value === item.category)?.label || item.category;
  const ptLabel = PAGE_TYPES.find((p) => p.value === item.pageType)?.label || 'All Pages';

  return (
    <div
      className={`flex items-center gap-3 border-b border-zinc-800/50 px-5 py-3 last:border-b-0 ${
        !item.isActive ? 'opacity-50' : ''
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-white">{item.label}</span>
          <span className="shrink-0 text-xs text-zinc-600">{item.value}</span>
          {!item.isActive && (
            <span className="shrink-0 rounded bg-zinc-700 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
              INACTIVE
            </span>
          )}
        </div>
      </div>
      <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${catColors.bg} ${catColors.text}`}>
        {catLabel}
      </span>
      <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${ptColors.bg} ${ptColors.text}`}>
        {ptLabel}
      </span>
      <span className="w-28 shrink-0 text-right text-sm font-medium text-emerald-400">
        {formatContentTypePrice(item)}
      </span>
      <div className="flex shrink-0 items-center gap-1">
        <button
          onClick={() => onEdit(item)}
          className="rounded p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-white"
          title="Edit"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        {item.isActive && (
          <button
            onClick={() => onDelete(item)}
            className="rounded p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-red-400"
            title="Deactivate"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function DialogBackdrop({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      {children}
    </div>
  );
}

function ContentTypeFormDialog({
  title,
  formData,
  models,
  updateField,
  onSubmit,
  onClose,
  isSubmitting,
  submitLabel,
  formValid,
  showCategory,
}: {
  title: string;
  formData: FormState;
  models: OfModel[];
  updateField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  onSubmit: () => void;
  onClose: () => void;
  isSubmitting: boolean;
  submitLabel: string;
  formValid: boolean;
  showCategory: boolean;
}) {
  return (
    <div
      className="w-full max-w-lg rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <button onClick={onClose} className="text-zinc-500 hover:text-white">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Body */}
      <div className="max-h-[70vh] space-y-4 overflow-y-auto p-6">
        {/* Label */}
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-400">Label</label>
          <input
            type="text"
            value={formData.label}
            onChange={(e) => updateField('label', e.target.value)}
            placeholder="e.g. Custom Video"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-brand-light-pink"
          />
        </div>

        {/* Value (code) */}
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-400">
            Value (code)
          </label>
          <input
            type="text"
            value={formData.value}
            onChange={(e) => updateField('value', e.target.value)}
            placeholder="e.g. custom_video"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-brand-light-pink"
          />
        </div>

        {/* Description */}
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-400">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => updateField('description', e.target.value)}
            placeholder="Optional description..."
            rows={2}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-brand-light-pink"
          />
        </div>

        {/* Category (only for Add) */}
        {showCategory && (
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">Category / Tier</label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((c) => {
                const colors = CATEGORY_COLORS[c.value];
                const selected = formData.category === c.value;
                return (
                  <button
                    key={c.value}
                    onClick={() => updateField('category', c.value)}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      selected
                        ? `${colors.bg} ${colors.text} border-current`
                        : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Page Type */}
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-400">Page Type</label>
          <div className="grid grid-cols-4 gap-2">
            {PAGE_TYPES.map((p) => {
              const selected = formData.pageType === p.value;
              return (
                <button
                  key={p.value}
                  onClick={() => updateField('pageType', p.value)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    selected
                      ? 'border-brand-light-pink bg-brand-light-pink/10 text-brand-light-pink'
                      : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Model */}
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-400">
            Model <span className="text-zinc-600">(empty = Global)</span>
          </label>
          <select
            value={formData.modelId}
            onChange={(e) => updateField('modelId', e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white outline-none focus:border-brand-light-pink"
          >
            <option value="">Global (all models)</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayName || m.name}
              </option>
            ))}
          </select>
        </div>

        {/* Is Free Toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => updateField('isFree', !formData.isFree)}
            className={`relative h-6 w-11 rounded-full transition-colors ${
              formData.isFree ? 'bg-brand-light-pink' : 'bg-zinc-700'
            }`}
          >
            <div
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                formData.isFree ? 'translate-x-[22px]' : 'translate-x-0.5'
              }`}
            />
          </button>
          <span className="text-sm text-zinc-300">Free content type</span>
        </div>

        {/* Pricing (hidden when free) */}
        {!formData.isFree && (
          <>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">Price Type</label>
              <div className="grid grid-cols-3 gap-2">
                {PRICE_TYPES.map((pt) => {
                  const selected = formData.priceType === pt.value;
                  return (
                    <button
                      key={pt.value}
                      onClick={() => updateField('priceType', pt.value)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                        selected
                          ? 'border-brand-light-pink bg-brand-light-pink/10 text-brand-light-pink'
                          : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                      }`}
                    >
                      {pt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {formData.priceType === 'FIXED' && (
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">
                  Fixed Price ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.priceFixed}
                  onChange={(e) => updateField('priceFixed', e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-brand-light-pink"
                />
              </div>
            )}

            {formData.priceType === 'RANGE' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-400">Min ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.priceMin}
                    onChange={(e) => updateField('priceMin', e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-brand-light-pink"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-400">Max ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.priceMax}
                    onChange={(e) => updateField('priceMax', e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-brand-light-pink"
                  />
                </div>
              </div>
            )}

            {formData.priceType === 'MINIMUM' && (
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">
                  Minimum Price ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.priceMin}
                  onChange={(e) => updateField('priceMin', e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-brand-light-pink"
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-3 border-t border-zinc-800 px-6 py-4">
        <button
          onClick={onClose}
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800"
        >
          Cancel
        </button>
        <button
          onClick={onSubmit}
          disabled={isSubmitting || !formValid}
          className="rounded-lg bg-brand-light-pink px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-mid-pink disabled:opacity-50"
        >
          {isSubmitting ? 'Saving...' : submitLabel}
        </button>
      </div>
    </div>
  );
}
