'use client';

import React, { useState, useEffect } from 'react';
import { API, Template, RunType, TemplateParameter } from '@/lib/api-client';

interface MessageSchema {
  type_key: string;
  label: string;
  description: string;
  $defs?: Record<string, unknown>;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [runTypes, setRunTypes] = useState<RunType[]>([]);
  const [messageSchemas, setMessageSchemas] = useState<
    Record<string, MessageSchema>
  >({});
  const [daqJobTypes, setDaqJobTypes] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    null
  );
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    type: 'run' as 'run' | 'message',
    config: '',
    runTypeIds: [] as number[],
    // Message template fields
    messageType: '',
    payloadTemplate: '',
    targetDaqJobType: '' as string, // Empty string = broadcast
  });
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [typeFilter, setTypeFilter] = useState<'all' | 'run' | 'message'>(
    'all'
  );

  // Dropdown state (for New Template button)
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Parameters state
  const [parameters, setParameters] = useState<TemplateParameter[]>([]);
  const [newParam, setNewParam] = useState({
    name: '',
    displayName: '',
    type: 'string',
    defaultValue: '',
    required: true,
  });
  const [isAddingParam, setIsAddingParam] = useState(false);
  const [editingParamId, setEditingParamId] = useState<number | null>(null);
  const [editParamData, setEditParamData] = useState({
    name: '',
    displayName: '',
    type: 'string',
    defaultValue: '',
    required: true,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [tData, rtData] = await Promise.all([
        API.getTemplates(),
        API.getRunTypes(),
      ]);
      setTemplates(tData);
      setRunTypes(rtData);

      // Also load message schemas for the dropdown
      try {
        const schemas = (await API.getMessageSchemas()) as Record<
          string,
          MessageSchema
        >;
        setMessageSchemas(schemas);
      } catch {
        console.warn('Failed to load message schemas');
      }

      // Load DAQ job types for target dropdown
      try {
        const jobSchemas = await API.getDAQJobSchemas();
        // Extract job type names from the schema keys
        const jobTypes = Object.keys(jobSchemas);
        setDaqJobTypes(jobTypes);
      } catch {
        console.warn('Failed to load DAQ job types');
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  const filteredTemplates = templates.filter((t) => {
    if (typeFilter === 'all') return true;
    return t.type === typeFilter;
  });

  const handleSelectTemplate = (t: Template) => {
    if (isCreating) {
      if (!confirm('Discard changes?')) return;
    }
    setSelectedTemplate(t);
    setIsCreating(false);
    setIsEditing(false);
    setFormData({
      name: t.name,
      displayName: t.displayName,
      type: (t.type === 'message' ? 'message' : 'run') as 'run' | 'message',
      config: t.config || '',
      runTypeIds: t.runTypeIds || [],
      messageType: t.messageType || '',
      payloadTemplate: t.payloadTemplate || '',
      targetDaqJobType: t.targetDaqJobType || '',
    });
    setError(null);
    setIsAddingParam(false);
    loadParameters(t.id);
  };

  const handleStartCreate = (type: 'run' | 'message' = 'run') => {
    setSelectedTemplate(null);
    setIsCreating(true);
    setIsEditing(false);
    setFormData({
      name: '',
      displayName: '',
      type,
      config: '',
      runTypeIds: [],
      messageType: '',
      payloadTemplate: '',
      targetDaqJobType: '',
    });
    setParameters([]);
    setEditingParamId(null);
    setIsAddingParam(false);
    setError(null);
  };

  const handleStartEdit = () => {
    if (!selectedTemplate) return;
    setIsEditing(true);
    setFormData({
      name: selectedTemplate.name,
      displayName: selectedTemplate.displayName,
      type: (selectedTemplate.type === 'message' ? 'message' : 'run') as
        | 'run'
        | 'message',
      config: selectedTemplate.config,
      runTypeIds: selectedTemplate.runTypeIds || [],
      messageType: selectedTemplate.messageType || '',
      payloadTemplate: selectedTemplate.payloadTemplate || '',
      targetDaqJobType: selectedTemplate.targetDaqJobType || '',
    });
  };

  const handleCancel = () => {
    setIsCreating(false);
    setIsEditing(false);
    if (selectedTemplate) {
      setFormData({
        name: selectedTemplate.name,
        displayName: selectedTemplate.displayName,
        type: (selectedTemplate.type === 'message' ? 'message' : 'run') as
          | 'run'
          | 'message',
        config: selectedTemplate.config || '',
        runTypeIds: selectedTemplate.runTypeIds || [],
        messageType: selectedTemplate.messageType || '',
        payloadTemplate: selectedTemplate.payloadTemplate || '',
        targetDaqJobType: selectedTemplate.targetDaqJobType || '',
      });
    } else {
      setFormData({
        name: '',
        displayName: '',
        type: 'run',
        config: '',
        runTypeIds: [],
        messageType: '',
        payloadTemplate: '',
        targetDaqJobType: '',
      });
    }
    setError(null);
    setError(null);
    setIsAddingParam(false);
    setEditingParamId(null);
  };

  const loadParameters = async (templateId: number) => {
    try {
      const params = await API.getTemplateParameters(templateId);
      setParameters(params);
    } catch (e) {
      console.error('Failed to load parameters:', e);
      setParameters([]);
    }
  };

  const handleAddParameter = async () => {
    if (!selectedTemplate || !newParam.name || !newParam.displayName) return;

    try {
      await API.createTemplateParameter(selectedTemplate.id, newParam);
      await loadParameters(selectedTemplate.id);
      setNewParam({
        name: '',
        displayName: '',
        type: 'string',
        defaultValue: '',
        required: true,
      });
      setIsAddingParam(false);
    } catch (e: any) {
      setError(e.response?.data?.error || e.message);
    }
  };

  const handleDeleteParameter = async (paramId: number) => {
    if (!confirm('Delete this parameter?')) return;
    try {
      await API.deleteTemplateParameter(paramId);
      if (selectedTemplate) {
        await loadParameters(selectedTemplate.id);
      }
    } catch (e: any) {
      setError(e.response?.data?.error || e.message);
    }
  };

  const handleStartEditParam = (param: TemplateParameter) => {
    setEditingParamId(param.id);
    setEditParamData({
      name: param.name,
      displayName: param.displayName,
      type: param.type,
      defaultValue: param.defaultValue || '',
      required: param.required,
    });
  };

  const handleCancelEditParam = () => {
    setEditingParamId(null);
  };

  const handleUpdateParameter = async () => {
    if (!editingParamId || !editParamData.name || !editParamData.displayName)
      return;
    try {
      await API.updateTemplateParameter(editingParamId, editParamData);
      if (selectedTemplate) {
        await loadParameters(selectedTemplate.id);
      }
      setEditingParamId(null);
    } catch (e: any) {
      setError(e.response?.data?.error || e.message);
    }
  };

  const handleSave = async () => {
    setError(null);
    try {
      // Validate JSON for message templates
      if (formData.type === 'message' && formData.payloadTemplate) {
        try {
          JSON.parse(formData.payloadTemplate);
        } catch {
          setError(
            'Invalid JSON in payload template. Please fix the syntax errors.'
          );
          return;
        }
      }

      if (isCreating) {
        const newTemplate = await API.createTemplate({
          name: formData.name,
          displayName: formData.displayName,
          config: formData.type === 'message' ? '' : formData.config,
          type: formData.type,
          runTypeIds: formData.runTypeIds,
          messageType:
            formData.type === 'message' ? formData.messageType : undefined,
          payloadTemplate:
            formData.type === 'message' ? formData.payloadTemplate : undefined,
          targetDaqJobType:
            formData.type === 'message'
              ? formData.targetDaqJobType || null
              : null,
        });
        await loadData();
        setSelectedTemplate(newTemplate);
        setParameters([]);
        setIsCreating(false);
      } else if (isEditing && selectedTemplate) {
        const updated = await API.updateTemplate(selectedTemplate.id, {
          displayName: formData.displayName,
          config: formData.config,
          type: formData.type,
          runTypeIds: formData.runTypeIds,
          messageType: formData.messageType,
          payloadTemplate: formData.payloadTemplate,
          targetDaqJobType: formData.targetDaqJobType || null,
        });
        await loadData();
        setSelectedTemplate(updated);
        setIsEditing(false);
      }
    } catch (e: any) {
      setError(e.response?.data?.error || e.message);
    }
  };

  const handleDelete = async () => {
    if (!selectedTemplate) return;
    if (
      !confirm(
        `Are you sure you want to delete template "${selectedTemplate.displayName}"?`
      )
    )
      return;

    try {
      await API.deleteTemplate(selectedTemplate.id);
      await loadData();
      setSelectedTemplate(null);
      setIsEditing(false);
    } catch (e: any) {
      setError(e.response?.data?.error || e.message);
    }
  };

  const toggleRunType = (id: number) => {
    const current = formData.runTypeIds;
    if (current.includes(id)) {
      setFormData({
        ...formData,
        runTypeIds: current.filter((rid) => rid !== id),
      });
    } else {
      setFormData({ ...formData, runTypeIds: [...current, id] });
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'message':
        return <span className="badge bg-info text-dark">Message</span>;
      case 'run':
      default:
        return <span className="badge bg-success">Run</span>;
    }
  };

  // Generate default payload template from schema
  const generatePayloadTemplate = (messageType: string) => {
    const schema = messageSchemas[messageType];
    if (!schema || !schema.$defs) return '{}';

    const mainDef = schema.$defs[messageType] as any;
    if (!mainDef?.properties) return '{}';

    const template: Record<string, any> = {};
    for (const [key, prop] of Object.entries(mainDef.properties)) {
      const p = prop as any;
      // Skip complex/nested objects for simplicity
      if (p.type === 'string') template[key] = `{${key.toUpperCase()}}`;
      else if (p.type === 'boolean') template[key] = false;
      else if (p.type === 'integer') template[key] = 0;
    }
    return JSON.stringify(template, null, 2);
  };

  return (
    <div className="container-fluid h-100 p-4 overflow-hidden d-flex flex-column">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="text-light fw-bold mb-0">Configuration Templates</h2>
        <div className="dropdown">
          <button
            className="btn btn-primary dropdown-toggle"
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
          >
            <i className="fa-solid fa-plus me-2"></i>New Template
          </button>
          <ul
            className={`dropdown-menu dropdown-menu-dark dropdown-menu-end ${
              dropdownOpen ? 'show' : ''
            }`}
          >
            <li>
              <button
                className="dropdown-item"
                onClick={() => {
                  handleStartCreate('run');
                  setDropdownOpen(false);
                }}
              >
                <i className="fa-solid fa-play me-2"></i>Run Template
              </button>
            </li>
            <li>
              <button
                className="dropdown-item"
                onClick={() => {
                  handleStartCreate('message');
                  setDropdownOpen(false);
                }}
              >
                <i className="fa-solid fa-envelope me-2"></i>Message Template
              </button>
            </li>
          </ul>
        </div>
      </div>

      <div className="row flex-grow-1 overflow-hidden g-4">
        {/* List Column */}
        <div className="col-md-4 h-100 d-flex flex-column">
          <div className="card h-100 border-secondary bg-dark">
            <div className="card-header border-secondary fw-bold d-flex justify-content-between align-items-center">
              <span>Available Templates</span>
              <select
                className="form-select form-select-sm bg-dark text-light border-secondary"
                style={{ width: 'auto' }}
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
              >
                <option value="all">All Types</option>
                <option value="run">Run</option>
                <option value="message">Message</option>
              </select>
            </div>
            <div className="list-group list-group-flush overflow-auto h-100">
              {filteredTemplates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleSelectTemplate(t)}
                  className={`list-group-item list-group-item-action bg-dark text-light border-secondary ${
                    selectedTemplate?.id === t.id ? 'active' : ''
                  }`}
                >
                  <div className="d-flex w-100 justify-content-between align-items-center">
                    <div>
                      <h6 className="mb-1 fw-bold">{t.displayName}</h6>
                      <small className="text-muted">{t.name}</small>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      {getTypeBadge(t.type)}
                      {!t.editable && (
                        <span className="badge bg-secondary">
                          <i className="fa-solid fa-lock"></i>
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
              {filteredTemplates.length === 0 && (
                <div className="p-3 text-center text-muted">
                  No templates found.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Detail/Edit Column */}
        <div className="col-md-8 h-100 d-flex flex-column">
          {error && (
            <div className="alert alert-danger mb-3">
              <i className="fa-solid fa-triangle-exclamation me-2"></i>
              {error}
            </div>
          )}

          {selectedTemplate || isCreating ? (
            <div className="card h-100 border-secondary bg-dark shadow-sm overflow-auto">
              <div className="card-header border-secondary d-flex justify-content-between align-items-center py-3">
                <div className="d-flex align-items-center gap-2">
                  <span className="fw-bold fs-5">
                    {isCreating
                      ? `Create New ${
                          formData.type.charAt(0).toUpperCase() +
                          formData.type.slice(1)
                        } Template`
                      : isEditing
                      ? 'Editing Template'
                      : 'Template Details'}
                  </span>
                  {!isCreating &&
                    selectedTemplate &&
                    getTypeBadge(selectedTemplate.type)}
                </div>
                <div>
                  {!isCreating && !isEditing && selectedTemplate?.editable && (
                    <>
                      <button
                        className="btn btn-outline-danger me-2"
                        onClick={handleDelete}
                      >
                        <i className="fa-solid fa-trash me-2"></i>Delete
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={handleStartEdit}
                      >
                        <i className="fa-solid fa-pen-to-square me-2"></i>Edit
                      </button>
                    </>
                  )}
                  {(isCreating || isEditing) && (
                    <>
                      <button
                        className="btn btn-secondary me-2"
                        onClick={handleCancel}
                      >
                        Cancel
                      </button>
                      <button className="btn btn-success" onClick={handleSave}>
                        <i className="fa-solid fa-save me-2"></i>Save
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="card-body overflow-auto">
                <div className="mb-3">
                  <label className="form-label text-muted">Internal Name</label>
                  <input
                    type="text"
                    className="form-control bg-dark text-light border-secondary"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    disabled={!isCreating}
                    placeholder="e.g. calibration_v1"
                  />
                  {isCreating && (
                    <div className="form-text">
                      Unique identifier for the system (snake_case recommended).
                    </div>
                  )}
                </div>

                <div className="mb-3">
                  <label className="form-label text-muted">Display Name</label>
                  <input
                    type="text"
                    className="form-control bg-dark text-light border-secondary"
                    value={formData.displayName}
                    onChange={(e) =>
                      setFormData({ ...formData, displayName: e.target.value })
                    }
                    disabled={!isCreating && !isEditing}
                    placeholder="e.g. Calibration V1"
                  />
                </div>

                {/* Type Selection (only when creating) */}
                {isCreating && (
                  <div className="mb-3">
                    <label className="form-label text-muted">
                      Template Type
                    </label>
                    <select
                      className="form-select bg-dark text-light border-secondary"
                      value={formData.type}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          type: e.target.value as 'run' | 'message',
                        })
                      }
                    >
                      <option value="run">Run (Used in Runs)</option>
                      <option value="message">
                        Message (DAQ Job Messaging)
                      </option>
                    </select>
                    <div className="form-text">
                      {formData.type === 'run' &&
                        'Template used when starting runs, linked to Run Types.'}
                      {formData.type === 'message' &&
                        'Template for sending messages to DAQ jobs.'}
                    </div>
                  </div>
                )}

                {/* Run Type Association (for both run and message templates) */}
                <div className="mb-3">
                  <label className="form-label text-muted">
                    Associated Run Types
                  </label>
                  <div className="form-text mb-2">
                    {formData.type === 'run'
                      ? 'This template will be available when starting runs of the selected types.'
                      : 'Message templates linked to run types can be sent during those runs.'}
                  </div>
                  <div className="card bg-dark border-secondary p-2">
                    {runTypes.length > 0 ? (
                      runTypes.map((rt) => (
                        <div
                          key={rt.id}
                          className="form-check form-switch mb-2"
                        >
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id={`rt-${rt.id}`}
                            checked={formData.runTypeIds.includes(rt.id)}
                            onChange={() => toggleRunType(rt.id)}
                            disabled={!isCreating && !isEditing}
                          />
                          <label
                            className="form-check-label"
                            htmlFor={`rt-${rt.id}`}
                          >
                            <strong>{rt.name}</strong>
                            {rt.description && (
                              <span className="text-muted ms-2 small">
                                ({rt.description})
                              </span>
                            )}
                          </label>
                        </div>
                      ))
                    ) : (
                      <small className="text-muted">
                        No run types defined in system.
                      </small>
                    )}
                  </div>
                </div>

                {/* Parameters Section (only for existing templates) */}
                {!isCreating && selectedTemplate && (
                  <div className="mb-4">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <label className="form-label text-muted mb-0">
                        Template Parameters
                      </label>
                      <button
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => setIsAddingParam(!isAddingParam)}
                        disabled={!isEditing || !selectedTemplate.editable}
                      >
                        <i className="fa-solid fa-plus me-1"></i>Add
                      </button>
                    </div>

                    <div className="list-group mb-3">
                      {parameters.map((p) => (
                        <div
                          key={p.id}
                          className="list-group-item bg-dark text-light border-secondary p-2"
                        >
                          {editingParamId === p.id ? (
                            <div className="row g-2">
                              <div className="col-md-6">
                                <input
                                  type="text"
                                  className="form-control form-control-sm bg-dark text-light border-secondary"
                                  value={editParamData.name}
                                  onChange={(e) =>
                                    setEditParamData({
                                      ...editParamData,
                                      name: e.target.value,
                                    })
                                  }
                                  placeholder="Internal Name"
                                />
                              </div>
                              <div className="col-md-6">
                                <input
                                  type="text"
                                  className="form-control form-control-sm bg-dark text-light border-secondary"
                                  value={editParamData.displayName}
                                  onChange={(e) =>
                                    setEditParamData({
                                      ...editParamData,
                                      displayName: e.target.value,
                                    })
                                  }
                                  placeholder="Display Name"
                                />
                              </div>
                              <div className="col-md-4">
                                <select
                                  className="form-select form-select-sm bg-dark text-light border-secondary"
                                  value={editParamData.type}
                                  onChange={(e) =>
                                    setEditParamData({
                                      ...editParamData,
                                      type: e.target.value,
                                    })
                                  }
                                >
                                  <option value="string">String</option>
                                  <option value="number">Number</option>
                                  <option value="boolean">Boolean</option>
                                </select>
                              </div>
                              <div className="col-md-4">
                                <input
                                  type="text"
                                  className="form-control form-control-sm bg-dark text-light border-secondary"
                                  value={editParamData.defaultValue}
                                  onChange={(e) =>
                                    setEditParamData({
                                      ...editParamData,
                                      defaultValue: e.target.value,
                                    })
                                  }
                                  placeholder="Default Value"
                                />
                              </div>
                              <div className="col-md-4 d-flex align-items-center justify-content-between">
                                <div className="form-check mb-0">
                                  <input
                                    className="form-check-input"
                                    type="checkbox"
                                    id={`edit-req-${p.id}`}
                                    checked={editParamData.required}
                                    onChange={(e) =>
                                      setEditParamData({
                                        ...editParamData,
                                        required: e.target.checked,
                                      })
                                    }
                                  />
                                  <label
                                    className="form-check-label small"
                                    htmlFor={`edit-req-${p.id}`}
                                  >
                                    Req
                                  </label>
                                </div>
                                <div>
                                  <button
                                    className="btn btn-sm btn-success me-1"
                                    onClick={handleUpdateParameter}
                                  >
                                    <i className="fa-solid fa-check"></i>
                                  </button>
                                  <button
                                    className="btn btn-sm btn-secondary"
                                    onClick={handleCancelEditParam}
                                  >
                                    <i className="fa-solid fa-xmark"></i>
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="d-flex justify-content-between align-items-center">
                              <div>
                                <div className="d-flex align-items-center gap-2">
                                  <span className="fw-bold">
                                    {p.displayName}
                                  </span>
                                  <code className="text-info bg-dark bg-opacity-50 px-1 rounded">
                                    {`{${p.name}}`}
                                  </code>
                                  {p.required && (
                                    <span className="badge bg-warning text-dark">
                                      Req
                                    </span>
                                  )}
                                </div>
                                <small className="text-muted">
                                  Type: {p.type} | Default:{' '}
                                  {p.defaultValue || '(none)'}
                                </small>
                              </div>
                              {selectedTemplate.editable && isEditing && (
                                <div>
                                  <button
                                    className="btn btn-sm btn-outline-info me-2"
                                    onClick={() => handleStartEditParam(p)}
                                    title="Edit Parameter"
                                  >
                                    <i className="fa-solid fa-pen"></i>
                                  </button>
                                  <button
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() => handleDeleteParameter(p.id)}
                                    title="Delete Parameter"
                                  >
                                    <i className="fa-solid fa-trash"></i>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                      {parameters.length === 0 && (
                        <div className="text-muted small fst-italic p-2 border border-secondary border-dashed rounded text-center">
                          No parameters defined. Add parameters to make this
                          template dynamic.
                        </div>
                      )}
                    </div>

                    {isAddingParam && isEditing && (
                      <div className="card card-body bg-dark border-info p-3 mb-3">
                        <h6 className="card-title text-info mb-3">
                          New Parameter
                        </h6>
                        <div className="row g-3">
                          <div className="col-md-6">
                            <label className="form-label small text-muted">
                              Internal Name
                            </label>
                            <input
                              type="text"
                              className="form-control form-control-sm bg-dark text-light border-secondary"
                              value={newParam.name}
                              onChange={(e) =>
                                setNewParam({
                                  ...newParam,
                                  name: e.target.value,
                                })
                              }
                              placeholder="e.g. voltage"
                            />
                          </div>
                          <div className="col-md-6">
                            <label className="form-label small text-muted">
                              Display Name
                            </label>
                            <input
                              type="text"
                              className="form-control form-control-sm bg-dark text-light border-secondary"
                              value={newParam.displayName}
                              onChange={(e) =>
                                setNewParam({
                                  ...newParam,
                                  displayName: e.target.value,
                                })
                              }
                              placeholder="e.g. Bias Voltage"
                            />
                          </div>
                          <div className="col-md-4">
                            <label className="form-label small text-muted">
                              Type
                            </label>
                            <select
                              className="form-select form-select-sm bg-dark text-light border-secondary"
                              value={newParam.type}
                              onChange={(e) =>
                                setNewParam({
                                  ...newParam,
                                  type: e.target.value,
                                })
                              }
                            >
                              <option value="string">String</option>
                              <option value="number">Number</option>
                              <option value="boolean">Boolean</option>
                            </select>
                          </div>
                          <div className="col-md-4">
                            <label className="form-label small text-muted">
                              Default Value
                            </label>
                            <input
                              type="text"
                              className="form-control form-control-sm bg-dark text-light border-secondary"
                              value={newParam.defaultValue}
                              onChange={(e) =>
                                setNewParam({
                                  ...newParam,
                                  defaultValue: e.target.value,
                                })
                              }
                              placeholder="Optional"
                            />
                          </div>
                          <div className="col-md-4 d-flex align-items-end">
                            <div className="form-check mb-1">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                id="paramRequired"
                                checked={newParam.required}
                                onChange={(e) =>
                                  setNewParam({
                                    ...newParam,
                                    required: e.target.checked,
                                  })
                                }
                              />
                              <label
                                className="form-check-label small"
                                htmlFor="paramRequired"
                              >
                                Required
                              </label>
                            </div>
                          </div>
                          <div className="col-12 text-end mt-3">
                            <button
                              className="btn btn-sm btn-secondary me-2"
                              onClick={() => setIsAddingParam(false)}
                            >
                              Cancel
                            </button>
                            <button
                              className="btn btn-sm btn-success"
                              onClick={handleAddParameter}
                            >
                              Add Parameter
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Message Template Fields */}
                {formData.type === 'message' && (
                  <>
                    <div className="mb-3">
                      <label className="form-label text-muted">
                        Message Type
                      </label>
                      <select
                        className="form-select bg-dark text-light border-secondary"
                        value={formData.messageType}
                        onChange={(e) => {
                          const newType = e.target.value;
                          setFormData({
                            ...formData,
                            messageType: newType,
                            payloadTemplate: newType
                              ? generatePayloadTemplate(newType)
                              : '',
                          });
                        }}
                        disabled={!isCreating && !isEditing}
                      >
                        <option value="">-- Select Message Type --</option>
                        {Object.entries(messageSchemas).map(([key, schema]) => (
                          <option key={key} value={key}>
                            {schema.label} ({key})
                          </option>
                        ))}
                      </select>
                      <div className="form-text">
                        The type of message to send (e.g., DAQJobMessageStop).
                      </div>
                    </div>

                    <div className="mb-3">
                      <label className="form-label text-muted">
                        Target DAQ Job
                      </label>
                      <select
                        className="form-select bg-dark text-light border-secondary"
                        value={formData.targetDaqJobType}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            targetDaqJobType: e.target.value,
                          })
                        }
                        disabled={!isCreating && !isEditing}
                      >
                        <option value="">Broadcast to All Jobs</option>
                        {daqJobTypes.map((jobType) => (
                          <option key={jobType} value={jobType}>
                            {jobType}
                          </option>
                        ))}
                      </select>
                      <div className="form-text">
                        {formData.targetDaqJobType
                          ? `Message will be sent only to jobs of type "${formData.targetDaqJobType}".`
                          : 'Message will be broadcast to all running DAQ jobs.'}
                      </div>
                    </div>

                    <div className="mb-3">
                      <label className="form-label text-muted">
                        Payload Template (JSON)
                      </label>
                      <textarea
                        className="form-control bg-dark text-light border-secondary font-monospace"
                        style={{ minHeight: '200px', resize: 'none' }}
                        value={formData.payloadTemplate}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            payloadTemplate: e.target.value,
                          })
                        }
                        disabled={!isCreating && !isEditing}
                        spellCheck={false}
                        placeholder='{"reason": "{STOP_REASON}"}'
                      />
                      <div className="form-text">
                        Use <code>{'{PARAMETER_NAME}'}</code> for placeholders
                        that will be replaced at send time.
                      </div>
                    </div>
                  </>
                )}

                {/* Config (for non-message templates) */}
                {formData.type !== 'message' && (
                  <div className="mb-3 flex-grow-1 d-flex flex-column h-100">
                    <label className="form-label text-muted">
                      Configuration (TOML)
                    </label>
                    <textarea
                      className="form-control bg-dark text-light border-secondary font-monospace"
                      style={{ minHeight: '400px', resize: 'none' }}
                      value={formData.config}
                      onChange={(e) =>
                        setFormData({ ...formData, config: e.target.value })
                      }
                      disabled={!isCreating && !isEditing}
                      spellCheck={false}
                    />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-100 d-flex flex-column justify-content-center align-items-center text-muted opacity-50 border border-secondary rounded border-dashed">
              <i className="fa-solid fa-file-code fa-4x mb-3"></i>
              <h4>Select a template to view details</h4>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
