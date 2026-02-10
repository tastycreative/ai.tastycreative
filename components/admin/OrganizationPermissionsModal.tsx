'use client';

import { useState, useEffect } from 'react';
import { X, Save, Shield, Loader2 } from 'lucide-react';
import PlanFeaturesEditor from './PlanFeaturesEditor';

// No need for a rigid interface - permissions are now dynamic JSON
// Any permission from PLAN_FEATURES can be used

interface OrganizationPermissionsModalProps {
  organizationId: string;
  organizationName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function OrganizationPermissionsModal({
  organizationId,
  organizationName,
  onClose,
  onSuccess,
}: OrganizationPermissionsModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<Record<string, boolean | number | null>>({});

  useEffect(() => {
    fetchPermissions();
    // Scroll to top when modal opens
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Also scroll the modal content to top
    setTimeout(() => {
      const modalContent = document.querySelector('[data-modal-content]');
      if (modalContent) {
        modalContent.scrollTop = 0;
      }
    }, 100);
  }, [organizationId]);

  const fetchPermissions = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/organizations/${organizationId}/permissions`);
      const data = await response.json();

      if (data.success) {
        setPermissions(data.permissions);
      } else {
        setError(data.error || 'Failed to fetch permissions');
      }
    } catch (err) {
      console.error('Error fetching permissions:', err);
      setError('Failed to fetch permissions');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const response = await fetch(`/api/admin/organizations/${organizationId}/permissions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(permissions),
      });

      const data = await response.json();

      if (data.success) {
        onSuccess();
        onClose();
      } else {
        setError(data.error || 'Failed to update permissions');
      }
    } catch (err) {
      console.error('Error updating permissions:', err);
      setError('Failed to update permissions');
    } finally {
      setSaving(false);
    }
  };

  const handlePermissionsChange = (newPermissions: Record<string, boolean | number | null>) => {
    setPermissions(newPermissions);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm">
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="relative bg-card border border-border rounded-xl shadow-2xl p-8 max-w-4xl w-full">
            <div className="flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-[#EC67A1] animate-spin" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="flex min-h-screen items-center justify-center p-4">
        <div
          className="relative bg-card border border-border rounded-xl shadow-2xl p-6 max-w-6xl w-full my-8 max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
          data-modal-content
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
            <div>
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Shield className="w-6 h-6 text-[#5DC3F8]" />
                Permissions
              </h2>
              <p className="text-sm text-muted-foreground mt-1">{organizationName}</p>
              {(permissions as any)?._planName && (
                <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-background border border-[#5DC3F8]/30 text-foreground rounded-lg text-sm">
                  <span className="font-medium">Plan:</span>
                  <span>{(permissions as any)._planName}</span>
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          <div className="mb-4 p-4 bg-blue-50/50 dark:bg-blue-950/30 border border-[#5DC3F8]/30 rounded-lg">
            <p className="text-sm text-foreground">
              <strong>Note:</strong> These permissions are based on the organization's subscription plan.
              Any changes you make here will override the plan defaults for this specific organization.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50/50 dark:bg-red-950/30 border border-red-500/30 rounded-lg">
              <p className="text-sm text-foreground">{error}</p>
            </div>
          )}

          {/* Permissions Grid - Use the same editor as Plans */}
          <div className="border-t border-border pt-4">
            <PlanFeaturesEditor
              features={permissions as Record<string, boolean | number | null>}
              onChange={handlePermissionsChange}
            />
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-border flex gap-3 justify-end">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-5 py-2.5 border border-border rounded-lg text-foreground hover:bg-muted font-medium transition-all active:scale-95 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2.5 bg-gradient-to-r from-[#5DC3F8] to-[#EC67A1] text-white rounded-lg hover:from-[#5DC3F8]/90 hover:to-[#EC67A1]/90 font-medium transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-[#5DC3F8]/25 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Permissions
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
