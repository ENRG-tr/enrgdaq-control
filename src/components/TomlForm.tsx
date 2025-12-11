'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  parseToml,
  stringifyToml,
  type TomlObject,
} from '@/lib/toml-utils';
import {
  parseDAQJobSchemas,
  getJobTypes,
  type ParsedSchemas,
  type FieldDefinition,
  type DAQJobSchema,
  type StoreConfigSchema,
} from '@/lib/schema-parser';
import { API } from '@/lib/api-client';

interface TomlFormProps {
  initialToml: string;
  onChange: (tomlString: string) => void;
  disabled?: boolean;
}

interface StoreConfigEntry {
  id: string;
  type: string;
  fields: Record<string, FieldValue>;
}

type FieldValue = string | number | boolean | string[] | Record<string, any>[];

interface FormData {
  daq_job_type: string;
  jobFields: Record<string, FieldValue>;
  // Dynamic store configs keyed by the store config property name (e.g., 'store_config', 'waveform_store_config', etc.)
  storeConfigsByKey: Record<string, StoreConfigEntry[]>;
  remoteConfigFields: Record<string, FieldValue>;
}

let storeConfigIdCounter = 0;
const generateId = () => `store-${++storeConfigIdCounter}`;

// Format description text with line breaks and preserved indentation
const formatDescription = (text: string | undefined): React.ReactNode => {
  if (!text) return null;
  
  // Split by newlines and render each line
  const lines = text.split('\n');
  
  return (
    <>
      {lines.map((line, index) => {
        // Count leading spaces and preserve them using non-breaking spaces
        const leadingSpaces = line.match(/^(\s*)/)?.[1].length || 0;
        const indent = '\u00A0'.repeat(leadingSpaces); // non-breaking spaces
        const trimmedLine = line.trimStart();
        
        return (
          <React.Fragment key={index}>
            {indent}{trimmedLine}
            {index < lines.length - 1 && <br />}
          </React.Fragment>
        );
      })}
    </>
  );
};

const TomlForm: React.FC<TomlFormProps> = ({ initialToml, onChange, disabled = false }) => {
  const [schemas, setSchemas] = useState<ParsedSchemas | null>(null);
  const [schemasLoading, setSchemasLoading] = useState(true);
  const [schemasError, setSchemasError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<FormData>({
    daq_job_type: '',
    jobFields: {},
    storeConfigsByKey: {},
    remoteConfigFields: {},
  });
  const [showRawEditor, setShowRawEditor] = useState(false);
  const [rawToml, setRawToml] = useState(initialToml);
  const [parseError, setParseError] = useState<string | null>(null);

  // Fetch schemas on mount
  useEffect(() => {
    const fetchSchemas = async () => {
      try {
        setSchemasLoading(true);
        const rawSchemas = await API.getDAQJobSchemas();
        const parsed = parseDAQJobSchemas(rawSchemas as Parameters<typeof parseDAQJobSchemas>[0]);
        setSchemas(parsed);
        setSchemasError(null);
        
        // Set default job type if not already set
        const jobTypes = getJobTypes(parsed);
        if (jobTypes.length > 0 && !formData.daq_job_type) {
          setFormData(prev => ({
            ...prev,
            daq_job_type: jobTypes[0].value,
          }));
        }
      } catch (error) {
        console.error('Failed to fetch DAQ job schemas:', error);
        setSchemasError('Failed to load DAQ job schemas. Using raw TOML editor.');
        setShowRawEditor(true);
      } finally {
        setSchemasLoading(false);
      }
    };
    
    fetchSchemas();
  }, []);

  // Parse TOML when initialToml or schemas change
  useEffect(() => {
    if (!schemas) return;
    
    // Skip parsing if the incoming TOML matches what we last generated
    // This means it's just our own changes echoed back from the parent
    if (initialToml === rawToml) {
      return;
    }
    
    try {
      const parsed = parseToml(initialToml);
      
      // Extract daq_job_type
      const daqJobType = (parsed.daq_job_type as string) || Object.keys(schemas.jobSchemas)[0] || '';
      const jobSchema = schemas.jobSchemas[daqJobType];
      
      // Extract job-specific fields
      const jobFields: Record<string, FieldValue> = {};
      if (jobSchema) {
        for (const field of jobSchema.fields) {
          if (parsed[field.name] !== undefined) {
            jobFields[field.name] = parsed[field.name] as FieldValue;
          } else if (field.default !== undefined && field.default !== null) {
            jobFields[field.name] = field.default as FieldValue;
          }
        }
      }
      
      // Extract store configs (can have multiple) - separate arrays for each type
      // Get which store config keys this job type supports (detected from schema)
      const supportedStoreConfigKeys = jobSchema?.storeConfigKeys || [];
      
      // Helper to parse store config entries from a TOML section
      const parseStoreConfigSection = (config: TomlObject): StoreConfigEntry[] => {
        const entries: StoreConfigEntry[] = [];
        for (const type of Object.keys(schemas.storeConfigSchemas)) {
          if (config[type]) {
            const typeConfig = config[type] as TomlObject;
            const fields: Record<string, FieldValue> = {};
            
            // Flatten nested objects (like remote_config) into dot-notation keys
            const flattenConfig = (obj: TomlObject, prefix = '') => {
              for (const [key, value] of Object.entries(obj)) {
                const fullKey = prefix ? `${prefix}.${key}` : key;
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                  flattenConfig(value as TomlObject, fullKey);
                } else {
                  fields[fullKey] = value as FieldValue;
                }
              }
            };
            flattenConfig(typeConfig);
            
            entries.push({
              id: generateId(),
              type,
              fields,
            });
          }
        }
        return entries;
      };
      
      // Parse store configs dynamically based on supported keys
      const storeConfigsByKey: Record<string, StoreConfigEntry[]> = {};
      const storeTypes = Object.keys(schemas.storeConfigSchemas);
      
      for (const storeConfigKey of supportedStoreConfigKeys) {
        const configSection = parsed[storeConfigKey] as TomlObject | undefined;
        if (configSection) {
          storeConfigsByKey[storeConfigKey] = parseStoreConfigSection(configSection);
        }
        
        // Add default if empty and we have store types available
        if ((!storeConfigsByKey[storeConfigKey] || storeConfigsByKey[storeConfigKey].length === 0) && storeTypes.length > 0) {
          storeConfigsByKey[storeConfigKey] = [{ id: generateId(), type: storeTypes[0], fields: {} }];
        }
      }
      
      // Extract global remote_config
      const globalRemoteConfig = parsed.remote_config as TomlObject | undefined;
      const remoteConfigFields: Record<string, string | number | boolean> = {};
      if (globalRemoteConfig) {
        for (const [key, value] of Object.entries(globalRemoteConfig)) {
          if (typeof value !== 'object') {
            remoteConfigFields[`remote_config.${key}`] = value as string | number | boolean;
          }
        }
      }
      
      setFormData({
        daq_job_type: daqJobType,
        jobFields,
        storeConfigsByKey,
        remoteConfigFields,
      });
      setRawToml(initialToml);
      setParseError(null);
    } catch (e) {
      setParseError('Failed to parse TOML configuration');
      console.error(e);
    }
  }, [initialToml, schemas]);

  // Generate TOML from form data
  const generateToml = useCallback((data: FormData): string => {
    const tomlObj: TomlObject = {
      daq_job_type: data.daq_job_type,
    };
    
    // Add job-specific fields
    for (const [key, value] of Object.entries(data.jobFields)) {
      if (value !== undefined && value !== '') {
        tomlObj[key] = value;
      }
    }
    
    // Helper to convert store configs array to TOML object
    const buildStoreConfigObj = (configs: StoreConfigEntry[]): TomlObject => {
      const storeConfigObj: TomlObject = {};
      for (const config of configs) {
        if (config.type) {
          // Unflatten dot-notation keys back into nested objects
          const unflattenFields = (fields: Record<string, FieldValue>): TomlObject => {
            const result: TomlObject = {};
            for (const [key, value] of Object.entries(fields)) {
              // Skip empty/undefined values (but not empty arrays)
              if (value === undefined || value === '') continue;
              // Skip empty arrays
              if (Array.isArray(value) && value.length === 0) continue;
              
              const parts = key.split('.');
              let current: TomlObject = result;
              for (let i = 0; i < parts.length - 1; i++) {
                if (!(parts[i] in current)) {
                  current[parts[i]] = {};
                }
                current = current[parts[i]] as TomlObject;
              }
              current[parts[parts.length - 1]] = value;
            }
            return result;
          };
          storeConfigObj[config.type] = unflattenFields(config.fields);
        }
      }
      return storeConfigObj;
    };
    
    
    // Add all store configs from storeConfigsByKey
    for (const [storeConfigKey, configs] of Object.entries(data.storeConfigsByKey)) {
      if (configs.length > 0) {
        const storeConfigObj = buildStoreConfigObj(configs);
        if (Object.keys(storeConfigObj).length > 0) {
          tomlObj[storeConfigKey] = storeConfigObj;
        }
      }
    }
    
    // Add global remote_config
    if (Object.keys(data.remoteConfigFields).length > 0) {
      const remoteConfig: TomlObject = {};
      for (const [key, value] of Object.entries(data.remoteConfigFields)) {
        if (value === undefined || value === '') continue;
        // Key is like "remote_config.remote_topic", extract the field name
        const fieldName = key.replace('remote_config.', '');
        remoteConfig[fieldName] = value;
      }
      if (Object.keys(remoteConfig).length > 0) {
        tomlObj['remote_config'] = remoteConfig;
      }
    }
    
    return stringifyToml(tomlObj);
  }, []);

  // Track if changes come from user interaction (not initial parsing)
  const [isUserChange, setIsUserChange] = useState(false);

  // Notify parent of form data changes via useEffect (avoids setState during render)
  useEffect(() => {
    if (!isUserChange || !formData.daq_job_type) return;
    
    const toml = generateToml(formData);
    setRawToml(toml);
    onChange(toml);
    setIsUserChange(false);
  }, [formData, isUserChange, generateToml, onChange]);

  // Handle form data changes
  const updateFormData = useCallback((updates: Partial<FormData>) => {
    setIsUserChange(true);
    setFormData(prev => ({ ...prev, ...updates }));
  }, []);

  // Handle DAQ job type change
  const handleJobTypeChange = (newType: string) => {
    if (!schemas) return;
    
    const jobSchema = schemas.jobSchemas[newType];
    const newJobFields: Record<string, FieldValue> = {};
    
    if (jobSchema) {
      for (const field of jobSchema.fields) {
        if (field.default !== undefined && field.default !== null) {
          newJobFields[field.name] = field.default as FieldValue;
        }
      }
    }
    
    updateFormData({
      daq_job_type: newType,
      jobFields: newJobFields,
    });
  };

  // Helper to get store configs for a specific key
  const getStoreConfigsForKey = (key: string): StoreConfigEntry[] => {
    return formData.storeConfigsByKey[key] || [];
  };

  // Helper to update store configs for a specific key
  const updateStoreConfigsForKey = (
    key: string,
    updater: (configs: StoreConfigEntry[]) => StoreConfigEntry[]
  ) => {
    updateFormData({ 
      storeConfigsByKey: {
        ...formData.storeConfigsByKey,
        [key]: updater(formData.storeConfigsByKey[key] || []),
      }
    });
  };

  // Add a new store config
  const addStoreConfig = (storeConfigKey: string) => {
    if (!schemas) return;
    
    const storeTypes = Object.keys(schemas.storeConfigSchemas);
    const currentConfigs = getStoreConfigsForKey(storeConfigKey);
    // Find a store type not already in use
    const usedTypes = new Set(currentConfigs.map((c: StoreConfigEntry) => c.type));
    const availableType = storeTypes.find(t => !usedTypes.has(t)) || storeTypes[0];
    
    if (availableType) {
      updateStoreConfigsForKey(storeConfigKey, (configs: StoreConfigEntry[]) => [
        ...configs,
        { id: generateId(), type: availableType, fields: {} },
      ]);
    }
  };

  // Remove a store config
  const removeStoreConfig = (storeConfigKey: string, id: string) => {
    updateStoreConfigsForKey(storeConfigKey, (configs: StoreConfigEntry[]) => 
      configs.filter((c: StoreConfigEntry) => c.id !== id)
    );
  };

  // Handle store config type change
  const handleStoreTypeChange = (storeConfigKey: string, id: string, newType: string) => {
    if (!schemas) return;
    
    const storeSchema = schemas.storeConfigSchemas[newType];
    const newFields: Record<string, FieldValue> = {};
    
    if (storeSchema) {
      for (const field of storeSchema.fields) {
        if (field.default !== undefined && field.default !== null) {
          newFields[field.name] = field.default as FieldValue;
        }
      }
    }
    
    updateStoreConfigsForKey(storeConfigKey, (configs: StoreConfigEntry[]) => 
      configs.map((c: StoreConfigEntry) => c.id === id ? { ...c, type: newType, fields: newFields } : c)
    );
  };

  // Handle individual field changes
  const handleJobFieldChange = (name: string, value: FieldValue) => {
    updateFormData({
      jobFields: { ...formData.jobFields, [name]: value },
    });
  };

  const handleStoreFieldChange = (storeConfigKey: string, id: string, name: string, value: FieldValue) => {
    updateStoreConfigsForKey(storeConfigKey, (configs: StoreConfigEntry[]) => 
      configs.map((c: StoreConfigEntry) => c.id === id ? { ...c, fields: { ...c.fields, [name]: value } } : c)
    );
  };

  // Handle global remote_config field changes
  const handleRemoteConfigFieldChange = (name: string, value: FieldValue) => {
    updateFormData({
      remoteConfigFields: { ...formData.remoteConfigFields, [name]: value },
    });
  };

  // Handle raw TOML editor changes
  const handleRawChange = (value: string) => {
    setRawToml(value);
    try {
      parseToml(value);
      setParseError(null);
      onChange(value);
    } catch {
      setParseError('Invalid TOML syntax');
    }
  };

  // Render a single field based on its definition
  const renderField = (
    field: FieldDefinition,
    value: FieldValue | undefined,
    onChangeHandler: (name: string, value: FieldValue) => void,
    keyPrefix: string = ''
  ) => {
    const fieldId = `${keyPrefix}field-${field.name}`;
    
    switch (field.type) {
      case 'boolean':
        return (
          <div key={fieldId} className="col-md-6 mb-3">
            <label className="form-label text-muted small d-block" htmlFor={fieldId}>
              {field.label}
              {field.required && <span className="text-danger ms-1">*</span>}
            </label>
            <div className="form-check form-switch">
              <input
                type="checkbox"
                className="form-check-input"
                id={fieldId}
                checked={Boolean(value)}
                onChange={(e) => onChangeHandler(field.name, e.target.checked)}
                disabled={disabled}
              />
              <label className="form-check-label text-muted small" htmlFor={fieldId}>
                {Boolean(value) ? 'On' : 'Off'}
              </label>
            </div>
            {field.description && (
              <small className="text-muted d-block mt-1">{formatDescription(field.description)}</small>
            )}
          </div>
        );
      
      case 'number':
        return (
          <div key={fieldId} className="col-md-6 mb-3">
            <label className="form-label text-muted small" htmlFor={fieldId}>
              {field.label}
              {field.required && <span className="text-danger ms-1">*</span>}
            </label>
            <input
              type="number"
              className="form-control form-control-sm bg-dark text-light border-secondary"
              id={fieldId}
              value={value !== undefined ? String(value) : ''}
              onChange={(e) => onChangeHandler(field.name, e.target.value === '' ? 0 : Number(e.target.value))}
              disabled={disabled}
            />
            {field.description && (
              <small className="text-muted">{formatDescription(field.description)}</small>
            )}
          </div>
        );
      
      case 'select':
        return (
          <div key={fieldId} className="col-md-6 mb-3">
            <label className="form-label text-muted small" htmlFor={fieldId}>
              {field.label}
              {field.required && <span className="text-danger ms-1">*</span>}
            </label>
            <select
              className="form-select form-select-sm bg-dark text-light border-secondary"
              id={fieldId}
              value={String(value || '')}
              onChange={(e) => onChangeHandler(field.name, e.target.value)}
              disabled={disabled}
            >
              <option value="">Select...</option>
              {field.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {field.description && (
              <small className="text-muted">{formatDescription(field.description)}</small>
            )}
          </div>
        );
      
      case 'array':
        // Render array as comma-separated values input
        // We need to handle the case where value is stored as array but displayed as string
        const displayValue = Array.isArray(value) ? value.join(', ') : String(value || '');
        return (
          <div key={fieldId} className="col-md-6 mb-3">
            <label className="form-label text-muted small" htmlFor={fieldId}>
              {field.label}
              {field.required && <span className="text-danger ms-1">*</span>}
              <span className="badge bg-secondary ms-2" style={{ fontSize: '0.65em' }}>List</span>
            </label>
            <input
              type="text"
              className="form-control form-control-sm bg-dark text-light border-secondary"
              id={fieldId}
              defaultValue={displayValue}
              placeholder="Enter comma-separated values"
              onChange={(e) => {
                // Store the raw input as-is (allows typing commas)
                // Parse on blur, but for immediate updates use raw string split
                const inputValue = e.target.value;
                // Split and keep non-empty parts for the data structure
                const parts = inputValue.split(',').map(s => s.trim()).filter(s => s !== '');
                onChangeHandler(field.name, parts);
              }}
              disabled={disabled}
            />
            {field.description && (
              <small className="text-muted">{formatDescription(field.description)}</small>
            )}
            <small className="text-info d-block">Comma-separated values</small>
          </div>
        );

      case 'arrayOfObjects':
        const items = Array.isArray(value) ? value as Record<string, FieldValue>[] : [];
        const itemLabel = field.objectSchemaName || 'Item';
        
        return (
          <div key={fieldId} className="col-12 mb-3">
             <div className="d-flex justify-content-between align-items-center mb-2">
              <label className="form-label text-muted small mb-0" htmlFor={fieldId}>
                {field.label}
                {field.required && <span className="text-danger ms-1">*</span>}
              </label>
              <button
                className="btn btn-xs btn-outline-success"
                onClick={() => {
                  const newItem: Record<string, FieldValue> = {};
                  // Initialize with defaults if available
                  if (field.objectFields) {
                    for (const f of field.objectFields) {
                      if (f.default !== undefined && f.default !== null) {
                        newItem[f.name] = f.default as any;
                      }
                    }
                  }
                  onChangeHandler(field.name, [...items, newItem]);
                }}
                disabled={disabled}
                type="button"
              >
                <i className="fa-solid fa-plus me-1"></i> Add {itemLabel}
              </button>
            </div>
            
            {field.description && (
              <small className="text-muted d-block mb-2">{formatDescription(field.description)}</small>
            )}

            <div className="d-flex flex-column gap-3">
              {items.map((item, index) => (
                <div key={`${fieldId}-item-${index}`} className="card bg-dark border-secondary">
                  <div className="card-header py-1 px-3 d-flex justify-content-between align-items-center bg-black bg-opacity-25">
                     <span className="small text-muted">{itemLabel} #{index + 1}</span>
                     <button
                        className="btn btn-xs text-danger p-0"
                        onClick={() => {
                          const newItems = [...items];
                          newItems.splice(index, 1);
                          onChangeHandler(field.name, newItems);
                        }}
                        disabled={disabled}
                        type="button"
                        title="Remove item"
                      >
                        <i className="fa-solid fa-times"></i>
                      </button>
                  </div>
                  <div className="card-body p-3">
                    <div className="row">
                      {field.objectFields?.map((subField) => 
                        renderField(
                          subField,
                          item[subField.name],
                          (subName, subValue) => {
                             const newItems = [...items];
                             newItems[index] = { ...newItems[index], [subName]: subValue };
                             onChangeHandler(field.name, newItems);
                          },
                          `${fieldId}-${index}-`
                        )
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {items.length === 0 && (
                <div className="text-center text-muted small py-3 border border-secondary border-dashed rounded bg-black bg-opacity-25">
                   No items added.
                </div>
              )}
            </div>
          </div>
        );
      
      default:
        return (
          <div key={fieldId} className="col-md-6 mb-3">
            <label className="form-label text-muted small" htmlFor={fieldId}>
              {field.label}
              {field.required && <span className="text-danger ms-1">*</span>}
            </label>
            <input
              type="text"
              className="form-control form-control-sm bg-dark text-light border-secondary"
              id={fieldId}
              value={String(value || '')}
              onChange={(e) => onChangeHandler(field.name, e.target.value)}
              disabled={disabled}
            />
            {field.description && (
              <small className="text-muted">{formatDescription(field.description)}</small>
            )}
          </div>
        );
    }
  };

  // Loading state
  if (schemasLoading) {
    return (
      <div className="text-center py-4">
        <div className="spinner-border spinner-border-sm text-primary me-2" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <span className="text-muted">Loading DAQ job schemas...</span>
      </div>
    );
  }

  // Error state - show raw editor
  if (schemasError || !schemas) {
    return (
      <div>
        {schemasError && (
          <div className="alert alert-warning py-2 mb-3">
            <i className="fa-solid fa-triangle-exclamation me-2"></i>
            {schemasError}
          </div>
        )}
        <textarea
          className="form-control bg-black text-warning border-secondary font-monospace"
          rows={12}
          value={rawToml}
          onChange={(e) => handleRawChange(e.target.value)}
          disabled={disabled}
        />
      </div>
    );
  }

  const jobSchema = schemas.jobSchemas[formData.daq_job_type];
  const storeTypes = Object.keys(schemas.storeConfigSchemas);
  const jobTypes = getJobTypes(schemas);

  if (parseError && !showRawEditor) {
    return (
      <div className="alert alert-warning">
        <i className="fa-solid fa-triangle-exclamation me-2"></i>
        {parseError}
        <button 
          className="btn btn-sm btn-outline-light ms-3"
          onClick={() => setShowRawEditor(true)}
        >
          Edit Raw TOML
        </button>
      </div>
    );
  }

  return (
    <div className="toml-form">
      {/* Toggle between form and raw editor */}
      <div className="d-flex justify-content-end mb-3">
        <div className="btn-group btn-group-sm">
          <button
            className={`btn ${!showRawEditor ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setShowRawEditor(false)}
          >
            <i className="fa-solid fa-sliders me-1"></i> Form
          </button>
          <button
            className={`btn ${showRawEditor ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setShowRawEditor(true)}
          >
            <i className="fa-solid fa-code me-1"></i> TOML
          </button>
        </div>
      </div>

      {showRawEditor ? (
        <div>
          <textarea
            className="form-control bg-black text-warning border-secondary font-monospace"
            rows={12}
            value={rawToml}
            onChange={(e) => handleRawChange(e.target.value)}
            disabled={disabled}
          />
          {parseError && (
            <div className="text-danger small mt-2">
              <i className="fa-solid fa-circle-xmark me-1"></i>
              {parseError}
            </div>
          )}
        </div>
      ) : (
        <div className="form-fields">
          {/* DAQ Job Type Selection */}
          <div className="mb-4">
            <label className="form-label text-info fw-bold">
              <i className="fa-solid fa-microchip me-2"></i>
              DAQ Job Type
            </label>
            <select
              className="form-select bg-dark text-light border-secondary"
              value={formData.daq_job_type}
              onChange={(e) => handleJobTypeChange(e.target.value)}
              disabled={disabled}
            >
              {jobTypes.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {jobSchema?.description && (
              <small className="text-muted d-block mt-1">{formatDescription(jobSchema.description)}</small>
            )}
          </div>

          {/* Job-specific Fields */}
          {jobSchema && jobSchema.fields.length > 0 && (
            <div className="mb-4">
              <div className="section-header mb-3">
                <span className="badge bg-info text-dark">
                  <i className="fa-solid fa-cog me-1"></i>
                  Job Configuration
                </span>
              </div>
              <div className="row">
                {jobSchema.fields.map((field) =>
                  renderField(field, formData.jobFields[field.name], handleJobFieldChange)
                )}
              </div>
            </div>
          )}

          {/* Store Config Sections - render each supported store config key */}
          {(jobSchema?.storeConfigKeys || ['store_config']).map((storeConfigKey) => {
            const configs = getStoreConfigsForKey(storeConfigKey);
            const usedTypes = new Set(configs.map((c: StoreConfigEntry) => c.type));
            const canAddMore = storeTypes.some(t => !usedTypes.has(t));
            const sectionLabel = storeConfigKey === 'waveform_store_config' 
              ? 'Waveform Store Configurations' 
              : 'Store Configurations';
            
            return (
              <div key={storeConfigKey} className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <span className="badge bg-success">
                    <i className="fa-solid fa-database me-1"></i>
                    {sectionLabel}
                  </span>
                  <button
                    className="btn btn-sm btn-outline-success"
                    onClick={() => addStoreConfig(storeConfigKey)}
                    disabled={disabled || !canAddMore}
                    title={canAddMore ? 'Add store configuration' : 'All store types are already added'}
                  >
                    <i className="fa-solid fa-plus me-1"></i>
                    Add Store
                  </button>
                </div>
                
                {/* Store Config Cards */}
                {configs.map((config: StoreConfigEntry, index: number) => {
                  const storeSchema = schemas.storeConfigSchemas[config.type];
                  return (
                    <div key={config.id} className="card bg-black border-secondary mb-3">
                      <div className="card-header d-flex justify-content-between align-items-center py-2 bg-dark border-secondary">
                        <div className="d-flex align-items-center gap-2">
                          <span className="badge bg-secondary">{index + 1}</span>
                          <select
                            className="form-select form-select-sm bg-dark text-light border-secondary"
                            style={{ width: 'auto' }}
                            value={config.type}
                            onChange={(e) => handleStoreTypeChange(storeConfigKey, config.id, e.target.value)}
                            disabled={disabled}
                          >
                            {storeTypes.map((type) => {
                              const schema = schemas.storeConfigSchemas[type];
                              const isUsed = usedTypes.has(type) && type !== config.type;
                              return (
                                <option key={type} value={type} disabled={isUsed}>
                                  {schema?.label || type} {isUsed ? '(in use)' : ''}
                                </option>
                              );
                            })}
                          </select>
                          {storeSchema?.description && (
                            <small className="text-muted ms-2">{formatDescription(storeSchema.description)}</small>
                          )}
                        </div>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => removeStoreConfig(storeConfigKey, config.id)}
                          disabled={disabled || configs.length <= 1}
                          title="Remove this store configuration"
                        >
                          <i className="fa-solid fa-trash"></i>
                        </button>
                      </div>
                      <div className="card-body py-3">
                        {storeSchema && storeSchema.fields.length > 0 ? (
                          <>
                            {/* Regular fields (non-remote_config) */}
                            {storeSchema.fields.filter(f => !f.name.startsWith('remote_config.')).length > 0 && (
                              <div className="row">
                                {storeSchema.fields
                                  .filter(field => !field.name.startsWith('remote_config.'))
                                  .map((field) =>
                                    renderField(
                                      field,
                                      config.fields[field.name],
                                      (name, value) => handleStoreFieldChange(storeConfigKey, config.id, name, value),
                                      `${config.id}-`
                                    )
                                  )}
                              </div>
                            )}
                            
                            {/* Remote Config fields separator and section */}
                            {storeSchema.fields.filter(f => f.name.startsWith('remote_config.')).length > 0 && (
                              <>
                                <div className="d-flex align-items-center my-3">
                                  <hr className="flex-grow-1 border-secondary opacity-50" />
                                  <span className="badge bg-info bg-opacity-25 text-info mx-2">
                                    <i className="fa-solid fa-satellite-dish me-1"></i>
                                    Remote Config
                                  </span>
                                  <hr className="flex-grow-1 border-secondary opacity-50" />
                                </div>
                                <div className="row">
                                  {storeSchema.fields
                                    .filter(field => field.name.startsWith('remote_config.'))
                                    .map((field) =>
                                      renderField(
                                        field,
                                        config.fields[field.name],
                                        (name, value) => handleStoreFieldChange(storeConfigKey, config.id, name, value),
                                        `${config.id}-`
                                      )
                                    )}
                                </div>
                              </>
                            )}
                          </>
                        ) : (
                          <div className="text-muted small">
                            <i className="fa-solid fa-info-circle me-1"></i>
                            No additional configuration required.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {configs.length === 0 && (
                  <div className="text-center text-muted py-3 border border-secondary rounded">
                    <i className="fa-solid fa-database fa-2x mb-2 opacity-50"></i>
                    <p className="mb-2">No store configurations added</p>
                    <button
                      className="btn btn-sm btn-outline-success"
                      onClick={() => addStoreConfig(storeConfigKey)}
                      disabled={disabled}
                    >
                      <i className="fa-solid fa-plus me-1"></i>
                      Add Store Configuration
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Global Remote Config Section */}
          {jobSchema?.remoteConfigFields && jobSchema.remoteConfigFields.length > 0 && (
            <div className="mb-3">
              <div className="section-header mb-3">
                <span className="badge bg-warning text-dark">
                  <i className="fa-solid fa-satellite-dish me-1"></i>
                  Global Remote Configuration
                </span>
              </div>
              <div className="card bg-black border-secondary">
                <div className="card-body py-3">
                  <div className="row">
                    {jobSchema.remoteConfigFields.map((field) =>
                      renderField(
                        field,
                        formData.remoteConfigFields[field.name],
                        handleRemoteConfigFieldChange,
                        'global-remote-'
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TomlForm;
