'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ArrowRight,
  ArrowLeft,
  Check,
  Plus,
  Trash2,
  GripVertical,
  LayoutGrid,
  List,
  LayoutPanelLeft,
  Image,
  MessageSquare,
  FileText,
  Zap,
  Target,
  Palette,
  Briefcase,
  Megaphone,
  Lock,
  Globe,
  type LucideIcon,
} from 'lucide-react';
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from '@hello-pangea/dnd';
import {
  useCreateSpace,
  type SpaceTemplateType,
  type SpaceAccess,
} from '@/lib/hooks/useSpaces.query';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CreateSpaceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TemplateOption {
  id: SpaceTemplateType;
  name: string;
  abbr: string;
  description: string;
  details: string;
  icon: LucideIcon;
}

interface WorkType {
  id: string;
  name: string;
  description: string;
  iconId: string;
  checked: boolean;
}

interface StatusItem {
  id: string;
  name: string;
  color: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const ICON_MAP: Record<string, LucideIcon> = {
  target: Target,
  file: FileText,
  zap: Zap,
  message: MessageSquare,
  palette: Palette,
  briefcase: Briefcase,
  megaphone: Megaphone,
  image: Image,
  layout: LayoutGrid,
  board: LayoutPanelLeft,
};

const ICON_OPTIONS = Object.entries(ICON_MAP).map(([id, icon]) => ({ id, icon }));

const TEMPLATES: TemplateOption[] = [
  {
    id: 'KANBAN',
    name: 'General Kanban Board',
    abbr: 'KB',
    description: 'Visual workflow with customizable columns for any project.',
    details:
      'Perfect for tracking creative production, campaign tasks, or team workflows. Start with three core columns and customize as you go. Great for agile teams that need flexibility in how they manage work.',
    icon: LayoutPanelLeft,
  },
  {
    id: 'WALL_POST',
    name: 'Wall Post Board',
    abbr: 'WP',
    description: 'Manage social media wall posts from draft to published.',
    details:
      'Streamline your social media content pipeline. Track posts from ideation through creation, approval, scheduling, and publishing. Includes built-in review workflows for content quality.',
    icon: Image,
  },
  {
    id: 'SEXTING_SETS',
    name: 'Sexting Sets Board',
    abbr: 'SS',
    description: 'Organize and track sexting set production workflows.',
    details:
      'Dedicated workflow for managing sexting set creation from concept to delivery. Track shoots, edits, approvals, and distribution in one organized space with full visibility.',
    icon: Palette,
  },
  {
    id: 'OTP_PTR',
    name: 'OTP/PTR Board',
    abbr: 'OP',
    description: 'Handle OTP and PTR request workflows efficiently.',
    details:
      'Manage one-time purchase and pay-to-receive request workflows. Track requests from submission through fulfillment with clear status visibility for the entire team.',
    icon: Zap,
  },
];

const DEFAULT_WORK_TYPES: WorkType[] = [
  { id: 'planning', name: 'Planning', description: 'Plan sprints, set goals, and define project scope', iconId: 'target', checked: true },
  { id: 'content', name: 'Content', description: 'Create and manage content deliverables', iconId: 'file', checked: true },
  { id: 'workflow', name: 'Workflow', description: 'Track processes and standard operating procedures', iconId: 'zap', checked: false },
  { id: 'review', name: 'Review', description: 'Quality assurance and review cycles', iconId: 'message', checked: false },
  { id: 'design', name: 'Design', description: 'Visual design and creative asset production', iconId: 'palette', checked: false },
];

const DEFAULT_STATUSES: StatusItem[] = [
  { id: 'todo', name: 'To Do', color: 'blue' },
  { id: 'in-progress', name: 'In Progress', color: 'amber' },
  { id: 'done', name: 'Done', color: 'green' },
];

const SEXTING_SETS_STATUSES: StatusItem[] = [
  { id: 'submissions', name: 'Submissions', color: 'blue' },
  { id: 'count-confirmed', name: 'Count Confirmed', color: 'cyan' },
  { id: 'editing-scripting', name: 'Editing and Scripting', color: 'purple' },
  { id: 'review', name: 'Review', color: 'amber' },
  { id: 'revision', name: 'Revision', color: 'orange' },
  { id: 'ready-vault', name: 'Ready for Vault Upload', color: 'pink' },
  { id: 'completed', name: 'Completed', color: 'green' },
];

function getDefaultStatusesForTemplate(templateType: SpaceTemplateType): StatusItem[] {
  switch (templateType) {
    case 'SEXTING_SETS':
      return SEXTING_SETS_STATUSES;
    default:
      return DEFAULT_STATUSES;
  }
}

const STATUS_COLORS = [
  { id: 'blue', label: 'Blue', class: 'bg-brand-blue' },
  { id: 'amber', label: 'Amber', class: 'bg-amber-500' },
  { id: 'green', label: 'Green', class: 'bg-emerald-500' },
  { id: 'purple', label: 'Purple', class: 'bg-violet-500' },
  { id: 'pink', label: 'Pink', class: 'bg-brand-light-pink' },
  { id: 'red', label: 'Red', class: 'bg-red-500' },
  { id: 'cyan', label: 'Cyan', class: 'bg-cyan-500' },
  { id: 'orange', label: 'Orange', class: 'bg-orange-500' },
];

const DOT_COLORS: Record<string, string> = {
  blue: 'bg-brand-blue',
  pink: 'bg-brand-light-pink',
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  purple: 'bg-violet-500',
  red: 'bg-red-500',
  cyan: 'bg-cyan-500',
  orange: 'bg-orange-500',
};

const STEP_META = [
  { title: 'Choose a template', subtitle: 'Select a template to get started with your space.' },
  { title: 'Name your space', subtitle: 'Set up basic information for your space.' },
  { title: 'Break down your daily work', subtitle: 'Select the types of work you`ll track in this space.' },
  { title: 'Select statuses', subtitle: 'Define the workflow columns for your board.' },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function generateKey(name: string): string {
  const clean = name.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const noVowels = clean.replace(/[AEIOU]/g, '');
  if (noVowels.length >= 2) return noVowels.slice(0, 8);
  return clean.slice(0, 4) || 'KEY';
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const active = n === current;
        const done = n < current;
        return (
          <div key={n} className="flex items-center gap-2">
            <div
              className={[
                'h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all',
                active
                  ? 'bg-brand-light-pink text-white shadow-md shadow-brand-light-pink/30'
                  : done
                    ? 'bg-brand-light-pink/20 text-brand-light-pink'
                    : 'bg-gray-200 dark:bg-gray-800 text-gray-400',
              ].join(' ')}
            >
              {done ? <Check className="h-3 w-3" /> : n}
            </div>
            {n < total && (
              <div
                className={`w-8 h-0.5 rounded-full ${done ? 'bg-brand-light-pink/40' : 'bg-gray-200 dark:bg-gray-800'}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function BoardPreview({
  statuses,
  keyPrefix,
  viewMode,
  onViewModeChange,
}: {
  statuses: StatusItem[];
  keyPrefix: string;
  viewMode: 'board' | 'list';
  onViewModeChange: (m: 'board' | 'list') => void;
}) {
  const prefix = keyPrefix || 'KEY';
  const dummy = [
    { key: 1, title: 'Sample task' },
    { key: 2, title: 'Another task' },
    { key: 3, title: 'Third task' },
  ];

  return (
    <div className="h-full flex flex-col">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
        Preview
      </p>

      <div className="flex items-center gap-1 mb-4">
        {(['board', 'list'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onViewModeChange(m)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              viewMode === m
                ? 'bg-brand-light-pink/10 text-brand-light-pink'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {m === 'board' ? <LayoutGrid className="h-3 w-3" /> : <List className="h-3 w-3" />}
            {m === 'board' ? 'Board' : 'List'}
          </button>
        ))}
      </div>

      {viewMode === 'board' ? (
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-2.5 min-w-max">
            {statuses.map((s, i) => (
              <div
                key={s.id}
                className="w-[170px] shrink-0 rounded-xl bg-gray-100/80 dark:bg-gray-900/50 border border-gray-200/60 dark:border-brand-mid-pink/15 p-2.5"
              >
                <div className="flex items-center gap-1.5 mb-2.5 px-1">
                  <span className={`h-2 w-2 rounded-full ${DOT_COLORS[s.color] ?? 'bg-gray-400'}`} />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 truncate">
                    {s.name}
                  </span>
                </div>
                {i === 0 &&
                  dummy.map((t) => (
                    <div
                      key={t.key}
                      className="rounded-lg bg-white dark:bg-gray-900/80 border border-gray-200/70 dark:border-brand-mid-pink/15 px-2.5 py-2 mb-1.5 last:mb-0"
                    >
                      <span className="text-[9px] font-semibold text-brand-blue/70 block mb-0.5">
                        {prefix}-{t.key}
                      </span>
                      <span className="text-[11px] text-gray-700 dark:text-gray-300">
                        {t.title}
                      </span>
                    </div>
                  ))}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="border border-gray-200/60 dark:border-brand-mid-pink/15 rounded-xl overflow-hidden">
            <div className="grid grid-cols-[1fr_100px_80px] gap-2 px-3 py-2 bg-gray-100/80 dark:bg-gray-900/50 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200/60 dark:border-brand-mid-pink/15">
              <span>Task</span>
              <span>Status</span>
              <span>Key</span>
            </div>
            {dummy.map((t) => (
              <div
                key={t.key}
                className="grid grid-cols-[1fr_100px_80px] gap-2 px-3 py-2.5 border-b last:border-b-0 border-gray-200/40 dark:border-brand-mid-pink/10 text-[11px]"
              >
                <span className="text-gray-700 dark:text-gray-300 truncate">{t.title}</span>
                <span className="inline-flex items-center gap-1">
                  <span className={`h-1.5 w-1.5 rounded-full ${DOT_COLORS[statuses[0]?.color ?? 'blue']}`} />
                  <span className="text-gray-500 dark:text-gray-400 truncate">
                    {statuses[0]?.name ?? 'To Do'}
                  </span>
                </span>
                <span className="font-semibold text-brand-blue/70">
                  {prefix}-{t.key}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function CreateSpaceModal({ isOpen, onClose }: CreateSpaceModalProps) {
  /* ---- state ---- */
  const [step, setStep] = useState(1);
  const [selectedTemplateId, setSelectedTemplateId] = useState<SpaceTemplateType>('KANBAN');
  const [name, setName] = useState('');
  const [access, setAccess] = useState<'open' | 'private'>('open');
  const [key, setKey] = useState('');
  const [keyManual, setKeyManual] = useState(false);
  const [workTypes, setWorkTypes] = useState<WorkType[]>(DEFAULT_WORK_TYPES);
  const [statuses, setStatuses] = useState<StatusItem[]>(getDefaultStatusesForTemplate('KANBAN'));
  const [previewMode, setPreviewMode] = useState<'board' | 'list'>('board');
  const [showAddWTModal, setShowAddWTModal] = useState(false);
  const [newWT, setNewWT] = useState({ name: '', description: '', iconId: 'target' });
  const [isAnimating, setIsAnimating] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState<string | null>(null);

  const { mutateAsync: createSpace, isPending } = useCreateSpace();
  const selectedTemplate = TEMPLATES.find((t) => t.id === selectedTemplateId) ?? TEMPLATES[0];
  const stepMeta = STEP_META[step - 1];

  /* ---- effects ---- */
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (isOpen) setIsAnimating(true);
  }, [isOpen]);

  useEffect(() => {
    if (!keyManual && name) {
      setKey(generateKey(name));
    } else if (!name) {
      setKey('');
      setKeyManual(false);
    }
  }, [name, keyManual]);

  useEffect(() => {
    setStatuses(getDefaultStatusesForTemplate(selectedTemplateId));
  }, [selectedTemplateId]);

  if (!mounted || (!isOpen && !isAnimating)) return null;

  /* ---- handlers ---- */
  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(() => {
      onClose();
      setStep(1);
      setSelectedTemplateId('KANBAN');
      setName('');
      setAccess('open');
      setKey('');
      setKeyManual(false);
      setWorkTypes(DEFAULT_WORK_TYPES);
      setStatuses(getDefaultStatusesForTemplate('KANBAN'));
      setPreviewMode('board');
      setShowAddWTModal(false);
    }, 300);
  };

  const handleCreate = async () => {
    if (!name.trim() || !key.trim()) return;
    try {
      await createSpace({
        name: name.trim(),
        templateType: selectedTemplateId,
        key: key.trim(),
        access: access.toUpperCase() as SpaceAccess,
      });
      handleClose();
    } catch (err) {
      console.error('Failed to create space', err);
    }
  };

  const canNext = () => {
    if (step === 1) return !!selectedTemplateId;
    if (step === 2) return !!name.trim() && !!key.trim();
    if (step === 3) return workTypes.some((w) => w.checked);
    if (step === 4) return statuses.length > 0;
    return false;
  };

  const handleAddStatus = () => {
    const newId = `s-${Date.now()}`;
    const newColor = STATUS_COLORS[statuses.length % STATUS_COLORS.length].id;
    setStatuses((p) => [...p, { id: newId, name: 'New Status', color: newColor }]);
  };

  const handleStatusDrag = (result: DropResult) => {
    if (!result.destination) return;
    const arr = Array.from(statuses);
    const [moved] = arr.splice(result.source.index, 1);
    arr.splice(result.destination.index, 0, moved);
    setStatuses(arr);
  };

  const handleSaveWT = () => {
    if (!newWT.name.trim()) return;
    setWorkTypes((p) => [
      ...p,
      { id: `wt-${Date.now()}`, name: newWT.name.trim(), description: newWT.description.trim(), iconId: newWT.iconId, checked: true },
    ]);
    setNewWT({ name: '', description: '', iconId: 'target' });
    setShowAddWTModal(false);
  };

  /* ---- render ---- */
  return createPortal(
    <>
      <div
        className={`fixed inset-0 z-9999 bg-black/60 backdrop-blur-md transition-opacity duration-500 ${
          isOpen && isAnimating ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
      >
        <div
          className={`relative w-full h-full bg-white dark:bg-gray-950 shadow-2xl overflow-hidden transform transition-transform duration-500 ease-out ${
            isOpen && isAnimating ? 'translate-x-0' : '-translate-x-full'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* bg decoration */}
          <div className="absolute inset-0 pointer-events-none opacity-30">
            <div className="absolute top-0 left-0 w-96 h-96 bg-brand-light-pink/20 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-brand-blue/20 rounded-full blur-3xl" />
          </div>

          {/* ── Two-column layout spanning full height ── */}
          <div className="relative flex h-full divide-x divide-gray-200 dark:divide-brand-mid-pink/20">

            {/* ══════════════ LEFT COLUMN ══════════════ */}
            <div className="flex flex-col w-full lg:w-1/2 h-full">

              {/* Left header */}
              <header className="flex items-start justify-between border-b border-gray-200 dark:border-brand-mid-pink/20 px-6 sm:px-8 lg:px-12 py-5">
                <div className="flex flex-col gap-3">
                  <StepIndicator current={step} total={4} />
                  <div>
                    <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-brand-off-white">
                      {stepMeta.title}
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                      {stepMeta.subtitle}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 dark:border-brand-mid-pink/30 bg-white/80 dark:bg-gray-900/80 text-gray-500 hover:text-gray-900 dark:hover:text-brand-off-white hover:border-brand-light-pink/60 shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              </header>

              {/* Left scrollable content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar px-6 sm:px-8 lg:px-12 py-6">

                {/* ========== STEP 1: Template list ========== */}
                {step === 1 && (
                  <div className="space-y-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-4">
                      Templates
                    </p>
                    {TEMPLATES.map((t) => {
                      const active = t.id === selectedTemplateId;
                      const Icon = t.icon;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setSelectedTemplateId(t.id)}
                          className={[
                            'w-full text-left rounded-2xl border px-4 py-3 sm:px-5 sm:py-4 transition-all',
                            active
                              ? 'border-brand-light-pink ring-2 ring-brand-light-pink/40 shadow-lg shadow-brand-light-pink/20 bg-brand-light-pink/5 dark:bg-brand-dark-pink/5'
                              : 'border-gray-200 dark:border-brand-mid-pink/30 hover:border-brand-light-pink/70 hover:shadow-md bg-white/90 dark:bg-gray-900/80',
                          ].join(' ')}
                        >
                          <div className="flex items-start gap-3">
                            <span
                              className={[
                                'mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl border',
                                active
                                  ? 'border-brand-light-pink bg-brand-light-pink/10 text-brand-light-pink'
                                  : 'border-gray-200 dark:border-brand-mid-pink/30 text-gray-500 dark:text-gray-300',
                              ].join(' ')}
                            >
                              <Icon className="h-4 w-4" />
                            </span>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-semibold text-gray-900 dark:text-brand-off-white mb-0.5">
                                {t.name}
                              </h4>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {t.description}
                              </p>
                            </div>
                            {active && (
                              <span className="shrink-0 mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-light-pink text-white">
                                <Check className="h-3 w-3" />
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* ========== STEP 2: Name ========== */}
                {step === 2 && (
                  <div className="space-y-5">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">
                        Space name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Content Production, Influencer Ops"
                        className="w-full rounded-xl border border-gray-200 dark:border-brand-mid-pink/30 bg-white/80 dark:bg-gray-900/80 px-3 py-2.5 text-sm text-gray-900 dark:text-brand-off-white placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light-pink"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">
                        Access
                      </label>
                      <div className="flex gap-2">
                        {([
                          { v: 'open' as const, label: 'Open', Icon: Globe, desc: 'Anyone in the org can access' },
                          { v: 'private' as const, label: 'Private', Icon: Lock, desc: 'Only invited members' },
                        ]).map((opt) => (
                          <button
                            key={opt.v}
                            type="button"
                            onClick={() => setAccess(opt.v)}
                            className={[
                              'flex-1 flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all',
                              access === opt.v
                                ? 'border-brand-light-pink ring-1 ring-brand-light-pink/30 bg-brand-light-pink/5'
                                : 'border-gray-200 dark:border-brand-mid-pink/30 hover:border-brand-light-pink/50',
                            ].join(' ')}
                          >
                            <opt.Icon className={`h-4 w-4 ${access === opt.v ? 'text-brand-light-pink' : 'text-gray-400'}`} />
                            <div>
                              <span className="text-sm font-medium text-gray-900 dark:text-brand-off-white block">
                                {opt.label}
                              </span>
                              <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                {opt.desc}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">
                        Key{' '}
                        <span className="text-gray-400 font-normal">(auto-generated, no vowels)</span>
                      </label>
                      <input
                        type="text"
                        value={key}
                        onChange={(e) => {
                          setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
                          setKeyManual(true);
                        }}
                        placeholder="CNTNT"
                        className="w-full rounded-xl border border-gray-200 dark:border-brand-mid-pink/30 bg-white/80 dark:bg-gray-900/80 px-3 py-2.5 text-sm font-mono text-gray-900 dark:text-brand-off-white placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light-pink uppercase tracking-wider"
                      />
                      {key && (
                        <p className="text-[10px] text-gray-400 mt-1">
                          Task IDs will look like:{' '}
                          <span className="font-semibold text-brand-blue">{key}-1</span>,{' '}
                          <span className="font-semibold text-brand-blue">{key}-2</span>, etc.
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">
                        Template
                      </label>
                      <div className="flex items-center gap-2.5 rounded-xl border border-gray-200 dark:border-brand-mid-pink/30 bg-gray-50/70 dark:bg-gray-900/50 px-3 py-2.5">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-brand-light-pink/10 text-brand-light-pink">
                          <selectedTemplate.icon className="h-3.5 w-3.5" />
                        </span>
                        <div>
                          <span className="text-sm font-medium text-gray-900 dark:text-brand-off-white">
                            {selectedTemplate.name}
                          </span>
                          <span className="text-[10px] text-gray-400 block">{selectedTemplate.abbr}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ========== STEP 3: Work types ========== */}
                {step === 3 && (
                  <div>
                    <div className="space-y-2.5 mb-5">
                      {workTypes.map((wt) => {
                        const Icon = ICON_MAP[wt.iconId] ?? Target;
                        return (
                          <label
                            key={wt.id}
                            className={[
                              'flex items-start gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-all',
                              wt.checked
                                ? 'border-brand-light-pink/50 bg-brand-light-pink/5 dark:bg-brand-dark-pink/5'
                                : 'border-gray-200 dark:border-brand-mid-pink/20 hover:border-brand-light-pink/30',
                            ].join(' ')}
                          >
                            <input
                              type="checkbox"
                              checked={wt.checked}
                              onChange={() =>
                                setWorkTypes((p) =>
                                  p.map((w) => w.id === wt.id ? { ...w, checked: !w.checked } : w)
                                )
                              }
                              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-light-pink focus:ring-brand-light-pink accent-brand-light-pink"
                            />
                            <div className="flex items-start gap-2.5 flex-1 min-w-0">
                              <span
                                className={`inline-flex h-7 w-7 items-center justify-center rounded-lg shrink-0 ${
                                  wt.checked
                                    ? 'bg-brand-light-pink/10 text-brand-light-pink'
                                    : 'bg-gray-200/70 dark:bg-gray-800 text-gray-400'
                                }`}
                              >
                                <Icon className="h-3.5 w-3.5" />
                              </span>
                              <div>
                                <span className="text-sm font-medium text-gray-900 dark:text-brand-off-white block">
                                  {wt.name}
                                </span>
                                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                  {wt.description}
                                </span>
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowAddWTModal(true)}
                      className="flex items-center gap-1.5 text-xs font-medium text-brand-light-pink hover:text-brand-mid-pink transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add work type
                    </button>
                  </div>
                )}

                {/* ========== STEP 4: Statuses ========== */}
                {step === 4 && (
                  <div>
                    <DragDropContext onDragEnd={handleStatusDrag}>
                      <Droppable droppableId="wizard-statuses">
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className="space-y-2 mb-4"
                          >
                            {statuses.map((s, i) => (
                              <Draggable key={s.id} draggableId={s.id} index={i}>
                                {(dp, ds) => (
                                  <div
                                    ref={dp.innerRef}
                                    {...dp.draggableProps}
                                    className={[
                                      'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-all',
                                      ds.isDragging
                                        ? 'border-brand-light-pink shadow-lg bg-white dark:bg-gray-900'
                                        : 'border-gray-200 dark:border-brand-mid-pink/20 bg-white/80 dark:bg-gray-900/60',
                                    ].join(' ')}
                                  >
                                    <span {...dp.dragHandleProps} className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600">
                                      <GripVertical className="h-4 w-4" />
                                    </span>

                                    {/* Color picker dropdown */}
                                    <div className="relative">
                                      <button
                                        type="button"
                                        onClick={() => setColorPickerOpen(colorPickerOpen === s.id ? null : s.id)}
                                        className={`h-7 w-7 rounded-full shrink-0 ${DOT_COLORS[s.color] ?? 'bg-gray-400'} border-2 border-white dark:border-gray-800 shadow-sm hover:scale-110 transition-transform`}
                                      />
                                      {colorPickerOpen === s.id && (
                                        <div className="absolute left-0 top-9 z-10 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-brand-mid-pink/30 shadow-xl p-4 min-w-[200px]">
                                          <div className="grid grid-cols-4 gap-3">
                                            {STATUS_COLORS.map((color) => (
                                              <button
                                                key={color.id}
                                                type="button"
                                                onClick={() => {
                                                  setStatuses((p) =>
                                                    p.map((st) => st.id === s.id ? { ...st, color: color.id } : st)
                                                  );
                                                  setColorPickerOpen(null);
                                                }}
                                                className={`h-9 w-9 rounded-full ${color.class} hover:scale-110 transition-transform ${
                                                  s.color === color.id ? 'ring-2 ring-offset-2 ring-brand-light-pink dark:ring-brand-mid-pink' : ''
                                                }`}
                                                title={color.label}
                                              />
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                    {/* Editable status name */}
                                    <input
                                      type="text"
                                      value={s.name}
                                      onChange={(e) =>
                                        setStatuses((p) =>
                                          p.map((st) => st.id === s.id ? { ...st, name: e.target.value } : st)
                                        )
                                      }
                                      className="flex-1 bg-transparent border-none text-sm font-medium text-gray-900 dark:text-brand-off-white focus:outline-none focus:ring-0 px-0"
                                      placeholder="Status name"
                                    />

                                    <button
                                      type="button"
                                      onClick={() => setStatuses((p) => p.filter((x) => x.id !== s.id))}
                                      className="shrink-0 p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </DragDropContext>

                    <button
                      type="button"
                      onClick={handleAddStatus}
                      className="flex items-center gap-1.5 text-xs font-medium text-brand-light-pink hover:text-brand-mid-pink transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add status
                    </button>
                  </div>
                )}
              </div>

              {/* Left footer — navigation buttons */}
              <footer className="border-t border-gray-200 dark:border-brand-mid-pink/20 px-6 sm:px-8 lg:px-12 py-4 flex items-center justify-between">
                <div>
                  {step > 1 && (
                    <button
                      type="button"
                      onClick={() => setStep(step - 1)}
                      className="flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-brand-mid-pink/30 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white/90 dark:bg-gray-900/80 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Back
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                  {step < 4 ? (
                    <button
                      type="button"
                      onClick={() => canNext() && setStep(step + 1)}
                      disabled={!canNext()}
                      className="flex items-center gap-1.5 rounded-xl bg-brand-light-pink px-5 py-2 text-sm font-semibold text-white shadow-md shadow-brand-light-pink/30 hover:bg-brand-mid-pink disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleCreate}
                      disabled={!canNext() || isPending}
                      className="flex items-center gap-1.5 rounded-xl bg-brand-light-pink px-5 py-2 text-sm font-semibold text-white shadow-md shadow-brand-light-pink/30 hover:bg-brand-mid-pink disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isPending ? 'Creating…' : 'Create Space'}
                    </button>
                  )}
                </div>
              </footer>
            </div>

            {/* ══════════════ RIGHT COLUMN ══════════════ */}
            <div className="hidden lg:flex flex-col w-1/2 h-full bg-gray-50/70 dark:bg-gray-950/80">

              {/* Right header — aligned with left header height */}
              <div className="border-b border-gray-200 dark:border-brand-mid-pink/20 px-6 sm:px-8 lg:px-12 py-5 flex items-center">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  {step === 1 ? 'Template overview' : 'Board preview'}
                </p>
              </div>

              {/* Right scrollable content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar px-6 sm:px-8 lg:px-12 py-6">
                {step === 1 ? (
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-brand-light-pink/10 text-brand-light-pink px-3 py-1 text-xs font-medium mb-4">
                      <selectedTemplate.icon className="h-3.5 w-3.5" />
                      {selectedTemplate.abbr}
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-brand-off-white mb-2">
                      {selectedTemplate.name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                      {selectedTemplate.description}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-6">
                      {selectedTemplate.details}
                    </p>
                    <div className="rounded-xl border border-dashed border-gray-300 dark:border-brand-mid-pink/20 bg-white/50 dark:bg-gray-900/30 p-4">
                      <div className="flex gap-2">
                        {DEFAULT_STATUSES.map((s) => (
                          <div
                            key={s.id}
                            className="flex-1 rounded-lg bg-gray-100/80 dark:bg-gray-900/50 border border-gray-200/50 dark:border-brand-mid-pink/10 p-2"
                          >
                            <div className="flex items-center gap-1.5 mb-2">
                              <span className={`h-1.5 w-1.5 rounded-full ${DOT_COLORS[s.color]}`} />
                              <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">
                                {s.name}
                              </span>
                            </div>
                            <div className="space-y-1">
                              {[1, 2].map((i) => (
                                <div key={i} className="h-4 rounded bg-gray-200/60 dark:bg-gray-800/50" />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <BoardPreview
                    statuses={statuses}
                    keyPrefix={key}
                    viewMode={previewMode}
                    onViewModeChange={setPreviewMode}
                  />
                )}
              </div>

              {/* Right footer — empty, just matches left footer height */}
              <div className="border-t border-gray-200 dark:border-brand-mid-pink/20 px-6 sm:px-8 lg:px-12 py-4 flex items-center">
                <p className="text-[11px] text-gray-400 dark:text-gray-500">
                  {step === 1 ? 'Select a template on the left to see its details.' : 'Live preview updates as you configure.'}
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Add Work Type Modal */}
      {showAddWTModal && (
        <div
          className="fixed inset-0 z-10000 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowAddWTModal(false)}
        >
          <div
            className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-brand-mid-pink/30 shadow-2xl max-w-md w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-brand-off-white">
                  Add Work Type
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Create a custom work type for your space
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddWTModal(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 dark:border-brand-mid-pink/30 bg-white/80 dark:bg-gray-900/80 text-gray-500 hover:text-gray-900 dark:hover:text-brand-off-white hover:border-brand-light-pink/60"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newWT.name}
                onChange={(e) => setNewWT((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Research"
                className="w-full rounded-xl border border-gray-200 dark:border-brand-mid-pink/30 bg-white/80 dark:bg-gray-900/80 px-3 py-2.5 text-sm text-gray-900 dark:text-brand-off-white placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light-pink"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">
                Description
              </label>
              <input
                type="text"
                value={newWT.description}
                onChange={(e) => setNewWT((p) => ({ ...p, description: e.target.value }))}
                placeholder="Brief description"
                className="w-full rounded-xl border border-gray-200 dark:border-brand-mid-pink/30 bg-white/80 dark:bg-gray-900/80 px-3 py-2.5 text-sm text-gray-900 dark:text-brand-off-white placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light-pink"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">
                Icon
              </label>
              <div className="flex flex-wrap gap-2">
                {ICON_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setNewWT((p) => ({ ...p, iconId: opt.id }))}
                    className={[
                      'inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-all',
                      newWT.iconId === opt.id
                        ? 'border-brand-light-pink bg-brand-light-pink/10 text-brand-light-pink ring-2 ring-brand-light-pink/30'
                        : 'border-gray-200 dark:border-brand-mid-pink/30 text-gray-400 hover:text-gray-600 hover:border-brand-light-pink/50',
                    ].join(' ')}
                  >
                    <opt.icon className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleSaveWT}
                disabled={!newWT.name.trim()}
                className="flex-1 px-4 py-2.5 rounded-xl bg-brand-light-pink text-white text-sm font-semibold hover:bg-brand-mid-pink disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md shadow-brand-light-pink/30"
              >
                Add Work Type
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddWTModal(false);
                  setNewWT({ name: '', description: '', iconId: 'target' });
                }}
                className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-brand-mid-pink/30 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}
