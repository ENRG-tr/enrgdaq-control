'use client';

import React, { useState, useEffect } from 'react';
import { API, Template, TemplateParameter, Message } from '@/lib/api-client';
import { useStore } from '@/lib/store';
import toast from 'react-hot-toast';
import MessagePayloadForm from '@/components/MessagePayloadForm';
import type { DAQJobInfo } from '@/lib/types';

interface MessageSchema {
  type_key: string;
  label: string;
  description: string;
  $defs?: Record<string, unknown>;
}

export default function MessagesPage() {
  const { clients, selectedClient, selectClient, clientOnline, clientStatus } =
    useStore();

  // Templates
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | ''>('');
  const [parameters, setParameters] = useState<TemplateParameter[]>([]);
  const [parameterValues, setParameterValues] = useState<
    Record<string, string>
  >({});
  const [loadingParams, setLoadingParams] = useState(false);

  // Schemas (for raw message mode)
  const [schemas, setSchemas] = useState<Record<string, MessageSchema>>({});
  const [loadingSchemas, setLoadingSchemas] = useState(false);

  // Target selection
  const [targetMode, setTargetMode] = useState<'broadcast' | 'specific'>(
    'broadcast',
  );
  const [targetDaqJobType, setTargetDaqJobType] = useState('');

  // Active DAQ jobs (for target selection)
  const activeJobs = clientStatus?.daq_jobs || [];

  // Message history
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesTotal, setMessagesTotal] = useState(0);
  const [messagesPage, setMessagesPage] = useState(1);
  const messagesLimit = 10;

  // Raw message mode
  const [mode, setMode] = useState<'template' | 'raw'>('template');
  const [rawMessageType, setRawMessageType] = useState('');
  const [rawPayload, setRawPayload] = useState('');

  // State
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load initial data
  useEffect(() => {
    loadTemplates();
    loadSchemas();
    loadMessages();
  }, []);

  // Reload messages when page changes
  useEffect(() => {
    loadMessages();
  }, [messagesPage]);

  // Load parameters when template changes
  useEffect(() => {
    if (selectedTemplateId === '') {
      setParameters([]);
      setParameterValues({});
      return;
    }

    loadParameters(Number(selectedTemplateId));
  }, [selectedTemplateId]);

  // Auto-select default client and target DAQ job when template changes
  useEffect(() => {
    if (selectedTemplateId === '') return;

    const template = templates.find((t) => t.id === selectedTemplateId);
    if (!template) return;

    // Auto-select default client if template has one
    if (template.defaultClientId) {
      // Check if the default client exists in our clients list
      const clientExists = clients.some(
        (c) => c.id === template.defaultClientId,
      );
      if (clientExists) {
        selectClient(template.defaultClientId);
      }
    }

    // Auto-select target DAQ job type if template has one
    if (template.targetDaqJobType) {
      setTargetMode('specific');
      setTargetDaqJobType(template.targetDaqJobType);
    } else {
      setTargetMode('broadcast');
      setTargetDaqJobType('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplateId]);

  const loadTemplates = async () => {
    try {
      const data = await API.getMessageTemplates();
      setTemplates(data);
    } catch (e: unknown) {
      console.error('Failed to load message templates:', e);
    }
  };

  const loadSchemas = async () => {
    setLoadingSchemas(true);
    try {
      const data = (await API.getMessageSchemas()) as Record<
        string,
        MessageSchema
      >;
      setSchemas(data);
    } catch (e: unknown) {
      console.error('Failed to load message schemas:', e);
    } finally {
      setLoadingSchemas(false);
    }
  };

  const loadMessages = async () => {
    try {
      const data = await API.getMessages(messagesPage, messagesLimit);
      setMessages(data.messages);
      setMessagesTotal(data.total);
    } catch (e: unknown) {
      console.error('Failed to load messages:', e);
    }
  };

  const loadParameters = async (templateId: number) => {
    setLoadingParams(true);
    try {
      const params = await API.getTemplateParameters(templateId);
      setParameters(params);
      // Initialize with defaults
      const initial: Record<string, string> = {};
      for (const param of params) {
        initial[param.name] = param.defaultValue || '';
      }
      setParameterValues(initial);
    } catch (e: unknown) {
      console.error('Failed to load parameters:', e);
      setParameters([]);
    } finally {
      setLoadingParams(false);
    }
  };

  const handleParameterChange = (name: string, value: string) => {
    setParameterValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSend = async () => {
    if (!selectedClient) {
      toast.error('Please select a client');
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      if (mode === 'template') {
        if (!selectedTemplateId) {
          throw new Error('Please select a message template');
        }

        // Validate required parameters
        for (const param of parameters) {
          if (param.required && !parameterValues[param.name]) {
            throw new Error(
              `Please fill in required parameter: ${param.displayName}`,
            );
          }
        }

        await API.sendMessage({
          templateId: Number(selectedTemplateId),
          clientId: selectedClient,
          targetDaqJobType: targetMode === 'specific' ? targetDaqJobType : null,
          parameterValues,
        });
      } else {
        // Raw message mode
        if (!rawMessageType || !rawPayload) {
          throw new Error('Please enter message type and payload');
        }

        // Validate JSON
        try {
          JSON.parse(rawPayload);
        } catch {
          throw new Error('Invalid JSON payload');
        }

        await API.sendMessage({
          clientId: selectedClient,
          messageType: rawMessageType,
          payload: rawPayload,
          targetDaqJobType: targetMode === 'specific' ? targetDaqJobType : null,
        });
      }

      toast.success('Message sent successfully!');
      loadMessages();

      // Reset form
      if (mode === 'raw') {
        setRawPayload('');
      }
    } catch (e: unknown) {
      const error = e as { message?: string };
      setError(error.message || 'Failed to send message');
      toast.error(error.message || 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  return (
    <div className="container-fluid h-100 p-4 overflow-hidden d-flex flex-column">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="fw-bold text-light mb-0">
          <i className="fa-solid fa-envelope me-3"></i>DAQ Job Messaging
        </h2>
        <div className="d-flex align-items-center bg-dark border border-secondary rounded px-3 py-2">
          <span className="text-muted me-2">Target Node:</span>
          <select
            className="form-select form-select-sm bg-dark text-light border-0"
            style={{ width: 'auto', boxShadow: 'none' }}
            value={selectedClient || ''}
            onChange={(e) => selectClient(e.target.value)}
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id}
              </option>
            ))}
          </select>
          <div
            className={`ms-3 status-dot ${
              clientOnline ? 'status-online' : 'status-offline'
            }`}
          ></div>
        </div>
      </div>

      <div className="row flex-grow-1 overflow-hidden g-4">
        {/* Send Message Panel */}
        <div className="col-lg-6 h-100 d-flex flex-column">
          <div className="card h-100 border-secondary bg-dark">
            <div className="card-header border-secondary fw-bold">
              <i className="fa-solid fa-paper-plane me-2"></i>Send Message
            </div>
            <div className="card-body overflow-auto">
              {error && (
                <div className="alert alert-danger mb-3">
                  <i className="fa-solid fa-triangle-exclamation me-2"></i>
                  {error}
                </div>
              )}

              {/* Mode Toggle */}
              <div className="btn-group w-100 mb-4" role="group">
                <input
                  type="radio"
                  className="btn-check"
                  name="mode"
                  id="mode-template"
                  checked={mode === 'template'}
                  onChange={() => setMode('template')}
                />
                <label
                  className="btn btn-outline-primary"
                  htmlFor="mode-template"
                >
                  <i className="fa-solid fa-file-code me-2"></i>Use Template
                </label>
                <input
                  type="radio"
                  className="btn-check"
                  name="mode"
                  id="mode-raw"
                  checked={mode === 'raw'}
                  onChange={() => setMode('raw')}
                />
                <label className="btn btn-outline-primary" htmlFor="mode-raw">
                  <i className="fa-solid fa-code me-2"></i>Raw Message
                </label>
              </div>

              {mode === 'template' ? (
                <>
                  {/* Template Selection */}
                  <div className="mb-4">
                    <label className="form-label text-muted">
                      Message Template
                    </label>
                    <select
                      className="form-select bg-dark text-light border-secondary"
                      value={selectedTemplateId}
                      onChange={(e) =>
                        setSelectedTemplateId(
                          e.target.value === '' ? '' : Number(e.target.value),
                        )
                      }
                    >
                      <option value="">-- Select Template --</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.displayName}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Template Preview */}
                  {selectedTemplate && (
                    <div className="mb-4 p-3 bg-dark border border-info rounded">
                      <div className="d-flex justify-content-between mb-2">
                        <span className="badge bg-info text-dark">
                          {selectedTemplate.messageType}
                        </span>
                      </div>
                      <pre
                        className="text-muted small mb-0"
                        style={{ maxHeight: '100px', overflow: 'auto' }}
                      >
                        {selectedTemplate.payloadTemplate}
                      </pre>
                    </div>
                  )}

                  {/* Parameters */}
                  {loadingParams && (
                    <div className="text-muted small mb-3">
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Loading parameters...
                    </div>
                  )}
                  {parameters.length > 0 && (
                    <div className="mb-4 p-3 border border-secondary rounded">
                      <label className="form-label text-info fw-bold mb-3">
                        <i className="fa-solid fa-sliders me-2"></i>Parameters
                      </label>
                      {parameters.map((param) => (
                        <div key={param.id} className="mb-3">
                          <label className="form-label text-muted small">
                            {param.displayName}
                            {param.required && (
                              <span className="text-danger ms-1">*</span>
                            )}
                          </label>
                          {param.type === 'bool' ? (
                            <select
                              className="form-select bg-dark text-light border-secondary"
                              value={parameterValues[param.name] || ''}
                              onChange={(e) =>
                                handleParameterChange(
                                  param.name,
                                  e.target.value,
                                )
                              }
                            >
                              <option value="">-- Select --</option>
                              <option value="true">True</option>
                              <option value="false">False</option>
                            </select>
                          ) : (
                            <input
                              type={
                                param.type === 'int' || param.type === 'float'
                                  ? 'number'
                                  : 'text'
                              }
                              step={param.type === 'float' ? '0.01' : undefined}
                              className="form-control bg-dark text-light border-secondary"
                              placeholder={
                                param.defaultValue ||
                                `Enter ${param.displayName}`
                              }
                              value={parameterValues[param.name] || ''}
                              onChange={(e) =>
                                handleParameterChange(
                                  param.name,
                                  e.target.value,
                                )
                              }
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Raw Message Type */}
                  <div className="mb-4">
                    <label className="form-label text-muted">
                      Message Type
                    </label>
                    <select
                      className="form-select bg-dark text-light border-secondary"
                      value={rawMessageType}
                      onChange={(e) => {
                        setRawMessageType(e.target.value);
                        // Reset payload when type changes
                        setRawPayload('{}');
                      }}
                    >
                      <option value="">-- Select Message Type --</option>
                      {Object.entries(schemas).map(([key, schema]) => (
                        <option key={key} value={key}>
                          {schema.label} ({key})
                        </option>
                      ))}
                    </select>
                    {loadingSchemas && (
                      <div className="form-text">
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Loading schemas...
                      </div>
                    )}
                  </div>

                  {/* RJSF-powered Payload Form */}
                  {rawMessageType && (
                    <div className="mb-4">
                      <label className="form-label text-muted">
                        Message Payload
                      </label>
                      <MessagePayloadForm
                        messageType={rawMessageType}
                        initialPayload={rawPayload}
                        onChange={setRawPayload}
                        disabled={!clientOnline}
                      />
                    </div>
                  )}
                </>
              )}

              {/* Target Selection */}
              <div className="mb-4">
                <label className="form-label text-muted">Target DAQ Job</label>
                <div className="btn-group w-100 mb-2" role="group">
                  <input
                    type="radio"
                    className="btn-check"
                    name="target"
                    id="target-broadcast"
                    checked={targetMode === 'broadcast'}
                    onChange={() => setTargetMode('broadcast')}
                  />
                  <label
                    className="btn btn-outline-secondary"
                    htmlFor="target-broadcast"
                  >
                    <i className="fa-solid fa-broadcast-tower me-2"></i>
                    Broadcast All
                  </label>
                  <input
                    type="radio"
                    className="btn-check"
                    name="target"
                    id="target-specific"
                    checked={targetMode === 'specific'}
                    onChange={() => setTargetMode('specific')}
                  />
                  <label
                    className="btn btn-outline-secondary"
                    htmlFor="target-specific"
                  >
                    <i className="fa-solid fa-bullseye me-2"></i>Specific Job
                  </label>
                </div>

                {targetMode === 'specific' && (
                  <select
                    className="form-select bg-dark text-light border-secondary"
                    value={targetDaqJobType}
                    onChange={(e) => setTargetDaqJobType(e.target.value)}
                  >
                    <option value="">-- Select Active Job --</option>
                    {activeJobs.map((job: DAQJobInfo) => (
                      <option key={job.unique_id} value={job.daq_job_type}>
                        {job.daq_job_type} ({job.unique_id})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Send Button */}
              <button
                className="btn btn-primary btn-lg w-100"
                onClick={handleSend}
                disabled={isSending || !clientOnline}
              >
                {isSending ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Sending...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-paper-plane me-2"></i>
                    Send Message
                  </>
                )}
              </button>

              {!clientOnline && (
                <div className="text-danger mt-2 text-center small">
                  Supervisor Offline
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Message History */}
        <div className="col-lg-6 h-100 d-flex flex-column">
          <div className="card h-100 border-secondary bg-dark">
            <div className="card-header border-secondary fw-bold d-flex justify-content-between align-items-center">
              <span>
                <i className="fa-solid fa-clock-rotate-left me-2"></i>Message
                History
              </span>
              <span className="badge bg-secondary">{messagesTotal} Total</span>
            </div>
            <div className="card-body p-0 overflow-auto">
              <div className="list-group list-group-flush">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className="list-group-item bg-dark text-light border-secondary"
                  >
                    <div className="d-flex justify-content-between align-items-start">
                      <div>
                        <span
                          className={`badge me-2 ${
                            msg.status === 'SENT' ? 'bg-success' : 'bg-danger'
                          }`}
                        >
                          {msg.status}
                        </span>
                        <strong className="text-info">{msg.messageType}</strong>
                        {msg.targetDaqJobType && (
                          <span className="badge bg-secondary ms-2">
                            → {msg.targetDaqJobType}
                          </span>
                        )}
                        {!msg.targetDaqJobType && (
                          <span className="badge bg-warning text-dark ms-2">
                            Broadcast
                          </span>
                        )}
                      </div>
                      <small className="text-muted">
                        {new Date(msg.sentAt).toLocaleString()}
                      </small>
                    </div>
                    <div className="mt-2">
                      <small className="text-muted">
                        Client: {msg.clientId}
                      </small>
                      {msg.errorMessage && (
                        <div className="text-danger small mt-1">
                          <i className="fa-solid fa-exclamation-circle me-1"></i>
                          {msg.errorMessage}
                        </div>
                      )}
                    </div>
                    <details className="mt-2">
                      <summary className="text-muted small cursor-pointer">
                        View Payload
                      </summary>
                      {(() => {
                        try {
                          const parsed = JSON.parse(msg.payload);
                          if (
                            typeof parsed !== 'object' ||
                            parsed === null ||
                            Object.keys(parsed).length === 0
                          ) {
                            return (
                              <pre
                                className="text-muted small mb-0 mt-2"
                                style={{ maxHeight: '100px', overflow: 'auto' }}
                              >
                                {msg.payload}
                              </pre>
                            );
                          }
                          return (
                            <div className="table-responsive mt-2">
                              <table
                                className="table table-sm table-dark table-bordered border-secondary mb-0"
                                style={{ fontSize: '0.85rem' }}
                              >
                                <tbody>
                                  {Object.entries(parsed).map(
                                    ([key, value]) => (
                                      <tr key={key}>
                                        <th
                                          className="text-muted fw-normal align-middle"
                                          style={{
                                            width: '30%',
                                            whiteSpace: 'nowrap',
                                          }}
                                        >
                                          {key}
                                        </th>
                                        <td className="text-light text-break font-monospace align-middle">
                                          {typeof value === 'object' &&
                                          value !== null ? (
                                            <pre
                                              className="mb-0 text-info"
                                              style={{
                                                fontSize: '0.8rem',
                                                background: 'transparent',
                                                padding: 0,
                                              }}
                                            >
                                              {JSON.stringify(value, null, 2)}
                                            </pre>
                                          ) : (
                                            String(value)
                                          )}
                                        </td>
                                      </tr>
                                    ),
                                  )}
                                </tbody>
                              </table>
                            </div>
                          );
                        } catch (e) {
                          return (
                            <pre
                              className="text-muted small mb-0 mt-2"
                              style={{ maxHeight: '100px', overflow: 'auto' }}
                            >
                              {msg.payload}
                            </pre>
                          );
                        }
                      })()}
                    </details>
                  </div>
                ))}
                {messages.length === 0 && (
                  <div className="p-4 text-center text-muted">
                    No messages sent yet.
                  </div>
                )}
              </div>

              {/* Pagination */}
              {messagesTotal > messagesLimit && (
                <div className="d-flex justify-content-between align-items-center p-3 border-top border-secondary">
                  <button
                    className="btn btn-sm btn-outline-secondary"
                    disabled={messagesPage === 1}
                    onClick={() => setMessagesPage(messagesPage - 1)}
                  >
                    <i className="fa-solid fa-chevron-left me-1"></i> Prev
                  </button>
                  <span className="text-muted small">
                    Page {messagesPage} of{' '}
                    {Math.ceil(messagesTotal / messagesLimit)}
                  </span>
                  <button
                    className="btn btn-sm btn-outline-secondary"
                    disabled={
                      messagesPage >= Math.ceil(messagesTotal / messagesLimit)
                    }
                    onClick={() => setMessagesPage(messagesPage + 1)}
                  >
                    Next <i className="fa-solid fa-chevron-right ms-1"></i>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
