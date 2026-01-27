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
  Sparkles,
  Clock,
  TrendingUp,
  Heart,
  AlertCircle,
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

const statusConfig: Record<string, { bg: string; text: string; dot: string; border: string }> = {
  ACTIVE: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400', border: 'border-emerald-500/20' },
  INACTIVE: { bg: 'bg-zinc-500/10', text: 'text-zinc-400', dot: 'bg-zinc-400', border: 'border-zinc-500/20' },
  PENDING: { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-400', border: 'border-amber-500/20' },
  ARCHIVED: { bg: 'bg-rose-500/10', text: 'text-rose-400', dot: 'bg-rose-400', border: 'border-rose-500/20' },
};

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
      <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-zinc-800/50">
          <div className="h-7 w-48 bg-zinc-800/50 rounded-lg animate-pulse" />
        </div>
        <div className="p-6 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-zinc-800/30 rounded-xl p-4 animate-pulse">
                <div className="h-4 w-24 bg-zinc-700/50 rounded mb-3" />
                <div className="h-6 w-20 bg-zinc-700/50 rounded" />
              </div>
            ))}
          </div>
          <div className="h-32 bg-zinc-800/30 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!model) {
    return null;
  }

  return (
    <>
      <div className="space-y-6">
        {/* Business Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            icon={<Calendar className="w-5 h-5" />}
            iconColor="text-sky-400"
            iconBg="bg-sky-500/10"
            label="Launch Date"
            value={model.launchDate ? new Date(model.launchDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not set'}
            isEmpty={!model.launchDate}
          />
          <MetricCard
            icon={<Percent className="w-5 h-5" />}
            iconColor="text-emerald-400"
            iconBg="bg-emerald-500/10"
            label="Percentage Taken"
            value={model.percentageTaken ? `${model.percentageTaken}%` : 'Not set'}
            isEmpty={!model.percentageTaken}
          />
          <MetricCard
            icon={<DollarSign className="w-5 h-5" />}
            iconColor="text-amber-400"
            iconBg="bg-amber-500/10"
            label="Guaranteed Amount"
            value={model.guaranteedAmount ? `$${model.guaranteedAmount.toLocaleString()}` : 'Not set'}
            isEmpty={!model.guaranteedAmount}
          />
          <MetricCard
            icon={<Users className="w-5 h-5" />}
            iconColor="text-violet-400"
            iconBg="bg-violet-500/10"
            label="Referrer"
            value={model.referrerName || 'None'}
            isEmpty={!model.referrerName}
          />
        </div>

        {/* Main Content Card */}
        <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-zinc-800/50">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/10">
                <Sparkles className="w-5 h-5 text-violet-400" />
              </div>
              <h2 className="text-lg font-medium text-white">Model Overview</h2>
            </div>
            <button
              onClick={() => setShowEditModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800/50 border border-zinc-700/50 text-zinc-400 hover:text-white hover:border-zinc-600 transition-all"
            >
              <Pencil className="w-4 h-4" />
              <span className="text-sm font-medium">Edit</span>
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-8">
            {/* Chatting Managers */}
            {model.chattingManagers && model.chattingManagers.length > 0 && (
              <Section title="Chatting Managers" icon={<MessageSquare className="w-4 h-4 text-violet-400" />}>
                <div className="flex flex-wrap gap-2">
                  {model.chattingManagers.map((manager, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-violet-500/10 border border-violet-500/20 text-violet-300 rounded-xl text-sm font-medium"
                    >
                      <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center text-xs">
                        {manager.charAt(0).toUpperCase()}
                      </div>
                      {manager}
                    </span>
                  ))}
                </div>
              </Section>
            )}

            {/* Personality & Communication */}
            <Section title="Personality & Communication" icon={<Heart className="w-4 h-4 text-pink-400" />}>
              <div className="space-y-5">
                {model.personalityType ? (
                  <div className="bg-zinc-800/30 rounded-xl p-4">
                    <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                      Personality Type
                    </label>
                    <p className="text-white font-medium">{model.personalityType}</p>
                  </div>
                ) : null}

                {model.commonTerms && model.commonTerms.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
                      Common Terms
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {model.commonTerms.map((term, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-500/10 border border-sky-500/20 text-sky-300 rounded-lg text-sm"
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
                    <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
                      Common Emojis
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {model.commonEmojis.map((emoji, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-4 py-2 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-xl"
                        >
                          {emoji}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {model.restrictedTerms && model.restrictedTerms.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
                      Restricted Terms
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {model.restrictedTerms.map((term, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-lg text-sm"
                        >
                          <Ban className="w-3 h-3" />
                          {term}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {!model.personalityType && (!model.commonTerms || model.commonTerms.length === 0) && (!model.commonEmojis || model.commonEmojis.length === 0) && (!model.restrictedTerms || model.restrictedTerms.length === 0) && (
                  <div className="flex items-center gap-3 p-4 bg-zinc-800/30 rounded-xl text-zinc-500">
                    <AlertCircle className="w-5 h-5" />
                    <span className="text-sm">No personality or communication preferences set</span>
                  </div>
                )}
              </div>
            </Section>

            {/* Notes */}
            {model.notes && (
              <Section title="Notes" icon={<FileText className="w-4 h-4 text-amber-400" />}>
                <div className="bg-zinc-800/30 rounded-xl p-5">
                  <p className="text-zinc-300 whitespace-pre-wrap leading-relaxed">
                    {model.notes}
                  </p>
                </div>
              </Section>
            )}

            {/* Timestamps */}
            <div className="flex flex-wrap gap-6 pt-4 border-t border-zinc-800/50">
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <Clock className="w-4 h-4" />
                <span>Created {new Date(model.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <TrendingUp className="w-4 h-4" />
                <span>Updated {new Date(model.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          </div>
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

function MetricCard({
  icon,
  iconColor,
  iconBg,
  label,
  value,
  isEmpty,
}: {
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  label: string;
  value: string;
  isEmpty?: boolean;
}) {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-5 hover:border-zinc-700/50 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-xl ${iconBg}`}>
          <div className={iconColor}>{icon}</div>
        </div>
      </div>
      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-xl font-medium ${isEmpty ? 'text-zinc-600' : 'text-white'}`}>{value}</p>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">{title}</h3>
      </div>
      {children}
    </section>
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
  const [activeSection, setActiveSection] = useState<'basic' | 'business' | 'social' | 'personality' | 'notes'>('basic');

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
        commonTerms: formData.commonTerms.split(',').map((t) => t.trim()).filter(Boolean),
        commonEmojis: formData.commonEmojis.split(/\s+/).filter(Boolean),
        restrictedTerms: formData.restrictedTerms.split(',').map((t) => t.trim()).filter(Boolean),
        notes: formData.notes.trim() || null,
        percentageTaken: formData.percentageTaken ? parseFloat(formData.percentageTaken) : null,
        guaranteedAmount: formData.guaranteedAmount ? parseFloat(formData.guaranteedAmount) : null,
        launchDate: formData.launchDate || null,
        instagramUrl: formData.instagramUrl.trim() || null,
        twitterUrl: formData.twitterUrl.trim() || null,
        tiktokUrl: formData.tiktokUrl.trim() || null,
        websiteUrl: formData.websiteUrl.trim() || null,
        profileLinkUrl: formData.profileLinkUrl.trim() || null,
        referrerName: formData.referrerName.trim() || null,
        chattingManagers: formData.chattingManagers.split(',').map((m) => m.trim()).filter(Boolean),
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

  const sections = [
    { id: 'basic', label: 'Basic Info' },
    { id: 'business', label: 'Business' },
    { id: 'social', label: 'Social Links' },
    { id: 'personality', label: 'Personality' },
    { id: 'notes', label: 'Notes' },
  ] as const;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-fadeIn">
        {/* Header Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-violet-500 to-transparent" />

        {/* Header */}
        <div className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur-sm border-b border-zinc-800 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/10">
                <Pencil className="w-5 h-5 text-violet-400" />
              </div>
              <h2 className="text-xl font-medium text-white">Edit Model</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Section Tabs */}
          <div className="flex gap-1 mt-4 overflow-x-auto pb-1">
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  activeSection === section.id
                    ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
                }`}
              >
                {section.label}
              </button>
            ))}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(90vh-180px)]">
          <div className="p-6 space-y-6">
            {/* Basic Info Section */}
            {activeSection === 'basic' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Name" required>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition-colors"
                      required
                    />
                  </FormField>
                  <FormField label="Display Name" required>
                    <input
                      type="text"
                      value={formData.displayName}
                      onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                      className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition-colors"
                      required
                    />
                  </FormField>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Slug" required>
                    <div className="flex items-center">
                      <span className="px-4 py-3 bg-zinc-800 border border-r-0 border-zinc-700/50 rounded-l-xl text-zinc-500 text-sm">
                        /of-models/
                      </span>
                      <input
                        type="text"
                        value={formData.slug}
                        onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                        className="flex-1 px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-r-xl text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition-colors"
                        required
                      />
                    </div>
                  </FormField>
                  <FormField label="Status">
                    <div className="flex flex-wrap gap-2">
                      {(['ACTIVE', 'INACTIVE', 'PENDING', 'ARCHIVED'] as const).map((status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => setFormData({ ...formData, status })}
                          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                            formData.status === status
                              ? `${statusConfig[status].bg} ${statusConfig[status].text} border ${statusConfig[status].border}`
                              : 'bg-zinc-800/50 border border-zinc-700/50 text-zinc-500 hover:text-zinc-400'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${statusConfig[status].dot}`} />
                          {status.charAt(0) + status.slice(1).toLowerCase()}
                        </button>
                      ))}
                    </div>
                  </FormField>
                </div>

                <FormField label="Bio">
                  <textarea
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition-colors resize-none"
                    placeholder="Short biography..."
                  />
                </FormField>
              </div>
            )}

            {/* Business Section */}
            {activeSection === 'business' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Launch Date">
                    <input
                      type="date"
                      value={formData.launchDate}
                      onChange={(e) => setFormData({ ...formData, launchDate: e.target.value })}
                      className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white focus:outline-none focus:border-violet-500/50 transition-colors"
                    />
                  </FormField>
                  <FormField label="Referrer Name">
                    <input
                      type="text"
                      value={formData.referrerName}
                      onChange={(e) => setFormData({ ...formData, referrerName: e.target.value })}
                      className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition-colors"
                      placeholder="Who referred this model?"
                    />
                  </FormField>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Percentage Taken (%)">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={formData.percentageTaken}
                      onChange={(e) => setFormData({ ...formData, percentageTaken: e.target.value })}
                      className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition-colors"
                      placeholder="e.g. 30"
                    />
                  </FormField>
                  <FormField label="Guaranteed Amount ($)">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.guaranteedAmount}
                      onChange={(e) => setFormData({ ...formData, guaranteedAmount: e.target.value })}
                      className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition-colors"
                      placeholder="e.g. 5000"
                    />
                  </FormField>
                </div>

                <FormField label="Chatting Managers" hint="Comma-separated list">
                  <input
                    type="text"
                    value={formData.chattingManagers}
                    onChange={(e) => setFormData({ ...formData, chattingManagers: e.target.value })}
                    placeholder="Manager 1, Manager 2, Manager 3"
                    className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition-colors"
                  />
                </FormField>
              </div>
            )}

            {/* Social Links Section */}
            {activeSection === 'social' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Instagram">
                    <input
                      type="text"
                      value={formData.instagramUrl}
                      onChange={(e) => setFormData({ ...formData, instagramUrl: e.target.value })}
                      placeholder="@username or full URL"
                      className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition-colors"
                    />
                  </FormField>
                  <FormField label="Twitter">
                    <input
                      type="text"
                      value={formData.twitterUrl}
                      onChange={(e) => setFormData({ ...formData, twitterUrl: e.target.value })}
                      placeholder="@username or full URL"
                      className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition-colors"
                    />
                  </FormField>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="TikTok">
                    <input
                      type="text"
                      value={formData.tiktokUrl}
                      onChange={(e) => setFormData({ ...formData, tiktokUrl: e.target.value })}
                      placeholder="@username or full URL"
                      className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition-colors"
                    />
                  </FormField>
                  <FormField label="Website">
                    <input
                      type="url"
                      value={formData.websiteUrl}
                      onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                      placeholder="https://..."
                      className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition-colors"
                    />
                  </FormField>
                </div>

                <FormField label="Profile Link">
                  <input
                    type="url"
                    value={formData.profileLinkUrl}
                    onChange={(e) => setFormData({ ...formData, profileLinkUrl: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition-colors"
                  />
                </FormField>
              </div>
            )}

            {/* Personality Section */}
            {activeSection === 'personality' && (
              <div className="space-y-5">
                <FormField label="Personality Type">
                  <input
                    type="text"
                    value={formData.personalityType}
                    onChange={(e) => setFormData({ ...formData, personalityType: e.target.value })}
                    placeholder="e.g., Friendly, Flirty, Professional"
                    className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition-colors"
                  />
                </FormField>

                <FormField label="Common Terms" hint="Comma-separated">
                  <input
                    type="text"
                    value={formData.commonTerms}
                    onChange={(e) => setFormData({ ...formData, commonTerms: e.target.value })}
                    placeholder="babe, honey, sweetheart"
                    className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition-colors"
                  />
                </FormField>

                <FormField label="Common Emojis" hint="Space-separated">
                  <input
                    type="text"
                    value={formData.commonEmojis}
                    onChange={(e) => setFormData({ ...formData, commonEmojis: e.target.value })}
                    placeholder="😘 💕 🔥 💋"
                    className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition-colors"
                  />
                </FormField>

                <FormField label="Restricted Terms" hint="Comma-separated terms to avoid">
                  <input
                    type="text"
                    value={formData.restrictedTerms}
                    onChange={(e) => setFormData({ ...formData, restrictedTerms: e.target.value })}
                    placeholder="Terms to avoid in communication"
                    className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition-colors"
                  />
                </FormField>
              </div>
            )}

            {/* Notes Section */}
            {activeSection === 'notes' && (
              <FormField label="Notes">
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={8}
                  placeholder="Additional notes about this model..."
                  className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition-colors resize-none"
                />
              </FormField>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-zinc-900/95 backdrop-blur-sm border-t border-zinc-800 p-5">
            <div className="flex gap-3">
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
                className="flex-1 relative px-4 py-3 rounded-xl font-medium text-white overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-fuchsia-600" />
                <span className="relative flex items-center justify-center gap-2">
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

function FormField({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <label className="block text-sm font-medium text-zinc-400">
          {label} {required && <span className="text-rose-400">*</span>}
        </label>
        {hint && <span className="text-xs text-zinc-600">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
