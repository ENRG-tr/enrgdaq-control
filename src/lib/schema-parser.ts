/**
 * JSON Schema parser for DAQ job configurations.
 * Converts JSON Schema from the API into form field definitions.
 */

export interface FieldDefinition {
  name: string;
  type:
    | 'string'
    | 'number'
    | 'boolean'
    | 'select'
    | 'object'
    | 'array'
    | 'arrayOfObjects';
  label: string;
  description?: string;
  required?: boolean;
  default?: string | number | boolean | null | string[] | unknown[];
  options?: { value: string; label: string }[];
  nullable?: boolean;
  arrayItemType?: 'string' | 'number'; // For simple array fields (list[str], list[int])
  objectFields?: FieldDefinition[]; // For arrayOfObjects, the fields of each item
  objectSchemaName?: string; // The schema name for display purposes
}

export interface StoreConfigSchema {
  type: string;
  label: string;
  description?: string;
  fields: FieldDefinition[];
}

export interface DAQJobSchema {
  type: string;
  label: string;
  description?: string;
  fields: FieldDefinition[];
  requiredFields: string[];
  // Array of store config property names detected from schema (properties that reference DAQJobStoreConfig)
  storeConfigKeys: string[];
  remoteConfigFields: FieldDefinition[];
}

export interface ParsedSchemas {
  jobSchemas: Record<string, DAQJobSchema>;
  storeConfigSchemas: Record<string, StoreConfigSchema>;
}

// JSON Schema types
interface JSONSchema {
  $ref?: string;
  $defs?: Record<string, JSONSchema>;
  type?: string | string[];
  title?: string;
  description?: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  default?: unknown;
  anyOf?: JSONSchema[];
  enum?: string[];
  items?: JSONSchema;
}

type RawAPIResponse = Record<
  string,
  { $ref: string; $defs: Record<string, JSONSchema> }
>;

/**
 * Convert a property name to a human-readable label
 */
function toLabel(name: string): string {
  return name
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Resolve a $ref to its definition
 */
function resolveRef(
  ref: string,
  defs: Record<string, JSONSchema>,
): JSONSchema | null {
  // $ref format: "#/$defs/DefinitionName"
  const match = ref.match(/^#\/\$defs\/(.+)$/);
  if (match && defs[match[1]]) {
    return defs[match[1]];
  }
  return null;
}

/**
 * Determine the field type from a JSON Schema property
 */
function getFieldType(
  schema: JSONSchema,
  defs: Record<string, JSONSchema>,
): FieldDefinition['type'] {
  // Handle $ref
  if (schema.$ref) {
    const resolved = resolveRef(schema.$ref, defs);
    if (resolved) {
      return getFieldType(resolved, defs);
    }
  }

  // Handle anyOf (nullable types)
  if (schema.anyOf) {
    const nonNullType = schema.anyOf.find((s) => s.type !== 'null');
    if (nonNullType) {
      return getFieldType(nonNullType, defs);
    }
  }

  // Handle enum as select
  if (schema.enum) {
    return 'select';
  }

  // Handle basic types
  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
  switch (type) {
    case 'boolean':
      return 'boolean';
    case 'integer':
    case 'number':
      return 'number';
    case 'array':
      // Check if it's an array of objects (has items with $ref)
      if (schema.items?.$ref) {
        return 'arrayOfObjects';
      }
      return 'array';
    case 'object':
      return 'object';
    default:
      return 'string';
  }
}

/**
 * Check if a field is nullable (can be null)
 */
function isNullable(schema: JSONSchema): boolean {
  if (schema.anyOf) {
    return schema.anyOf.some((s) => s.type === 'null');
  }
  return false;
}

/**
 * Get enum options from a schema
 */
function getEnumOptions(
  schema: JSONSchema,
  defs: Record<string, JSONSchema>,
): { value: string; label: string }[] | undefined {
  // Handle $ref
  if (schema.$ref) {
    const resolved = resolveRef(schema.$ref, defs);
    if (resolved) {
      return getEnumOptions(resolved, defs);
    }
  }

  // Handle anyOf
  if (schema.anyOf) {
    for (const s of schema.anyOf) {
      const opts = getEnumOptions(s, defs);
      if (opts) return opts;
    }
  }

  if (schema.enum) {
    return schema.enum.map((value) => ({
      value,
      label: toLabel(value),
    }));
  }

  return undefined;
}

/**
 * Get the description from a schema, handling $ref and anyOf
 */
function getDescription(
  schema: JSONSchema,
  defs: Record<string, JSONSchema>,
): string | undefined {
  if (schema.description) return schema.description;

  if (schema.$ref) {
    const resolved = resolveRef(schema.$ref, defs);
    if (resolved?.description) return resolved.description;
  }

  if (schema.anyOf) {
    for (const s of schema.anyOf) {
      const desc = getDescription(s, defs);
      if (desc) return desc;
    }
  }

  return undefined;
}

/**
 * Parse a JSON Schema property into a FieldDefinition
 */
function parseField(
  name: string,
  schema: JSONSchema,
  required: boolean,
  defs: Record<string, JSONSchema>,
): FieldDefinition {
  const fieldType = getFieldType(schema, defs);

  // Detect array item type or object fields
  let arrayItemType: 'string' | 'number' | undefined;
  let objectFields: FieldDefinition[] | undefined;
  let objectSchemaName: string | undefined;

  if (fieldType === 'array') {
    // Get the actual schema (resolve anyOf if needed)
    let arraySchema = schema;
    if (schema.anyOf) {
      arraySchema = schema.anyOf.find((s) => s.type === 'array') || schema;
    }
    if (schema.$ref) {
      arraySchema = resolveRef(schema.$ref, defs) || schema;
    }

    if (arraySchema.items) {
      const itemType = Array.isArray(arraySchema.items.type)
        ? arraySchema.items.type[0]
        : arraySchema.items.type;
      if (itemType === 'integer' || itemType === 'number') {
        arrayItemType = 'number';
      } else {
        arrayItemType = 'string';
      }
    } else {
      arrayItemType = 'string'; // Default to string array
    }
  } else if (fieldType === 'arrayOfObjects') {
    // Resolve the item schema
    let arraySchema = schema;
    if (schema.anyOf) {
      arraySchema =
        schema.anyOf.find(
          (s) => s.type === 'array' || (s.items && s.items.$ref),
        ) || schema;
    }

    if (arraySchema.items && arraySchema.items.$ref) {
      const refName = arraySchema.items.$ref.replace('#/$defs/', '');
      objectSchemaName = toLabel(refName);
      const itemSchema = resolveRef(arraySchema.items.$ref, defs);

      if (itemSchema && itemSchema.properties) {
        objectFields = [];
        const requiredFields = new Set(itemSchema.required || []);

        for (const [propName, propSchema] of Object.entries(
          itemSchema.properties,
        )) {
          // Prevent infinite recursion by skipping complex nested objects inside the array item for now
          // We can expand this later if needed
          const propType = getFieldType(propSchema, defs);
          if (propType === 'object' || propType === 'arrayOfObjects') {
            continue;
          }

          objectFields.push(
            parseField(
              propName,
              propSchema,
              requiredFields.has(propName),
              defs,
            ),
          );
        }
      }
    }
  }

  return {
    name,
    type: fieldType,
    label: toLabel(name),
    description: getDescription(schema, defs),
    required,
    default: schema.default as FieldDefinition['default'],
    options: getEnumOptions(schema, defs),
    nullable: isNullable(schema),
    arrayItemType,
    objectFields,
    objectSchemaName,
  };
}

/**
 * Parse store config schemas from the $defs
 */
function parseStoreConfigSchemas(
  defs: Record<string, JSONSchema>,
): Record<string, StoreConfigSchema> {
  const storeSchemas: Record<string, StoreConfigSchema> = {};

  // Parse remote_config fields to include in all store configs
  // Note: drop_remote_messages is only for global remote_config, not store-level
  const remoteConfigFields: FieldDefinition[] = [];
  const remoteConfigDef = defs['DAQRemoteConfig'];
  if (remoteConfigDef?.properties) {
    for (const [propName, propSchema] of Object.entries(
      remoteConfigDef.properties,
    )) {
      // Skip drop_remote_messages - it only applies at job level, not store level
      if (propName === 'drop_remote_messages') continue;

      const fieldType = getFieldType(propSchema, defs);
      if (fieldType !== 'object') {
        remoteConfigFields.push({
          ...parseField(propName, propSchema, false, defs),
          name: `remote_config.${propName}`,
          label: `Remote: ${toLabel(propName)}`,
        });
      }
    }
  }

  // Find all DAQJobStoreConfig* definitions
  const storeConfigTypes = [
    { key: 'csv', defName: 'DAQJobStoreConfigCSV' },
    { key: 'raw', defName: 'DAQJobStoreConfigRaw' },
    { key: 'root', defName: 'DAQJobStoreConfigROOT' },
    { key: 'hdf5', defName: 'DAQJobStoreConfigHDF5' },
    { key: 'mysql', defName: 'DAQJobStoreConfigMySQL' },
    { key: 'redis', defName: 'DAQJobStoreConfigRedis' },
    { key: 'memory', defName: 'DAQJobStoreConfigMemory' },
  ];

  for (const { key, defName } of storeConfigTypes) {
    const def = defs[defName];
    if (!def) continue;

    const fields: FieldDefinition[] = [];
    const requiredFields = new Set(def.required || []);

    if (def.properties) {
      for (const [propName, propSchema] of Object.entries(def.properties)) {
        // Skip remote_config here - we add it separately with prefixed fields
        if (propName === 'remote_config') continue;

        fields.push(
          parseField(propName, propSchema, requiredFields.has(propName), defs),
        );
      }
    }

    // Add remote_config fields at the end
    fields.push(...remoteConfigFields);

    storeSchemas[key] = {
      type: key,
      label: def.title || toLabel(key),
      description: def.description,
      fields,
    };
  }

  return storeSchemas;
}

/**
 * Parse global remote_config fields for job level
 */
function parseGlobalRemoteConfigFields(
  defs: Record<string, JSONSchema>,
): FieldDefinition[] {
  const fields: FieldDefinition[] = [];
  const remoteConfigDef = defs['DAQRemoteConfig'];

  if (remoteConfigDef?.properties) {
    for (const [propName, propSchema] of Object.entries(
      remoteConfigDef.properties,
    )) {
      const fieldType = getFieldType(propSchema, defs);
      if (fieldType !== 'object') {
        fields.push({
          ...parseField(propName, propSchema, false, defs),
          name: `remote_config.${propName}`,
          label: toLabel(propName),
        });
      }
    }
  }

  return fields;
}

/**
 * Parse a single DAQ job schema
 */
function parseJobSchema(
  jobType: string,
  data: { $ref: string; $defs: Record<string, JSONSchema> },
): DAQJobSchema | null {
  const defs = data.$defs;

  // Resolve the main config definition
  const mainConfigName = data.$ref.replace('#/$defs/', '');
  const mainConfig = defs[mainConfigName];

  if (!mainConfig || !mainConfig.properties) {
    return null;
  }

  const fields: FieldDefinition[] = [];
  const requiredFields = new Set(mainConfig.required || []);

  // Detect store config keys dynamically by finding properties that reference DAQJobStoreConfig
  const storeConfigKeys: string[] = [];
  const storeConfigRefPattern = '#/$defs/DAQJobStoreConfig';

  // Helper to check if a property references DAQJobStoreConfig (directly or via anyOf)
  const isStoreConfigProperty = (propSchema: JSONSchema): boolean => {
    // Direct reference
    if (propSchema.$ref === storeConfigRefPattern) {
      return true;
    }
    // Check anyOf (for optional store configs like "anyOf": [{ "type": "null" }, { "$ref": "#/$defs/DAQJobStoreConfig" }])
    if (propSchema.anyOf) {
      return propSchema.anyOf.some(
        (option) => option.$ref === storeConfigRefPattern,
      );
    }
    return false;
  };

  for (const [propName, propSchema] of Object.entries(mainConfig.properties)) {
    // Check if this property references DAQJobStoreConfig (directly or via anyOf)
    if (isStoreConfigProperty(propSchema)) {
      storeConfigKeys.push(propName);
      continue; // Skip adding to regular fields
    }

    // Skip meta fields and remote_config (handled separately)
    if (['daq_job_type', 'remote_config', 'verbosity'].includes(propName)) {
      continue;
    }

    // Skip properties already identified as store configs
    if (storeConfigKeys.includes(propName)) {
      continue;
    }

    const fieldType = getFieldType(propSchema, defs);

    // Skip complex object types for now
    if (fieldType === 'object') {
      continue;
    }

    fields.push(
      parseField(propName, propSchema, requiredFields.has(propName), defs),
    );
  }

  // Parse global remote_config fields
  const remoteConfigFields = parseGlobalRemoteConfigFields(defs);

  return {
    type: jobType,
    label: toLabel(jobType),
    description: mainConfig.description,
    fields,
    requiredFields: Array.from(requiredFields),
    storeConfigKeys,
    remoteConfigFields,
  };
}

/**
 * Parse the full API response into usable schemas
 */
export function parseDAQJobSchemas(apiResponse: RawAPIResponse): ParsedSchemas {
  const jobSchemas: Record<string, DAQJobSchema> = {};
  let storeConfigSchemas: Record<string, StoreConfigSchema> = {};

  for (const [jobType, data] of Object.entries(apiResponse)) {
    // Parse job schema
    const jobSchema = parseJobSchema(jobType, data);
    if (jobSchema) {
      jobSchemas[jobType] = jobSchema;
    }

    // Parse store config schemas from the first job that has $defs
    // (they're the same across all jobs)
    if (Object.keys(storeConfigSchemas).length === 0 && data.$defs) {
      storeConfigSchemas = parseStoreConfigSchemas(data.$defs);
    }
  }

  return { jobSchemas, storeConfigSchemas };
}

/**
 * Get available job types from parsed schemas
 */
export function getJobTypes(
  schemas: ParsedSchemas,
): { value: string; label: string }[] {
  return Object.values(schemas.jobSchemas).map((s) => ({
    value: s.type,
    label: s.label,
  }));
}

/**
 * Get available store config types
 */
export function getStoreTypes(
  schemas: ParsedSchemas,
): { value: string; label: string }[] {
  return Object.values(schemas.storeConfigSchemas).map((s) => ({
    value: s.type,
    label: s.label,
  }));
}

/**
 * Generate a commented TOML string from a DAQJobSchema
 */
export function generateCommentedToml(
  schemas: ParsedSchemas,
  jobType: string,
): string {
  const schema = schemas.jobSchemas[jobType];
  if (!schema) return `daq_job_type = "${jobType}"`;

  const lines: string[] = [];

  if (schema.label) {
    lines.push(`# ==========================================`);
    lines.push(`# ${schema.label}`);
    lines.push(`# ==========================================`);
  }
  if (schema.description) {
    const descLines = schema.description.split('\n');
    for (const d of descLines) {
      lines.push(`# ${d.trim()}`);
    }
  }
  lines.push('');
  lines.push(`daq_job_type = "${jobType}"`);
  lines.push('');

  // Process normal fields
  for (const field of schema.fields) {
    if (field.name.includes('.')) continue; // skip remote_config for now

    if (field.description) {
      const descLines = field.description.split('\n');
      for (const d of descLines) {
        lines.push(`# ${d.trim()}`);
      }
    }

    let defaultStr = '""';
    if (field.default !== undefined && field.default !== null) {
      if (typeof field.default === 'string') defaultStr = `"${field.default}"`;
      else if (Array.isArray(field.default))
        defaultStr = `[${field.default.map((v) => (typeof v === 'string' ? `"${v}"` : v)).join(', ')}]`;
      else defaultStr = String(field.default);
    } else {
      if (field.type === 'number') defaultStr = '0';
      if (field.type === 'boolean') defaultStr = 'false';
      if (field.type === 'array') defaultStr = '[]';
    }

    const isRequired = field.required ? '' : '# ';
    lines.push(`${isRequired}${field.name} = ${defaultStr}`);
    lines.push('');
  }

  // Remote config group
  const rcFields = schema.fields.filter((f) =>
    f.name.startsWith('remote_config.'),
  );
  if (rcFields.length > 0) {
    lines.push(`[remote_config]`);
    for (const field of rcFields) {
      if (field.description) {
        const descLines = field.description.split('\n');
        for (const d of descLines) {
          lines.push(`# ${d.trim()}`);
        }
      }
      const rawName = field.name.replace('remote_config.', '');

      let defaultStr = '""';
      if (field.default !== undefined && field.default !== null) {
        if (typeof field.default === 'string')
          defaultStr = `"${field.default}"`;
        else defaultStr = String(field.default);
      } else {
        if (field.type === 'number') defaultStr = '0';
        if (field.type === 'boolean') defaultStr = 'false';
        if (field.type === 'array') defaultStr = '[]';
      }

      const isRequired = field.required ? '' : '# ';
      lines.push(`${isRequired}${rawName} = ${defaultStr}`);
      lines.push('');
    }
  }

  // Store Configs
  if (schema.storeConfigKeys && schema.storeConfigKeys.length > 0) {
    lines.push(`# ==========================================`);
    lines.push(`# Store Configurations`);
    lines.push(`# ==========================================`);
    lines.push('');

    const storeTypes = Object.values(schemas.storeConfigSchemas);
    if (storeTypes.length > 0) {
      lines.push(
        `# Available store config types: ${storeTypes.map((s) => s.type).join(', ')}`,
      );
      lines.push('');
      const exampleType = storeTypes[0];
      for (const stKey of schema.storeConfigKeys) {
        lines.push(`# Example of a ${exampleType.type} store for ${stKey}:`);
        lines.push(`#[${stKey}]`);
        lines.push(`#type = "${exampleType.type}"`);
        for (const field of exampleType.fields) {
          if (field.name.includes('.')) continue; // skip nested
          let defaultStr = '""';
          if (field.type === 'number') defaultStr = '0';
          if (field.type === 'boolean') defaultStr = 'false';
          const isRequired = field.required ? '' : '# ';
          lines.push(`#${isRequired}${field.name} = ${defaultStr}`);
        }
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}
