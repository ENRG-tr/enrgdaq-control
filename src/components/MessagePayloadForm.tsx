'use client';

import React, { useState, useEffect } from 'react';
import { API } from '@/lib/api-client';
import validator from '@rjsf/validator-ajv8';
import Form from '@rjsf/react-bootstrap';

interface MessagePayloadFormProps {
  messageType: string;
  initialPayload?: string;
  onChange: (payload: string) => void;
  disabled?: boolean;
}

/**
 * RJSF-based form for editing message payloads.
 * Uses JSON schemas from the /templates/messages API.
 */
const MessagePayloadForm: React.FC<MessagePayloadFormProps> = ({
  messageType,
  initialPayload,
  onChange,
  disabled = false,
}) => {
  const [schemas, setSchemas] = useState<Record<string, any> | null>(null);
  const [schemasLoading, setSchemasLoading] = useState(true);
  const [schemasError, setSchemasError] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [showRawEditor, setShowRawEditor] = useState(false);
  const [rawPayload, setRawPayload] = useState(initialPayload || '{}');

  // Fetch schemas on mount
  useEffect(() => {
    const fetchSchemas = async () => {
      try {
        setSchemasLoading(true);
        const data = await API.getMessageSchemas();
        setSchemas(data);
        setSchemasError(null);
      } catch (error) {
        console.error('Failed to fetch message schemas:', error);
        setSchemasError(
          'Failed to load message schemas. Using raw JSON editor.'
        );
        setShowRawEditor(true);
      } finally {
        setSchemasLoading(false);
      }
    };

    fetchSchemas();
  }, []);

  // Parse initial payload when it changes
  useEffect(() => {
    if (!initialPayload) {
      setFormData({});
      setRawPayload('{}');
      return;
    }

    try {
      const parsed = JSON.parse(initialPayload);
      setFormData(parsed);
      setRawPayload(initialPayload);
    } catch (e) {
      console.error('Failed to parse initial payload:', e);
      setRawPayload(initialPayload);
    }
  }, [initialPayload]);

  const handleRawChange = (value: string) => {
    setRawPayload(value);
    try {
      const parsed = JSON.parse(value);
      setFormData(parsed);
      onChange(value);
    } catch {
      // Invalid JSON, still update but don't sync to form
      onChange(value);
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

  // Error state or no schema for this message type - show raw editor
  const schema = schemas?.[messageType];
  if (schemasError || !schema) {
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
          rows={8}
          value={rawPayload}
          onChange={(e) => handleRawChange(e.target.value)}
          disabled={disabled}
          spellCheck={false}
          placeholder='{"reason": "User requested stop"}'
        />
      </div>
    );
  }

  return (
    <div className="message-payload-form">
      {/* Toggle between form and raw editor */}
      <div className="d-flex justify-content-end mb-3">
        <div className="btn-group btn-group-sm">
          <button
            type="button"
            className={`btn ${
              !showRawEditor ? 'btn-primary' : 'btn-outline-secondary'
            }`}
            onClick={() => setShowRawEditor(false)}
          >
            <i className="fa-solid fa-sliders me-1"></i> Form
          </button>
          <button
            type="button"
            className={`btn ${
              showRawEditor ? 'btn-primary' : 'btn-outline-secondary'
            }`}
            onClick={() => setShowRawEditor(true)}
          >
            <i className="fa-solid fa-code me-1"></i> JSON
          </button>
        </div>
      </div>

      {showRawEditor ? (
        <div>
          <textarea
            className="form-control bg-black text-warning border-secondary font-monospace"
            rows={8}
            value={rawPayload}
            onChange={(e) => handleRawChange(e.target.value)}
            disabled={disabled}
            spellCheck={false}
          />
        </div>
      ) : (
        <div className="bg-dark p-3 rounded border border-secondary rjsf-dark">
          <Form
            schema={schema}
            formData={formData}
            disabled={disabled}
            onChange={(e) => {
              setFormData(e.formData);
              const json = JSON.stringify(e.formData, null, 2);
              setRawPayload(json);
              onChange(json);
            }}
            validator={validator}
            uiSchema={{
              // Hide fields that are auto-populated
              id: { 'ui:widget': 'hidden' },
              timestamp: { 'ui:widget': 'hidden' },
              is_remote: { 'ui:widget': 'hidden' },
              daq_job_info: { 'ui:widget': 'hidden' },
              remote_config: { 'ui:widget': 'hidden' },
            }}
          >
            {/* Hide default submit button */}
            <button type="submit" style={{ display: 'none' }} />
          </Form>
        </div>
      )}
    </div>
  );
};

export default MessagePayloadForm;
