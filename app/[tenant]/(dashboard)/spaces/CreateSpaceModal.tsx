'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { LayoutPanelLeft, X } from 'lucide-react';
import { useCreateSpace, type SpaceTemplateType } from '@/lib/hooks/useSpaces.query';

interface CreateSpaceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TemplateOption {
  id: SpaceTemplateType;
  name: string;
  description: string;
  details: string;
}

const TEMPLATES: TemplateOption[] = [
  {
    id: 'KANBAN',
    name: 'General Kanban board',
    description: 'Visual workflow with To Do, In Progress, and Done columns.',
    details:
      'Perfect for tracking creative production, campaign tasks, or team workflows. Start with three core columns and customize as you go.',
  },
];

export function CreateSpaceModal({ isOpen, onClose }: CreateSpaceModalProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<SpaceTemplateType>('KANBAN');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);
  const [mounted, setMounted] = useState(false);

  const { mutateAsync: createSpace, isPending } = useCreateSpace();

  const selectedTemplate = TEMPLATES.find((t) => t.id === selectedTemplateId) ?? TEMPLATES[0];

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
    }
  }, [isOpen]);

  if (!mounted || (!isOpen && !isAnimating)) {
    return null;
  }

  const handleSave = async () => {
    if (!name.trim()) return;

    try {
      await createSpace({
        name: name.trim(),
        description: description.trim() || undefined,
        templateType: selectedTemplateId,
      });
      setName('');
      setDescription('');
      handleClose();
    } catch (error) {
      console.error('Failed to create space', error);
    }
  };

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  return createPortal(
    <div
      className={`fixed inset-0 z-9999 bg-black/60 backdrop-blur-md transition-opacity duration-500 ${
        isOpen && isAnimating ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={handleClose}
    >
      <div
        className={`relative w-full h-full bg-white dark:bg-gray-950 shadow-2xl border-r border-gray-200 dark:border-brand-mid-pink/20 overflow-hidden transform transition-transform duration-500 ease-out ${
          isOpen && isAnimating ? 'translate-x-0' : '-translate-x-full'
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="absolute inset-0 pointer-events-none opacity-30">
          <div className="absolute top-0 left-0 w-96 h-96 bg-brand-light-pink/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-brand-blue/20 rounded-full blur-3xl" />
        </div>

        <div className="relative flex h-full flex-col max-w-7xl mx-auto">
          <header className="flex items-center justify-between border-b border-gray-200 dark:border-brand-mid-pink/20 px-6 sm:px-8 lg:px-12 py-5 sm:py-6">
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-brand-off-white">
                Create a new Space
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                Choose a template and configure the basics. You can change structure later.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 dark:border-brand-mid-pink/30 bg-white/80 dark:bg-gray-900/80 text-gray-500 hover:text-gray-900 dark:hover:text-brand-off-white hover:border-brand-light-pink/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light-pink"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="flex-1 grid grid-cols-1 lg:grid-cols-[0.42fr_0.58fr] divide-y lg:divide-y-0 lg:divide-x divide-gray-200 dark:divide-brand-mid-pink/20 overflow-hidden">
            {/* Left column: selected template info and basic fields */}
            <div className="relative h-full bg-gray-50/70 dark:bg-gray-950/80 px-6 sm:px-8 lg:px-12 py-6 sm:py-8 overflow-y-auto custom-scrollbar">
              <div className="inline-flex items-center gap-2 rounded-full bg-brand-light-pink/10 text-brand-light-pink px-3 py-1 text-xs font-medium mb-4">
                <LayoutPanelLeft className="h-4 w-4" />
                Selected template
              </div>

              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-brand-off-white mb-1.5">
                {selectedTemplate.name}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                {selectedTemplate.description}
              </p>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-6">
                {selectedTemplate.details}
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">
                    Space name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="e.g. Content Production, Influencer Ops"
                    className="w-full rounded-xl border border-gray-200 dark:border-brand-mid-pink/30 bg-white/80 dark:bg-gray-900/80 px-3 py-2.5 text-sm text-gray-900 dark:text-brand-off-white placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light-pink"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">
                    Description (optional)
                  </label>
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={4}
                    placeholder="Briefly describe what this space is used for."
                    className="w-full rounded-xl border border-gray-200 dark:border-brand-mid-pink/30 bg-white/80 dark:bg-gray-900/80 px-3 py-2.5 text-sm text-gray-900 dark:text-brand-off-white placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light-pink resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Right column: template selection */}
            <div className="relative h-full bg-white/95 dark:bg-gray-950/90 px-6 sm:px-8 lg:px-12 py-6 sm:py-8 overflow-y-auto custom-scrollbar">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-brand-off-white mb-3">
                Choose a template
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
                Start with a Kanban board template today. More templates are coming soon.
              </p>

              <div className="space-y-3 mb-6">
                {TEMPLATES.map((template) => {
                  const isSelected = template.id === selectedTemplateId;

                  return (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => setSelectedTemplateId(template.id)}
                      className={[
                        'w-full text-left rounded-2xl border px-4 py-3 sm:px-5 sm:py-4 transition-all bg-white/90 dark:bg-gray-900/80',
                        isSelected
                          ? 'border-brand-light-pink ring-2 ring-brand-light-pink/40 shadow-lg shadow-brand-light-pink/20'
                          : 'border-gray-200 dark:border-brand-mid-pink/30 hover:border-brand-light-pink/70 hover:shadow-md',
                      ].join(' ')}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">
                          <span
                            className={[
                              'inline-flex h-8 w-8 items-center justify-center rounded-xl border text-xs font-semibold',
                              isSelected
                                ? 'border-brand-light-pink bg-brand-light-pink/10 text-brand-light-pink'
                                : 'border-gray-200 dark:border-brand-mid-pink/30 text-gray-500 dark:text-gray-300',
                            ].join(' ')}
                          >
                            KB
                          </span>
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-brand-off-white mb-1">
                            {template.name}
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {template.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-gray-200 dark:border-brand-mid-pink/20 pt-4 mt-auto">
                <button
                  type="button"
                  onClick={handleClose}
                  className="inline-flex items-center justify-center rounded-xl border border-gray-200 dark:border-brand-mid-pink/30 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white/90 dark:bg-gray-900/80 hover:bg-gray-50 dark:hover:bg-gray-900"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!name.trim() || isPending}
                  className="inline-flex items-center justify-center rounded-xl bg-brand-light-pink px-4 py-2 text-sm font-semibold text-brand-off-white shadow-md shadow-brand-light-pink/30 hover:bg-brand-mid-pink disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {isPending ? 'Creating…' : 'Create Space'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

