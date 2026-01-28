'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import {
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  DollarSign,
  X,
  Save,
  Tag,
  Layers,
  Package,
  Sparkles,
  AlertCircle,
  FileText,
  Download,
  Check,
} from 'lucide-react';

interface PricingItem {
  id: string;
  name: string;
  price: number;
  priceType: 'FIXED' | 'RANGE' | 'MINIMUM';
  priceMin: number | null;
  priceMax: number | null;
  isFree: boolean;
  description: string | null;
  order: number;
  isActive: boolean;
}

interface PricingCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  order: number;
  isGlobal: boolean;
  items: PricingItem[];
}

interface OfModel {
  id: string;
  slug: string;
}

export default function OfModelPricingPage() {
  const params = useParams();
  const modelSlug = params.modelSlug as string;
  const [model, setModel] = useState<OfModel | null>(null);
  const [categories, setCategories] = useState<PricingCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showEditCategoryModal, setShowEditCategoryModal] = useState(false);
  const [showEditItemModal, setShowEditItemModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<PricingCategory | null>(null);
  const [selectedItem, setSelectedItem] = useState<PricingItem | null>(null);
  const [showApplyTemplateModal, setShowApplyTemplateModal] = useState(false);

  useEffect(() => {
    if (modelSlug) {
      loadModelAndPricing();
    }
  }, [modelSlug]);

  const loadModelAndPricing = async () => {
    try {
      const response = await fetch(`/api/of-models/${modelSlug}`);
      if (response.ok) {
        const result = await response.json();
        setModel(result.data);
        await loadPricing(result.data.id);
      }
    } catch (error) {
      console.error('Error loading model:', error);
      setLoading(false);
    }
  };

  const loadPricing = async (modelId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/of-models/${modelId}/pricing`);
      if (response.ok) {
        const result = await response.json();
        const mappedCategories = (result.data || []).map((cat: any) => ({
          ...cat,
          items: cat.of_model_pricing_items || [],
        }));
        setCategories(mappedCategories);
        setExpandedCategories(new Set(mappedCategories.map((c: PricingCategory) => c.id)));
      }
    } catch (error) {
      console.error('Error loading pricing:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  const handleDeleteCategory = async (category: PricingCategory) => {
    if (!model || !confirm(`Delete category "${category.name}" and all its items?`)) return;

    try {
      const response = await fetch(`/api/of-models/${model.id}/pricing/${category.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Category deleted');
        loadPricing(model.id);
      } else {
        toast.error('Failed to delete category');
      }
    } catch (error) {
      toast.error('Failed to delete category');
    }
  };

  const handleDeleteItem = async (categoryId: string, item: PricingItem) => {
    if (!model || !confirm(`Delete item "${item.name}"?`)) return;

    try {
      const response = await fetch(
        `/api/of-models/${model.id}/pricing/${categoryId}/items?itemId=${item.id}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        toast.success('Item deleted');
        loadPricing(model.id);
      } else {
        toast.error('Failed to delete item');
      }
    } catch (error) {
      toast.error('Failed to delete item');
    }
  };

  // Calculate totals
  const totalItems = categories.reduce((acc, cat) => acc + cat.items.length, 0);
  const totalRevenuePotential = categories.reduce(
    (acc, cat) => acc + cat.items.reduce((sum, item) => sum + (item.isActive ? item.price : 0), 0),
    0
  );

  if (loading) {
    return (
      <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-zinc-800/50">
          <div className="h-7 w-48 bg-zinc-800/50 rounded-lg animate-pulse" />
        </div>
        <div className="p-6 space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-zinc-800/30 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="p-2.5 rounded-xl bg-violet-500/10">
              <Layers className="w-5 h-5 text-violet-400" />
            </div>
          </div>
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1">Categories</p>
          <p className="text-2xl font-medium text-white">{categories.length}</p>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10">
              <Package className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1">Total Items</p>
          <p className="text-2xl font-medium text-white">{totalItems}</p>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10">
              <DollarSign className="w-5 h-5 text-amber-400" />
            </div>
          </div>
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1">Menu Total</p>
          <p className="text-2xl font-medium text-white">${totalRevenuePotential.toLocaleString()}</p>
        </div>
      </div>

      {/* Main Card */}
      <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <DollarSign className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-white">Pricing Menu</h2>
              <p className="text-sm text-zinc-500">Manage pricing categories and items</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowApplyTemplateModal(true)}
              className="group inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-white bg-zinc-800/80 border border-zinc-700/50 hover:border-violet-500/50 hover:bg-zinc-800 transition-all"
            >
              <FileText className="w-4 h-4 text-violet-400" />
              <span className="text-sm">Apply Template</span>
            </button>
            <button
              onClick={() => setShowAddCategoryModal(true)}
              className="group relative inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-white overflow-hidden transition-all"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-fuchsia-600" />
              <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-fuchsia-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              <Plus className="relative w-4 h-4" />
              <span className="relative text-sm">Add Category</span>
            </button>
          </div>
        </div>

        {/* Categories */}
        <div className="divide-y divide-zinc-800/50">
          {categories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 rounded-2xl bg-zinc-800/30 mb-4">
                <DollarSign className="w-10 h-10 text-zinc-600" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">No pricing categories yet</h3>
              <p className="text-zinc-500 mb-6 max-w-sm">
                Create your first pricing category to start building your menu
              </p>
              <button
                onClick={() => setShowAddCategoryModal(true)}
                className="group relative inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-fuchsia-600" />
                <Sparkles className="relative w-4 h-4" />
                <span className="relative">Create Category</span>
              </button>
            </div>
          ) : (
            categories.map((category) => (
              <div key={category.id}>
                {/* Category Header */}
                <div
                  className="flex items-center gap-4 p-4 hover:bg-zinc-800/20 cursor-pointer transition-colors"
                  onClick={() => toggleCategory(category.id)}
                >
                  <button className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors">
                    {expandedCategories.has(category.id) ? (
                      <ChevronDown className="w-5 h-5" />
                    ) : (
                      <ChevronRight className="w-5 h-5" />
                    )}
                  </button>

                  <div className="p-2 rounded-lg bg-zinc-800/50">
                    <Layers className="w-4 h-4 text-violet-400" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-white">{category.name}</h3>
                      {category.isGlobal && (
                        <span className="px-2 py-0.5 bg-blue-500/20 rounded text-[10px] font-medium text-blue-400 uppercase border border-blue-500/30">
                          Global
                        </span>
                      )}
                    </div>
                    {category.description && (
                      <p className="text-sm text-zinc-500 truncate">{category.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 bg-zinc-800/50 rounded-lg text-xs font-medium text-zinc-400">
                      {category.items.length} item{category.items.length !== 1 ? 's' : ''}
                    </span>

                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          setSelectedCategory(category);
                          setShowAddItemModal(true);
                        }}
                        className="p-2 rounded-lg text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"
                        title="Add item"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedCategory(category);
                          setShowEditCategoryModal(true);
                        }}
                        className="p-2 rounded-lg text-zinc-500 hover:text-violet-400 hover:bg-violet-500/10 transition-all"
                        title="Edit category"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(category)}
                        className="p-2 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                        title="Delete category"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Category Items */}
                {expandedCategories.has(category.id) && (
                  <div className="border-t border-zinc-800/30 bg-zinc-900/30">
                    {category.items.length === 0 ? (
                      <div className="flex items-center gap-3 p-4 pl-16 text-zinc-500">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-sm">No items in this category</span>
                        <button
                          onClick={() => {
                            setSelectedCategory(category);
                            setShowAddItemModal(true);
                          }}
                          className="text-sm text-violet-400 hover:text-violet-300 transition-colors"
                        >
                          Add one
                        </button>
                      </div>
                    ) : (
                      category.items.map((item, index) => (
                        <div
                          key={item.id}
                          className={`flex items-center gap-4 p-4 pl-16 hover:bg-zinc-800/20 transition-colors ${
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
                              {!item.isFree && item.priceType !== 'FIXED' && (
                                <span className="px-2 py-0.5 bg-zinc-800/50 rounded text-[10px] font-medium text-zinc-400 uppercase">
                                  {item.priceType}
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

                          <div className="text-lg font-semibold text-emerald-400">
                            {item.isFree ? (
                              'FREE'
                            ) : item.priceType === 'RANGE' && item.priceMin !== null && item.priceMax !== null ? (
                              `$${item.priceMin.toFixed(2)} - $${item.priceMax.toFixed(2)}`
                            ) : item.priceType === 'MINIMUM' && item.priceMin !== null ? (
                              `From $${item.priceMin.toFixed(2)}`
                            ) : (
                              `$${item.price.toFixed(2)}`
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setSelectedCategory(category);
                                setSelectedItem(item);
                                setShowEditItemModal(true);
                              }}
                              className="p-2 rounded-lg text-zinc-500 hover:text-violet-400 hover:bg-violet-500/10 transition-all"
                              title="Edit item"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteItem(category.id, item)}
                              className="p-2 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                              title="Delete item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
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

      {/* Modals */}
      {showAddCategoryModal && model && (
        <CategoryModal
          modelId={model.id}
          onClose={() => setShowAddCategoryModal(false)}
          onSuccess={() => {
            setShowAddCategoryModal(false);
            loadPricing(model.id);
          }}
        />
      )}

      {showEditCategoryModal && model && selectedCategory && (
        <CategoryModal
          modelId={model.id}
          category={selectedCategory}
          onClose={() => {
            setShowEditCategoryModal(false);
            setSelectedCategory(null);
          }}
          onSuccess={() => {
            setShowEditCategoryModal(false);
            setSelectedCategory(null);
            loadPricing(model.id);
          }}
        />
      )}

      {showAddItemModal && model && selectedCategory && (
        <ItemModal
          modelId={model.id}
          categoryId={selectedCategory.id}
          onClose={() => {
            setShowAddItemModal(false);
            setSelectedCategory(null);
          }}
          onSuccess={() => {
            setShowAddItemModal(false);
            setSelectedCategory(null);
            loadPricing(model.id);
          }}
        />
      )}

      {showEditItemModal && model && selectedCategory && selectedItem && (
        <ItemModal
          modelId={model.id}
          categoryId={selectedCategory.id}
          item={selectedItem}
          onClose={() => {
            setShowEditItemModal(false);
            setSelectedCategory(null);
            setSelectedItem(null);
          }}
          onSuccess={() => {
            setShowEditItemModal(false);
            setSelectedCategory(null);
            setSelectedItem(null);
            loadPricing(model.id);
          }}
        />
      )}

      {showApplyTemplateModal && model && (
        <ApplyTemplateModal
          modelId={model.id}
          onClose={() => setShowApplyTemplateModal(false)}
          onSuccess={() => {
            setShowApplyTemplateModal(false);
            loadPricing(model.id);
          }}
        />
      )}
    </>
  );
}

// Category Modal (Add/Edit)
function CategoryModal({
  modelId,
  category,
  onClose,
  onSuccess,
}: {
  modelId: string;
  category?: PricingCategory;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isEdit = !!category;
  const [name, setName] = useState(category?.name || '');
  const [slug, setSlug] = useState(category?.slug || '');
  const [description, setDescription] = useState(category?.description || '');
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
  }, [name, isEdit]);

  if (!mounted) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) {
      toast.error('Name and slug are required');
      return;
    }

    try {
      setSaving(true);
      const url = isEdit
        ? `/api/of-models/${modelId}/pricing/${category.id}`
        : `/api/of-models/${modelId}/pricing`;

      const response = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim() || null,
        }),
      });

      if (response.ok) {
        toast.success(isEdit ? 'Category updated' : 'Category created');
        onSuccess();
      } else {
        const error = await response.json();
        toast.error(error.error || `Failed to ${isEdit ? 'update' : 'create'} category`);
      }
    } catch (error) {
      toast.error(`Failed to ${isEdit ? 'update' : 'create'} category`);
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-fadeIn">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-violet-500 to-transparent" />

        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <Layers className="w-5 h-5 text-violet-400" />
            </div>
            <h2 className="text-lg font-medium text-white">
              {isEdit ? 'Edit Category' : 'Add Category'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Premium Content"
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
              placeholder="premium-content"
              className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition-colors"
              required
            />
          </div>

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

          <div className="flex gap-3 pt-2">
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
              <span className="relative">{saving ? 'Saving...' : isEdit ? 'Save' : 'Create'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

// Item Modal (Add/Edit)
function ItemModal({
  modelId,
  categoryId,
  item,
  onClose,
  onSuccess,
}: {
  modelId: string;
  categoryId: string;
  item?: PricingItem;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isEdit = !!item;
  const [name, setName] = useState(item?.name || '');
  const [price, setPrice] = useState(item?.price.toString() || '');
  const [priceType, setPriceType] = useState<'FIXED' | 'RANGE' | 'MINIMUM'>(item?.priceType || 'FIXED');
  const [priceMin, setPriceMin] = useState(item?.priceMin?.toString() || '');
  const [priceMax, setPriceMax] = useState(item?.priceMax?.toString() || '');
  const [isFree, setIsFree] = useState(item?.isFree ?? false);
  const [description, setDescription] = useState(item?.description || '');
  const [isActive, setIsActive] = useState(item?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSaving(true);
      const response = await fetch(`/api/of-models/${modelId}/pricing/${categoryId}/items`, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(isEdit && { itemId: item.id }),
          name: name.trim(),
          price: isFree ? 0 : parseFloat(price || '0'),
          priceType: isFree ? 'FIXED' : priceType,
          priceMin: isFree ? null : (priceMin ? parseFloat(priceMin) : null),
          priceMax: isFree ? null : (priceMax ? parseFloat(priceMax) : null),
          isFree,
          description: description.trim() || null,
          isActive,
        }),
      });

      if (response.ok) {
        toast.success(isEdit ? 'Item updated' : 'Item created');
        onSuccess();
      } else {
        const error = await response.json();
        toast.error(error.error || `Failed to ${isEdit ? 'update' : 'create'} item`);
      }
    } catch (error) {
      toast.error(`Failed to ${isEdit ? 'update' : 'create'} item`);
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-fadeIn">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-emerald-500 to-transparent" />

        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <Tag className="w-5 h-5 text-emerald-400" />
            </div>
            <h2 className="text-lg font-medium text-white">
              {isEdit ? 'Edit Item' : 'Add Item'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Custom Photo Set"
              className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition-colors"
              required
            />
          </div>

          {/* Free Toggle */}
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Pricing</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsFree(false)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  !isFree
                    ? 'bg-violet-500/10 text-violet-400 border border-violet-500/30'
                    : 'bg-zinc-800/50 border border-zinc-700/50 text-zinc-500 hover:text-zinc-400'
                }`}
              >
                <DollarSign className="w-4 h-4" />
                Paid
              </button>
              <button
                type="button"
                onClick={() => setIsFree(true)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  isFree
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'bg-zinc-800/50 border border-zinc-700/50 text-zinc-500 hover:text-zinc-400'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                Free
              </button>
            </div>
          </div>

          {/* Price Type (only if not free) */}
          {!isFree && (
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Price Type</label>
              <div className="flex gap-2">
                {(['FIXED', 'RANGE', 'MINIMUM'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setPriceType(type)}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      priceType === type
                        ? 'bg-violet-500/10 text-violet-400 border border-violet-500/30'
                        : 'bg-zinc-800/50 border border-zinc-700/50 text-zinc-500 hover:text-zinc-400'
                    }`}
                  >
                    {type === 'MINIMUM' ? 'Min' : type.charAt(0) + type.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Price Inputs (only if not free) */}
          {!isFree && priceType === 'FIXED' && (
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                Price <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-medium">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-8 pr-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition-colors"
                  required
                />
              </div>
            </div>
          )}

          {!isFree && priceType === 'RANGE' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  Min Price <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-medium">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={priceMin}
                    onChange={(e) => setPriceMin(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition-colors"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  Max Price <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-medium">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={priceMax}
                    onChange={(e) => setPriceMax(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition-colors"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {!isFree && priceType === 'MINIMUM' && (
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                Starting Price <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-medium">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={priceMin}
                  onChange={(e) => setPriceMin(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-8 pr-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition-colors"
                  required
                />
              </div>
            </div>
          )}

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

          <div className="flex gap-3 pt-2">
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
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-teal-600" />
              <span className="relative">{saving ? 'Saving...' : isEdit ? 'Save' : 'Create'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

// Apply Template Modal
interface PricingTemplate {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  pageType: string;
  isDefault: boolean;
  items?: {
    id: string;
    name: string;
    priceType: string;
    priceFixed: number | null;
    priceMin: number | null;
    priceMax: number | null;
    description: string | null;
    order: number;
    isActive: boolean;
  }[];
}

function ApplyTemplateModal({
  modelId,
  onClose,
  onSuccess,
}: {
  modelId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [templates, setTemplates] = useState<PricingTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<PricingTemplate | null>(null);
  const [applyMode, setApplyMode] = useState<'replace' | 'merge'>('replace');
  const [applying, setApplying] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');

  useEffect(() => {
    setMounted(true);
    loadTemplates();
    return () => setMounted(false);
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('includeItems', 'true');
      params.append('activeOnly', 'true');
      if (categoryFilter) params.append('category', categoryFilter);

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

  useEffect(() => {
    if (mounted) {
      loadTemplates();
    }
  }, [categoryFilter, mounted]);

  if (!mounted) return null;

  const handleApply = async () => {
    if (!selectedTemplate) {
      toast.error('Please select a template');
      return;
    }

    try {
      setApplying(true);
      const response = await fetch(`/api/of-models/${modelId}/pricing/apply-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          mode: applyMode,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(result.message || 'Template applied successfully');
        onSuccess();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to apply template');
      }
    } catch (error) {
      toast.error('Failed to apply template');
    } finally {
      setApplying(false);
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

  const formatPrice = (item: NonNullable<PricingTemplate['items']>[0]) => {
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
            <div>
              <h2 className="text-lg font-medium text-white">Apply Pricing Template</h2>
              <p className="text-sm text-zinc-500">Select a template to apply to this creator</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Category Filter */}
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Filter by Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white focus:outline-none focus:border-violet-500/50"
            >
              <option value="">All Categories</option>
              <option value="PORN_ACCURATE">Porn Accurate</option>
              <option value="PORN_SCAM">Porn Scam</option>
              <option value="GF_ACCURATE">GF Accurate</option>
              <option value="GF_SCAM">GF Scam</option>
              <option value="BUNDLE_BASED">Bundle Based</option>
              <option value="CUSTOM">Custom</option>
            </select>
          </div>

          {/* Templates List */}
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Select Template</label>
            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-20 bg-zinc-800/30 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-8 text-zinc-500 bg-zinc-800/30 rounded-xl border border-dashed border-zinc-700/50">
                <FileText className="w-10 h-10 mx-auto mb-3 text-zinc-600" />
                <p className="text-sm">No templates available</p>
                <p className="text-xs text-zinc-600 mt-1">Create templates in Settings &gt; Pricing Templates</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => setSelectedTemplate(template)}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      selectedTemplate?.id === template.id
                        ? 'bg-violet-500/10 border-violet-500/50'
                        : 'bg-zinc-800/30 border-zinc-700/50 hover:border-zinc-600/50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">{template.name}</span>
                          {template.isDefault && (
                            <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-400 text-[10px] font-medium rounded border border-amber-500/30">
                              DEFAULT
                            </span>
                          )}
                        </div>
                        {template.description && (
                          <p className="text-sm text-zinc-500 mt-1">{template.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`px-2 py-0.5 text-[10px] font-medium rounded border ${getCategoryBadgeColor(template.category)}`}>
                            {template.category.replace('_', ' ')}
                          </span>
                          <span className="text-xs text-zinc-500">
                            {template.items?.length || 0} item{(template.items?.length || 0) !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                        selectedTemplate?.id === template.id
                          ? 'border-violet-500 bg-violet-500'
                          : 'border-zinc-600'
                      }`}>
                        {selectedTemplate?.id === template.id && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Preview */}
          {selectedTemplate && selectedTemplate.items && selectedTemplate.items.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Template Preview</label>
              <div className="bg-zinc-800/30 rounded-xl border border-zinc-700/50 p-4">
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {selectedTemplate.items.map((item, index) => (
                    <div key={index} className="flex items-center justify-between py-2 border-b border-zinc-700/30 last:border-0">
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-emerald-400" />
                        <span className="text-sm text-white">{item.name}</span>
                      </div>
                      <span className="text-sm font-medium text-emerald-400">{formatPrice(item)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Apply Mode */}
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Apply Mode</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setApplyMode('replace')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  applyMode === 'replace'
                    ? 'bg-violet-500/10 text-violet-400 border border-violet-500/30'
                    : 'bg-zinc-800/50 border border-zinc-700/50 text-zinc-500 hover:text-zinc-400'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${applyMode === 'replace' ? 'bg-violet-400' : 'bg-zinc-600'}`} />
                Replace Existing
              </button>
              <button
                type="button"
                onClick={() => setApplyMode('merge')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  applyMode === 'merge'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'bg-zinc-800/50 border border-zinc-700/50 text-zinc-500 hover:text-zinc-400'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${applyMode === 'merge' ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                Merge with Existing
              </button>
            </div>
            <p className="text-xs text-zinc-500 mt-2">
              {applyMode === 'replace'
                ? 'This will delete all existing pricing and replace it with the template.'
                : 'This will add the template items alongside existing pricing.'}
            </p>
          </div>
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
            onClick={handleApply}
            disabled={applying || !selectedTemplate}
            className="flex-1 relative px-4 py-3 rounded-xl font-medium text-white overflow-hidden disabled:opacity-50"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-fuchsia-600" />
            <span className="relative flex items-center justify-center gap-2">
              <Download className="w-4 h-4" />
              {applying ? 'Applying...' : 'Apply Template'}
            </span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
