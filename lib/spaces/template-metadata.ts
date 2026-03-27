/**
 * Centralized metadata definitions for each Space template type.
 *
 * Import from here in:
 *   - API routes    (validate / default incoming metadata)
 *   - Forms / UI    (render the right fields per template)
 *   - Seed scripts  (generate realistic sample data)
 *
 * Each template exports:
 *   - A TypeScript interface   (compile-time safety)
 *   - A defaults object        (pre-fill forms, seed data)
 *   - A field descriptor array (drive dynamic form rendering)
 */

/* ================================================================== */
/*  Shared helpers                                                     */
/* ================================================================== */

export type SpaceTemplateType = 'KANBAN' | 'WALL_POST' | 'SEXTING_SETS' | 'OTP_PTR' | 'MODEL_ONBOARDING' | 'CONTENT_GENERATION';

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'boolean'
  | 'date'
  | 'select'
  | 'multi-select'
  | 'tags';

export interface MetadataFieldDescriptor {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  placeholder?: string;
}

/* ================================================================== */
/*  KANBAN                                                             */
/* ================================================================== */

export interface KanbanItemMetadata {
  tags: string[];
  storyPoints: number;
  labels: string[];
}

export const KANBAN_METADATA_DEFAULTS: KanbanItemMetadata = {
  tags: [],
  storyPoints: 0,
  labels: [],
};

export const KANBAN_METADATA_FIELDS: MetadataFieldDescriptor[] = [
  { key: 'tags', label: 'Tags', type: 'tags', placeholder: 'e.g. planning, sprint-1' },
  { key: 'storyPoints', label: 'Story Points', type: 'number', placeholder: '0' },
  { key: 'labels', label: 'Labels', type: 'tags', placeholder: 'e.g. frontend, backend' },
];

/* ================================================================== */
/*  WALL POST                                                          */
/* ================================================================== */

export interface WallPostItemMetadata {
  caption: string;
  platform: string;
  hashtags: string[];
  scheduledDate: string;
  model: string;
  mediaCount: number;
}

export const WALL_POST_METADATA_DEFAULTS: WallPostItemMetadata = {
  caption: '',
  platform: 'onlyfans',
  hashtags: [],
  scheduledDate: '',
  model: '',
  mediaCount: 0,
};

export const WALL_POST_METADATA_FIELDS: MetadataFieldDescriptor[] = [
  { key: 'caption', label: 'Caption', type: 'textarea', placeholder: 'Write caption...' },
  {
    key: 'platform',
    label: 'Platform',
    type: 'select',
    options: ['onlyfans', 'fansly', 'instagram', 'twitter', 'reddit'],
  },
  { key: 'hashtags', label: 'Hashtags', type: 'tags', placeholder: 'e.g. summer, exclusive' },
  { key: 'scheduledDate', label: 'Scheduled Date', type: 'date' },
  { key: 'model', label: 'Model', type: 'text', placeholder: 'Model name', required: true },
  { key: 'mediaCount', label: 'Media Count', type: 'number', placeholder: '0' },
];

/* ================================================================== */
/*  SEXTING SETS                                                       */
/* ================================================================== */

export interface SextingSetImageRef {
  id: string;
  url: string;
  name: string;
  type: string;
  sequence: number;
}

export interface SextingSetCaptionItem {
  contentItemId: string | null;
  url: string;
  fileName: string | null;
  captionText: string | null;
  captionStatus: 'pending' | 'submitted' | 'approved' | 'rejected' | 'not_required';
  qaRejectionReason: string | null;
  isPosted: boolean;
}

export interface SextingSetsItemMetadata {
  category: string;
  setSize: number;
  model: string;
  quality: string;
  watermarked: boolean;
  tags: string[];
  // ── Linkage fields ──
  sextingSetId: string;
  contentGenTaskId: string;
  clientId: string;
  clientName: string;
  profileId: string;
  // ── Caption workflow fields ──
  captionTicketId: string;
  captionStatus: string;
  sextingSetStatus: string;
  captionItems: SextingSetCaptionItem[];
  // ── Actual images from organizer ──
  images: SextingSetImageRef[];
}

export const SEXTING_SETS_METADATA_DEFAULTS: SextingSetsItemMetadata = {
  category: '',
  setSize: 0,
  model: '',
  quality: 'HD',
  watermarked: false,
  tags: [],
  sextingSetId: '',
  contentGenTaskId: '',
  clientId: '',
  clientName: '',
  profileId: '',
  captionTicketId: '',
  captionStatus: '',
  sextingSetStatus: '',
  captionItems: [],
  images: [],
};

export const SEXTING_SETS_METADATA_FIELDS: MetadataFieldDescriptor[] = [
  {
    key: 'category',
    label: 'Category',
    type: 'select',
    options: ['bedroom', 'outdoor', 'studio', 'selfie', 'cosplay', 'lingerie', 'other'],
  },
  { key: 'setSize', label: 'Set Size', type: 'number', placeholder: 'Number of images' },
  { key: 'model', label: 'Model', type: 'text', placeholder: 'Model name' },
  {
    key: 'quality',
    label: 'Quality',
    type: 'select',
    options: ['SD', 'HD', '4K'],
  },
  { key: 'watermarked', label: 'Watermarked', type: 'boolean' },
  { key: 'tags', label: 'Tags', type: 'tags', placeholder: 'e.g. exclusive, new-model' },
];

/* ================================================================== */
/*  OTP / PTR                                                          */
/* ================================================================== */

export interface OtpPtrItemMetadata {
  // --- Submission fields (set at creation) ---
  postOrigin: 'PTR' | 'OTP' | 'OTM' | 'PPV' | 'GAME' | 'LIVE' | 'TIP_ME' | 'VIP' | 'DM_FUNNEL' | 'RENEW_ON' | 'CUSTOM';
  price: number;
  model: string;
  pricingTier: string;
  pageType: string;
  driveLink: string;
  contentType: string;
  contentLength: string;
  contentCount: string;
  externalCreatorTags: string[];
  internalModelTags: string[];
  contentTags: string[];
  deadline: string;
  platforms: string[];

  // --- Workflow fields (filled by teams) ---
  caption: string;
  gameType: string;
  gifUrl: string;                    // Single GIF URL (or OnlyFans GIF when both platforms)
  gifUrlFansly: string;              // NEW: Fansly-specific GIF URL (when both platforms selected)
  gameNotes: string;
  originalPollReference: string;     // PPV/Bundle reference
  campaignOrUnlock: string;          // NEW: "Campaign", "Unlock", etc.
  totalSale: number;                 // NEW: Revenue tracking (QA only)
  qaNotes: string;                   // NEW: QA team notes
  postLinkOnlyfans: string;          // NEW: OF post URL after deployment
  postLinkFansly: string;            // NEW: Fansly post URL after deployment
  datePosted: string;                // NEW: Actual post date (ISO string)
}

export const OTP_PTR_METADATA_DEFAULTS: OtpPtrItemMetadata = {
  postOrigin: 'OTP',
  price: 0,
  model: '',
  pricingTier: '',
  pageType: '',
  driveLink: '',
  contentType: '',
  contentLength: '',
  contentCount: '',
  externalCreatorTags: [],
  internalModelTags: [],
  contentTags: [],
  deadline: '',
  platforms: [],
  caption: '',
  gameType: '',
  gifUrl: '',
  gifUrlFansly: '',
  gameNotes: '',
  originalPollReference: '',
  campaignOrUnlock: '',
  totalSale: 0,
  qaNotes: '',
  postLinkOnlyfans: '',
  postLinkFansly: '',
  datePosted: '',
};

export const OTP_PTR_METADATA_FIELDS: MetadataFieldDescriptor[] = [
  {
    key: 'postOrigin',
    label: 'Post Origin',
    type: 'select',
    required: true,
    options: ['PTR', 'OTP', 'OTM', 'PPV', 'GAME', 'LIVE', 'TIP_ME', 'VIP', 'DM_FUNNEL', 'RENEW_ON', 'CUSTOM'],
  },
  { key: 'price', label: 'Price ($)', type: 'number', placeholder: '0.00' },
  // driveLink — handled by the Google Drive attachment section in the submission form
  { key: 'contentLength', label: 'Content Length', type: 'text', placeholder: 'e.g. 8:43 or 8 mins 43 secs' },
  { key: 'contentCount', label: 'Content Count', type: 'text', placeholder: 'e.g. 1 Video, 3 Photos' },
  { key: 'externalCreatorTags', label: 'Tags — External Creators', type: 'tags', placeholder: '@johndoe @janedoe' },
  { key: 'deadline', label: 'Deadline', type: 'date' },
  // caption, campaignOrUnlock, qaNotes, totalSale — workflow-only fields (board modal, not submission form)
];

/* ================================================================== */
/*  MODEL ONBOARDING                                                   */
/* ================================================================== */

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  completedBy?: string;
  completedAt?: string;
  order: number;
  notes?: string;
}

export interface ModelOnboardingItemMetadata {
  modelName: string;
  socialHandles: string[];
  notes: string;
  platform: string;
  tags: string[];
  checklist: ChecklistItem[];
  checklistProgress: number;
  /** Dynamic key-value pairs from external sources (e.g. Google Sheet / webhook) */
  fields: Record<string, string>;
}

export const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { id: 'step-1', text: 'Collect model information & photos', completed: false, order: 0 },
  { id: 'step-2', text: 'Verify identity documents', completed: false, order: 1 },
  { id: 'step-3', text: 'Sign contract & agreements', completed: false, order: 2 },
  { id: 'step-4', text: 'Set up platform accounts', completed: false, order: 3 },
  { id: 'step-5', text: 'Upload initial content', completed: false, order: 4 },
  { id: 'step-6', text: 'Configure pricing & tiers', completed: false, order: 5 },
  { id: 'step-7', text: 'Team introductions', completed: false, order: 6 },
  { id: 'step-8', text: 'Schedule first content calendar', completed: false, order: 7 },
];

/**
 * Returns the checklist items to use for a new task.
 * Reads custom checklist from spaceConfig.checklist.items if available,
 * otherwise falls back to the hardcoded DEFAULT_CHECKLIST.
 * Always returns fresh copies with completed: false.
 */
export function getDefaultChecklist(
  spaceConfig?: Record<string, unknown> | null,
): ChecklistItem[] {
  const checklist = (spaceConfig?.checklist as Record<string, unknown> | undefined);
  const items = checklist?.items as ChecklistItem[] | undefined;

  if (Array.isArray(items) && items.length > 0) {
    return items.map((item, idx) => ({
      ...item,
      completed: false,
      completedBy: undefined,
      completedAt: undefined,
      order: idx,
    }));
  }

  return DEFAULT_CHECKLIST.map((item) => ({ ...item, completed: false }));
}

export const MODEL_ONBOARDING_METADATA_DEFAULTS: ModelOnboardingItemMetadata = {
  modelName: '',
  socialHandles: [],
  notes: '',
  platform: '',
  tags: [],
  checklist: DEFAULT_CHECKLIST,
  checklistProgress: 0,
  fields: {},
};

export const MODEL_ONBOARDING_METADATA_FIELDS: MetadataFieldDescriptor[] = [
  { key: 'modelName', label: 'Model Name', type: 'text', required: true, placeholder: 'Full name or stage name' },
  { key: 'socialHandles', label: 'Social Handles', type: 'tags', placeholder: '@handle' },
  { key: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Additional notes...' },
  {
    key: 'platform',
    label: 'Platform',
    type: 'select',
    options: ['onlyfans', 'fansly', 'instagram', 'twitter', 'tiktok', 'other'],
  },
  { key: 'tags', label: 'Tags', type: 'tags', placeholder: 'e.g. new-model, priority' },
];

/* ================================================================== */
/*  CONTENT GENERATION                                                 */
/* ================================================================== */

export type ContentGenTaskType =
  | 'IG_SFW_REELS'
  | 'NSFW_PPV'
  | 'WALL_POSTS'
  | 'STORIES'
  | 'PROMO'
  | 'CUSTOM';

export interface VaultAssetRef {
  id: string;
  fileName: string;
  fileType: string;
  awsS3Url: string;
  folderId: string;
  folderName?: string;
}

export interface ContentGenItemMetadata {
  taskType: ContentGenTaskType;
  quantity: number;
  clientId: string;
  clientName: string;
  assignedTo: string[];
  vaultAssets: VaultAssetRef[];
  notes: string;
  deadline: string;
  requestedBy: string;
  requestedByName: string;
}

export const CONTENT_GEN_METADATA_DEFAULTS: ContentGenItemMetadata = {
  taskType: 'WALL_POSTS',
  quantity: 1,
  clientId: '',
  clientName: '',
  assignedTo: [],
  vaultAssets: [],
  notes: '',
  deadline: '',
  requestedBy: '',
  requestedByName: '',
};

export const CONTENT_GEN_TASK_TYPE_OPTIONS: { value: ContentGenTaskType; label: string }[] = [
  { value: 'IG_SFW_REELS', label: 'IG SFW Reels' },
  { value: 'NSFW_PPV', label: 'NSFW PPV' },
  { value: 'WALL_POSTS', label: 'Wall Posts' },
  { value: 'STORIES', label: 'Stories' },
  { value: 'PROMO', label: 'Promo' },
  { value: 'CUSTOM', label: 'Custom' },
];

export const CONTENT_GEN_METADATA_FIELDS: MetadataFieldDescriptor[] = [
  {
    key: 'taskType',
    label: 'Task Type',
    type: 'select',
    required: true,
    options: ['IG_SFW_REELS', 'NSFW_PPV', 'WALL_POSTS', 'STORIES', 'PROMO', 'CUSTOM'],
  },
  { key: 'quantity', label: 'Quantity', type: 'number', required: true, placeholder: '1' },
  { key: 'clientName', label: 'Client', type: 'text', required: true, placeholder: 'Select a client' },
  { key: 'deadline', label: 'Deadline', type: 'date', required: true },
  { key: 'notes', label: 'Special Instructions', type: 'textarea', placeholder: 'Any special instructions...' },
];

/* ================================================================== */
/*  Registry — look up by template type                                */
/* ================================================================== */

export type AnyItemMetadata =
  | KanbanItemMetadata
  | WallPostItemMetadata
  | SextingSetsItemMetadata
  | OtpPtrItemMetadata
  | ModelOnboardingItemMetadata
  | ContentGenItemMetadata;

interface TemplateMetadataEntry<T> {
  defaults: T;
  fields: MetadataFieldDescriptor[];
}

const REGISTRY: Record<SpaceTemplateType, TemplateMetadataEntry<AnyItemMetadata>> = {
  KANBAN: { defaults: KANBAN_METADATA_DEFAULTS, fields: KANBAN_METADATA_FIELDS },
  WALL_POST: { defaults: WALL_POST_METADATA_DEFAULTS, fields: WALL_POST_METADATA_FIELDS },
  SEXTING_SETS: { defaults: SEXTING_SETS_METADATA_DEFAULTS, fields: SEXTING_SETS_METADATA_FIELDS },
  OTP_PTR: { defaults: OTP_PTR_METADATA_DEFAULTS, fields: OTP_PTR_METADATA_FIELDS },
  MODEL_ONBOARDING: { defaults: MODEL_ONBOARDING_METADATA_DEFAULTS, fields: MODEL_ONBOARDING_METADATA_FIELDS },
  CONTENT_GENERATION: { defaults: CONTENT_GEN_METADATA_DEFAULTS, fields: CONTENT_GEN_METADATA_FIELDS },
};

/** Get the default metadata for a given template type. */
export function getMetadataDefaults(templateType: SpaceTemplateType): AnyItemMetadata {
  return { ...REGISTRY[templateType].defaults };
}

/** Get the field descriptors for a given template type (drives dynamic forms). */
export function getMetadataFields(templateType: SpaceTemplateType): MetadataFieldDescriptor[] {
  return REGISTRY[templateType].fields;
}

/** Merge partial user input with defaults so no fields are missing. */
export function mergeMetadata(
  templateType: SpaceTemplateType,
  partial: Record<string, unknown> = {},
): AnyItemMetadata {
  return { ...REGISTRY[templateType].defaults, ...partial } as AnyItemMetadata;
}
