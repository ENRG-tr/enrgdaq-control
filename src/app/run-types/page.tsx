'use client';

import React, { useState, useEffect } from 'react';
import { API, RunType, AggregatedParameter, Template } from '@/lib/api-client';

export default function RunTypesPage() {
  const [runTypes, setRunTypes] = useState<RunType[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedRunType, setSelectedRunType] = useState<RunType | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Form state
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    requiredTags: string[];
    templateIds: number[];
  }>({ name: '', description: '', requiredTags: [], templateIds: [] });
  const [error, setError] = useState<string | null>(null);

  // Aggregated parameters state (from associated templates)
  const [aggregatedParams, setAggregatedParams] = useState<
    AggregatedParameter[]
  >([]);

  useEffect(() => {
    loadData();
  }, []);

  // Load aggregated parameters when a run type is selected
  useEffect(() => {
    if (selectedRunType) {
      loadAggregatedParameters(selectedRunType.id);
    } else {
      setAggregatedParams([]);
    }
  }, [selectedRunType]);

  const loadData = async () => {
    try {
      const [rtData, tData] = await Promise.all([
        API.getRunTypes(),
        API.getTemplates(),
      ]);
      setRunTypes(rtData);
      // Include both run and message templates
      setTemplates(tData);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const loadAggregatedParameters = async (runTypeId: number) => {
    try {
      const params = await API.getAggregatedParametersForRunType(runTypeId);
      setAggregatedParams(params);
    } catch (e) {
      console.error('Failed to load aggregated parameters:', e);
      setAggregatedParams([]);
    }
  };

  const handleSelectRunType = (rt: RunType) => {
    if (isCreating || isEditing) {
      if (!confirm('Discard changes?')) return;
    }
    setSelectedRunType(rt);
    setIsCreating(false);
    setIsEditing(false);
    const associatedIds = templates
      .filter((t) => t.runTypeIds?.includes(rt.id))
      .map((t) => t.id);
    setFormData({
      name: rt.name,
      description: rt.description || '',
      requiredTags: rt.requiredTags || [],
      templateIds: associatedIds,
    });
    setError(null);
  };

  const handleStartCreate = () => {
    setSelectedRunType(null);
    setIsCreating(true);
    setIsEditing(false);
    setFormData({
      name: '',
      description: '',
      requiredTags: [],
      templateIds: [],
    });
    setError(null);
    setAggregatedParams([]);
  };

  const handleStartEdit = () => {
    if (!selectedRunType) return;
    setIsEditing(true);
    setFormData({
      name: selectedRunType.name,
      description: selectedRunType.description || '',
      requiredTags: selectedRunType.requiredTags || [],
      templateIds: formData.templateIds,
    });
  };

  const handleCancel = () => {
    setIsCreating(false);
    setIsEditing(false);
    if (selectedRunType) {
      const associatedIds = templates
        .filter((t) => t.runTypeIds?.includes(selectedRunType.id))
        .map((t) => t.id);
      setFormData({
        name: selectedRunType.name,
        description: selectedRunType.description || '',
        requiredTags: selectedRunType.requiredTags || [],
        templateIds: associatedIds,
      });
    } else {
      setFormData({
        name: '',
        description: '',
        requiredTags: [],
        templateIds: [],
      });
    }
    setError(null);
  };

  const handleSave = async () => {
    setError(null);
    try {
      if (isCreating) {
        const newRunType = await API.createRunType({
          name: formData.name,
          description: formData.description,
          requiredTags: formData.requiredTags,
        });

        if (formData.templateIds.length > 0) {
          await API.updateRunTypeTemplates(newRunType.id, formData.templateIds);
        }

        await loadData();
        setSelectedRunType(newRunType);
        setIsCreating(false);
      } else if (isEditing && selectedRunType) {
        const updated = await API.updateRunType(selectedRunType.id, {
          name: formData.name,
          description: formData.description,
          requiredTags: formData.requiredTags,
        });

        // Update templates
        await API.updateRunTypeTemplates(
          selectedRunType.id,
          formData.templateIds
        );

        await loadData();
        setSelectedRunType(updated);
        setIsEditing(false);
      }
    } catch (e: any) {
      setError(e.response?.data?.error || e.message);
    }
  };

  const handleDelete = async () => {
    if (!selectedRunType) return;
    if (
      !confirm(
        `Are you sure you want to delete run type "${selectedRunType.name}"?`
      )
    )
      return;

    try {
      await API.deleteRunType(selectedRunType.id);
      await loadData();
      setSelectedRunType(null);
      setIsEditing(false);
    } catch (e: any) {
      setError(e.response?.data?.error || e.message);
    }
  };

  /**
   * Set or remove a default value for a parameter on this run type
   */
  const handleSetParameterDefault = async (
    parameterId: number,
    defaultValue: string | null
  ) => {
    if (!selectedRunType) return;
    try {
      await API.setRunTypeParameterDefault(
        selectedRunType.id,
        parameterId,
        defaultValue
      );
      await loadAggregatedParameters(selectedRunType.id);
    } catch (e: any) {
      setError(e.response?.data?.error || e.message);
    }
  };

  return (
    <div className="container-fluid h-100 p-4 overflow-hidden d-flex flex-column">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="text-light fw-bold mb-0">
          <i className="fa-solid fa-tags me-3"></i>Run Types
        </h2>
        <button className="btn btn-primary" onClick={handleStartCreate}>
          <i className="fa-solid fa-plus me-2"></i>New Run Type
        </button>
      </div>

      <div className="row flex-grow-1 overflow-hidden g-4">
        {/* List Column */}
        <div className="col-md-4 h-100 d-flex flex-column">
          <div className="card h-100 border-secondary bg-dark">
            <div className="card-header border-secondary fw-bold">
              Available Run Types
            </div>
            <div className="list-group list-group-flush overflow-auto h-100">
              {runTypes.map((rt) => (
                <button
                  key={rt.id}
                  onClick={() => handleSelectRunType(rt)}
                  className={`list-group-item list-group-item-action bg-dark text-light border-secondary ${
                    selectedRunType?.id === rt.id ? 'active' : ''
                  }`}
                >
                  <div className="d-flex w-100 justify-content-between">
                    <h6 className="mb-1 fw-bold">{rt.name}</h6>
                  </div>
                  <small className="text-muted text-truncate d-block">
                    {rt.description}
                  </small>
                </button>
              ))}
              {runTypes.length === 0 && (
                <div className="p-3 text-center text-muted">
                  No run types found.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Detail/Edit Column */}
        <div className="col-md-8 h-100 d-flex flex-column overflow-auto">
          {error && (
            <div className="alert alert-danger mb-3">
              <i className="fa-solid fa-triangle-exclamation me-2"></i>
              {error}
            </div>
          )}

          {selectedRunType || isCreating ? (
            <div className="card border-secondary bg-dark shadow-sm">
              <div className="card-header border-secondary d-flex justify-content-between align-items-center py-3">
                <span className="fw-bold fs-5">
                  {isCreating
                    ? 'Create New Run Type'
                    : isEditing
                    ? 'Editing Run Type'
                    : 'Run Type Details'}
                </span>
                <div>
                  {!isCreating && !isEditing && (
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

              <div className="card-body">
                <div className="mb-3">
                  <label className="form-label text-muted">Name</label>
                  <input
                    type="text"
                    className="form-control bg-dark text-light border-secondary"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    disabled={!isCreating && !isEditing}
                    placeholder="e.g. Physics"
                  />
                  {(isCreating || isEditing) && (
                    <div className="form-text">
                      Unique name for the run type.
                    </div>
                  )}
                </div>

                <div className="mb-3">
                  <label className="form-label text-muted">Description</label>
                  <textarea
                    className="form-control bg-dark text-light border-secondary"
                    rows={3}
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    disabled={!isCreating && !isEditing}
                    placeholder="Description of this run type..."
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label text-muted">
                    Required Client Tags
                  </label>
                  {(isCreating || isEditing) && (
                    <div className="input-group mb-2">
                      <span className="input-group-text bg-dark border-secondary text-light">
                        <i className="fa-solid fa-tags"></i>
                      </span>
                      <input
                        type="text"
                        className="form-control bg-dark text-light border-secondary"
                        placeholder="Type a tag and press Enter to add..."
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const val = e.currentTarget.value.trim();
                            if (val && !formData.requiredTags.includes(val)) {
                              setFormData({
                                ...formData,
                                requiredTags: [...formData.requiredTags, val],
                              });
                              e.currentTarget.value = '';
                            }
                          }
                        }}
                      />
                    </div>
                  )}
                  <div
                    className="d-flex flex-wrap gap-2 p-2 border border-secondary rounded bg-black bg-opacity-25"
                    style={{ minHeight: '45px' }}
                  >
                    {formData.requiredTags.map((tag) => (
                      <span
                        key={tag}
                        className="badge bg-info text-dark d-flex align-items-center"
                      >
                        {tag}
                        {(isCreating || isEditing) && (
                          <i
                            className="fa-solid fa-xmark ms-2"
                            style={{ cursor: 'pointer' }}
                            onClick={() =>
                              setFormData({
                                ...formData,
                                requiredTags: formData.requiredTags.filter(
                                  (t) => t !== tag
                                ),
                              })
                            }
                          ></i>
                        )}
                      </span>
                    ))}
                    {formData.requiredTags.length === 0 && (
                      <span className="text-muted small fst-italic align-self-center">
                        No tags required.
                      </span>
                    )}
                  </div>
                  {(isCreating || isEditing) && (
                    <div className="form-text">
                      Clients must have all these tags to run this type.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-100 d-flex flex-column justify-content-center align-items-center text-muted opacity-50 border border-secondary rounded border-dashed">
              <i className="fa-solid fa-tag fa-4x mb-3"></i>
              <h4>Select a run type to view details</h4>
            </div>
          )}

          {/* Associated Templates Section */}
          {(selectedRunType || isCreating) && (
            <div className="card border-secondary bg-dark shadow-sm mt-4">
              <div className="card-header border-secondary d-flex justify-content-between align-items-center py-3">
                <span className="fw-bold">
                  <i className="fa-solid fa-file-code me-2"></i>Associated
                  Templates
                </span>
                <span className="badge bg-secondary">
                  {formData.templateIds.length} Selected
                </span>
              </div>
              <div className="card-body">
                <p className="text-muted small mb-3">
                  Select which templates should be associated with this run
                  type. Run templates define what DAQ jobs to start, while
                  message templates define messages that can be sent during the
                  run.
                </p>
                {templates.length > 0 ? (
                  <div className="row g-2">
                    {templates.map((t) => {
                      const isAssociated = formData.templateIds.includes(t.id);
                      const isMessage = t.type === 'message';
                      const isInteractive = isCreating || isEditing;
                      return (
                        <div key={t.id} className="col-md-6 col-lg-4">
                          <div
                            className={`p-2 border rounded d-flex align-items-center ${
                              isInteractive ? 'cursor-pointer' : ''
                            } ${
                              isAssociated
                                ? isMessage
                                  ? 'border-info bg-info bg-opacity-10'
                                  : 'border-success bg-success bg-opacity-10'
                                : 'border-secondary'
                            }`}
                            style={{
                              cursor: isInteractive ? 'pointer' : 'default',
                              opacity: isInteractive ? 1 : 0.8,
                            }}
                            onClick={() => {
                              if (!isInteractive) return;

                              let newIds: number[];
                              if (isAssociated) {
                                newIds = formData.templateIds.filter(
                                  (id) => id !== t.id
                                );
                              } else {
                                newIds = [...formData.templateIds, t.id];
                              }
                              setFormData({ ...formData, templateIds: newIds });
                            }}
                          >
                            <input
                              type="checkbox"
                              className="form-check-input me-2"
                              checked={isAssociated}
                              onChange={() => {}}
                              disabled={!isInteractive}
                              style={{ pointerEvents: 'none' }}
                            />
                            <div className="flex-grow-1">
                              <div className="d-flex align-items-center gap-2">
                                <span
                                  className={
                                    isAssociated
                                      ? isMessage
                                        ? 'text-info'
                                        : 'text-success'
                                      : 'text-light'
                                  }
                                >
                                  {t.displayName}
                                </span>
                                <span
                                  className={`badge ${
                                    isMessage
                                      ? 'bg-info text-dark'
                                      : 'bg-success'
                                  }`}
                                  style={{ fontSize: '0.65rem' }}
                                >
                                  {isMessage ? 'MSG' : 'RUN'}
                                </span>
                              </div>
                              <small className="text-muted">{t.name}</small>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <span className="text-muted fst-italic">
                    No templates available. Create templates in the Templates
                    page first.
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Parameters Section - Only show when viewing an existing RunType */}
          {selectedRunType && !isCreating && (
            <div className="card border-secondary bg-dark shadow-sm mt-4">
              <div className="card-header border-secondary py-3">
                <span className="fw-bold">
                  <i className="fa-solid fa-sliders me-2"></i>Run Parameters
                </span>
                <span className="text-muted small ms-2">
                  (from associated templates)
                </span>
              </div>
              <div className="card-body">
                <p className="text-muted small mb-3">
                  Parameters are defined on templates. When this run type is
                  used, users will be prompted for these values. You can
                  optionally set default values for this run type.
                </p>

                {/* Aggregated parameter list */}
                {aggregatedParams.length > 0 ? (
                  <table className="table table-dark table-sm table-hover mb-0">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Display Name</th>
                        <th>Type</th>
                        <th>Template Default</th>
                        <th>Run Type Default</th>
                        <th>Required</th>
                        <th>Placeholder</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aggregatedParams.map((param) => (
                        <tr key={param.id}>
                          <td>
                            <code>{param.name}</code>
                          </td>
                          <td>{param.displayName}</td>
                          <td>
                            <span className="badge bg-secondary">
                              {param.type}
                            </span>
                          </td>
                          <td>
                            {param.defaultValue || (
                              <span className="text-muted">-</span>
                            )}
                          </td>
                          <td>
                            <input
                              type="text"
                              className="form-control form-control-sm bg-dark text-light border-secondary"
                              placeholder="Optional override"
                              value={param.runTypeDefault || ''}
                              onChange={(e) =>
                                handleSetParameterDefault(
                                  param.id,
                                  e.target.value || null
                                )
                              }
                            />
                          </td>
                          <td>
                            {param.required ? (
                              <span className="text-success">Yes</span>
                            ) : (
                              <span className="text-muted">No</span>
                            )}
                          </td>
                          <td>
                            <code>{`{${param.name.toUpperCase()}}`}</code>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-center text-muted py-3">
                    No parameters required. Add templates with parameters to
                    this run type.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
