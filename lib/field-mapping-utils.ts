import { MODEL_BIBLE_FIELDS } from './model-bible-fields';

/**
 * Build a modelBible from direct target→value pairs.
 * Used when edited values are already resolved (user may have edited them).
 *
 * @param values - Record<targetPath, finalValue>
 * @param existingBible - Existing modelBible to merge with
 */
export function buildModelBibleFromValues(
  values: Record<string, string>,
  existingBible: Record<string, unknown> = {},
): Record<string, unknown> {
  const result: Record<string, unknown> = JSON.parse(JSON.stringify(existingBible));
  const fieldDefMap = new Map(MODEL_BIBLE_FIELDS.map((f) => [f.path, f]));

  for (const [targetPath, rawValue] of Object.entries(values)) {
    if (!rawValue && rawValue !== '') continue;

    const fieldDef = fieldDefMap.get(targetPath);
    const converted = convertValue(rawValue, fieldDef?.type ?? 'string');
    setNestedValue(result, targetPath, converted);
  }

  return result;
}

/**
 * Build a modelBible from field mappings (legacy).
 *
 * @param mappings - Record<targetPath, sourceFieldName>
 * @param formFields - Record<sourceFieldName, value>
 * @param existingBible - Existing modelBible to merge with
 */
export function buildModelBible(
  mappings: Record<string, string>,
  formFields: Record<string, string>,
  existingBible: Record<string, unknown> = {},
): Record<string, unknown> {
  const values: Record<string, string> = {};
  for (const [targetPath, sourceKey] of Object.entries(mappings)) {
    if (!sourceKey) continue;
    const val = formFields[sourceKey];
    if (val !== undefined && val !== null) {
      values[targetPath] = val;
    }
  }
  return buildModelBibleFromValues(values, existingBible);
}

function convertValue(raw: string, type: string): unknown {
  if (!raw) return type === 'boolean' ? false : type === 'string[]' ? [] : '';
  switch (type) {
    case 'string[]':
      return raw
        .split(/[,\n]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    case 'boolean': {
      const lower = raw.toLowerCase().trim();
      return ['yes', 'true', '1', 'y', 'ok', 'sure'].includes(lower);
    }
    default:
      return raw.trim();
  }
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (typeof current[key] !== 'object' || current[key] === null) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]] = value;
}
