'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import {
  Pencil,
  Save,
  X,
  FileText,
  MapPin,
  User,
  Heart,
  Briefcase,
  Sparkles,
  BookOpen,
  Scroll,
  Mic2,
  ShieldAlert,
  PenLine,
  Info,
  Eye,
  Calendar,
  Clock,
} from 'lucide-react';

interface OfModelDetails {
  id: string;
  creatorId: string;
  fullBio: string | null;
  backstory: string | null;
  interests: string[];
  occupation: string | null;
  location: string | null;
  age: number | null;
  physicalDescription: string | null;
  voiceDescription: string | null;
  writingStyle: string | null;
  boundaries: string | null;
  funFacts: string[];
  customFields: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

interface OfModel {
  id: string;
  slug: string;
  displayName: string;
}

// Stats card component
function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  color: 'violet' | 'fuchsia' | 'emerald' | 'amber';
}) {
  const colorConfig = {
    violet: {
      bg: 'bg-violet-500/10',
      border: 'border-violet-500/20',
      icon: 'text-violet-400',
      glow: 'shadow-violet-500/5',
    },
    fuchsia: {
      bg: 'bg-fuchsia-500/10',
      border: 'border-fuchsia-500/20',
      icon: 'text-fuchsia-400',
      glow: 'shadow-fuchsia-500/5',
    },
    emerald: {
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      icon: 'text-emerald-400',
      glow: 'shadow-emerald-500/5',
    },
    amber: {
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
      icon: 'text-amber-400',
      glow: 'shadow-amber-500/5',
    },
  };

  const config = colorConfig[color];

  return (
    <div
      className={`relative ${config.bg} border ${config.border} rounded-2xl p-5 shadow-lg ${config.glow} overflow-hidden group`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent" />
      <div className="relative flex items-center gap-4">
        <div className={`p-3 ${config.bg} rounded-xl`}>
          <Icon className={`w-5 h-5 ${config.icon}`} />
        </div>
        <div>
          <p className="text-sm text-zinc-500 font-medium">{label}</p>
          <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
        </div>
      </div>
    </div>
  );
}

// Section component
function Section({
  icon: Icon,
  title,
  children,
  accent = 'violet',
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
  accent?: 'violet' | 'fuchsia' | 'pink' | 'amber' | 'emerald' | 'red';
}) {
  const accentConfig = {
    violet: 'from-violet-500 to-violet-600',
    fuchsia: 'from-fuchsia-500 to-fuchsia-600',
    pink: 'from-pink-500 to-pink-600',
    amber: 'from-amber-500 to-amber-600',
    emerald: 'from-emerald-500 to-emerald-600',
    red: 'from-red-500 to-red-600',
  };

  return (
    <div className="relative bg-zinc-900/50 border border-zinc-800/50 rounded-2xl overflow-hidden">
      <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${accentConfig[accent]}`} />
      <div className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-zinc-800/50 rounded-lg">
            <Icon className="w-4 h-4 text-zinc-400" />
          </div>
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">{title}</h3>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function OfModelDetailsPage() {
  const params = useParams();
  const tenant = params.tenant as string;
  const [model, setModel] = useState<OfModel | null>(null);
  const [details, setDetails] = useState<OfModelDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    if (slug) {
      loadModel();
    }
  }, [slug]);

  const loadModel = async () => {
    try {
      const response = await fetch(`/api/of-models/`);
      if (response.ok) {
        const result = await response.json();
        setModel(result.data);
        loadDetails(result.data.id);
      }
    } catch (error) {
      console.error('Error loading model:', error);
      setLoading(false);
    }
  };

  const loadDetails = async (modelId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/of-models/${modelId}/details`);
      if (response.ok) {
        const result = await response.json();
        setDetails(result.data);
      }
    } catch (error) {
      console.error('Error loading details:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Stats skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-5 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 bg-zinc-800 rounded-xl" />
                <div className="space-y-2">
                  <div className="h-3 w-16 bg-zinc-800 rounded" />
                  <div className="h-6 w-12 bg-zinc-800 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
        {/* Content skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-6 animate-pulse">
              <div className="h-4 w-32 bg-zinc-800 rounded mb-4" />
              <div className="space-y-2">
                <div className="h-3 w-full bg-zinc-800 rounded" />
                <div className="h-3 w-4/5 bg-zinc-800 rounded" />
                <div className="h-3 w-3/5 bg-zinc-800 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const hasDetails =
    details &&
    (details.fullBio ||
      details.backstory ||
      details.interests?.length > 0 ||
      details.occupation ||
      details.location ||
      details.age ||
      details.physicalDescription ||
      details.voiceDescription ||
      details.writingStyle ||
      details.boundaries ||
      details.funFacts?.length > 0);

  // Calculate stats
  const filledSections = [
    details?.fullBio,
    details?.backstory,
    details?.interests?.length,
    details?.occupation || details?.location || details?.age,
    details?.physicalDescription,
    details?.voiceDescription,
    details?.writingStyle,
    details?.boundaries,
    details?.funFacts?.length,
  ].filter(Boolean).length;

  const totalInterests = details?.interests?.length || 0;
  const totalFunFacts = details?.funFacts?.length || 0;

  return (
    <>
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={FileText}
            label="Sections Filled"
            value={`${filledSections}/9`}
            color="violet"
          />
          <StatCard icon={Heart} label="Interests" value={totalInterests} color="fuchsia" />
          <StatCard icon={Sparkles} label="Fun Facts" value={totalFunFacts} color="amber" />
          <StatCard
            icon={Eye}
            label="Completeness"
            value={`${Math.round((filledSections / 9) * 100)}%`}
            color="emerald"
          />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Extended Details</h2>
            <p className="text-sm text-zinc-500 mt-1">Character and persona information</p>
          </div>
          <button
            onClick={() => setShowEditModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-sm font-medium rounded-xl transition-all duration-200 shadow-lg shadow-violet-500/25"
          >
            <Pencil className="w-4 h-4" />
            {hasDetails ? 'Edit Details' : 'Add Details'}
          </button>
        </div>

        {/* Content */}
        {!hasDetails ? (
          <div className="relative bg-zinc-900/50 border border-zinc-800/50 rounded-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-fuchsia-500/5" />
            <div className="relative text-center py-16 px-6">
              <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 rounded-2xl flex items-center justify-center">
                <FileText className="w-8 h-8 text-violet-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">No extended details yet</h3>
              <p className="text-zinc-400 mb-8 max-w-md mx-auto">
                Add backstory, interests, physical descriptions, and other persona details to bring
                this model to life.
              </p>
              <button
                onClick={() => setShowEditModal(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-medium rounded-xl transition-all duration-200 shadow-lg shadow-violet-500/25"
              >
                <Pencil className="w-5 h-5" />
                Add Details
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Basic Info Cards */}
            {(details.age || details.occupation || details.location) && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {details.age && (
                  <div className="relative bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-4 group hover:border-violet-500/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-violet-500/10 rounded-lg">
                        <User className="w-5 h-5 text-violet-400" />
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">
                          Age
                        </p>
                        <p className="text-lg font-semibold text-white">{details.age} years old</p>
                      </div>
                    </div>
                  </div>
                )}
                {details.occupation && (
                  <div className="relative bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-4 group hover:border-emerald-500/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-emerald-500/10 rounded-lg">
                        <Briefcase className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">
                          Occupation
                        </p>
                        <p className="text-lg font-semibold text-white">{details.occupation}</p>
                      </div>
                    </div>
                  </div>
                )}
                {details.location && (
                  <div className="relative bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-4 group hover:border-pink-500/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-pink-500/10 rounded-lg">
                        <MapPin className="w-5 h-5 text-pink-400" />
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">
                          Location
                        </p>
                        <p className="text-lg font-semibold text-white">{details.location}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Two Column Grid for Long Content */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Full Bio */}
              {details.fullBio && (
                <Section icon={BookOpen} title="Full Biography" accent="violet">
                  <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap">
                    {details.fullBio}
                  </p>
                </Section>
              )}

              {/* Backstory */}
              {details.backstory && (
                <Section icon={Scroll} title="Backstory" accent="fuchsia">
                  <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap">
                    {details.backstory}
                  </p>
                </Section>
              )}

              {/* Physical Description */}
              {details.physicalDescription && (
                <Section icon={Eye} title="Physical Description" accent="pink">
                  <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap">
                    {details.physicalDescription}
                  </p>
                </Section>
              )}

              {/* Voice Description */}
              {details.voiceDescription && (
                <Section icon={Mic2} title="Voice Description" accent="emerald">
                  <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap">
                    {details.voiceDescription}
                  </p>
                </Section>
              )}

              {/* Writing Style */}
              {details.writingStyle && (
                <Section icon={PenLine} title="Writing Style" accent="violet">
                  <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap">
                    {details.writingStyle}
                  </p>
                </Section>
              )}

              {/* Boundaries */}
              {details.boundaries && (
                <Section icon={ShieldAlert} title="Boundaries" accent="red">
                  <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl">
                    <p className="text-red-300/90 leading-relaxed whitespace-pre-wrap">
                      {details.boundaries}
                    </p>
                  </div>
                </Section>
              )}
            </div>

            {/* Interests */}
            {details.interests && details.interests.length > 0 && (
              <Section icon={Heart} title="Interests" accent="pink">
                <div className="flex flex-wrap gap-2">
                  {details.interests.map((interest, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-pink-500/10 to-fuchsia-500/10 border border-pink-500/20 text-pink-300 rounded-full text-sm font-medium"
                    >
                      <Heart className="w-3 h-3" />
                      {interest}
                    </span>
                  ))}
                </div>
              </Section>
            )}

            {/* Fun Facts */}
            {details.funFacts && details.funFacts.length > 0 && (
              <Section icon={Sparkles} title="Fun Facts" accent="amber">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {details.funFacts.map((fact, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-4 bg-gradient-to-r from-amber-500/5 to-orange-500/5 border border-amber-500/20 rounded-xl group hover:border-amber-500/40 transition-colors"
                    >
                      <div className="p-1.5 bg-amber-500/20 rounded-lg shrink-0 mt-0.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      </div>
                      <p className="text-zinc-300 text-sm leading-relaxed">{fact}</p>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Timestamps */}
            {details.createdAt && (
              <div className="flex flex-wrap items-center gap-6 pt-4 border-t border-zinc-800/50">
                <div className="flex items-center gap-2 text-sm text-zinc-500">
                  <Calendar className="w-4 h-4" />
                  <span>Created: {new Date(details.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-zinc-500">
                  <Clock className="w-4 h-4" />
                  <span>Updated: {new Date(details.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {showEditModal && model && (
        <EditDetailsModal
          modelId={model.id}
          details={details}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false);
            loadDetails(model.id);
          }}
        />
      )}
    </>
  );
}

// Edit Details Modal with Tabs
function EditDetailsModal({
  modelId,
  details,
  onClose,
  onSuccess,
}: {
  modelId: string;
  details: OfModelDetails | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    fullBio: details?.fullBio || '',
    backstory: details?.backstory || '',
    interests: details?.interests?.join(', ') || '',
    occupation: details?.occupation || '',
    location: details?.location || '',
    age: details?.age?.toString() || '',
    physicalDescription: details?.physicalDescription || '',
    voiceDescription: details?.voiceDescription || '',
    writingStyle: details?.writingStyle || '',
    boundaries: details?.boundaries || '',
    funFacts: details?.funFacts?.join('\n') || '',
  });
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [activeSection, setActiveSection] = useState<
    'basic' | 'biography' | 'personality' | 'descriptions' | 'boundaries'
  >('basic');

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
        fullBio: formData.fullBio.trim() || null,
        backstory: formData.backstory.trim() || null,
        interests: formData.interests
          .split(',')
          .map((i) => i.trim())
          .filter(Boolean),
        occupation: formData.occupation.trim() || null,
        location: formData.location.trim() || null,
        age: formData.age ? parseInt(formData.age) : null,
        physicalDescription: formData.physicalDescription.trim() || null,
        voiceDescription: formData.voiceDescription.trim() || null,
        writingStyle: formData.writingStyle.trim() || null,
        boundaries: formData.boundaries.trim() || null,
        funFacts: formData.funFacts
          .split('\n')
          .map((f) => f.trim())
          .filter(Boolean),
      };

      const response = await fetch(`/api/of-models/${modelId}/details`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast.success('Details saved successfully');
        onSuccess();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to save details');
      }
    } catch (error) {
      toast.error('Failed to save details');
    } finally {
      setSaving(false);
    }
  };

  const sections = [
    { id: 'basic', label: 'Basic Info', icon: Info },
    { id: 'biography', label: 'Biography', icon: BookOpen },
    { id: 'personality', label: 'Personality', icon: Heart },
    { id: 'descriptions', label: 'Descriptions', icon: Eye },
    { id: 'boundaries', label: 'Boundaries', icon: ShieldAlert },
  ] as const;

  return createPortal(
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header with gradient */}
        <div className="relative p-6 border-b border-zinc-800">
          <div className="absolute inset-0 bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10" />
          <div className="relative flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Edit Extended Details</h2>
              <p className="text-sm text-zinc-400 mt-1">Update character and persona information</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-zinc-400" />
            </button>
          </div>
        </div>

        {/* Section Tabs */}
        <div className="px-6 pt-4 border-b border-zinc-800 overflow-x-auto">
          <div className="flex gap-1">
            {sections.map((section) => {
              const Icon = section.icon;
              const active = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`relative inline-flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-sm font-medium transition-all ${
                    active
                      ? 'text-white bg-zinc-800'
                      : 'text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {section.label}
                  {active && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-violet-500 to-fuchsia-500" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Basic Info Section */}
            {activeSection === 'basic' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">Age</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input
                        type="number"
                        min="18"
                        max="99"
                        value={formData.age}
                        onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                        className="w-full pl-10 pr-4 py-2.5 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-500 focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 transition-all"
                        placeholder="25"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      Occupation
                    </label>
                    <div className="relative">
                      <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input
                        type="text"
                        value={formData.occupation}
                        onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                        className="w-full pl-10 pr-4 py-2.5 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-500 focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 transition-all"
                        placeholder="Model, Influencer..."
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">Location</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input
                        type="text"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        className="w-full pl-10 pr-4 py-2.5 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-500 focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 transition-all"
                        placeholder="Los Angeles, CA"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Biography Section */}
            {activeSection === 'biography' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Full Bio</label>
                  <textarea
                    value={formData.fullBio}
                    onChange={(e) => setFormData({ ...formData, fullBio: e.target.value })}
                    rows={5}
                    className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-500 focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 transition-all resize-none"
                    placeholder="A comprehensive biography of the persona..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Backstory</label>
                  <textarea
                    value={formData.backstory}
                    onChange={(e) => setFormData({ ...formData, backstory: e.target.value })}
                    rows={5}
                    className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-500 focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 transition-all resize-none"
                    placeholder="The character's history and background..."
                  />
                </div>
              </div>
            )}

            {/* Personality Section */}
            {activeSection === 'personality' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Interests
                    <span className="text-zinc-500 font-normal ml-2">(comma-separated)</span>
                  </label>
                  <div className="relative">
                    <Heart className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
                    <input
                      type="text"
                      value={formData.interests}
                      onChange={(e) => setFormData({ ...formData, interests: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-500 focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 transition-all"
                      placeholder="Music, Travel, Fitness, Photography"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Writing Style
                  </label>
                  <textarea
                    value={formData.writingStyle}
                    onChange={(e) => setFormData({ ...formData, writingStyle: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-500 focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 transition-all resize-none"
                    placeholder="Describe how this persona communicates, their tone, vocabulary, emoji usage..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Fun Facts
                    <span className="text-zinc-500 font-normal ml-2">(one per line)</span>
                  </label>
                  <textarea
                    value={formData.funFacts}
                    onChange={(e) => setFormData({ ...formData, funFacts: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-500 focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 transition-all resize-none"
                    placeholder="Speaks 3 languages&#10;Has a pet cat named Mochi&#10;Loves hiking..."
                  />
                </div>
              </div>
            )}

            {/* Descriptions Section */}
            {activeSection === 'descriptions' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Physical Description
                  </label>
                  <textarea
                    value={formData.physicalDescription}
                    onChange={(e) =>
                      setFormData({ ...formData, physicalDescription: e.target.value })
                    }
                    rows={4}
                    className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-500 focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 transition-all resize-none"
                    placeholder="Physical appearance, features, style..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Voice Description
                  </label>
                  <textarea
                    value={formData.voiceDescription}
                    onChange={(e) => setFormData({ ...formData, voiceDescription: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-500 focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 transition-all resize-none"
                    placeholder="Voice characteristics, accent, speech patterns..."
                  />
                </div>
              </div>
            )}

            {/* Boundaries Section */}
            {activeSection === 'boundaries' && (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 bg-red-500/5 border border-red-500/20 rounded-xl">
                  <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-300/80">
                    Define topics, actions, or behaviors that should be avoided when interacting as
                    this persona.
                  </p>
                </div>
                <textarea
                  value={formData.boundaries}
                  onChange={(e) => setFormData({ ...formData, boundaries: e.target.value })}
                  rows={6}
                  className="w-full px-4 py-3 bg-zinc-800/50 border border-red-500/20 rounded-xl text-white placeholder-zinc-500 focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 transition-all resize-none"
                  placeholder="Topics to avoid, content restrictions, behavioral limits..."
                />
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="sticky bottom-0 bg-zinc-900 border-t border-zinc-800 p-6">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-violet-500/25"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Details
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
