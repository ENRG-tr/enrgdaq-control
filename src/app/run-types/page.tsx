'use client';

import React, { useState, useEffect } from 'react';
import { API, RunType } from '@/lib/api-client';

export default function RunTypesPage() {
  const [runTypes, setRunTypes] = useState<RunType[]>([]);
  const [selectedRunType, setSelectedRunType] = useState<RunType | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Form state
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const data = await API.getRunTypes();
      setRunTypes(data);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleSelectRunType = (rt: RunType) => {
    if (isCreating || isEditing) {
        if (!confirm("Discard changes?")) return;
    }
    setSelectedRunType(rt);
    setIsCreating(false);
    setIsEditing(false);
    setFormData({
      name: rt.name,
      description: rt.description || '',
    });
    setError(null);
  };

  const handleStartCreate = () => {
    setSelectedRunType(null);
    setIsCreating(true);
    setIsEditing(false);
    setFormData({ name: '', description: '' });
    setError(null);
  };

  const handleStartEdit = () => {
    if (!selectedRunType) return;
    setIsEditing(true);
    setFormData({
      name: selectedRunType.name,
      description: selectedRunType.description || '',
    });
  };

  const handleCancel = () => {
    setIsCreating(false);
    setIsEditing(false);
    if (selectedRunType) {
        setFormData({
            name: selectedRunType.name,
            description: selectedRunType.description || '',
        });
    } else {
        setFormData({ name: '', description: '' });
    }
    setError(null);
  };

  const handleSave = async () => {
    setError(null);
    try {
      if (isCreating) {
        const newRunType = await API.createRunType(formData);
        await loadData();
        setSelectedRunType(newRunType);
        setIsCreating(false);
      } else if (isEditing && selectedRunType) {
        const updated = await API.updateRunType(selectedRunType.id, {
            name: formData.name,
            description: formData.description
        });
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
    if (!confirm(`Are you sure you want to delete run type "${selectedRunType.name}"?`)) return;

    try {
      await API.deleteRunType(selectedRunType.id);
      await loadData();
      setSelectedRunType(null);
      setIsEditing(false);
    } catch (e: any) {
      setError(e.response?.data?.error || e.message);
    }
  };

  return (
    <div className="container-fluid h-100 p-4 overflow-hidden d-flex flex-column">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="text-light fw-bold mb-0">Run Types</h2>
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
              {runTypes.map(rt => (
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
                  <small className="text-muted text-truncate d-block">{rt.description}</small>
                </button>
              ))}
              {runTypes.length === 0 && (
                <div className="p-3 text-center text-muted">No run types found.</div>
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

            {(selectedRunType || isCreating) ? (
                <div className="card h-100 border-secondary bg-dark shadow-sm">
                    <div className="card-header border-secondary d-flex justify-content-between align-items-center py-3">
                        <span className="fw-bold fs-5">
                            {isCreating ? 'Create New Run Type' : (isEditing ? 'Editing Run Type' : 'Run Type Details')}
                        </span>
                        <div>
                            {!isCreating && !isEditing && (
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
                            <label className="form-label text-muted">Name</label>
                            <input 
                                type="text" 
                                className="form-control bg-dark text-light border-secondary"
                                value={formData.name}
                                onChange={(e) => setFormData({...formData, name: e.target.value})}
                                disabled={!isCreating && !isEditing}
                                placeholder="e.g. Physics"
                            />
                            {(isCreating || isEditing) && <div className="form-text">Unique name for the run type.</div>}
                        </div>

                        <div className="mb-3">
                            <label className="form-label text-muted">Description</label>
                            <textarea 
                                className="form-control bg-dark text-light border-secondary"
                                rows={5}
                                value={formData.description}
                                onChange={(e) => setFormData({...formData, description: e.target.value})}
                                disabled={!isCreating && !isEditing}
                                placeholder="Description of this run type..."
                            />
                        </div>
                    </div>
                </div>
            ) : (
                <div className="h-100 d-flex flex-column justify-content-center align-items-center text-muted opacity-50 border border-secondary rounded border-dashed">
                    <i className="fa-solid fa-tag fa-4x mb-3"></i>
                    <h4>Select a run type to view details</h4>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
