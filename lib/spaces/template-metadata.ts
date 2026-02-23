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

export type SpaceTemplateType = 'KANBAN' | 'WALL_POST' | 'SEXTING_SETS' | 'OTP_PTR';

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
  { key: 'model', label: 'Model', type: 'text', placeholder: 'Model name' },
  { key: 'mediaCount', label: 'Media Count', type: 'number', placeholder: '0' },
];

/* ================================================================== */
/*  SEXTING SETS                                                       */
/* ================================================================== */

export interface SextingSetsItemMetadata {
  category: string;
  setSize: number;
  model: string;
  quality: string;
  watermarked: boolean;
  tags: string[];
}

export const SEXTING_SETS_METADATA_DEFAULTS: SextingSetsItemMetadata = {
  category: '',
  setSize: 0,
  model: '',
  quality: 'HD',
  watermarked: false,
  tags: [],
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
  requestType: 'OTP' | 'PTR' | 'CUSTOM';
  price: number;
  model: string;
  pricingTier: string;
  pageType: string;
  driveLink: string;
  contentType: string;
  contentLength: string;
  contentCount: string;
  deliverables: string[];
  externalCreatorTags: string[];
  internalModelTags: string[];
  contentTags: string[];
  deadline: string;
  isPaid: boolean;
  fulfillmentNotes: string;
}

export const OTP_PTR_METADATA_DEFAULTS: OtpPtrItemMetadata = {
  requestType: 'OTP',
  price: 0,
  model: '',
  pricingTier: '',
  pageType: '',
  driveLink: '',
  contentType: '',
  contentLength: '',
  contentCount: '',
  deliverables: [],
  externalCreatorTags: [],
  internalModelTags: [],
  contentTags: [],
  deadline: '',
  isPaid: false,
  fulfillmentNotes: '',
};

export const OTP_PTR_METADATA_FIELDS: MetadataFieldDescriptor[] = [
  {
    key: 'requestType',
    label: 'Request Type',
    type: 'select',
    required: true,
    options: ['OTP', 'PTR', 'CUSTOM'],
  },
  { key: 'price', label: 'Price ($)', type: 'number', required: true, placeholder: '0.00' },
  { key: 'model', label: 'Model', type: 'text', placeholder: 'Model name' },
  {
    key: 'pricingTier',
    label: 'Pricing Tier',
    type: 'select',
    options: ['Porn Accurate', 'Porn Scam', 'GF Accurate', 'GF Scam'],
  },
  {
    key: 'pageType',
    label: 'Page Type',
    type: 'select',
    options: ['All Pages', 'Free', 'Paid', 'VIP'],
  },
  { key: 'driveLink', label: 'Drive Link', type: 'text', placeholder: 'https://drive.google.com/...' },
  {
    key: 'contentType',
    label: 'Content Type',
    type: 'select',
    options: ['Photo', 'Video', 'Photo Set', 'Video Set', 'Mixed (Photos + Videos)', 'GIF', 'Livestream', 'Audio', 'Text Only'],
  },
  { key: 'contentLength', label: 'Content Length', type: 'text', placeholder: 'e.g. 8:43 or 8 mins 43 secs' },
  { key: 'contentCount', label: 'Content Count', type: 'text', placeholder: 'e.g. 1 Video, 3 Photos' },
  { key: 'deliverables', label: 'Deliverables', type: 'tags', placeholder: 'e.g. 3 photos, 1 video' },
  { key: 'externalCreatorTags', label: 'Tags — External Creators', type: 'tags', placeholder: '@johndoe @janedoe' },
  { key: 'internalModelTags', label: 'Tags — Internal Models', type: 'tags', placeholder: '@modelname' },
  { key: 'contentTags', label: 'Content Tags', type: 'tags', placeholder: 'e.g. exclusive, solo, custom' },
  { key: 'deadline', label: 'Deadline', type: 'date' },
  { key: 'isPaid', label: 'Paid', type: 'boolean' },
  { key: 'fulfillmentNotes', label: 'Fulfillment Notes', type: 'textarea', placeholder: 'Delivery instructions...' },
];

/* ================================================================== */
/*  Registry — look up by template type                                */
/* ================================================================== */

export type AnyItemMetadata =
  | KanbanItemMetadata
  | WallPostItemMetadata
  | SextingSetsItemMetadata
  | OtpPtrItemMetadata;

interface TemplateMetadataEntry<T> {
  defaults: T;
  fields: MetadataFieldDescriptor[];
}

const REGISTRY: Record<SpaceTemplateType, TemplateMetadataEntry<AnyItemMetadata>> = {
  KANBAN: { defaults: KANBAN_METADATA_DEFAULTS, fields: KANBAN_METADATA_FIELDS },
  WALL_POST: { defaults: WALL_POST_METADATA_DEFAULTS, fields: WALL_POST_METADATA_FIELDS },
  SEXTING_SETS: { defaults: SEXTING_SETS_METADATA_DEFAULTS, fields: SEXTING_SETS_METADATA_FIELDS },
  OTP_PTR: { defaults: OTP_PTR_METADATA_DEFAULTS, fields: OTP_PTR_METADATA_FIELDS },
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
