/**
 * JSON Schema parser for DAQ job configurations.
 * Converts JSON Schema from the API into form field definitions.
 */

export interface FieldDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'object';
  label: string;
  description?: string;
  required?: boolean;
  default?: string | number | boolean | null;
  options?: { value: string; label: string }[];
  nullable?: boolean;
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
  storeConfigKey: 'store_config' | 'waveform_store_config';
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

type RawAPIResponse = Record<string, { $ref: string; $defs: Record<string, JSONSchema> }>;

/**
 * Convert a property name to a human-readable label
 */
function toLabel(name: string): string {
  return name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Resolve a $ref to its definition
 */
function resolveRef(ref: string, defs: Record<string, JSONSchema>): JSONSchema | null {
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
function getFieldType(schema: JSONSchema, defs: Record<string, JSONSchema>): FieldDefinition['type'] {
  // Handle $ref
  if (schema.$ref) {
    const resolved = resolveRef(schema.$ref, defs);
    if (resolved) {
      return getFieldType(resolved, defs);
    }
  }

  // Handle anyOf (nullable types)
  if (schema.anyOf) {
    const nonNullType = schema.anyOf.find(s => s.type !== 'null');
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
    return schema.anyOf.some(s => s.type === 'null');
  }
  return false;
}

/**
 * Get enum options from a schema
 */
function getEnumOptions(schema: JSONSchema, defs: Record<string, JSONSchema>): { value: string; label: string }[] | undefined {
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
    return schema.enum.map(value => ({
      value,
      label: toLabel(value),
    }));
  }

  return undefined;
}

/**
 * Get the description from a schema, handling $ref and anyOf
 */
function getDescription(schema: JSONSchema, defs: Record<string, JSONSchema>): string | undefined {
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
function parseField(name: string, schema: JSONSchema, required: boolean, defs: Record<string, JSONSchema>): FieldDefinition {
  const fieldType = getFieldType(schema, defs);
  
  return {
    name,
    type: fieldType,
    label: toLabel(name),
    description: getDescription(schema, defs),
    required,
    default: schema.default as FieldDefinition['default'],
    options: getEnumOptions(schema, defs),
    nullable: isNullable(schema),
  };
}

/**
 * Parse store config schemas from the $defs
 */
function parseStoreConfigSchemas(defs: Record<string, JSONSchema>): Record<string, StoreConfigSchema> {
  const storeSchemas: Record<string, StoreConfigSchema> = {};
  
  // Parse remote_config fields to include in all store configs
  // Note: drop_remote_messages is only for global remote_config, not store-level
  const remoteConfigFields: FieldDefinition[] = [];
  const remoteConfigDef = defs['DAQRemoteConfig'];
  if (remoteConfigDef?.properties) {
    for (const [propName, propSchema] of Object.entries(remoteConfigDef.properties)) {
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
        
        fields.push(parseField(propName, propSchema, requiredFields.has(propName), defs));
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
function parseGlobalRemoteConfigFields(defs: Record<string, JSONSchema>): FieldDefinition[] {
  const fields: FieldDefinition[] = [];
  const remoteConfigDef = defs['DAQRemoteConfig'];
  
  if (remoteConfigDef?.properties) {
    for (const [propName, propSchema] of Object.entries(remoteConfigDef.properties)) {
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
function parseJobSchema(jobType: string, data: { $ref: string; $defs: Record<string, JSONSchema> }): DAQJobSchema | null {
  const defs = data.$defs;
  
  // Resolve the main config definition
  const mainConfigName = data.$ref.replace('#/$defs/', '');
  const mainConfig = defs[mainConfigName];
  
  if (!mainConfig || !mainConfig.properties) {
    return null;
  }
  
  const fields: FieldDefinition[] = [];
  const requiredFields = new Set(mainConfig.required || []);
  
  // Determine store config key based on job type
  // CAEN digitizers use waveform_store_config
  const hasWaveformStore = 'waveform_store_config' in mainConfig.properties;
  const storeConfigKey: 'store_config' | 'waveform_store_config' = hasWaveformStore 
    ? 'waveform_store_config' 
    : 'store_config';
  
  for (const [propName, propSchema] of Object.entries(mainConfig.properties)) {
    // Skip meta fields and store configs (handled separately)
    if (['daq_job_type', 'store_config', 'waveform_store_config', 'remote_config', 'verbosity'].includes(propName)) {
      continue;
    }
    
    const fieldType = getFieldType(propSchema, defs);
    
    // Skip complex object types for now
    if (fieldType === 'object') {
      continue;
    }
    
    fields.push(parseField(propName, propSchema, requiredFields.has(propName), defs));
  }
  
  // Parse global remote_config fields
  const remoteConfigFields = parseGlobalRemoteConfigFields(defs);
  
  return {
    type: jobType,
    label: mainConfig.title?.replace('Config', '').replace('DAQJob', '') || toLabel(jobType),
    description: mainConfig.description,
    fields,
    requiredFields: Array.from(requiredFields),
    storeConfigKey,
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
export function getJobTypes(schemas: ParsedSchemas): { value: string; label: string }[] {
  return Object.values(schemas.jobSchemas).map(s => ({
    value: s.type,
    label: s.label,
  }));
}

/**
 * Get available store config types
 */
export function getStoreTypes(schemas: ParsedSchemas): { value: string; label: string }[] {
  return Object.values(schemas.storeConfigSchemas).map(s => ({
    value: s.type,
    label: s.label,
  }));
}
