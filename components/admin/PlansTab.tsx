'use client';

import { useState, useEffect } from 'react';
import { DollarSign, Plus, Edit2, Trash2, X, CheckCircle, XCircle, Search, Users, Calendar } from 'lucide-react';
import PlanFeaturesEditor from './PlanFeaturesEditor';
import { getDefaultFeatures } from '@/lib/planFeatures';

interface SubscriptionPlan {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  price: number;
  billingInterval: 'MONTHLY' | 'YEARLY';
  maxMembers: number;
  maxProfiles: number;
  maxWorkspaces: number;
  maxStorageGB: number;
  monthlyCredits: number;
  stripePriceId: string | null;
  stripeProductId: string | null;
  isActive: boolean;
  isPublic: boolean;
  features: Record<string, boolean | number | null>; // JSON field
  createdAt: string;
  updatedAt: string;
  organizationsCount: number;
}

export default function PlansTab() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [showCreatePlanModal, setShowCreatePlanModal] = useState(false);
  const [showEditPlanModal, setShowEditPlanModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    description: '',
    price: 0,
    billingInterval: 'MONTHLY' as 'MONTHLY' | 'YEARLY',
    maxMembers: 1,
    maxProfiles: 1,
    maxWorkspaces: 0,
    maxStorageGB: 5,
    monthlyCredits: 100,
    stripePriceId: '',
    stripeProductId: '',
    isActive: true,
    isPublic: true,
  });

  const [planFeatures, setPlanFeatures] = useState<Record<string, boolean | number | null>>(getDefaultFeatures());

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/plans');
      const data = await response.json();

      if (data.success) {
        setPlans(data.plans);
      } else {
        setError(data.error || 'Failed to fetch plans');
      }
    } catch (err) {
      console.error('Error fetching plans:', err);
      setError('Failed to fetch plans');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlan = async () => {
    try {
      setError(null);

      // Convert features object to array format for API
      const response = await fetch('/api/admin/plans/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          features: planFeatures, // Send features as JSON object
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Plan created successfully!');
        setShowCreatePlanModal(false);
        resetForm();
        fetchPlans();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Failed to create plan');
      }
    } catch (err) {
      console.error('Error creating plan:', err);
      setError('Failed to create plan');
    }
  };

  const handleUpdatePlan = async () => {
    if (!selectedPlan) return;

    try {
      setError(null);

      const response = await fetch(`/api/admin/plans/${selectedPlan.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          features: planFeatures, // Send features as JSON object
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Plan updated successfully!');
        setShowEditPlanModal(false);
        setSelectedPlan(null);
        resetForm();
        fetchPlans();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Failed to update plan');
      }
    } catch (err) {
      console.error('Error updating plan:', err);
      setError('Failed to update plan');
    }
  };

  const handleDeletePlan = async (planId: string, planName: string) => {
    if (!confirm(`Are you sure you want to delete the "${planName}" plan? This action cannot be undone.`)) {
      return;
    }

    try {
      setError(null);
      const response = await fetch(`/api/admin/plans/${planId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Plan deleted successfully!');
        fetchPlans();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Failed to delete plan');
      }
    } catch (err) {
      console.error('Error deleting plan:', err);
      setError('Failed to delete plan');
    }
  };

  const openEditModal = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    setFormData({
      name: plan.name,
      displayName: plan.displayName,
      description: plan.description || '',
      price: plan.price,
      billingInterval: plan.billingInterval,
      maxMembers: plan.maxMembers,
      maxProfiles: plan.maxProfiles,
      maxWorkspaces: plan.maxWorkspaces,
      maxStorageGB: plan.maxStorageGB,
      monthlyCredits: plan.monthlyCredits,
      stripePriceId: plan.stripePriceId || '',
      stripeProductId: plan.stripeProductId || '',
      isActive: plan.isActive,
      isPublic: plan.isPublic,
    });

    // Convert plan features array to object for the editor
    // Features are now stored as JSON object
    setPlanFeatures(plan.features || {});
    setShowEditPlanModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      displayName: '',
      description: '',
      price: 0,
      billingInterval: 'MONTHLY',
      maxMembers: 1,
      maxProfiles: 1,
      maxWorkspaces: 0,
      maxStorageGB: 5,
      monthlyCredits: 100,
      stripePriceId: '',
      stripeProductId: '',
      isActive: true,
      isPublic: true,
    });

    // Reset features to defaults from centralized config
    setPlanFeatures(getDefaultFeatures());
  };

  const filteredPlans = plans.filter(plan =>
    plan.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    plan.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (plan.description && plan.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-mid-pink"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div>
        <h3 className="text-xl font-semibold text-foreground mb-2">Subscription Plans</h3>
        <p className="text-muted-foreground">Manage subscription plans, pricing, and features</p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-lg flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Error</p>
            <p className="text-sm text-foreground mt-1">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="mt-4 p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900/50 rounded-lg flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Success</p>
            <p className="text-sm text-foreground mt-1">{success}</p>
          </div>
          <button onClick={() => setSuccess(null)} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search and Actions */}
      <div className="mt-6 flex gap-4 items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search plans..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-brand-mid-pink focus:border-brand-mid-pink placeholder:text-muted-foreground"
          />
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowCreatePlanModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-mid-pink to-brand-light-pink text-white rounded-lg hover:from-brand-dark-pink hover:to-brand-mid-pink transition-all active:scale-95 shadow-lg shadow-brand-mid-pink/25"
        >
          <Plus className="w-5 h-5" />
          <span>Create Plan</span>
        </button>
      </div>

      {/* Plans List */}
      <div className="space-y-4 flex-1 overflow-auto min-h-0 mt-4">
        {filteredPlans.map((plan) => (
          <div key={plan.id} className="bg-card border border-border rounded-lg p-6 hover:shadow-md hover:border-brand-mid-pink/30 transition-all">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h4 className="text-lg font-semibold text-foreground">{plan.displayName}</h4>
                  <span className="text-xs px-2 py-1 rounded-full bg-muted border border-border text-muted-foreground">
                    {plan.name}
                  </span>
                  {plan.isActive ? (
                    <span className="text-xs px-2 py-1 rounded-full bg-green-50/50 dark:bg-green-950/30 border border-green-500/30 text-foreground flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-green-600 dark:text-green-400" />
                      Active
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-1 rounded-full bg-muted border border-border text-muted-foreground">
                      Inactive
                    </span>
                  )}
                  {!plan.isPublic && (
                    <span className="text-xs px-2 py-1 rounded-full bg-orange-50/50 dark:bg-orange-950/30 border border-orange-500/30 text-foreground">
                      Private
                    </span>
                  )}
                </div>
                {plan.description && (
                  <p className="text-sm text-muted-foreground mb-3">{plan.description}</p>
                )}
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-brand-mid-pink" />
                    <span className="font-semibold text-foreground">${plan.price}</span>
                    <span>/ {plan.billingInterval.toLowerCase()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-brand-blue" />
                    <span>{plan.organizationsCount} org{plan.organizationsCount !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => openEditModal(plan)}
                  className="p-2 text-brand-blue hover:bg-brand-blue/10 rounded-lg transition-colors"
                  title="Edit plan"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeletePlan(plan.id, plan.displayName)}
                  className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                  title="Delete plan"
                  disabled={plan.organizationsCount > 0}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Plan Limits */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 border border-border rounded-lg mb-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Members</p>
                <p className="text-sm font-semibold text-foreground">{plan.maxMembers}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Profiles</p>
                <p className="text-sm font-semibold text-foreground">{plan.maxProfiles}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Workspaces</p>
                <p className="text-sm font-semibold text-foreground">{plan.maxWorkspaces}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Storage</p>
                <p className="text-sm font-semibold text-foreground">{plan.maxStorageGB} GB</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Monthly Credits</p>
                <p className="text-sm font-semibold text-foreground">{plan.monthlyCredits}</p>
              </div>
            </div>

            {/* Features Summary */}
            {plan.features && Object.keys(plan.features).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-foreground mb-2">
                  Available Features ({Object.entries(plan.features).filter(([_, v]) => v === true).length} enabled):
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {/* Tab Permissions */}
                  {Object.entries(plan.features)
                    .filter(([key, value]) => key.startsWith('has') && value === true)
                    .map(([key]) => (
                      <span
                        key={key}
                        className="text-xs px-3 py-1.5 bg-green-50/50 dark:bg-green-950/30 border border-green-500/30 text-foreground rounded-lg flex items-center gap-1"
                      >
                        <span className="text-green-600 dark:text-green-400">✓</span> {key.replace('has', '').replace('Tab', '')}
                      </span>
                    ))}
                  {/* Feature Permissions */}
                  {Object.entries(plan.features)
                    .filter(([key, value]) => key.startsWith('can') && value === true)
                    .slice(0, 6)
                    .map(([key]) => (
                      <span
                        key={key}
                        className="text-xs px-3 py-1.5 bg-background border border-brand-blue/30 text-foreground rounded-lg flex items-center gap-1"
                      >
                        <span className="text-brand-blue">✓</span> {key.replace('can', '')}
                      </span>
                    ))}
                </div>
                {Object.entries(plan.features).filter(([key, value]) => key.startsWith('can') && value === true).length > 6 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    +{Object.entries(plan.features).filter(([key, value]) => key.startsWith('can') && value === true).length - 6} more features
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Create Plan Modal */}
      {showCreatePlanModal && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm"
          onClick={() => {
            setShowCreatePlanModal(false);
            resetForm();
          }}
        >
          <div className="flex min-h-screen items-center justify-center p-4">
            <div
              className="relative bg-card border border-border rounded-xl shadow-2xl p-6 max-w-4xl w-full my-8 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-foreground">Create New Plan</h2>
                <button
                  onClick={() => {
                    setShowCreatePlanModal(false);
                    resetForm();
                  }}
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Plan Name (tenant) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '-') })}
                      className="w-full px-4 py-2.5 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-brand-mid-pink focus:border-brand-mid-pink placeholder:text-muted-foreground"
                      placeholder="basic-plan"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Display Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.displayName}
                      onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                      className="w-full px-4 py-2.5 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-brand-mid-pink focus:border-brand-mid-pink placeholder:text-muted-foreground"
                      placeholder="Basic Plan"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2.5 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-brand-mid-pink focus:border-brand-mid-pink placeholder:text-muted-foreground"
                    placeholder="Plan description..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">Price</label>
                    <input
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                      min="0"
                      step="0.01"
                      className="w-full px-4 py-2.5 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-brand-mid-pink focus:border-brand-mid-pink"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">Billing Interval</label>
                    <select
                      value={formData.billingInterval}
                      onChange={(e) => setFormData({ ...formData, billingInterval: e.target.value as 'MONTHLY' | 'YEARLY' })}
                      className="w-full px-4 py-2.5 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-brand-mid-pink focus:border-brand-mid-pink"
                    >
                      <option value="MONTHLY">Monthly</option>
                      <option value="YEARLY">Yearly</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">Max Members</label>
                    <input
                      type="number"
                      value={formData.maxMembers}
                      onChange={(e) => setFormData({ ...formData, maxMembers: parseInt(e.target.value) || 1 })}
                      min="1"
                      className="w-full px-4 py-2.5 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-brand-mid-pink focus:border-brand-mid-pink"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">Max Profiles</label>
                    <input
                      type="number"
                      value={formData.maxProfiles}
                      onChange={(e) => setFormData({ ...formData, maxProfiles: parseInt(e.target.value) || 1 })}
                      min="1"
                      className="w-full px-4 py-2.5 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-brand-mid-pink focus:border-brand-mid-pink"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">Max Workspaces</label>
                    <input
                      type="number"
                      value={formData.maxWorkspaces}
                      onChange={(e) => setFormData({ ...formData, maxWorkspaces: parseInt(e.target.value) || 0 })}
                      min="0"
                      className="w-full px-4 py-2.5 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-brand-mid-pink focus:border-brand-mid-pink"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">Max Storage (GB)</label>
                    <input
                      type="number"
                      value={formData.maxStorageGB}
                      onChange={(e) => setFormData({ ...formData, maxStorageGB: parseInt(e.target.value) || 5 })}
                      min="1"
                      className="w-full px-4 py-2.5 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-brand-mid-pink focus:border-brand-mid-pink"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">Monthly Credits</label>
                    <input
                      type="number"
                      value={formData.monthlyCredits}
                      onChange={(e) => setFormData({ ...formData, monthlyCredits: parseInt(e.target.value) || 100 })}
                      min="0"
                      className="w-full px-4 py-2.5 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-brand-mid-pink focus:border-brand-mid-pink"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
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
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isPublic"
                      checked={formData.isPublic}
                      onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                      className="w-4 h-4 text-brand-blue rounded focus:ring-2 focus:ring-brand-blue"
                    />
                    <label htmlFor="isPublic" className="text-sm font-medium text-foreground">
                      Public
                    </label>
                  </div>
                </div>

                {/* Features Section */}
                <div className="border-t border-border pt-4">
                  <h3 className="text-sm font-semibold text-foreground mb-4">Plan Features & Permissions</h3>
                  <PlanFeaturesEditor features={planFeatures} onChange={setPlanFeatures} />
                </div>
              </div>

              <div className="mt-6 flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowCreatePlanModal(false);
                    resetForm();
                  }}
                  className="px-5 py-2.5 border border-border rounded-lg text-foreground hover:bg-muted font-medium transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreatePlan}
                  disabled={!formData.name || !formData.displayName}
                  className="px-5 py-2.5 bg-gradient-to-r from-brand-mid-pink to-brand-light-pink text-white rounded-lg hover:from-brand-dark-pink hover:to-brand-mid-pink font-medium transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-mid-pink/25"
                >
                  Create Plan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Plan Modal - Similar to Create but with pre-filled data */}
      {showEditPlanModal && selectedPlan && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm"
          onClick={() => {
            setShowEditPlanModal(false);
            setSelectedPlan(null);
            resetForm();
          }}
        >
          <div className="flex min-h-screen items-center justify-center p-4">
            <div
              className="relative bg-card border border-border rounded-xl shadow-2xl p-6 max-w-4xl w-full my-8 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Edit Plan</h2>
                  <p className="text-sm text-muted-foreground mt-1">{selectedPlan.displayName}</p>
                </div>
                <button
                  onClick={() => {
                    setShowEditPlanModal(false);
                    setSelectedPlan(null);
                    resetForm();
                  }}
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Plan Name (tenant)
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      disabled
                      className="w-full px-4 py-2.5 border border-border bg-muted text-muted-foreground rounded-lg cursor-not-allowed"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Cannot be changed</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Display Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.displayName}
                      onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                      className="w-full px-4 py-2.5 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-brand-mid-pink focus:border-brand-mid-pink"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2.5 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-brand-mid-pink focus:border-brand-mid-pink"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">Price</label>
                    <input
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                      min="0"
                      step="0.01"
                      className="w-full px-4 py-2.5 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-brand-mid-pink focus:border-brand-mid-pink"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">Billing Interval</label>
                    <select
                      value={formData.billingInterval}
                      onChange={(e) => setFormData({ ...formData, billingInterval: e.target.value as 'MONTHLY' | 'YEARLY' })}
                      className="w-full px-4 py-2.5 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-brand-mid-pink focus:border-brand-mid-pink"
                    >
                      <option value="MONTHLY">Monthly</option>
                      <option value="YEARLY">Yearly</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">Max Members</label>
                    <input
                      type="number"
                      value={formData.maxMembers}
                      onChange={(e) => setFormData({ ...formData, maxMembers: parseInt(e.target.value) || 1 })}
                      min="1"
                      className="w-full px-4 py-2.5 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-brand-mid-pink focus:border-brand-mid-pink"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">Max Profiles</label>
                    <input
                      type="number"
                      value={formData.maxProfiles}
                      onChange={(e) => setFormData({ ...formData, maxProfiles: parseInt(e.target.value) || 1 })}
                      min="1"
                      className="w-full px-4 py-2.5 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-brand-mid-pink focus:border-brand-mid-pink"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">Max Workspaces</label>
                    <input
                      type="number"
                      value={formData.maxWorkspaces}
                      onChange={(e) => setFormData({ ...formData, maxWorkspaces: parseInt(e.target.value) || 0 })}
                      min="0"
                      className="w-full px-4 py-2.5 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-brand-mid-pink focus:border-brand-mid-pink"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">Max Storage (GB)</label>
                    <input
                      type="number"
                      value={formData.maxStorageGB}
                      onChange={(e) => setFormData({ ...formData, maxStorageGB: parseInt(e.target.value) || 5 })}
                      min="1"
                      className="w-full px-4 py-2.5 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-brand-mid-pink focus:border-brand-mid-pink"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">Monthly Credits</label>
                    <input
                      type="number"
                      value={formData.monthlyCredits}
                      onChange={(e) => setFormData({ ...formData, monthlyCredits: parseInt(e.target.value) || 100 })}
                      min="0"
                      className="w-full px-4 py-2.5 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-brand-mid-pink focus:border-brand-mid-pink"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isActiveEdit"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="w-4 h-4 text-brand-mid-pink rounded focus:ring-2 focus:ring-brand-mid-pink"
                    />
                    <label htmlFor="isActiveEdit" className="text-sm font-medium text-foreground">
                      Active
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isPublicEdit"
                      checked={formData.isPublic}
                      onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                      className="w-4 h-4 text-brand-blue rounded focus:ring-2 focus:ring-brand-blue"
                    />
                    <label htmlFor="isPublicEdit" className="text-sm font-medium text-foreground">
                      Public
                    </label>
                  </div>
                </div>

                {/* Features Section */}
                <div className="border-t border-border pt-4">
                  <h3 className="text-sm font-semibold text-foreground mb-4">Plan Features & Permissions</h3>
                  <PlanFeaturesEditor features={planFeatures} onChange={setPlanFeatures} />
                </div>
              </div>

              <div className="mt-6 flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowEditPlanModal(false);
                    setSelectedPlan(null);
                    resetForm();
                  }}
                  className="px-5 py-2.5 border border-border rounded-lg text-foreground hover:bg-muted font-medium transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdatePlan}
                  disabled={!formData.displayName}
                  className="px-5 py-2.5 bg-gradient-to-r from-brand-blue to-brand-mid-pink text-white rounded-lg hover:from-brand-blue/90 hover:to-brand-mid-pink/90 font-medium transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-blue/25"
                >
                  Update Plan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
