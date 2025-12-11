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
  disableJobType?: boolean;
}

interface FormData {
  daq_job_type: string;
}

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

import validator from '@rjsf/validator-ajv8';
import Form from '@rjsf/react-bootstrap';

const TomlForm: React.FC<TomlFormProps> = ({ initialToml, onChange, disabled = false, disableJobType = false }) => {
  const [schemas, setSchemas] = useState<ParsedSchemas | null>(null);
  // Store raw schemas for RJSF
  const [rawSchemas, setRawSchemas] = useState<Record<string, any> | null>(null);
  const [schemasLoading, setSchemasLoading] = useState(true);
  const [schemasError, setSchemasError] = useState<string | null>(null);
  const [rjsfData, setRjsfData] = useState<any>({});
  
  const [formData, setFormData] = useState<FormData>({
    daq_job_type: '',
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
        setRawSchemas(rawSchemas);
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
        
    try {
      const parsed = parseToml(initialToml);
      setRjsfData(parsed);
      
      // Extract daq_job_type
      const daqJobType = (parsed.daq_job_type as string) || Object.keys(schemas.jobSchemas)[0] || '';
      
      // We only track job type manually now
      setFormData(prev => ({ ...prev, daq_job_type: daqJobType }));
      setRawToml(initialToml);
      setParseError(null);
    } catch (e) {
      setParseError('Failed to parse TOML configuration');
      console.error(e);
    }
  }, [initialToml, schemas, rawToml]);

  // Handle DAQ job type change
  const handleJobTypeChange = (newType: string) => {
    // Reset RJSF data when job type changes
    const newRjsfData = { daq_job_type: newType };
    setRjsfData(newRjsfData);
    
    // Update raw TOML and notify parent
    const toml = stringifyToml(newRjsfData);
    setRawToml(toml);
    onChange(toml);
    
    setFormData(prev => ({ ...prev, daq_job_type: newType }));
  };

  const handleRawChange = (value: string) => {
    setRawToml(value);
    try {
      const parsed = parseToml(value);
      setRjsfData(parsed);
      
      const daqJobType = (parsed.daq_job_type as string) || '';
      if (daqJobType && daqJobType !== formData.daq_job_type) {
         setFormData(prev => ({ ...prev, daq_job_type: daqJobType }));
      }
      
      setParseError(null);
      onChange(value);
    } catch {
      setParseError('Invalid TOML syntax');
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
              disabled={disabled || disableJobType}
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

          {/* RJSF Implementation */}
          {rawSchemas && formData.daq_job_type && (
            <div className="bg-dark p-3 rounded border border-secondary mb-4 rjsf-dark">
              <Form
                schema={rawSchemas[formData.daq_job_type]}
                formData={rjsfData}
                disabled={disabled}
                onChange={(e) => {
                  setRjsfData(e.formData);
                  const toml = stringifyToml(e.formData);
                  setRawToml(toml);
                  onChange(toml);
                }}
                validator={validator}
                uiSchema={{
                  daq_job_type: { "ui:widget": "hidden" }
                }}
              >
                {/* Hide default submit button */}
                <button type="submit" style={{ display: 'none' }} />
              </Form>
            </div>
          )}

        </div>
      )}
    </div>
  );
};

export default TomlForm;
