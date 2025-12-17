'use client';

import React from 'react';
import type { Template } from '@/lib/api-client';

interface TemplateListProps {
  templates: Template[];
  selectedTemplateId: number | null;
  typeFilter: 'all' | 'run' | 'message';
  setTypeFilter: (filter: 'all' | 'run' | 'message') => void;
  onSelectTemplate: (template: Template) => void;
}

export function TemplateList({
  templates,
  selectedTemplateId,
  typeFilter,
  setTypeFilter,
  onSelectTemplate,
}: TemplateListProps) {
  const filteredTemplates = templates.filter((t) => {
    if (typeFilter === 'all') return true;
    return t.type === typeFilter;
  });

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'message':
        return <span className="badge bg-info text-dark">Message</span>;
      case 'run':
      default:
        return <span className="badge bg-success">Run</span>;
    }
  };

  return (
    <div className="card h-100 border-secondary bg-dark">
      <div className="card-header border-secondary fw-bold d-flex justify-content-between align-items-center">
        <span>Available Templates</span>
        <select
          className="form-select form-select-sm bg-dark text-light border-secondary"
          style={{ width: 'auto' }}
          value={typeFilter}
          onChange={(e) =>
            setTypeFilter(e.target.value as 'all' | 'run' | 'message')
          }
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
            onClick={() => onSelectTemplate(t)}
            className={`list-group-item list-group-item-action bg-dark text-light border-secondary ${
              selectedTemplateId === t.id ? 'active' : ''
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
          <div className="p-3 text-center text-muted">No templates found.</div>
        )}
      </div>
    </div>
  );
}
