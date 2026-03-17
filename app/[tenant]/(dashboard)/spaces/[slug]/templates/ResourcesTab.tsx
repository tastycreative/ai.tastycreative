'use client';

import { useState } from 'react';
import { ExternalLink, Plus, Pencil, Trash2, Link2, X, Check, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import {
  useWorkspaceResources,
  useCreateResource,
  useUpdateResource,
  useDeleteResource,
  type WorkspaceResource,
} from '@/lib/hooks/useWorkspaceResources.query';

interface ResourcesTabProps {
  workspaceId: string;
}

export function ResourcesTab({ workspaceId }: ResourcesTabProps) {
  const { data: resources = [], isLoading } = useWorkspaceResources(workspaceId);
  const createMutation = useCreateResource(workspaceId);
  const updateMutation = useUpdateResource(workspaceId);
  const deleteMutation = useDeleteResource(workspaceId);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({ name: '', url: '', description: '', category: '' });

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const resetForm = () => {
    setForm({ name: '', url: '', description: '', category: '' });
    setShowForm(false);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.url.trim()) return;

    if (editingId) {
      await updateMutation.mutateAsync({ resourceId: editingId, ...form });
    } else {
      await createMutation.mutateAsync(form);
    }
    resetForm();
  };

  const handleEdit = (resource: WorkspaceResource) => {
    setEditingId(resource.id);
    setForm({
      name: resource.name,
      url: resource.url,
      description: resource.description ?? '',
      category: resource.category ?? '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync(id);
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-white/[0.06] bg-white/80 dark:bg-gray-900/50 backdrop-blur-sm overflow-hidden">
        {/* Header skeleton */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/[0.06]">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-gray-200 dark:bg-white/[0.06]" />
            <div className="w-20 h-4 rounded bg-gray-200 dark:bg-white/[0.06]" />
          </div>
          <div className="w-24 h-7 rounded-lg bg-gray-200 dark:bg-white/[0.06]" />
        </div>
        {/* Table header skeleton */}
        <div className="px-5 py-3 border-b border-gray-100 dark:border-white/[0.06]">
          <div className="flex gap-6">
            <div className="w-16 h-3 rounded bg-gray-200 dark:bg-white/[0.06]" />
            <div className="w-12 h-3 rounded bg-gray-200 dark:bg-white/[0.06]" />
            <div className="w-24 h-3 rounded bg-gray-200 dark:bg-white/[0.06] hidden md:block" />
            <div className="w-20 h-3 rounded bg-gray-200 dark:bg-white/[0.06] hidden sm:block" />
          </div>
        </div>
        {/* Row skeletons */}
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-6 px-5 py-3.5 border-b border-gray-50 dark:border-white/[0.03] animate-pulse">
            <div className="w-28 h-4 rounded bg-gray-200 dark:bg-white/[0.06]" />
            <div className="w-36 h-3.5 rounded bg-gray-100 dark:bg-white/[0.04]" />
            <div className="w-48 h-3.5 rounded bg-gray-100 dark:bg-white/[0.04] hidden md:block" />
            <div className="w-16 h-5 rounded-full bg-gray-100 dark:bg-white/[0.04] hidden sm:block" />
            <div className="ml-auto flex gap-1">
              <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-white/[0.04]" />
              <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-white/[0.04]" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-white/[0.06] bg-white/80 dark:bg-gray-900/50 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-brand-light-pink" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-brand-off-white">
            Resources
          </h3>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            ({resources.length})
          </span>
        </div>
        <button
          type="button"
          onClick={() => { resetForm(); setShowForm(true); }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-light-pink px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-mid-pink transition-colors shadow-sm shadow-brand-light-pink/20"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Resource
        </button>
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="px-5 py-4 border-b border-gray-100 dark:border-white/[0.06] bg-gray-50/50 dark:bg-white/[0.02]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Resource name *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="rounded-lg border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-brand-off-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-light-pink/40"
            />
            <input
              type="url"
              placeholder="URL *"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              required
              className="rounded-lg border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-brand-off-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-light-pink/40"
            />
            <textarea
              placeholder="Description (optional)"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="sm:col-span-2 rounded-lg border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-brand-off-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-light-pink/40 resize-y"
            />
            <input
              type="text"
              placeholder="Category (optional)"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="rounded-lg border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-brand-off-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-light-pink/40"
            />
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-light-pink px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-mid-pink transition-colors disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              {editingId ? 'Update' : 'Add'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/60 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Table */}
      {resources.length === 0 && !showForm ? (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-light-pink/10 dark:bg-brand-light-pink/[0.08] mb-3">
            <Link2 className="h-6 w-6 text-brand-light-pink" />
          </div>
          <p className="text-sm font-medium text-gray-900 dark:text-brand-off-white mb-1">
            No resources yet
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Add important links and documentation for your team.
          </p>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-light-pink px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-mid-pink transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Resource
          </button>
        </div>
      ) : resources.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/[0.06]">
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Name</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">URL</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 hidden md:table-cell">Description</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 hidden sm:table-cell">Category</th>
                <th className="text-right px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {resources.map((r) => (
                <tr key={r.id} className="border-b border-gray-50 dark:border-white/[0.03] hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3">
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-medium text-gray-900 dark:text-brand-off-white hover:text-brand-light-pink transition-colors"
                    >
                      {r.name}
                      <ExternalLink className="h-3 w-3 opacity-40" />
                    </a>
                  </td>
                  <td className="px-5 py-3 max-w-[200px]">
                    <span className="text-gray-500 dark:text-gray-400 truncate block" title={r.url}>
                      {r.url.replace(/^https?:\/\//, '').slice(0, 40)}
                      {r.url.replace(/^https?:\/\//, '').length > 40 ? '...' : ''}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-600 dark:text-gray-400 hidden md:table-cell max-w-[350px]">
                    {r.description ? (
                      <div>
                        <span className={`whitespace-pre-wrap break-words text-xs ${expandedIds.has(r.id) ? '' : 'line-clamp-2'}`}>
                          {r.description}
                        </span>
                        {r.description.length > 100 && (
                          <button
                            type="button"
                            onClick={() => toggleExpand(r.id)}
                            className="inline-flex items-center gap-0.5 mt-1 text-[11px] font-medium text-brand-light-pink hover:text-brand-mid-pink transition-colors"
                          >
                            {expandedIds.has(r.id) ? (
                              <>Show less <ChevronUp className="h-3 w-3" /></>
                            ) : (
                              <>Show more <ChevronDown className="h-3 w-3" /></>
                            )}
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 hidden sm:table-cell">
                    {r.category ? (
                      <span className="inline-flex rounded-full bg-brand-blue/10 dark:bg-brand-blue/[0.08] text-brand-blue px-2 py-0.5 text-[11px] font-medium">
                        {r.category}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleEdit(r)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-brand-light-pink hover:bg-brand-light-pink/10 transition-colors"
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(r.id)}
                        disabled={deleteMutation.isPending}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors disabled:opacity-50"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
