'use client';

import { useState, useEffect } from 'react';
import { X, Save, Shield, Loader2 } from 'lucide-react';
import PlanFeaturesEditor from './PlanFeaturesEditor';

interface CustomOrganizationPermission {
  id: string;
  organizationId: string;
  hasGenerateTab: boolean | null;
  hasVaultTab: boolean | null;
  hasTrainingTab: boolean | null;
  hasInstagramTab: boolean | null;
  hasPlanningTab: boolean | null;
  hasPipelineTab: boolean | null;
  hasAnalyticsTab: boolean | null;
  hasFeedTab: boolean | null;
  hasMarketplaceTab: boolean | null;
  canTextToImage: boolean | null;
  canImageToVideo: boolean | null;
  canImageToImage: boolean | null;
  canTextToVideo: boolean | null;
  canFaceSwap: boolean | null;
  canFluxKontext: boolean | null;
  canVideoFpsBoost: boolean | null;
  canSkinEnhancement: boolean | null;
  canStyleTransfer: boolean | null;
  canSkinEnhancer: boolean | null;
  canImageToImageSkinEnhancer: boolean | null;
  canSeeDreamTextToImage: boolean | null;
  canSeeDreamImageToImage: boolean | null;
  canSeeDreamTextToVideo: boolean | null;
  canSeeDreamImageToVideo: boolean | null;
  canKlingTextToVideo: boolean | null;
  canKlingImageToVideo: boolean | null;
  canKlingMultiImageToVideo: boolean | null;
  canKlingMotionControl: boolean | null;
  canTrainLoRA: boolean | null;
  canShareLoRA: boolean | null;
  canAccessMarketplace: boolean | null;
  canAutoSchedule: boolean | null;
  canBulkUpload: boolean | null;
  canCaptionBank: boolean | null;
  canHashtagBank: boolean | null;
  canStoryPlanner: boolean | null;
  canReelPlanner: boolean | null;
  canFeedPostPlanner: boolean | null;
  canContentPipeline: boolean | null;
  canPerformanceMetrics: boolean | null;
  canShareFolders: boolean | null;
  canCreateFolders: boolean | null;
  maxVaultFolders: number | null;
  canApproveContent: boolean | null;
  canCommentOnContent: boolean | null;
  canAssignTasks: boolean | null;
  canMentionTeam: boolean | null;
  canExportData: boolean | null;
  canAccessAPI: boolean | null;
  canWhiteLabel: boolean | null;
  canCustomBranding: boolean | null;
  canWebhooks: boolean | null;
}

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
  const [permissions, setPermissions] = useState<Partial<CustomOrganizationPermission>>({});

  useEffect(() => {
    fetchPermissions();
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
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 max-w-4xl w-full">
            <div className="flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
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
          className="relative bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-xl shadow-2xl p-6 max-w-6xl w-full border border-gray-200 dark:border-gray-700 my-8 max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Shield className="w-6 h-6 text-blue-600" />
                Permissions
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{organizationName}</p>
              {(permissions as any)?._planName && (
                <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg text-sm border border-blue-200 dark:border-blue-800">
                  <span className="font-medium">Plan:</span>
                  <span>{(permissions as any)._planName}</span>
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Note:</strong> These permissions are based on the organization's subscription plan.
              Any changes you make here will override the plan defaults for this specific organization.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {/* Permissions Grid - Use the same editor as Plans */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <PlanFeaturesEditor
              features={permissions as Record<string, boolean | number | null>}
              onChange={handlePermissionsChange}
            />
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 flex gap-3 justify-end">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium transition-all active:scale-95 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 font-medium transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-blue-500/25 flex items-center gap-2"
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
