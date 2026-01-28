'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  DollarSign,
  X,
  Tag,
  Layers,
  FileText,
  Sparkles,
  ArrowLeft,
  Filter,
  Eye,
  EyeOff,
  Copy,
  MoreHorizontal,
} from 'lucide-react';

interface PricingTemplateItem {
  id: string;
  name: string;
  priceType: 'FIXED' | 'RANGE' | 'MINIMUM';
  priceFixed: number | null;
  priceMin: number | null;
  priceMax: number | null;
  isFree: boolean;
  description: string | null;
  order: number;
  isActive: boolean;
}

interface PricingTemplate {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  pageType: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  items?: PricingTemplateItem[];
}

interface CategoryOption {
  value: string;
  label: string;
  description: string;
}

interface PageTypeOption {
  value: string;
  label: string;
  description: string;
}

interface PriceTypeOption {
  value: string;
  label: string;
  description: string;
}

export default function PricingTemplatesPage() {
  const params = useParams();
  const tenant = params.tenant as string;
  const [templates, setTemplates] = useState<PricingTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTemplates, setExpandedTemplates] = useState<Set<string>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<PricingTemplate | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [pageTypeFilter, setPageTypeFilter] = useState<string>('');
  const [showInactive, setShowInactive] = useState(false);

  // Options for dropdowns
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [pageTypes, setPageTypes] = useState<PageTypeOption[]>([]);
  const [priceTypes, setPriceTypes] = useState<PriceTypeOption[]>([]);

  useEffect(() => {
    loadCategories();
    loadTemplates();
  }, [categoryFilter, pageTypeFilter, showInactive]);

  const loadCategories = async () => {
    try {
      const response = await fetch('/api/pricing-templates/categories');
      if (response.ok) {
        const result = await response.json();
        setCategories(result.data.categories);
        setPageTypes(result.data.pageTypes);
        setPriceTypes(result.data.priceTypes);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('includeItems', 'true');
      if (categoryFilter) params.append('category', categoryFilter);
      if (pageTypeFilter) params.append('pageType', pageTypeFilter);
      params.append('activeOnly', (!showInactive).toString());

      const response = await fetch(`/api/pricing-templates?${params.toString()}`);
      if (response.ok) {
        const result = await response.json();
        setTemplates(result.data || []);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const toggleTemplate = (templateId: string) => {
    setExpandedTemplates((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(templateId)) {
        newSet.delete(templateId);
      } else {
        newSet.add(templateId);
      }
      return newSet;
    });
  };

  const handleDeleteTemplate = async (template: PricingTemplate) => {
    if (template.isDefault) {
      toast.error('Cannot delete system default templates');
      return;
    }
    if (!confirm(`Delete template "${template.name}"?`)) return;

    try {
      const response = await fetch(`/api/pricing-templates/${template.id}?hard=true`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Template deleted');
        loadTemplates();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to delete template');
      }
    } catch (error) {
      toast.error('Failed to delete template');
    }
  };

  const handleDuplicateTemplate = async (template: PricingTemplate) => {
    try {
      // Fetch full template with items
      const response = await fetch(`/api/pricing-templates/${template.id}`);
      if (!response.ok) throw new Error('Failed to fetch template');

      const result = await response.json();
      const fullTemplate = result.data;

      // Create new template with copied data
      const createResponse = await fetch('/api/pricing-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${fullTemplate.name} (Copy)`,
          slug: `${fullTemplate.slug}-copy-${Date.now()}`,
          description: fullTemplate.description,
          category: fullTemplate.category,
          pageType: fullTemplate.pageType,
          isDefault: false,
          items: fullTemplate.items?.map((item: PricingTemplateItem) => ({
            name: item.name,
            priceType: item.priceType,
            priceFixed: item.priceFixed,
            priceMin: item.priceMin,
            priceMax: item.priceMax,
            description: item.description,
            order: item.order,
            isActive: item.isActive,
          })),
        }),
      });

      if (createResponse.ok) {
        toast.success('Template duplicated');
        loadTemplates();
      } else {
        const error = await createResponse.json();
        toast.error(error.error || 'Failed to duplicate template');
      }
    } catch (error) {
      toast.error('Failed to duplicate template');
    }
  };

  const getCategoryBadgeColor = (category: string) => {
    switch (category) {
      case 'PORN_ACCURATE':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case 'PORN_SCAM':
        return 'bg-red-500/10 text-red-400 border-red-500/30';
      case 'GF_ACCURATE':
        return 'bg-pink-500/10 text-pink-400 border-pink-500/30';
      case 'GF_SCAM':
        return 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/30';
      case 'BUNDLE_BASED':
        return 'bg-violet-500/10 text-violet-400 border-violet-500/30';
      default:
        return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30';
    }
  };

  const getPageTypeBadgeColor = (pageType: string) => {
    switch (pageType) {
      case 'FREE':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'PAID':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'VIP':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      default:
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    }
  };

  const formatPrice = (item: PricingTemplateItem) => {
    if (item.isFree) {
      return 'FREE';
    }
    if (item.priceType === 'FIXED' && item.priceFixed !== null) {
      return `$${item.priceFixed.toFixed(2)}`;
    }
    if (item.priceType === 'RANGE' && item.priceMin !== null && item.priceMax !== null) {
      return `$${item.priceMin.toFixed(2)} - $${item.priceMax.toFixed(2)}`;
    }
    if (item.priceType === 'MINIMUM' && item.priceMin !== null) {
      return `From $${item.priceMin.toFixed(2)}`;
    }
    return '-';
  };

  if (loading && templates.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link
            href={`/${tenant}/settings`}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800/50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="h-7 w-48 bg-zinc-800/50 rounded-lg animate-pulse" />
            <div className="h-4 w-64 bg-zinc-800/30 rounded mt-2 animate-pulse" />
          </div>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-6">
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-zinc-800/30 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/${tenant}/settings`}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800/50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">Pricing Templates</h1>
            <p className="text-sm text-zinc-500">Create and manage reusable pricing templates for OF Creators</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="group relative inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-white overflow-hidden transition-all"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-fuchsia-600" />
          <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-fuchsia-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          <Plus className="relative w-4 h-4" />
          <span className="relative text-sm">New Template</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-zinc-500" />
          <span className="text-sm text-zinc-500">Filters:</span>
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 bg-zinc-800/50 border border-zinc-700/50 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500/50"
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>

        <select
          value={pageTypeFilter}
          onChange={(e) => setPageTypeFilter(e.target.value)}
          className="px-3 py-2 bg-zinc-800/50 border border-zinc-700/50 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500/50"
        >
          <option value="">All Page Types</option>
          {pageTypes.map((pt) => (
            <option key={pt.value} value={pt.value}>
              {pt.label}
            </option>
          ))}
        </select>

        <button
          onClick={() => setShowInactive(!showInactive)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
            showInactive
              ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
              : 'bg-zinc-800/50 text-zinc-400 border border-zinc-700/50 hover:border-zinc-600/50'
          }`}
        >
          {showInactive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          {showInactive ? 'Showing Inactive' : 'Hide Inactive'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="p-2.5 rounded-xl bg-violet-500/10">
              <FileText className="w-5 h-5 text-violet-400" />
            </div>
          </div>
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1">Total Templates</p>
          <p className="text-2xl font-medium text-white">{templates.length}</p>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10">
              <Tag className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1">Total Items</p>
          <p className="text-2xl font-medium text-white">
            {templates.reduce((acc, t) => acc + (t.items?.length || 0), 0)}
          </p>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10">
              <Sparkles className="w-5 h-5 text-amber-400" />
            </div>
          </div>
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1">Default Templates</p>
          <p className="text-2xl font-medium text-white">
            {templates.filter((t) => t.isDefault).length}
          </p>
        </div>
      </div>

      {/* Templates List */}
      <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-zinc-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <Layers className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-white">Templates</h2>
              <p className="text-sm text-zinc-500">Click to expand and see items</p>
            </div>
          </div>
        </div>

        <div className="divide-y divide-zinc-800/50">
          {templates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 rounded-2xl bg-zinc-800/30 mb-4">
                <FileText className="w-10 h-10 text-zinc-600" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">No templates found</h3>
              <p className="text-zinc-500 mb-6 max-w-sm">
                {categoryFilter || pageTypeFilter
                  ? 'Try adjusting your filters or create a new template'
                  : 'Create your first pricing template to get started'}
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="group relative inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-fuchsia-600" />
                <Sparkles className="relative w-4 h-4" />
                <span className="relative">Create Template</span>
              </button>
            </div>
          ) : (
            templates.map((template) => (
              <div key={template.id}>
                {/* Template Header */}
                <div
                  className="flex items-center gap-4 p-4 hover:bg-zinc-800/20 cursor-pointer transition-colors"
                  onClick={() => toggleTemplate(template.id)}
                >
                  <button className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors">
                    {expandedTemplates.has(template.id) ? (
                      <ChevronDown className="w-5 h-5" />
                    ) : (
                      <ChevronRight className="w-5 h-5" />
                    )}
                  </button>

                  <div className="p-2 rounded-lg bg-zinc-800/50">
                    <FileText className="w-4 h-4 text-violet-400" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-white">{template.name}</h3>
                      {template.isDefault && (
                        <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 text-[10px] font-medium rounded border border-amber-500/30">
                          DEFAULT
                        </span>
                      )}
                      {!template.isActive && (
                        <span className="px-2 py-0.5 bg-zinc-500/10 text-zinc-500 text-[10px] font-medium rounded border border-zinc-500/30">
                          INACTIVE
                        </span>
                      )}
                    </div>
                    {template.description && (
                      <p className="text-sm text-zinc-500 truncate">{template.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 text-[10px] font-medium rounded border ${getCategoryBadgeColor(template.category)}`}>
                      {template.category.replace('_', ' ')}
                    </span>
                    <span className={`px-2 py-1 text-[10px] font-medium rounded border ${getPageTypeBadgeColor(template.pageType)}`}>
                      {template.pageType.replace('_', ' ')}
                    </span>
                    <span className="px-2.5 py-1 bg-zinc-800/50 rounded-lg text-xs font-medium text-zinc-400">
                      {template.items?.length || 0} item{(template.items?.length || 0) !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleDuplicateTemplate(template)}
                      className="p-2 rounded-lg text-zinc-500 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
                      title="Duplicate template"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setSelectedTemplate(template);
                        setShowEditModal(true);
                      }}
                      className="p-2 rounded-lg text-zinc-500 hover:text-violet-400 hover:bg-violet-500/10 transition-all"
                      title="Edit template"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(template)}
                      disabled={template.isDefault}
                      className="p-2 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      title={template.isDefault ? 'Cannot delete default template' : 'Delete template'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Template Items */}
                {expandedTemplates.has(template.id) && (
                  <div className="border-t border-zinc-800/30 bg-zinc-900/30">
                    {!template.items || template.items.length === 0 ? (
                      <div className="flex items-center gap-3 p-4 pl-16 text-zinc-500">
                        <span className="text-sm">No items in this template</span>
                      </div>
                    ) : (
                      template.items.map((item, index) => (
                        <div
                          key={item.id}
                          className={`flex items-center gap-4 p-4 pl-16 ${
                            index !== 0 ? 'border-t border-zinc-800/30' : ''
                          }`}
                        >
                          <div className={`p-2 rounded-lg ${item.isActive ? 'bg-emerald-500/10' : 'bg-zinc-800/50'}`}>
                            <Tag className={`w-4 h-4 ${item.isActive ? 'text-emerald-400' : 'text-zinc-600'}`} />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`font-medium ${item.isActive ? 'text-white' : 'text-zinc-500'}`}>
                                {item.name}
                              </span>
                              {item.isFree && (
                                <span className="px-2 py-0.5 bg-emerald-500/20 rounded text-[10px] font-medium text-emerald-400 uppercase border border-emerald-500/30">
                                  Free
                                </span>
                              )}
                              {!item.isActive && (
                                <span className="px-2 py-0.5 bg-zinc-800/50 rounded text-[10px] font-medium text-zinc-500 uppercase">
                                  Inactive
                                </span>
                              )}
                            </div>
                            {item.description && (
                              <p className="text-sm text-zinc-500 truncate">{item.description}</p>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {!item.isFree && (
                              <span className="px-2 py-1 bg-zinc-800/50 text-[10px] font-medium text-zinc-400 rounded">
                                {item.priceType}
                              </span>
                            )}
                            <span className="text-lg font-semibold text-emerald-400">
                              {formatPrice(item)}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <TemplateModal
          categories={categories}
          pageTypes={pageTypes}
          priceTypes={priceTypes}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadTemplates();
          }}
        />
      )}

      {/* Edit Modal */}
      {showEditModal && selectedTemplate && (
        <TemplateModal
          template={selectedTemplate}
          categories={categories}
          pageTypes={pageTypes}
          priceTypes={priceTypes}
          onClose={() => {
            setShowEditModal(false);
            setSelectedTemplate(null);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setSelectedTemplate(null);
            loadTemplates();
          }}
        />
      )}
    </div>
  );
}

// Template Modal Component
function TemplateModal({
  template,
  categories,
  pageTypes,
  priceTypes,
  onClose,
  onSuccess,
}: {
  template?: PricingTemplate;
  categories: CategoryOption[];
  pageTypes: PageTypeOption[];
  priceTypes: PriceTypeOption[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isEdit = !!template;
  const [name, setName] = useState(template?.name || '');
  const [slug, setSlug] = useState(template?.slug || '');
  const [description, setDescription] = useState(template?.description || '');
  const [category, setCategory] = useState(template?.category || 'CUSTOM');
  const [pageType, setPageType] = useState(template?.pageType || 'ALL_PAGES');
  const [isActive, setIsActive] = useState(template?.isActive ?? true);
  const [items, setItems] = useState<Omit<PricingTemplateItem, 'id'>[]>(
    template?.items?.map((item) => ({
      name: item.name,
      priceType: item.priceType,
      priceFixed: item.priceFixed,
      priceMin: item.priceMin,
      priceMax: item.priceMax,
      isFree: item.isFree,
      description: item.description,
      order: item.order,
      isActive: item.isActive,
    })) || []
  );
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (name && !slug && !isEdit) {
      setSlug(name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
    }
  }, [name, isEdit, slug]);

  if (!mounted) return null;

  const addItem = () => {
    setItems([
      ...items,
      {
        name: '',
        priceType: 'FIXED',
        priceFixed: 0,
        priceMin: null,
        priceMax: null,
        isFree: false,
        description: null,
        order: items.length,
        isActive: true,
      },
    ]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: string, value: any) => {
    setItems(
      items.map((item, i) => {
        if (i !== index) return item;
        return { ...item, [field]: value };
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) {
      toast.error('Name and slug are required');
      return;
    }

    try {
      setSaving(true);

      if (isEdit) {
        // Update template
        const response = await fetch(`/api/pricing-templates/${template.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            slug: slug.trim(),
            description: description.trim() || null,
            category,
            pageType,
            isActive,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to update template');
        }

        // Update items (delete existing and recreate)
        // Note: For simplicity, we'll need to handle this differently in production
        // This is a simplified approach

        toast.success('Template updated');
        onSuccess();
      } else {
        // Create template with items
        const response = await fetch('/api/pricing-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            slug: slug.trim(),
            description: description.trim() || null,
            category,
            pageType,
            items: items.filter((item) => item.name.trim()),
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to create template');
        }

        toast.success('Template created');
        onSuccess();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-2xl max-h-[90vh] bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-fadeIn">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-violet-500 to-transparent" />

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <FileText className="w-5 h-5 text-violet-400" />
            </div>
            <h2 className="text-lg font-medium text-white">
              {isEdit ? 'Edit Template' : 'Create Template'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-4">
            {/* Name & Slug */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. GF Accurate"
                  className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  Slug <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="gf-accurate"
                  className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition-colors"
                  required
                />
              </div>
            </div>

            {/* Category & Page Type */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white focus:outline-none focus:border-violet-500/50 transition-colors"
                >
                  {categories.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Page Type</label>
                <select
                  value={pageType}
                  onChange={(e) => setPageType(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white focus:outline-none focus:border-violet-500/50 transition-colors"
                >
                  {pageTypes.map((pt) => (
                    <option key={pt.value} value={pt.value}>
                      {pt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Optional description..."
                className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition-colors resize-none"
              />
            </div>

            {/* Status */}
            {isEdit && (
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Status</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsActive(true)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'bg-zinc-800/50 border border-zinc-700/50 text-zinc-500 hover:text-zinc-400'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                    Active
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsActive(false)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      !isActive
                        ? 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/30'
                        : 'bg-zinc-800/50 border border-zinc-700/50 text-zinc-500 hover:text-zinc-400'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${!isActive ? 'bg-zinc-400' : 'bg-zinc-600'}`} />
                    Inactive
                  </button>
                </div>
              </div>
            )}

            {/* Items Section */}
            {!isEdit && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-zinc-400">Pricing Items</label>
                  <button
                    type="button"
                    onClick={addItem}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-violet-400 bg-violet-500/10 hover:bg-violet-500/20 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Add Item
                  </button>
                </div>

                <div className="space-y-3">
                  {items.length === 0 ? (
                    <div className="text-center py-6 text-zinc-500 text-sm bg-zinc-800/30 rounded-xl border border-dashed border-zinc-700/50">
                      No items yet. Click "Add Item" to start adding pricing items.
                    </div>
                  ) : (
                    items.map((item, index) => (
                      <div key={index} className="p-4 bg-zinc-800/30 rounded-xl border border-zinc-700/50 space-y-3">
                        <div className="flex items-start justify-between">
                          <span className="text-xs font-medium text-zinc-500">Item {index + 1}</span>
                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => updateItem(index, 'name', e.target.value)}
                            placeholder="Item name"
                            className="px-3 py-2 bg-zinc-800/50 border border-zinc-700/50 rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50"
                          />
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => updateItem(index, 'isFree', !item.isFree)}
                              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                item.isFree
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-zinc-800/50 border border-zinc-700/50 text-zinc-500 hover:text-zinc-400'
                              }`}
                            >
                              <span className={`w-2 h-2 rounded-full ${item.isFree ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                              Free
                            </button>
                            {!item.isFree && (
                              <select
                                value={item.priceType}
                                onChange={(e) => updateItem(index, 'priceType', e.target.value)}
                                className="flex-1 px-3 py-2 bg-zinc-800/50 border border-zinc-700/50 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500/50"
                              >
                                {priceTypes.map((pt) => (
                                  <option key={pt.value} value={pt.value}>
                                    {pt.label}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        </div>

                        {!item.isFree && item.priceType === 'FIXED' && (
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.priceFixed || ''}
                              onChange={(e) => updateItem(index, 'priceFixed', parseFloat(e.target.value) || 0)}
                              placeholder="0.00"
                              className="w-full pl-7 pr-3 py-2 bg-zinc-800/50 border border-zinc-700/50 rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50"
                            />
                          </div>
                        )}

                        {!item.isFree && item.priceType === 'RANGE' && (
                          <div className="grid grid-cols-2 gap-3">
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={item.priceMin || ''}
                                onChange={(e) => updateItem(index, 'priceMin', parseFloat(e.target.value) || 0)}
                                placeholder="Min"
                                className="w-full pl-7 pr-3 py-2 bg-zinc-800/50 border border-zinc-700/50 rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50"
                              />
                            </div>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={item.priceMax || ''}
                                onChange={(e) => updateItem(index, 'priceMax', parseFloat(e.target.value) || 0)}
                                placeholder="Max"
                                className="w-full pl-7 pr-3 py-2 bg-zinc-800/50 border border-zinc-700/50 rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50"
                              />
                            </div>
                          </div>
                        )}

                        {!item.isFree && item.priceType === 'MINIMUM' && (
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.priceMin || ''}
                              onChange={(e) => updateItem(index, 'priceMin', parseFloat(e.target.value) || 0)}
                              placeholder="Starting from"
                              className="w-full pl-7 pr-3 py-2 bg-zinc-800/50 border border-zinc-700/50 rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50"
                            />
                          </div>
                        )}

                        <input
                          type="text"
                          value={item.description || ''}
                          onChange={(e) => updateItem(index, 'description', e.target.value || null)}
                          placeholder="Description (optional)"
                          className="w-full px-3 py-2 bg-zinc-800/50 border border-zinc-700/50 rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50"
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 p-5 border-t border-zinc-800 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-xl hover:bg-zinc-700 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 relative px-4 py-3 rounded-xl font-medium text-white overflow-hidden disabled:opacity-50"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-fuchsia-600" />
              <span className="relative">{saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Template'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
