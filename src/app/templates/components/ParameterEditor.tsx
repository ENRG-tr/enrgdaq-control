'use client';

import React from 'react';
import type { TemplateParameter } from '@/lib/api-client';

interface ParameterEditorProps {
  parameters: TemplateParameter[];
  isEditing: boolean;
  editableTemplate: boolean;
  isAddingParam: boolean;
  setIsAddingParam: (value: boolean) => void;
  newParam: {
    name: string;
    displayName: string;
    type: string;
    defaultValue: string;
    required: boolean;
  };
  setNewParam: (value: {
    name: string;
    displayName: string;
    type: string;
    defaultValue: string;
    required: boolean;
  }) => void;
  editingParamId: number | null;
  editParamData: {
    name: string;
    displayName: string;
    type: string;
    defaultValue: string;
    required: boolean;
  };
  setEditParamData: (value: {
    name: string;
    displayName: string;
    type: string;
    defaultValue: string;
    required: boolean;
  }) => void;
  onAddParameter: () => void;
  onDeleteParameter: (id: number) => void;
  onStartEditParam: (param: TemplateParameter) => void;
  onCancelEditParam: () => void;
  onUpdateParameter: () => void;
  generateInternalName: (displayName: string) => string;
}

export function ParameterEditor({
  parameters,
  isEditing,
  editableTemplate,
  isAddingParam,
  setIsAddingParam,
  newParam,
  setNewParam,
  editingParamId,
  editParamData,
  setEditParamData,
  onAddParameter,
  onDeleteParameter,
  onStartEditParam,
  onCancelEditParam,
  onUpdateParameter,
  generateInternalName,
}: ParameterEditorProps) {
  return (
    <div className="mb-4">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <label className="form-label text-muted mb-0">
          Template Parameters
        </label>
        <button
          className="btn btn-sm btn-outline-primary"
          onClick={() => setIsAddingParam(!isAddingParam)}
          disabled={!isEditing || !editableTemplate}
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
                        name: generateInternalName(e.target.value),
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
                      onClick={onUpdateParameter}
                    >
                      <i className="fa-solid fa-check"></i>
                    </button>
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={onCancelEditParam}
                    >
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <strong>{p.displayName}</strong>
                  <span className="text-muted ms-2 small">({p.name})</span>
                  <span
                    className={`badge ms-2 ${
                      p.type === 'string'
                        ? 'bg-secondary'
                        : p.type === 'number'
                        ? 'bg-info text-dark'
                        : 'bg-warning text-dark'
                    }`}
                  >
                    {p.type}
                  </span>
                  {p.required && (
                    <span className="badge bg-danger ms-1">Required</span>
                  )}
                  {p.defaultValue && (
                    <span className="text-muted ms-2 small">
                      Default: {p.defaultValue}
                    </span>
                  )}
                </div>
                {isEditing && editableTemplate && (
                  <div>
                    <button
                      className="btn btn-sm btn-outline-primary me-1"
                      onClick={() => onStartEditParam(p)}
                    >
                      <i className="fa-solid fa-pen"></i>
                    </button>
                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => onDeleteParameter(p.id)}
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
          <div className="text-muted small text-center py-2">
            No parameters defined
          </div>
        )}
      </div>

      {/* Add New Parameter Form */}
      {isAddingParam && (
        <div className="card bg-dark border-primary mb-3">
          <div className="card-header border-primary py-2">
            <strong>Add New Parameter</strong>
          </div>
          <div className="card-body p-2">
            <div className="row g-2">
              <div className="col-md-6">
                <input
                  type="text"
                  className="form-control form-control-sm bg-dark text-light border-secondary"
                  value={newParam.name}
                  readOnly
                  placeholder="Internal Name (auto)"
                />
              </div>
              <div className="col-md-6">
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
                  placeholder="Display Name"
                />
              </div>
              <div className="col-md-4">
                <select
                  className="form-select form-select-sm bg-dark text-light border-secondary"
                  value={newParam.type}
                  onChange={(e) =>
                    setNewParam({ ...newParam, type: e.target.value })
                  }
                >
                  <option value="string">String</option>
                  <option value="int">Integer</option>
                  <option value="float">Float</option>
                  <option value="bool">Boolean</option>
                </select>
              </div>
              <div className="col-md-4">
                <input
                  type="text"
                  className="form-control form-control-sm bg-dark text-light border-secondary"
                  value={newParam.defaultValue}
                  onChange={(e) =>
                    setNewParam({ ...newParam, defaultValue: e.target.value })
                  }
                  placeholder="Default Value"
                />
              </div>
              <div className="col-md-4 d-flex align-items-center justify-content-between">
                <div className="form-check mb-0">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="new-param-req"
                    checked={newParam.required}
                    onChange={(e) =>
                      setNewParam({ ...newParam, required: e.target.checked })
                    }
                  />
                  <label
                    className="form-check-label small"
                    htmlFor="new-param-req"
                  >
                    Required
                  </label>
                </div>
                <button
                  className="btn btn-sm btn-success"
                  onClick={onAddParameter}
                  disabled={!newParam.name || !newParam.displayName}
                >
                  <i className="fa-solid fa-plus me-1"></i>Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
