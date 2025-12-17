'use client';

import React from 'react';
import type { RunType } from '@/lib/api-client';

interface RunTypeAssociationProps {
  runTypes: RunType[];
  selectedRunTypeIds: number[];
  templateType: 'run' | 'message';
  isDisabled: boolean;
  onToggleRunType: (id: number) => void;
}

export function RunTypeAssociation({
  runTypes,
  selectedRunTypeIds,
  templateType,
  isDisabled,
  onToggleRunType,
}: RunTypeAssociationProps) {
  return (
    <div className="mb-3">
      <label className="form-label text-muted">Associated Run Types</label>
      <div className="form-text mb-2">
        {templateType === 'run'
          ? 'This template will be available when starting runs of the selected types.'
          : 'Message templates linked to run types can be sent during those runs.'}
      </div>
      <div className="card bg-dark border-secondary p-2">
        {runTypes.length > 0 ? (
          runTypes.map((rt) => (
            <div key={rt.id} className="form-check form-switch mb-2">
              <input
                className="form-check-input"
                type="checkbox"
                id={`rt-${rt.id}`}
                checked={selectedRunTypeIds.includes(rt.id)}
                onChange={() => onToggleRunType(rt.id)}
                disabled={isDisabled}
              />
              <label className="form-check-label" htmlFor={`rt-${rt.id}`}>
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
          <small className="text-muted">No run types defined in system.</small>
        )}
      </div>
    </div>
  );
}
