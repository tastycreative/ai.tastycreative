'use client';

import { memo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Save,
  FolderOpen,
  Trash2,
  Star,
  StarOff,
  Clock,
  CheckCircle2,
  X,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Template {
  id: string;
  name: string;
  description?: string;
  data: any;
  isFavorite: boolean;
  createdAt: Date;
  lastUsed?: Date;
  usageCount: number;
}

interface TemplateManagerProps {
  currentData: any;
  onLoadTemplate: (data: any) => void;
  onSaveTemplate?: (template: Template) => void;
}

export const TemplateManager = memo(function TemplateManager({
  currentData,
  onLoadTemplate,
  onSaveTemplate,
}: TemplateManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templates, setTemplates] = useState<Template[]>([
    // Demo templates - replace with API call
    {
      id: '1',
      name: 'Standard Photo Post',
      description: 'Quick template for regular photo posts',
      data: {
        submissionType: 'otp',
        contentStyle: 'normal',
        platform: 'onlyfans',
        selectedComponents: ['upload'],
      },
      isFavorite: true,
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      lastUsed: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      usageCount: 15,
    },
    {
      id: '2',
      name: 'PTR Video Bundle',
      description: 'Pay-to-release video bundle with pricing',
      data: {
        submissionType: 'ptr',
        contentStyle: 'bundle',
        platform: 'onlyfans',
        selectedComponents: ['release', 'pricing', 'upload'],
      },
      isFavorite: false,
      createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      lastUsed: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      usageCount: 8,
    },
  ]);

  const handleSaveTemplate = useCallback(() => {
    if (!templateName.trim()) {
      alert('Please enter a template name');
      return;
    }

    const newTemplate: Template = {
      id: Date.now().toString(),
      name: templateName,
      description: templateDescription,
      data: currentData,
      isFavorite: false,
      createdAt: new Date(),
      usageCount: 0,
    };

    setTemplates((prev) => [newTemplate, ...prev]);
    setShowSaveDialog(false);
    setTemplateName('');
    setTemplateDescription('');

    if (onSaveTemplate) {
      onSaveTemplate(newTemplate);
    }
  }, [templateName, templateDescription, currentData, onSaveTemplate]);

  const handleLoadTemplate = useCallback(
    (template: Template) => {
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === template.id
            ? {
                ...t,
                lastUsed: new Date(),
                usageCount: t.usageCount + 1,
              }
            : t
        )
      );
      onLoadTemplate(template.data);
      setIsOpen(false);
    },
    [onLoadTemplate]
  );

  const toggleFavorite = useCallback((id: string) => {
    setTemplates((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, isFavorite: !t.isFavorite } : t
      )
    );
  }, []);

  const deleteTemplate = useCallback((id: string) => {
    if (confirm('Are you sure you want to delete this template?')) {
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    }
  }, []);

  const sortedTemplates = [...templates].sort((a, b) => {
    if (a.isFavorite && !b.isFavorite) return -1;
    if (!a.isFavorite && b.isFavorite) return 1;
    return b.usageCount - a.usageCount;
  });

  return (
    <>
      {/* Trigger Buttons */}
      <div className="flex items-center gap-2">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowSaveDialog(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900/50 border border-zinc-700/50 text-zinc-300 hover:border-brand-light-pink hover:text-white transition-colors"
        >
          <Save className="w-4 h-4" />
          <span className="hidden sm:inline">Save as Template</span>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900/50 border border-zinc-700/50 text-zinc-300 hover:border-brand-blue hover:text-white transition-colors"
        >
          <FolderOpen className="w-4 h-4" />
          <span className="hidden sm:inline">Load Template</span>
          {templates.length > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-brand-blue/20 text-brand-blue rounded-full">
              {templates.length}
            </span>
          )}
        </motion.button>
      </div>

      {/* Save Template Dialog */}
      <AnimatePresence>
        {showSaveDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setShowSaveDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-md w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Save className="w-5 h-5 text-brand-light-pink" />
                  Save Template
                </h3>
                <button
                  onClick={() => setShowSaveDialog(false)}
                  className="text-zinc-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Template Name <span className="text-brand-light-pink">*</span>
                  </label>
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="e.g., Standard Photo Post"
                    className="w-full px-4 py-3 rounded-xl bg-zinc-800/50 border border-zinc-700/50 text-white placeholder-zinc-500 focus:border-brand-light-pink focus:ring-2 focus:ring-brand-light-pink/20 transition-all"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Description (Optional)
                  </label>
                  <textarea
                    value={templateDescription}
                    onChange={(e) => setTemplateDescription(e.target.value)}
                    placeholder="What is this template for?"
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl bg-zinc-800/50 border border-zinc-700/50 text-white placeholder-zinc-500 focus:border-brand-light-pink focus:ring-2 focus:ring-brand-light-pink/20 transition-all resize-none"
                  />
                </div>

                <div className="flex items-center gap-3 pt-4">
                  <button
                    onClick={handleSaveTemplate}
                    disabled={!templateName.trim()}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-brand-light-pink to-brand-dark-pink text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="w-4 h-4" />
                    Save Template
                  </button>
                  <button
                    onClick={() => setShowSaveDialog(false)}
                    className="px-4 py-3 rounded-xl border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Load Template Dialog */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <FolderOpen className="w-5 h-5 text-brand-blue" />
                  Load Template
                </h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-zinc-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {templates.length === 0 ? (
                <div className="py-12 text-center">
                  <FolderOpen className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                  <p className="text-zinc-400">No templates saved yet</p>
                  <p className="text-sm text-zinc-600 mt-2">
                    Save your current form as a template to reuse later
                  </p>
                </div>
              ) : (
                <div className="space-y-3 overflow-y-auto">
                  <AnimatePresence mode="popLayout">
                    {sortedTemplates.map((template) => (
                      <motion.div
                        key={template.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -100 }}
                        className="group relative bg-zinc-800/30 border border-zinc-700/50 rounded-xl p-4 hover:border-brand-blue/50 hover:bg-zinc-800/50 transition-all cursor-pointer"
                        onClick={() => handleLoadTemplate(template)}
                      >
                        <div className="flex items-start gap-4">
                          {/* Icon */}
                          <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br from-brand-light-pink/20 to-brand-blue/20 flex items-center justify-center">
                            <FolderOpen className="w-6 h-6 text-brand-blue" />
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-white truncate">
                                {template.name}
                              </h4>
                              {template.isFavorite && (
                                <Star className="w-4 h-4 text-yellow-500 fill-current flex-shrink-0" />
                              )}
                            </div>
                            {template.description && (
                              <p className="text-sm text-zinc-400 mb-2">
                                {template.description}
                              </p>
                            )}
                            <div className="flex items-center gap-4 text-xs text-zinc-500">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {template.lastUsed
                                  ? `Used ${formatDistanceToNow(template.lastUsed, { addSuffix: true })}`
                                  : `Created ${formatDistanceToNow(template.createdAt, { addSuffix: true })}`}
                              </span>
                              <span>•</span>
                              <span>{template.usageCount} uses</span>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFavorite(template.id);
                              }}
                              className="p-2 rounded-lg hover:bg-zinc-700 text-zinc-400 hover:text-yellow-500 transition-colors"
                              title={template.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                            >
                              {template.isFavorite ? (
                                <Star className="w-4 h-4 fill-current" />
                              ) : (
                                <StarOff className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteTemplate(template.id);
                              }}
                              className="p-2 rounded-lg hover:bg-zinc-700 text-zinc-400 hover:text-red-500 transition-colors"
                              title="Delete template"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});
