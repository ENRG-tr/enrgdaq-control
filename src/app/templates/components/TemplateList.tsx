'use client';

import React from 'react';
import type { Template } from '@/lib/api-client';
import LoadingSpinner from '@/components/LoadingSpinner';

interface TemplateListProps {
  templates: Template[];
  selectedTemplateId: number | null;
  typeFilter: 'all' | 'run' | 'message';
  setTypeFilter: (filter: 'all' | 'run' | 'message') => void;
  onSelectTemplate: (template: Template) => void;
  isLoading?: boolean;
}

type TemplateSortOrder = 'name-asc' | 'name-desc' | 'type';

export function TemplateList({
  templates,
  selectedTemplateId,
  typeFilter,
  setTypeFilter,
  onSelectTemplate,
  isLoading = false,
}: TemplateListProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [sortOrder, setSortOrder] =
    React.useState<TemplateSortOrder>('name-asc');

  const filteredTemplates = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const matchingTemplates = templates.filter((template) => {
      if (typeFilter !== 'all' && template.type !== typeFilter) return false;
      if (!query) return true;

      const searchableText = [
        template.displayName,
        template.name,
        template.type,
        template.messageType,
        template.targetDaqJobType,
      ]
        .filter((value) => value !== null && value !== undefined)
        .join(' ')
        .toLowerCase();
      return searchableText.includes(query);
    });

    return matchingTemplates.sort((first, second) => {
      if (sortOrder === 'type') {
        return (
          first.type.localeCompare(second.type) ||
          first.displayName.localeCompare(second.displayName)
        );
      }

      const nameComparison = first.displayName.localeCompare(
        second.displayName,
        undefined,
        { sensitivity: 'base' },
      );
      return sortOrder === 'name-desc' ? -nameComparison : nameComparison;
    });
  }, [templates, typeFilter, searchQuery, sortOrder]);

  const filtersActive = searchQuery.trim().length > 0 || typeFilter !== 'all';

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
      <div className="p-2 border-bottom border-secondary">
        <div className="row g-2 align-items-end">
          <div className="col-12">
            <label
              htmlFor="template-search"
              className="form-label text-muted small mb-1"
            >
              Search templates
            </label>
            <div className="input-group input-group-sm">
              <span className="input-group-text bg-dark text-muted border-secondary">
                <i className="fa-solid fa-magnifying-glass"></i>
              </span>
              <input
                id="template-search"
                type="search"
                className="form-control bg-dark text-light border-secondary"
                placeholder="Display name, internal name, message type..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>
          <div className="col-8">
            <label
              htmlFor="template-sort-order"
              className="form-label text-muted small mb-1"
            >
              Sort by
            </label>
            <select
              id="template-sort-order"
              className="form-select form-select-sm bg-dark text-light border-secondary"
              value={sortOrder}
              onChange={(event) =>
                setSortOrder(event.target.value as TemplateSortOrder)
              }
              disabled={isLoading}
            >
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="type">Template type</option>
            </select>
          </div>
          <div className="col-4 d-flex">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary w-100"
              onClick={() => {
                setSearchQuery('');
                setSortOrder('name-asc');
                setTypeFilter('all');
              }}
              disabled={
                isLoading || (!filtersActive && sortOrder === 'name-asc')
              }
              title="Clear template filters"
            >
              <i className="fa-solid fa-xmark me-1"></i>Clear
            </button>
          </div>
        </div>
        <div className="text-muted small mt-2" aria-live="polite">
          {isLoading ? (
            'Loading templates...'
          ) : (
            <>
              Showing {filteredTemplates.length} of {templates.length} templates
            </>
          )}
        </div>
      </div>
      <div className="list-group list-group-flush overflow-auto h-100">
        {isLoading ? (
          <LoadingSpinner label="Loading templates..." className="p-4" />
        ) : (
          filteredTemplates.map((t) => (
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
          ))
        )}
        {!isLoading && filteredTemplates.length === 0 && (
          <div className="p-3 text-center text-muted">No templates found.</div>
        )}
      </div>
    </div>
  );
}
