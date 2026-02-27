'use client';

import React, { useState, useEffect } from 'react';
import { parseToml } from '@/lib/toml-utils';
import {
  parseDAQJobSchemas,
  getJobTypes,
  generateCommentedToml,
  type ParsedSchemas,
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
            {indent}
            {trimmedLine}
            {index < lines.length - 1 && <br />}
          </React.Fragment>
        );
      })}
    </>
  );
};

const TomlForm: React.FC<TomlFormProps> = ({
  initialToml,
  onChange,
  disabled = false,
  disableJobType = false,
}) => {
  const [schemas, setSchemas] = useState<ParsedSchemas | null>(null);
  const [schemasLoading, setSchemasLoading] = useState(true);
  const [schemasError, setSchemasError] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormData>({
    daq_job_type: '',
  });

  const [rawToml, setRawToml] = useState(initialToml);
  const [parseError, setParseError] = useState<string | null>(null);

  // Fetch schemas on mount
  useEffect(() => {
    const fetchSchemas = async () => {
      try {
        setSchemasLoading(true);
        const rawSchemas = await API.getDAQJobSchemas();
        const parsed = parseDAQJobSchemas(
          rawSchemas as Parameters<typeof parseDAQJobSchemas>[0],
        );
        setSchemas(parsed);
        setSchemasError(null);

        // Set default job type if not already set
        const jobTypes = getJobTypes(parsed);
        if (jobTypes.length > 0 && !formData.daq_job_type) {
          setFormData((prev) => ({
            ...prev,
            daq_job_type: jobTypes[0].value,
          }));
        }
      } catch (error) {
        console.error('Failed to fetch DAQ job schemas:', error);
        setSchemasError(
          'Failed to load DAQ job schemas. Using raw TOML editor.',
        );
      } finally {
        setSchemasLoading(false);
      }
    };

    fetchSchemas();
  }, [formData.daq_job_type]);

  // Parse TOML when initialToml or schemas change
  useEffect(() => {
    // Always sync the text area if we receive new initialToml from outside
    setRawToml(initialToml);

    if (!schemas) return;

    try {
      const parsed = parseToml(initialToml);

      // Extract daq_job_type
      const daqJobType =
        (parsed.daq_job_type as string) ||
        Object.keys(schemas.jobSchemas)[0] ||
        '';

      setFormData((prev) => ({ ...prev, daq_job_type: daqJobType }));
      setParseError(null);
    } catch (e) {
      setParseError('Failed to parse TOML configuration');
      console.error(e);
    }
  }, [initialToml, schemas]);

  // Handle DAQ job type change
  const handleJobTypeChange = (newType: string) => {
    setFormData((prev) => ({ ...prev, daq_job_type: newType }));

    // Auto-generate template for this job type
    if (schemas) {
      const tomlTemplate = generateCommentedToml(schemas, newType);
      setRawToml(tomlTemplate);
      onChange(tomlTemplate);
      setParseError(null);
    }
  };

  const handleRawChange = (value: string) => {
    setRawToml(value);
    try {
      const parsed = parseToml(value);

      const daqJobType = (parsed.daq_job_type as string) || '';
      if (daqJobType && daqJobType !== formData.daq_job_type) {
        setFormData((prev) => ({ ...prev, daq_job_type: daqJobType }));
      }

      setParseError(null);
      onChange(value);
    } catch {
      setParseError('Invalid TOML syntax');
    }
  };

  const handleGenerateTemplate = () => {
    if (!schemas || !formData.daq_job_type) return;

    if (
      window.confirm(
        'This will overwrite your current configuration. Are you sure?',
      )
    ) {
      const tomlTemplate = generateCommentedToml(
        schemas,
        formData.daq_job_type,
      );
      setRawToml(tomlTemplate);
      onChange(tomlTemplate);
      setParseError(null);
    }
  };

  // Loading state
  if (schemasLoading) {
    return (
      <div className="text-center py-4">
        <div
          className="spinner-border spinner-border-sm text-primary me-2"
          role="status"
        >
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

  return (
    <div className="toml-form">
      {/* DAQ Job Type Selection */}
      <div className="mb-4 d-flex align-items-end gap-3">
        <div className="flex-grow-1">
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
        </div>

        {!disableJobType && !disabled && (
          <button
            type="button"
            className="btn btn-outline-info"
            onClick={handleGenerateTemplate}
            title="Generate a default template with all comments"
          >
            <i className="fa-solid fa-wand-magic-sparkles me-2"></i>
            Insert Template
          </button>
        )}
      </div>

      {jobSchema?.description && (
        <div className="mb-3 small text-light opacity-75">
          {formatDescription(jobSchema.description)}
        </div>
      )}

      <div>
        <div className="d-flex justify-content-between align-items-center mb-2">
          <label className="form-label text-warning fw-bold mb-0">
            <i className="fa-solid fa-code me-2"></i>
            TOML Configuration
          </label>
        </div>
        <textarea
          className="form-control bg-black text-warning border-secondary font-monospace p-3"
          rows={16}
          value={rawToml}
          onChange={(e) => handleRawChange(e.target.value)}
          disabled={disabled}
          style={{ lineHeight: '1.4', fontSize: '13px' }}
        />
        {parseError && (
          <div className="text-danger small mt-2">
            <i className="fa-solid fa-circle-xmark me-1"></i>
            {parseError}
          </div>
        )}
      </div>
    </div>
  );
};

export default TomlForm;
