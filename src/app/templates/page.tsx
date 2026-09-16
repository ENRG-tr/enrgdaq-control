'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { API, Template, RunType, TemplateParameter } from '@/lib/api-client';
import { TemplateList, RunTypeAssociation } from './components';
import LoadingSpinner from '@/components/LoadingSpinner';
import ConfirmModal from '@/components/ConfirmModal';
import AsyncError from '@/components/AsyncError';
import { useNavigationGuard } from '@/hooks/useNavigationGuard';

interface MessageSchema {
  type_key: string;
  label: string;
  description: string;
  $defs?: Record<string, unknown>;
}

interface TemplateFormData {
  name: string;
  displayName: string;
  type: 'run' | 'message';
  config: string;
  runTypeIds: number[];
  messageType: string;
  payloadTemplate: string;
  targetDaqJobType: string;
  defaultClientId: string;
  restartOnCrash: boolean;
}

interface ConfirmationRequest {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
}

const emptyTemplateForm = (
  type: 'run' | 'message' = 'run',
): TemplateFormData => ({
  name: '',
  displayName: '',
  type,
  config: '',
  runTypeIds: [],
  messageType: '',
  payloadTemplate: '',
  targetDaqJobType: '',
  defaultClientId: '',
  restartOnCrash: true,
});

const templateToFormData = (template: Template): TemplateFormData => ({
  name: template.name,
  displayName: template.displayName,
  type: template.type === 'message' ? 'message' : 'run',
  config: template.config || '',
  runTypeIds: template.runTypeIds || [],
  messageType: template.messageType || '',
  payloadTemplate: template.payloadTemplate || '',
  targetDaqJobType: template.targetDaqJobType || '',
  defaultClientId: template.defaultClientId || '',
  restartOnCrash: template.restartOnCrash ?? true,
});

const emptyParameterForm = () => ({
  name: '',
  displayName: '',
  type: 'string',
  defaultValue: '',
  required: true,
});

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [runTypes, setRunTypes] = useState<RunType[]>([]);
  const [messageSchemas, setMessageSchemas] = useState<
    Record<string, MessageSchema>
  >({});
  const [daqJobTypes, setDaqJobTypes] = useState<string[]>([]);
  const [clients, setClients] = useState<{ id: string; tags: string[] }[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    null
  );
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingParameters, setIsLoadingParameters] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [parameterAction, setParameterAction] = useState<'add' | 'update' | number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [parameterError, setParameterError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<TemplateFormData>(() =>
    emptyTemplateForm(),
  );
  const [formBaseline, setFormBaseline] = useState<TemplateFormData>(() =>
    emptyTemplateForm(),
  );
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] =
    useState<ConfirmationRequest | null>(null);

  // Parameter drafts are edited in the same form, so protect them as well.
  const [newParam, setNewParam] = useState(emptyParameterForm);
  const [parameterEditBaseline, setParameterEditBaseline] = useState(
    emptyParameterForm,
  );
  const [isAddingParam, setIsAddingParam] = useState(false);
  const [editingParamId, setEditingParamId] = useState<number | null>(null);
  const [editParamData, setEditParamData] = useState(emptyParameterForm);

  const isParameterDraftDirty =
    (isAddingParam &&
      JSON.stringify(newParam) !== JSON.stringify(emptyParameterForm())) ||
    (editingParamId !== null &&
      JSON.stringify(editParamData) !== JSON.stringify(parameterEditBaseline));
  const isDirty =
    (isCreating || isEditing) &&
    (JSON.stringify(formData) !== JSON.stringify(formBaseline) ||
      isParameterDraftDirty);

  // Filter state
  const [typeFilter, setTypeFilter] = useState<'all' | 'run' | 'message'>(
    'all'
  );

  // Dropdown state (for New Template button)
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Parameters state
  const [parameters, setParameters] = useState<TemplateParameter[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const askToDiscardChanges = (onConfirm: () => void) => {
    setConfirmation({
      title: 'Discard unsaved changes?',
      message: 'Your changes will be lost if you continue.',
      confirmLabel: 'Discard changes',
      danger: true,
      onConfirm,
    });
  };

  const runWithDiscardCheck = (onConfirm: () => void) => {
    if (isDirty) {
      askToDiscardChanges(onConfirm);
    } else {
      onConfirm();
    }
  };

  useNavigationGuard(isDirty, (href) => {
    askToDiscardChanges(() => router.push(href));
  });

  const loadData = async () => {
    setIsLoading(true);
    setLoadError(null);
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

      // Load clients for default client dropdown
      try {
        const clientsData = await API.getClients();
        setClients(clientsData);
      } catch {
        console.warn('Failed to load clients');
      }
    } catch (e: unknown) {
      const error = e as { message?: string };
      const message = error.message || 'Failed to load data';
      setLoadError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const generateInternalName = (displayName: string) => {
    return displayName
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '_')
      .replace(/[^A-Z0-9_]/g, ''); // Ensure only safe chars
  };

  const resetParameterDrafts = () => {
    setNewParam(emptyParameterForm());
    setEditingParamId(null);
    setEditParamData(emptyParameterForm());
    setParameterEditBaseline(emptyParameterForm());
    setIsAddingParam(false);
  };

  const selectTemplate = (template: Template) => {
    const nextFormData = templateToFormData(template);
    setSelectedTemplate(template);
    setIsCreating(false);
    setIsEditing(false);
    setFormData(nextFormData);
    setFormBaseline(nextFormData);
    setError(null);
    resetParameterDrafts();
    loadParameters(template.id);
  };

  const handleSelectTemplate = (template: Template) => {
    runWithDiscardCheck(() => selectTemplate(template));
  };

  const startCreate = (type: 'run' | 'message') => {
    const nextFormData = emptyTemplateForm(type);
    setSelectedTemplate(null);
    setIsCreating(true);
    setIsEditing(false);
    setFormData(nextFormData);
    setFormBaseline(nextFormData);
    setParameters([]);
    resetParameterDrafts();
    setError(null);
  };

  const handleStartCreate = (type: 'run' | 'message' = 'run') => {
    runWithDiscardCheck(() => startCreate(type));
  };

  const handleStartEdit = () => {
    if (!selectedTemplate) return;
    const nextFormData = templateToFormData(selectedTemplate);
    setIsEditing(true);
    setFormData(nextFormData);
    setFormBaseline(nextFormData);
    resetParameterDrafts();
  };

  const cancelForm = () => {
    const nextFormData = selectedTemplate
      ? templateToFormData(selectedTemplate)
      : emptyTemplateForm();
    setIsCreating(false);
    setIsEditing(false);
    setFormData(nextFormData);
    setFormBaseline(nextFormData);
    setError(null);
    resetParameterDrafts();
  };

  const handleCancel = () => {
    runWithDiscardCheck(cancelForm);
  };

  const loadParameters = async (templateId: number) => {
    setIsLoadingParameters(true);
    setParameterError(null);
    try {
      const params = await API.getTemplateParameters(templateId);
      setParameters(params);
    } catch (e) {
      console.error('Failed to load parameters:', e);
      setParameterError('Failed to load parameters. Please try again.');
      setParameters([]);
    } finally {
      setIsLoadingParameters(false);
    }
  };

  const handleAddParameter = async () => {
    if (!selectedTemplate || !newParam.name || !newParam.displayName) return;

    setParameterAction('add');
    try {
      await API.createTemplateParameter(selectedTemplate.id, newParam);
      await loadParameters(selectedTemplate.id);
      setNewParam(emptyParameterForm());
      setIsAddingParam(false);
    } catch (e: unknown) {
      const error = e as {
        response?: { data?: { error?: string } };
        message?: string;
      };
      setError(
        error.response?.data?.error ||
          error.message ||
          'Failed to add parameter'
      );
    } finally {
      setParameterAction(null);
    }
  };

  const cancelAddParam = () => {
    setIsAddingParam(false);
    setNewParam(emptyParameterForm());
  };

  const handleCancelAddParam = () => {
    const hasChanges =
      isAddingParam &&
      JSON.stringify(newParam) !== JSON.stringify(emptyParameterForm());
    if (hasChanges) {
      askToDiscardChanges(cancelAddParam);
    } else {
      cancelAddParam();
    }
  };

  const deleteParameter = async (paramId: number) => {
    setParameterAction(paramId);
    try {
      await API.deleteTemplateParameter(paramId);
      if (selectedTemplate) {
        await loadParameters(selectedTemplate.id);
      }
    } catch (e: unknown) {
      const error = e as {
        response?: { data?: { error?: string } };
        message?: string;
      };
      setError(
        error.response?.data?.error ||
          error.message ||
          'Failed to delete parameter'
      );
    } finally {
      setParameterAction(null);
    }
  };

  const handleDeleteParameter = (paramId: number) => {
    const parameter = parameters.find((item) => item.id === paramId);
    setConfirmation({
      title: 'Delete parameter?',
      message: parameter
        ? `Are you sure you want to delete the parameter "${parameter.displayName}"?`
        : 'Are you sure you want to delete this parameter?',
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => {
        void deleteParameter(paramId);
      },
    });
  };

  const handleStartEditParam = (param: TemplateParameter) => {
    const nextParamData = {
      name: param.name,
      displayName: param.displayName,
      type: param.type,
      defaultValue: param.defaultValue || '',
      required: param.required,
    };
    setEditingParamId(param.id);
    setEditParamData(nextParamData);
    setParameterEditBaseline(nextParamData);
  };

  const cancelEditParam = () => {
    setEditingParamId(null);
    setEditParamData(emptyParameterForm());
    setParameterEditBaseline(emptyParameterForm());
  };

  const handleCancelEditParam = () => {
    const hasChanges =
      editingParamId !== null &&
      JSON.stringify(editParamData) !== JSON.stringify(parameterEditBaseline);
    if (hasChanges) {
      askToDiscardChanges(cancelEditParam);
    } else {
      cancelEditParam();
    }
  };

  const handleUpdateParameter = async () => {
    if (!editingParamId || !editParamData.name || !editParamData.displayName)
      return;
    setParameterAction('update');
    try {
      await API.updateTemplateParameter(editingParamId, editParamData);
      if (selectedTemplate) {
        await loadParameters(selectedTemplate.id);
      }
      cancelEditParam();
    } catch (e: unknown) {
      const error = e as {
        response?: { data?: { error?: string } };
        message?: string;
      };
      setError(
        error.response?.data?.error ||
          error.message ||
          'Failed to update parameter'
      );
    } finally {
      setParameterAction(null);
    }
  };

  const handleSave = async () => {
    setError(null);
    setIsSaving(true);
    try {
      // Validate JSON for message templates
      /*
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
      */

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
          defaultClientId:
            formData.type === 'message'
              ? formData.defaultClientId || null
              : null,
          restartOnCrash:
            formData.type === 'run' ? formData.restartOnCrash : true,
        });
        const nextFormData = templateToFormData(newTemplate);
        setFormData(nextFormData);
        setFormBaseline(nextFormData);
        setParameters([]);
        resetParameterDrafts();
        await loadData();
        setSelectedTemplate(newTemplate);
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
          defaultClientId: formData.defaultClientId || null,
          restartOnCrash:
            formData.type === 'run' ? formData.restartOnCrash : true,
        });
        const nextFormData = templateToFormData(updated);
        setFormData(nextFormData);
        setFormBaseline(nextFormData);
        resetParameterDrafts();
        await loadData();
        setSelectedTemplate(updated);
        setIsEditing(false);
      }
    } catch (e: unknown) {
      const error = e as {
        response?: { data?: { error?: string } };
        message?: string;
      };
      setError(
        error.response?.data?.error ||
          error.message ||
          'Failed to save template'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const deleteTemplate = async () => {
    if (!selectedTemplate) return;

    setIsDeleting(true);
    try {
      await API.deleteTemplate(selectedTemplate.id);
      await loadData();
      const nextFormData = emptyTemplateForm();
      setSelectedTemplate(null);
      setIsCreating(false);
      setIsEditing(false);
      setFormData(nextFormData);
      setFormBaseline(nextFormData);
      setParameters([]);
      resetParameterDrafts();
    } catch (e: unknown) {
      const error = e as {
        response?: { data?: { error?: string } };
        message?: string;
      };
      setError(
        error.response?.data?.error ||
          error.message ||
          'Failed to delete template'
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDelete = () => {
    if (!selectedTemplate) return;
    setConfirmation({
      title: 'Delete template?',
      message: `Are you sure you want to delete template "${selectedTemplate.displayName}"?`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => {
        void deleteTemplate();
      },
    });
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

    // Type for JSON Schema definition
    interface SchemaDefinition {
      properties?: Record<string, { type?: string }>;
    }

    const mainDef = schema.$defs[messageType] as SchemaDefinition | undefined;
    if (!mainDef?.properties) return '{}';

    const template: Record<string, string | boolean | number> = {};
    for (const [key, prop] of Object.entries(mainDef.properties)) {
      // Skip complex/nested objects for simplicity
      if (prop.type === 'string') template[key] = `{${key.toUpperCase()}}`;
      else if (prop.type === 'boolean') template[key] = false;
      else if (prop.type === 'integer') template[key] = 0;
    }
    return JSON.stringify(template, null, 2);
  };

  return (
    <div className="container-fluid h-100 p-4 overflow-hidden d-flex flex-column">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="text-light fw-bold mb-0">
          <i className="fa-solid fa-file-code me-3"></i>Configuration Templates
        </h2>
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
          {loadError && !isLoading ? (
            <AsyncError
              message={loadError}
              onRetry={loadData}
              retryLabel="Retry loading templates"
              className="mb-3"
            />
          ) : null}
          <TemplateList
            templates={templates}
            selectedTemplateId={selectedTemplate?.id || null}
            typeFilter={typeFilter}
            setTypeFilter={setTypeFilter}
            onSelectTemplate={handleSelectTemplate}
            isLoading={isLoading}
          />
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
                        disabled={isDeleting || isSaving}
                      >
                        {isDeleting ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
                            Deleting...
                          </>
                        ) : (
                          <><i className="fa-solid fa-trash me-2"></i>Delete</>
                        )}
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
                        disabled={isSaving}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn btn-success"
                        onClick={handleSave}
                        disabled={isSaving}
                      >
                        {isSaving ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
                            Saving...
                          </>
                        ) : (
                          <><i className="fa-solid fa-save me-2"></i>Save</>
                        )}
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
                    readOnly
                    placeholder="Auto-generated"
                  />
                  {isCreating && (
                    <div className="form-text">
                      Unique identifier (auto-generated from Display Name).
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
                      setFormData((prev) => ({
                        ...prev,
                        displayName: e.target.value,
                        name: isCreating
                          ? generateInternalName(e.target.value)
                          : prev.name,
                      }))
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
                <RunTypeAssociation
                  runTypes={runTypes}
                  selectedRunTypeIds={formData.runTypeIds}
                  templateType={formData.type}
                  isDisabled={!isCreating && !isEditing}
                  onToggleRunType={toggleRunType}
                />

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
                      {isLoadingParameters ? (
                        <LoadingSpinner label="Loading parameters..." className="p-3" />
                      ) : parameterError ? (
                        <AsyncError
                          message={parameterError}
                          onRetry={() => selectedTemplate && loadParameters(selectedTemplate.id)}
                          retryLabel="Retry loading parameters"
                          className="m-2"
                        />
                      ) : parameters.map((p) => (
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
                                  readOnly
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
                                      name: generateInternalName(
                                        e.target.value
                                      ),
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
                                    disabled={parameterAction !== null}
                                  >
                                    {parameterAction === 'update' ? (
                                      <span className="spinner-border spinner-border-sm" aria-label="Updating parameter"></span>
                                    ) : (
                                      <i className="fa-solid fa-check"></i>
                                    )}
                                  </button>
                                  <button
                                    className="btn btn-sm btn-secondary"
                                    onClick={handleCancelEditParam}
                                    disabled={parameterAction !== null}
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
                                    disabled={parameterAction !== null}
                                  >
                                    <i className="fa-solid fa-pen"></i>
                                  </button>
                                  <button
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() => handleDeleteParameter(p.id)}
                                    title="Delete Parameter"
                                    disabled={parameterAction !== null}
                                  >
                                    {parameterAction === p.id ? (
                                      <span className="spinner-border spinner-border-sm" aria-label="Deleting parameter"></span>
                                    ) : (
                                      <i className="fa-solid fa-trash"></i>
                                    )}
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                      {!isLoadingParameters && !parameterError && parameters.length === 0 && (
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
                              readOnly
                              placeholder="Auto-generated"
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
                                  name: generateInternalName(e.target.value),
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
                              onClick={handleCancelAddParam}
                              disabled={parameterAction !== null}
                            >
                              Cancel
                            </button>
                            <button
                              className="btn btn-sm btn-success"
                              onClick={handleAddParameter}
                              disabled={parameterAction !== null}
                            >
                              {parameterAction === 'add' ? (
                                <>
                                  <span className="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
                                  Adding...
                                </>
                              ) : (
                                'Add Parameter'
                              )}
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
                        Default Client
                      </label>
                      <select
                        className="form-select bg-dark text-light border-secondary"
                        value={formData.defaultClientId}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            defaultClientId: e.target.value,
                          })
                        }
                        disabled={!isCreating && !isEditing}
                      >
                        <option value="">
                          -- No Default (User Selects) --
                        </option>
                        {clients.map((client) => (
                          <option key={client.id} value={client.id}>
                            {client.id}
                          </option>
                        ))}
                      </select>
                      <div className="form-text">
                        {formData.defaultClientId
                          ? `Client "${formData.defaultClientId}" will be pre-selected when using this template.`
                          : 'User must manually select the target client when sending.'}
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
                  <>
                    <div className="mb-3">
                      <div className="form-check form-switch">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="restartOnCrash"
                          checked={formData.restartOnCrash}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              restartOnCrash: e.target.checked,
                            })
                          }
                          disabled={!isCreating && !isEditing}
                        />
                        <label
                          className="form-check-label"
                          htmlFor="restartOnCrash"
                        >
                          Restart on Crash
                        </label>
                      </div>
                      <div className="form-text">
                        If enabled, the DAQ job will automatically restart if it
                        crashes during execution.
                      </div>
                    </div>

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
                  </>
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

      {confirmation && (
        <ConfirmModal
          title={confirmation.title}
          message={confirmation.message}
          confirmLabel={confirmation.confirmLabel}
          danger={confirmation.danger}
          onCancel={() => setConfirmation(null)}
          onConfirm={() => {
            const action = confirmation.onConfirm;
            setConfirmation(null);
            action();
          }}
        />
      )}
    </div>
  );
}
