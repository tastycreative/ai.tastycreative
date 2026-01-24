'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import {
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronRight,
  DollarSign,
  X,
} from 'lucide-react';

interface PricingItem {
  id: string;
  name: string;
  price: number;
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
  items: PricingItem[];
}

interface OfModel {
  id: string;
  slug: string;
}

export default function OfModelPricingPage() {
  const params = useParams();
  const slug = params.slug as string;
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

  useEffect(() => {
    if (slug) {
      loadModel();
    }
  }, [slug]);

  const loadModel = async () => {
    try {
      const response = await fetch(`/api/of-models/${slug}`);
      if (response.ok) {
        const result = await response.json();
        setModel(result.data);
        loadPricing(result.data.id);
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
        setCategories(result.data || []);
        // Expand all categories by default
        setExpandedCategories(new Set(result.data?.map((c: PricingCategory) => c.id) || []));
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

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Pricing Menu
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Manage pricing categories and items
            </p>
          </div>
          <button
            onClick={() => setShowAddCategoryModal(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Category
          </button>
        </div>

        {/* Categories */}
        <div className="divide-y divide-gray-200 dark:divide-gray-800">
          {categories.length === 0 ? (
            <div className="p-12 text-center">
              <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No pricing categories yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Create your first pricing category to get started
              </p>
              <button
                onClick={() => setShowAddCategoryModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <Plus className="w-5 h-5" />
                Add Category
              </button>
            </div>
          ) : (
            categories.map((category) => (
              <div key={category.id}>
                {/* Category Header */}
                <div
                  className="flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                  onClick={() => toggleCategory(category.id)}
                >
                  <button className="text-gray-400">
                    {expandedCategories.has(category.id) ? (
                      <ChevronDown className="w-5 h-5" />
                    ) : (
                      <ChevronRight className="w-5 h-5" />
                    )}
                  </button>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      {category.name}
                    </h3>
                    {category.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {category.description}
                      </p>
                    )}
                  </div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {category.items.length} item{category.items.length !== 1 ? 's' : ''}
                  </span>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => {
                        setSelectedCategory(category);
                        setShowAddItemModal(true);
                      }}
                      className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                      title="Add item"
                    >
                      <Plus className="w-4 h-4 text-gray-500" />
                    </button>
                    <button
                      onClick={() => {
                        setSelectedCategory(category);
                        setShowEditCategoryModal(true);
                      }}
                      className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                      title="Edit category"
                    >
                      <Pencil className="w-4 h-4 text-gray-500" />
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(category)}
                      className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                      title="Delete category"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>

                {/* Category Items */}
                {expandedCategories.has(category.id) && (
                  <div className="border-t border-gray-100 dark:border-gray-800">
                    {category.items.length === 0 ? (
                      <div className="p-4 pl-12 text-center text-gray-500 dark:text-gray-400">
                        No items in this category
                      </div>
                    ) : (
                      category.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 p-3 pl-12 hover:bg-gray-50 dark:hover:bg-gray-800 border-t border-gray-100 dark:border-gray-800 first:border-t-0"
                        >
                          <GripVertical className="w-4 h-4 text-gray-300 cursor-grab" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className={`font-medium ${item.isActive ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>
                                {item.name}
                              </span>
                              {!item.isActive && (
                                <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 rounded">
                                  Inactive
                                </span>
                              )}
                            </div>
                            {item.description && (
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {item.description}
                              </p>
                            )}
                          </div>
                          <span className="font-semibold text-green-600 dark:text-green-400">
                            ${item.price.toFixed(2)}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setSelectedCategory(category);
                                setSelectedItem(item);
                                setShowEditItemModal(true);
                              }}
                              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                              title="Edit item"
                            >
                              <Pencil className="w-4 h-4 text-gray-500" />
                            </button>
                            <button
                              onClick={() => handleDeleteItem(category.id, item)}
                              className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                              title="Delete item"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
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

      {/* Add Category Modal */}
      {showAddCategoryModal && model && (
        <AddCategoryModal
          modelId={model.id}
          onClose={() => setShowAddCategoryModal(false)}
          onSuccess={() => {
            setShowAddCategoryModal(false);
            loadPricing(model.id);
          }}
        />
      )}

      {/* Edit Category Modal */}
      {showEditCategoryModal && model && selectedCategory && (
        <EditCategoryModal
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

      {/* Add Item Modal */}
      {showAddItemModal && model && selectedCategory && (
        <AddItemModal
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

      {/* Edit Item Modal */}
      {showEditItemModal && model && selectedCategory && selectedItem && (
        <EditItemModal
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
    </>
  );
}

// Add Category Modal
function AddCategoryModal({
  modelId,
  onClose,
  onSuccess,
}: {
  modelId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (name && !slug) {
      setSlug(name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
    }
  }, [name]);

  if (!mounted) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) {
      toast.error('Name and slug are required');
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`/api/of-models/${modelId}/pricing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim() || null,
        }),
      });

      if (response.ok) {
        toast.success('Category created');
        onSuccess();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create category');
      }
    } catch (error) {
      toast.error('Failed to create category');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Add Category
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Slug *</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50">
              {saving ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

// Edit Category Modal
function EditCategoryModal({
  modelId,
  category,
  onClose,
  onSuccess,
}: {
  modelId: string;
  category: PricingCategory;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(category.name);
  const [slug, setSlug] = useState(category.slug);
  const [description, setDescription] = useState(category.description || '');
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
      const response = await fetch(`/api/of-models/${modelId}/pricing/${category.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim() || null,
        }),
      });

      if (response.ok) {
        toast.success('Category updated');
        onSuccess();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to update category');
      }
    } catch (error) {
      toast.error('Failed to update category');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Edit Category</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Slug *</label>
            <input type="text" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white" />
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

// Add Item Modal
function AddItemModal({
  modelId,
  categoryId,
  onClose,
  onSuccess,
}: {
  modelId: string;
  categoryId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          price: parseFloat(price),
          description: description.trim() || null,
          isActive,
        }),
      });

      if (response.ok) {
        toast.success('Item created');
        onSuccess();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create item');
      }
    } catch (error) {
      toast.error('Failed to create item');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Add Item</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Price *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full pl-7 pr-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white" required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="isActive" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
            <label htmlFor="isActive" className="text-sm text-gray-700 dark:text-gray-300">Active</label>
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50">{saving ? 'Creating...' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

// Edit Item Modal
function EditItemModal({
  modelId,
  categoryId,
  item,
  onClose,
  onSuccess,
}: {
  modelId: string;
  categoryId: string;
  item: PricingItem;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(item.price.toString());
  const [description, setDescription] = useState(item.description || '');
  const [isActive, setIsActive] = useState(item.isActive);
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
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: item.id,
          name: name.trim(),
          price: parseFloat(price),
          description: description.trim() || null,
          isActive,
        }),
      });

      if (response.ok) {
        toast.success('Item updated');
        onSuccess();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to update item');
      }
    } catch (error) {
      toast.error('Failed to update item');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Edit Item</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Price *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full pl-7 pr-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white" required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="editIsActive" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
            <label htmlFor="editIsActive" className="text-sm text-gray-700 dark:text-gray-300">Active</label>
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
