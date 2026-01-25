'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import {
  Pencil,
  Calendar,
  DollarSign,
  Percent,
  Users,
  MessageSquare,
  Tag,
  Ban,
  FileText,
  Save,
  X,
} from 'lucide-react';

interface OfModel {
  id: string;
  name: string;
  displayName: string;
  slug: string;
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'ARCHIVED';
  profileImageUrl: string | null;
  bio: string | null;
  personalityType: string | null;
  commonTerms: string[];
  commonEmojis: string[];
  restrictedTerms: string[];
  notes: string | null;
  percentageTaken: number | null;
  guaranteedAmount: number | null;
  launchDate: string | null;
  instagramUrl: string | null;
  twitterUrl: string | null;
  tiktokUrl: string | null;
  websiteUrl: string | null;
  profileLinkUrl: string | null;
  referrerName: string | null;
  chattingManagers: string[];
  createdAt: string;
  updatedAt: string;
}

export default function OfModelOverviewPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const [model, setModel] = useState<OfModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    if (slug) {
      loadModel();
    }
  }, [slug]);

  const loadModel = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/of-models/${slug}`);
      if (response.ok) {
        const result = await response.json();
        setModel(result.data);
      }
    } catch (error) {
      console.error('Error loading model:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
        <div className="animate-pulse space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!model) {
    return null;
  }

  return (
    <>
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Model Overview
          </h2>
          <button
            onClick={() => setShowEditModal(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
          >
            <Pencil className="w-4 h-4" />
            Edit
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-8">
          {/* Business Info */}
          <section>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
              Business Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <InfoItem
                icon={<Calendar className="w-5 h-5 text-blue-500" />}
                label="Launch Date"
                value={model.launchDate ? new Date(model.launchDate).toLocaleDateString() : 'Not set'}
              />
              <InfoItem
                icon={<Percent className="w-5 h-5 text-green-500" />}
                label="Percentage Taken"
                value={model.percentageTaken ? `${model.percentageTaken}%` : 'Not set'}
              />
              <InfoItem
                icon={<DollarSign className="w-5 h-5 text-yellow-500" />}
                label="Guaranteed Amount"
                value={model.guaranteedAmount ? `$${model.guaranteedAmount.toLocaleString()}` : 'Not set'}
              />
              <InfoItem
                icon={<Users className="w-5 h-5 text-purple-500" />}
                label="Referrer"
                value={model.referrerName || 'None'}
              />
            </div>
          </section>

          {/* Chatting Managers */}
          {model.chattingManagers && model.chattingManagers.length > 0 && (
            <section>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                Chatting Managers
              </h3>
              <div className="flex flex-wrap gap-2">
                {model.chattingManagers.map((manager, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-sm"
                  >
                    <MessageSquare className="w-3 h-3" />
                    {manager}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Personality & Communication */}
          <section>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
              Personality & Communication
            </h3>
            <div className="space-y-4">
              {model.personalityType && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Personality Type
                  </label>
                  <p className="text-gray-900 dark:text-white">{model.personalityType}</p>
                </div>
              )}

              {model.commonTerms && model.commonTerms.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Common Terms
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {model.commonTerms.map((term, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-sm"
                      >
                        <Tag className="w-3 h-3" />
                        {term}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {model.commonEmojis && model.commonEmojis.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Common Emojis
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {model.commonEmojis.map((emoji, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded text-lg"
                      >
                        {emoji}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {model.restrictedTerms && model.restrictedTerms.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Restricted Terms
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {model.restrictedTerms.map((term, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded text-sm"
                      >
                        <Ban className="w-3 h-3" />
                        {term}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Notes */}
          {model.notes && (
            <section>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                Notes
              </h3>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-gray-400 mt-0.5" />
                  <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {model.notes}
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* Timestamps */}
          <section className="pt-4 border-t border-gray-200 dark:border-gray-800">
            <div className="flex flex-wrap gap-6 text-sm text-gray-500 dark:text-gray-400">
              <span>Created: {new Date(model.createdAt).toLocaleString()}</span>
              <span>Updated: {new Date(model.updatedAt).toLocaleString()}</span>
            </div>
          </section>
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && model && (
        <EditOverviewModal
          model={model}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false);
            loadModel();
          }}
        />
      )}
    </>
  );
}

function InfoItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 mt-0.5">{icon}</div>
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-gray-900 dark:text-white font-medium">{value}</p>
      </div>
    </div>
  );
}

// Edit Overview Modal
function EditOverviewModal({
  model,
  onClose,
  onSuccess,
}: {
  model: OfModel;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    name: model.name,
    displayName: model.displayName,
    slug: model.slug,
    bio: model.bio || '',
    status: model.status,
    personalityType: model.personalityType || '',
    commonTerms: model.commonTerms.join(', '),
    commonEmojis: model.commonEmojis.join(' '),
    restrictedTerms: model.restrictedTerms.join(', '),
    notes: model.notes || '',
    percentageTaken: model.percentageTaken?.toString() || '',
    guaranteedAmount: model.guaranteedAmount?.toString() || '',
    launchDate: model.launchDate ? model.launchDate.split('T')[0] : '',
    instagramUrl: model.instagramUrl || '',
    twitterUrl: model.twitterUrl || '',
    tiktokUrl: model.tiktokUrl || '',
    websiteUrl: model.websiteUrl || '',
    profileLinkUrl: model.profileLinkUrl || '',
    referrerName: model.referrerName || '',
    chattingManagers: model.chattingManagers.join(', '),
  });
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

      const payload = {
        name: formData.name.trim(),
        displayName: formData.displayName.trim(),
        slug: formData.slug.trim(),
        bio: formData.bio.trim() || null,
        status: formData.status,
        personalityType: formData.personalityType.trim() || null,
        commonTerms: formData.commonTerms
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        commonEmojis: formData.commonEmojis
          .split(/\s+/)
          .filter(Boolean),
        restrictedTerms: formData.restrictedTerms
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        notes: formData.notes.trim() || null,
        percentageTaken: formData.percentageTaken
          ? parseFloat(formData.percentageTaken)
          : null,
        guaranteedAmount: formData.guaranteedAmount
          ? parseFloat(formData.guaranteedAmount)
          : null,
        launchDate: formData.launchDate || null,
        instagramUrl: formData.instagramUrl.trim() || null,
        twitterUrl: formData.twitterUrl.trim() || null,
        tiktokUrl: formData.tiktokUrl.trim() || null,
        websiteUrl: formData.websiteUrl.trim() || null,
        profileLinkUrl: formData.profileLinkUrl.trim() || null,
        referrerName: formData.referrerName.trim() || null,
        chattingManagers: formData.chattingManagers
          .split(',')
          .map((m) => m.trim())
          .filter(Boolean),
      };

      const response = await fetch(`/api/of-models/${model.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast.success('Model updated successfully');
        onSuccess();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to update model');
      }
    } catch (error) {
      console.error('Error updating model:', error);
      toast.error('Failed to update model');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-900 p-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Edit Model
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Info */}
          <section>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
              Basic Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Display Name *
                </label>
                <input
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Slug *
                </label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as OfModel['status'] })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="PENDING">Pending</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Bio
              </label>
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
              />
            </div>
          </section>

          {/* Business Info */}
          <section>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
              Business Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Launch Date
                </label>
                <input
                  type="date"
                  value={formData.launchDate}
                  onChange={(e) => setFormData({ ...formData, launchDate: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Referrer Name
                </label>
                <input
                  type="text"
                  value={formData.referrerName}
                  onChange={(e) => setFormData({ ...formData, referrerName: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Percentage Taken (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={formData.percentageTaken}
                  onChange={(e) => setFormData({ ...formData, percentageTaken: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Guaranteed Amount ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.guaranteedAmount}
                  onChange={(e) => setFormData({ ...formData, guaranteedAmount: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Chatting Managers (comma-separated)
              </label>
              <input
                type="text"
                value={formData.chattingManagers}
                onChange={(e) => setFormData({ ...formData, chattingManagers: e.target.value })}
                placeholder="Manager 1, Manager 2"
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
              />
            </div>
          </section>

          {/* Social Links */}
          <section>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
              Social Links
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Instagram URL
                </label>
                <input
                  type="url"
                  value={formData.instagramUrl}
                  onChange={(e) => setFormData({ ...formData, instagramUrl: e.target.value })}
                  placeholder="https://instagram.com/..."
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Twitter URL
                </label>
                <input
                  type="url"
                  value={formData.twitterUrl}
                  onChange={(e) => setFormData({ ...formData, twitterUrl: e.target.value })}
                  placeholder="https://twitter.com/..."
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  TikTok URL
                </label>
                <input
                  type="url"
                  value={formData.tiktokUrl}
                  onChange={(e) => setFormData({ ...formData, tiktokUrl: e.target.value })}
                  placeholder="https://tiktok.com/..."
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Website URL
                </label>
                <input
                  type="url"
                  value={formData.websiteUrl}
                  onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Profile Link URL
                </label>
                <input
                  type="url"
                  value={formData.profileLinkUrl}
                  onChange={(e) => setFormData({ ...formData, profileLinkUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </section>

          {/* Personality */}
          <section>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
              Personality & Communication
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Personality Type
                </label>
                <input
                  type="text"
                  value={formData.personalityType}
                  onChange={(e) => setFormData({ ...formData, personalityType: e.target.value })}
                  placeholder="e.g., Friendly, Flirty, Professional"
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Common Terms (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.commonTerms}
                  onChange={(e) => setFormData({ ...formData, commonTerms: e.target.value })}
                  placeholder="babe, honey, sweetheart"
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Common Emojis (space-separated)
                </label>
                <input
                  type="text"
                  value={formData.commonEmojis}
                  onChange={(e) => setFormData({ ...formData, commonEmojis: e.target.value })}
                  placeholder="😘 💕 🔥"
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Restricted Terms (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.restrictedTerms}
                  onChange={(e) => setFormData({ ...formData, restrictedTerms: e.target.value })}
                  placeholder="Terms to avoid"
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </section>

          {/* Notes */}
          <section>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
              Notes
            </h3>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={4}
              placeholder="Additional notes about this model..."
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
            />
          </section>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
