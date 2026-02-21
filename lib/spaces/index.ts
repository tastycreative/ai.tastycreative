export {
  // Types
  type SpaceTemplateType,
  type FieldType,
  type MetadataFieldDescriptor,
  type AnyItemMetadata,
  type KanbanItemMetadata,
  type WallPostItemMetadata,
  type SextingSetsItemMetadata,
  type OtpPtrItemMetadata,

  // Defaults
  KANBAN_METADATA_DEFAULTS,
  WALL_POST_METADATA_DEFAULTS,
  SEXTING_SETS_METADATA_DEFAULTS,
  OTP_PTR_METADATA_DEFAULTS,

  // Field descriptors
  KANBAN_METADATA_FIELDS,
  WALL_POST_METADATA_FIELDS,
  SEXTING_SETS_METADATA_FIELDS,
  OTP_PTR_METADATA_FIELDS,

  // Helpers
  getMetadataDefaults,
  getMetadataFields,
  mergeMetadata,
} from './template-metadata';
