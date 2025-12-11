'use client';

import React, { useState, useEffect } from 'react';
import { API, Template, RunType } from '@/lib/api-client';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [runTypes, setRunTypes] = useState<RunType[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false); // If true, we are editing the selected template

  // Form state
  const [formData, setFormData] = useState({ name: '', displayName: '', config: '', runTypeIds: [] as number[] });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [tData, rtData] = await Promise.all([
        API.getTemplates(),
        API.getRunTypes()
      ]);
      setTemplates(tData);
      setRunTypes(rtData);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleSelectTemplate = (t: Template) => {
    if (isCreating) {
        if (!confirm("Discard changes?")) return;
    }
    setSelectedTemplate(t);
    setIsCreating(false);
    setIsEditing(false);
    setFormData({
      name: t.name,
      displayName: t.displayName,
      config: t.config,
      runTypeIds: t.runTypeIds || []
    });
    setError(null);
  };

  const handleStartCreate = () => {
    setSelectedTemplate(null);
    setIsCreating(true);
    setIsEditing(false);
    setFormData({ name: '', displayName: '', config: '', runTypeIds: [] });
    setError(null);
  };

  const handleStartEdit = () => {
    if (!selectedTemplate) return;
    setIsEditing(true);
    setFormData({
      name: selectedTemplate.name,
      displayName: selectedTemplate.displayName,
      config: selectedTemplate.config,
      runTypeIds: selectedTemplate.runTypeIds || []
    });
  };

  const handleCancel = () => {
    setIsCreating(false);
    setIsEditing(false);
    if (selectedTemplate) {
        setFormData({
            name: selectedTemplate.name,
            displayName: selectedTemplate.displayName,
            config: selectedTemplate.config,
            runTypeIds: selectedTemplate.runTypeIds || []
        });
    } else {
        setFormData({ name: '', displayName: '', config: '', runTypeIds: [] });
    }
    setError(null);
  };

  const handleSave = async () => {
    setError(null);
    try {
      if (isCreating) {
        const newTemplate = await API.createTemplate(formData);
        await loadData(); // Reload all to get updated relations
        setSelectedTemplate(newTemplate);
        setIsCreating(false);
      } else if (isEditing && selectedTemplate) {
        const updated = await API.updateTemplate(selectedTemplate.id, {
            displayName: formData.displayName,
            config: formData.config,
            runTypeIds: formData.runTypeIds
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
    if (!confirm(`Are you sure you want to delete template "${selectedTemplate.displayName}"?`)) return;

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
          setFormData({ ...formData, runTypeIds: current.filter(rid => rid !== id) });
      } else {
          setFormData({ ...formData, runTypeIds: [...current, id] });
      }
  };

  return (
    <div className="container-fluid h-100 p-4 overflow-hidden d-flex flex-column">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="text-light fw-bold mb-0">Configuration Templates</h2>
        <button className="btn btn-primary" onClick={handleStartCreate}>
          <i className="fa-solid fa-plus me-2"></i>New Template
        </button>
      </div>

      <div className="row flex-grow-1 overflow-hidden g-4">
        {/* List Column */}
        <div className="col-md-4 h-100 d-flex flex-column">
          <div className="card h-100 border-secondary bg-dark">
            <div className="card-header border-secondary fw-bold">
              Available Templates
            </div>
            <div className="list-group list-group-flush overflow-auto h-100">
              {templates.map(t => (
                <button
                  key={t.id}
                  onClick={() => handleSelectTemplate(t)}
                  className={`list-group-item list-group-item-action bg-dark text-light border-secondary ${
                    selectedTemplate?.id === t.id ? 'active' : ''
                  }`}
                >
                  <div className="d-flex w-100 justify-content-between">
                    <h6 className="mb-1 fw-bold">{t.displayName}</h6>
                    {!t.editable && <span className="badge bg-secondary"><i className="fa-solid fa-lock"></i></span>}
                  </div>
                  <small className="text-muted">{t.name}</small>
                </button>
              ))}
              {templates.length === 0 && (
                <div className="p-3 text-center text-muted">No templates found.</div>
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

            {(selectedTemplate || isCreating) ? (
                <div className="card h-100 border-secondary bg-dark shadow-sm">
                    <div className="card-header border-secondary d-flex justify-content-between align-items-center py-3">
                        <span className="fw-bold fs-5">
                            {isCreating ? 'Create New Template' : (isEditing ? 'Editing Template' : 'Template Details')}
                        </span>
                        <div>
                            {!isCreating && !isEditing && selectedTemplate?.editable && (
                                <>
                                    <button className="btn btn-outline-danger me-2" onClick={handleDelete}>
                                        <i className="fa-solid fa-trash me-2"></i>Delete
                                    </button>
                                    <button className="btn btn-primary" onClick={handleStartEdit}>
                                        <i className="fa-solid fa-pen-to-square me-2"></i>Edit
                                    </button>
                                </>
                            )}
                            {(isCreating || isEditing) && (
                                <>
                                    <button className="btn btn-secondary me-2" onClick={handleCancel}>
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
                                onChange={(e) => setFormData({...formData, name: e.target.value})}
                                disabled={!isCreating} // Internal name usually immutable after creation or primary key-like
                                placeholder="e.g. calibration_v1"
                            />
                            {isCreating && <div className="form-text">Unique identifier for the system (snake_case recommended).</div>}
                        </div>

                        <div className="mb-3">
                            <label className="form-label text-muted">Display Name</label>
                            <input 
                                type="text" 
                                className="form-control bg-dark text-light border-secondary"
                                value={formData.displayName}
                                onChange={(e) => setFormData({...formData, displayName: e.target.value})}
                                disabled={!isCreating && !isEditing}
                                placeholder="e.g. Calibration V1"
                            />
                        </div>

                        <div className="mb-3">
                            <label className="form-label text-muted">Associated Run Types</label>
                            <div className="card bg-dark border-secondary p-2">
                                {runTypes.length > 0 ? runTypes.map(rt => (
                                    <div key={rt.id} className="form-check form-switch mb-2">
                                        <input 
                                            className="form-check-input" 
                                            type="checkbox" 
                                            id={`rt-${rt.id}`}
                                            checked={formData.runTypeIds.includes(rt.id)}
                                            onChange={() => toggleRunType(rt.id)}
                                            disabled={!isCreating && !isEditing}
                                        />
                                        <label className="form-check-label" htmlFor={`rt-${rt.id}`}>
                                            <strong>{rt.name}</strong>
                                            {rt.description && <span className="text-muted ms-2 small">({rt.description})</span>}
                                        </label>
                                    </div>
                                )) : (
                                    <small className="text-muted">No run types defined in system.</small>
                                )}
                            </div>
                        </div>

                        <div className="mb-3 flex-grow-1 d-flex flex-column h-100">
                             <label className="form-label text-muted">Configuration (TOML)</label>
                             <textarea 
                                className="form-control bg-dark text-light border-secondary font-monospace"
                                style={{ minHeight: '400px', resize: 'none' }}
                                value={formData.config}
                                onChange={(e) => setFormData({...formData, config: e.target.value})}
                                disabled={!isCreating && !isEditing}
                                spellCheck={false}
                             />
                        </div>
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
