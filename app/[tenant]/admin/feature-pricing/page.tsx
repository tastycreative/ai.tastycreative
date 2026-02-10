"use client";

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Copy, Check } from 'lucide-react';

interface FeaturePricing {
  id: string;
  featureKey: string;
  featureName: string;
  category: string;
  credits: number;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function FeaturePricingPage() {
  const [pricing, setPricing] = useState<FeaturePricing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<FeaturePricing | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    featureKey: '',
    featureName: '',
    category: '',
    credits: 0,
    description: '',
    isActive: true,
  });

  useEffect(() => {
    fetchPricing();
  }, []);

  const fetchPricing = async () => {
    try {
      const response = await fetch('/api/admin/feature-pricing');
      if (response.ok) {
        const data = await response.json();
        setPricing(data.pricing);
      }
    } catch (error) {
      console.error('Error fetching pricing:', error);
      toast.error('Failed to load feature pricing');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const url = editingItem
        ? `/api/admin/feature-pricing/${editingItem.id}`
        : '/api/admin/feature-pricing';

      const method = editingItem ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success(editingItem ? 'Feature updated' : 'Feature created');
        setShowModal(false);
        setEditingItem(null);
        resetForm();
        fetchPricing();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to save feature');
      }
    } catch (error) {
      console.error('Error saving feature:', error);
      toast.error('Failed to save feature');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this feature pricing?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/feature-pricing/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Feature deleted');
        fetchPricing();
      } else {
        toast.error('Failed to delete feature');
      }
    } catch (error) {
      console.error('Error deleting feature:', error);
      toast.error('Failed to delete feature');
    }
  };

  const handleEdit = (item: FeaturePricing) => {
    setEditingItem(item);
    setFormData({
      featureKey: item.featureKey,
      featureName: item.featureName,
      category: item.category,
      credits: item.credits,
      description: item.description || '',
      isActive: item.isActive,
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      featureKey: '',
      featureName: '',
      category: '',
      credits: 0,
      description: '',
      isActive: true,
    });
  };

  const handleCopyKey = async (key: string) => {
    await navigator.clipboard.writeText(key);
    setCopiedId(key);
    toast.success('Feature key copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Group pricing by category
  const groupedPricing = pricing.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, FeaturePricing[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-mid-pink"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Feature Credit Pricing</h1>
          <p className="text-muted-foreground mt-2">
            Manage credit costs for platform features
          </p>
        </div>
        <button
          onClick={() => {
            setEditingItem(null);
            resetForm();
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-mid-pink to-brand-light-pink text-white rounded-lg hover:from-brand-mid-pink/90 hover:to-brand-light-pink/90 transition-all active:scale-95 shadow-lg shadow-brand-mid-pink/25"
        >
          <Plus className="w-5 h-5" />
          Add Feature
        </button>
      </div>

      {Object.keys(groupedPricing).length === 0 ? (
        <div className="text-center py-12 bg-card rounded-xl border border-border">
          <p className="text-muted-foreground">No feature pricing configured yet</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedPricing).map(([category, items]) => (
            <div key={category}>
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {category}
              </h2>
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Feature
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Feature Key
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Credits
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {items.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/50 transition-colors">
                        <td className="px-6 py-4">
                          <div>
                            <div className="font-medium text-foreground">
                              {item.featureName}
                            </div>
                            {item.description && (
                              <div className="text-sm text-muted-foreground">
                                {item.description}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleCopyKey(item.featureKey)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg hover:bg-muted/80 transition-colors group border border-border"
                          >
                            <code className="text-sm font-mono text-foreground">
                              {item.featureKey}
                            </code>
                            {copiedId === item.featureKey ? (
                              <Check className="w-4 h-4 text-brand-mid-pink" />
                            ) : (
                              <Copy className="w-4 h-4 text-muted-foreground group-hover:text-brand-mid-pink transition-colors" />
                            )}
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-muted text-foreground border border-brand-blue/30">
                            {item.credits} credits
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                              item.isActive
                                ? 'bg-muted text-foreground border-green-500/50'
                                : 'bg-muted text-muted-foreground border-border'
                            }`}
                          >
                            {item.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleEdit(item)}
                              className="p-2 text-brand-mid-pink hover:bg-brand-mid-pink/10 rounded-lg transition-colors border border-transparent hover:border-brand-mid-pink/30"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent hover:border-red-500/30"
                              title="Delete"
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
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-border">
            <h2 className="text-2xl font-bold text-foreground mb-6">
              {editingItem ? 'Edit Feature Pricing' : 'Add Feature Pricing'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Feature Key *
                </label>
                <input
                  type="text"
                  value={formData.featureKey}
                  onChange={(e) => setFormData({ ...formData, featureKey: e.target.value })}
                  placeholder="e.g., seedream_text_to_image"
                  className="w-full px-4 py-2 bg-background border border-border text-foreground rounded-lg focus:ring-2 focus:ring-brand-mid-pink focus:border-brand-mid-pink placeholder:text-muted-foreground"
                  required
                  disabled={!!editingItem}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Use lowercase with underscores. Cannot be changed after creation.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Feature Name *
                </label>
                <input
                  type="text"
                  value={formData.featureName}
                  onChange={(e) => setFormData({ ...formData, featureName: e.target.value })}
                  placeholder="e.g., SeeDream Text to Image"
                  className="w-full px-4 py-2 bg-background border border-border text-foreground rounded-lg focus:ring-2 focus:ring-brand-mid-pink focus:border-brand-mid-pink placeholder:text-muted-foreground"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Category *
                </label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="e.g., Image Generation, Video Generation"
                  className="w-full px-4 py-2 bg-background border border-border text-foreground rounded-lg focus:ring-2 focus:ring-brand-mid-pink focus:border-brand-mid-pink placeholder:text-muted-foreground"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Credits *
                </label>
                <input
                  type="number"
                  value={formData.credits}
                  onChange={(e) => setFormData({ ...formData, credits: parseInt(e.target.value) })}
                  min="0"
                  className="w-full px-4 py-2 bg-background border border-border text-foreground rounded-lg focus:ring-2 focus:ring-brand-mid-pink focus:border-brand-mid-pink"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 bg-background border border-border text-foreground rounded-lg focus:ring-2 focus:ring-brand-mid-pink focus:border-brand-mid-pink placeholder:text-muted-foreground"
                  placeholder="Brief description of the feature"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-brand-mid-pink rounded focus:ring-2 focus:ring-brand-mid-pink"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-foreground">
                  Active
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingItem(null);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 border border-border rounded-lg text-foreground hover:bg-muted font-medium transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-brand-mid-pink to-brand-light-pink text-white rounded-lg hover:from-brand-mid-pink/90 hover:to-brand-light-pink/90 font-medium transition-all active:scale-95 shadow-lg shadow-brand-mid-pink/25"
                >
                  {editingItem ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
