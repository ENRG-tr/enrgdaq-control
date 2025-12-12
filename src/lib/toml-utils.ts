import TOML from '@iarna/toml';

export type TomlValue =
  | string
  | number
  | boolean
  | Date
  | TomlValue[]
  | TomlObject;
export type TomlObject = { [key: string]: TomlValue };

/**
 * Parse a TOML string into a JavaScript object
 */
export function parseToml(tomlString: string): TomlObject {
  try {
    return TOML.parse(tomlString) as TomlObject;
  } catch (error) {
    console.error('Failed to parse TOML:', error);
    return {};
  }
}

/**
 * Stringify a JavaScript object to TOML format
 */
export function stringifyToml(obj: TomlObject): string {
  try {
    return TOML.stringify(obj as TOML.JsonMap);
  } catch (error) {
    console.error('Failed to stringify TOML:', error);
    return '';
  }
}

/**
 * Determine the field type for form rendering
 */
export function getFieldType(
  value: TomlValue
): 'string' | 'number' | 'boolean' | 'array' | 'object' {
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'string') return 'string';
  if (Array.isArray(value)) return 'array';
  if (value instanceof Date) return 'string';
  if (typeof value === 'object' && value !== null) return 'object';
  return 'string';
}

/**
 * Check if a value looks like a number (for smart type inference from TOML)
 */
export function isNumericString(value: string): boolean {
  // Check for binary (0b), hex (0x), octal (0o), or decimal numbers
  if (/^0b[01]+$/i.test(value)) return true;
  if (/^0x[0-9a-f]+$/i.test(value)) return true;
  if (/^0o[0-7]+$/i.test(value)) return true;
  return !isNaN(Number(value)) && value.trim() !== '';
}

/**
 * Get a human-readable label from a key name
 */
export function keyToLabel(key: string): string {
  return key
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Flatten nested object paths for form field names
 */
export function flattenObject(
  obj: TomlObject,
  prefix = ''
): Record<string, TomlValue> {
  const result: Record<string, TomlValue> = {};

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      !(value instanceof Date)
    ) {
      Object.assign(result, flattenObject(value as TomlObject, fullKey));
    } else {
      result[fullKey] = value;
    }
  }

  return result;
}

/**
 * Unflatten dot-notation keys back into nested object
 */
export function unflattenObject(flat: Record<string, TomlValue>): TomlObject {
  const result: TomlObject = {};

  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split('.');
    let current: TomlObject = result;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current)) {
        current[part] = {};
      }
      current = current[part] as TomlObject;
    }

    current[parts[parts.length - 1]] = value;
  }

  return result;
}
