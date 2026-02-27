'use client';

import React, { useState, useEffect } from 'react';
import { API } from '@/lib/api-client';

interface MessagePayloadFormProps {
  messageType: string;
  initialPayload?: string;
  onChange: (payload: string) => void;
  disabled?: boolean;
}

const MessagePayloadForm: React.FC<MessagePayloadFormProps> = ({
  messageType,
  initialPayload,
  onChange,
  disabled = false,
}) => {
  const [schemas, setSchemas] = useState<Record<string, any> | null>(null);
  const [schemasLoading, setSchemasLoading] = useState(true);
  const [rawPayload, setRawPayload] = useState(initialPayload || '{}');

  // Fetch schemas on mount
  useEffect(() => {
    const fetchSchemas = async () => {
      try {
        setSchemasLoading(true);
        const data = await API.getMessageSchemas();
        setSchemas(data);
      } catch (error) {
        console.error('Failed to fetch message schemas:', error);
      } finally {
        setSchemasLoading(false);
      }
    };

    fetchSchemas();
  }, []);

  // Sync with prop
  useEffect(() => {
    if (initialPayload && initialPayload !== rawPayload) {
      setRawPayload(initialPayload);
    }
  }, [initialPayload]);

  const handleRawChange = (value: string) => {
    setRawPayload(value);
    onChange(value);
  };

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(rawPayload);
      const formatted = JSON.stringify(parsed, null, 2);
      setRawPayload(formatted);
      onChange(formatted);
    } catch {
      // Ignore formatting error if invalid json
    }
  };

  const handleGenerateTemplate = () => {
    if (!schemas || !schemas[messageType]) return;

    if (window.confirm('This will overwrite your current payload. Continue?')) {
      const schema = schemas[messageType];

      // Helper to recursively generate default fields
      const generateDefault = (s: any): any => {
        if (s.default !== undefined) return s.default;
        switch (s.type) {
          case 'string':
            return '';
          case 'number':
          case 'integer':
            return 0;
          case 'boolean':
            return false;
          case 'array':
            return [];
          case 'object':
            if (!s.properties) return {};
            const obj: any = {};
            for (const key in s.properties) {
              // Skip internal/meta fields
              if (
                [
                  'id',
                  'timestamp',
                  'is_remote',
                  'daq_job_info',
                  'remote_config',
                ].includes(key)
              )
                continue;
              obj[key] = generateDefault(s.properties[key]);
            }
            return obj;
          default:
            return null;
        }
      };

      if (schema.properties) {
        const template = generateDefault(schema);
        const json = JSON.stringify(template, null, 2);
        setRawPayload(json);
        onChange(json);
      }
    }
  };

  // Loading state
  if (schemasLoading) {
    return (
      <div className="text-center py-3">
        <div
          className="spinner-border spinner-border-sm text-primary me-2"
          role="status"
        >
          <span className="visually-hidden">Loading...</span>
        </div>
        <span className="text-muted">Loading message schemas...</span>
      </div>
    );
  }

  const schema = schemas?.[messageType];

  return (
    <div className="message-payload-form">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <label className="form-label text-warning fw-bold mb-0">
          <i className="fa-solid fa-code me-2"></i>
          JSON Payload
        </label>
        <div>
          {schema && (
            <button
              type="button"
              className="btn btn-sm btn-outline-info me-2"
              onClick={handleGenerateTemplate}
              disabled={disabled}
              title="Generate a blank template based on the schema"
            >
              <i className="fa-solid fa-wand-magic-sparkles me-1"></i> Template
            </button>
          )}
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={handleFormat}
            disabled={disabled}
            title="Pretty-print JSON"
          >
            <i className="fa-solid fa-align-left me-1"></i> Format
          </button>
        </div>
      </div>

      <textarea
        className="form-control bg-black text-warning border-secondary font-monospace p-3"
        rows={8}
        value={rawPayload}
        onChange={(e) => handleRawChange(e.target.value)}
        disabled={disabled}
        spellCheck={false}
        placeholder='{"reason": "User requested stop"}'
        style={{ lineHeight: '1.4', fontSize: '13px' }}
      />

      {schema?.description && (
        <div className="text-muted small mt-2">
          <i className="fa-solid fa-circle-info me-1"></i>
          {schema.description}
        </div>
      )}
    </div>
  );
};

export default MessagePayloadForm;
