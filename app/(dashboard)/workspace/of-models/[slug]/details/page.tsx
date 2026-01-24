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

export default function OfModelDetailsPage() {
  const params = useParams();
  const slug = params.slug as string;
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
      const response = await fetch(`/api/of-models/${slug}`);
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
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
        <div className="animate-pulse space-y-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const hasDetails = details && (
    details.fullBio ||
    details.backstory ||
    details.interests?.length > 0 ||
    details.occupation ||
    details.location ||
    details.age ||
    details.physicalDescription ||
    details.voiceDescription ||
    details.writingStyle ||
    details.boundaries ||
    details.funFacts?.length > 0
  );

  return (
    <>
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Extended Details
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Additional character and persona information
            </p>
          </div>
          <button
            onClick={() => setShowEditModal(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
          >
            <Pencil className="w-4 h-4" />
            {hasDetails ? 'Edit' : 'Add Details'}
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {!hasDetails ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No extended details yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Add backstory, interests, and other persona details
              </p>
              <button
                onClick={() => setShowEditModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <Pencil className="w-5 h-5" />
                Add Details
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Basic Info */}
              {(details.age || details.occupation || details.location) && (
                <section>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                    Basic Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {details.age && (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <User className="w-5 h-5 text-blue-500" />
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Age</p>
                          <p className="font-medium text-gray-900 dark:text-white">{details.age}</p>
                        </div>
                      </div>
                    )}
                    {details.occupation && (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <Briefcase className="w-5 h-5 text-green-500" />
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Occupation</p>
                          <p className="font-medium text-gray-900 dark:text-white">{details.occupation}</p>
                        </div>
                      </div>
                    )}
                    {details.location && (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <MapPin className="w-5 h-5 text-red-500" />
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Location</p>
                          <p className="font-medium text-gray-900 dark:text-white">{details.location}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Full Bio */}
              {details.fullBio && (
                <section>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                    Full Biography
                  </h3>
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {details.fullBio}
                    </p>
                  </div>
                </section>
              )}

              {/* Backstory */}
              {details.backstory && (
                <section>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                    Backstory
                  </h3>
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {details.backstory}
                    </p>
                  </div>
                </section>
              )}

              {/* Interests */}
              {details.interests && details.interests.length > 0 && (
                <section>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                    Interests
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {details.interests.map((interest, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 rounded-full text-sm"
                      >
                        <Heart className="w-3 h-3" />
                        {interest}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {/* Descriptions */}
              {(details.physicalDescription || details.voiceDescription) && (
                <section>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                    Descriptions
                  </h3>
                  <div className="space-y-4">
                    {details.physicalDescription && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Physical Description
                        </label>
                        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                            {details.physicalDescription}
                          </p>
                        </div>
                      </div>
                    )}
                    {details.voiceDescription && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Voice Description
                        </label>
                        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                            {details.voiceDescription}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Writing Style */}
              {details.writingStyle && (
                <section>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                    Writing Style
                  </h3>
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {details.writingStyle}
                    </p>
                  </div>
                </section>
              )}

              {/* Boundaries */}
              {details.boundaries && (
                <section>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                    Boundaries
                  </h3>
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-red-700 dark:text-red-300 whitespace-pre-wrap">
                      {details.boundaries}
                    </p>
                  </div>
                </section>
              )}

              {/* Fun Facts */}
              {details.funFacts && details.funFacts.length > 0 && (
                <section>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                    Fun Facts
                  </h3>
                  <div className="space-y-2">
                    {details.funFacts.map((fact, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg"
                      >
                        <Sparkles className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                        <p className="text-gray-700 dark:text-gray-300">{fact}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Timestamps */}
              {details.createdAt && (
                <section className="pt-4 border-t border-gray-200 dark:border-gray-800">
                  <div className="flex flex-wrap gap-6 text-sm text-gray-500 dark:text-gray-400">
                    <span>Created: {new Date(details.createdAt).toLocaleString()}</span>
                    <span>Updated: {new Date(details.updatedAt).toLocaleString()}</span>
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
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

// Edit Details Modal
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
        toast.success('Details saved');
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

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-900 flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Edit Extended Details
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Info */}
          <section>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
              Basic Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Age</label>
                <input
                  type="number"
                  min="18"
                  max="99"
                  value={formData.age}
                  onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Occupation</label>
                <input
                  type="text"
                  value={formData.occupation}
                  onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </section>

          {/* Biography */}
          <section>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
              Biography
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Bio</label>
                <textarea
                  value={formData.fullBio}
                  onChange={(e) => setFormData({ ...formData, fullBio: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Backstory</label>
                <textarea
                  value={formData.backstory}
                  onChange={(e) => setFormData({ ...formData, backstory: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </section>

          {/* Personality */}
          <section>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
              Personality
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Interests (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.interests}
                  onChange={(e) => setFormData({ ...formData, interests: e.target.value })}
                  placeholder="Music, Travel, Fitness"
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Writing Style</label>
                <textarea
                  value={formData.writingStyle}
                  onChange={(e) => setFormData({ ...formData, writingStyle: e.target.value })}
                  rows={3}
                  placeholder="Describe how this persona writes messages..."
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </section>

          {/* Descriptions */}
          <section>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
              Descriptions
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Physical Description</label>
                <textarea
                  value={formData.physicalDescription}
                  onChange={(e) => setFormData({ ...formData, physicalDescription: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Voice Description</label>
                <textarea
                  value={formData.voiceDescription}
                  onChange={(e) => setFormData({ ...formData, voiceDescription: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </section>

          {/* Boundaries */}
          <section>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
              Boundaries
            </h3>
            <textarea
              value={formData.boundaries}
              onChange={(e) => setFormData({ ...formData, boundaries: e.target.value })}
              rows={3}
              placeholder="Topics or actions to avoid..."
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
            />
          </section>

          {/* Fun Facts */}
          <section>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
              Fun Facts
            </h3>
            <textarea
              value={formData.funFacts}
              onChange={(e) => setFormData({ ...formData, funFacts: e.target.value })}
              rows={4}
              placeholder="One fact per line..."
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Enter one fun fact per line</p>
          </section>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Details'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
