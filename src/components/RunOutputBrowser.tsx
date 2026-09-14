'use client';

import { useEffect, useState } from 'react';
import { API, type RunOutputEntry } from '@/lib/api-client';
import { formatDate } from '@/lib/date-utils';

interface RunOutputBrowserProps {
  runId: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function getErrorMessage(error: unknown): string {
  const responseError = (
    error as { response?: { data?: { error?: string } } }
  )?.response?.data?.error;
  return responseError || 'Failed to load run output';
}

export function RunOutputBrowser({ runId }: RunOutputBrowserProps) {
  const [currentPath, setCurrentPath] = useState('');
  const [entries, setEntries] = useState<RunOutputEntry[]>([]);
  const [isTruncated, setIsTruncated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);
    setError(null);

    API.getRunFiles(runId, currentPath)
      .then((listing) => {
        if (!isCurrent) return;
        setEntries(listing.entries);
        setIsTruncated(listing.truncated);
      })
      .catch((requestError: unknown) => {
        if (!isCurrent) return;
        setEntries([]);
        setIsTruncated(false);
        setError(getErrorMessage(requestError));
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [runId, currentPath]);

  const pathParts = currentPath ? currentPath.split('/') : [];
  const goUp = () => {
    setCurrentPath(pathParts.slice(0, -1).join('/'));
  };

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h5 className="text-light mb-0">
          <i className="fa-solid fa-folder-open me-2 text-warning"></i>
          Output Files
        </h5>
        <div className="d-flex align-items-center gap-2">
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={goUp}
            disabled={!currentPath || isLoading}
            title="Open parent folder"
          >
            <i className="fa-solid fa-arrow-up me-1"></i>Up
          </button>
          <a
            className="btn btn-sm btn-outline-info"
            href={`/enrgdaq-out/runs/${runId}/`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <i className="fa-solid fa-arrow-up-right-from-square me-1"></i>
            Open directory
          </a>
        </div>
      </div>

      <nav aria-label="Output directory" className="mb-3">
        <ol className="breadcrumb mb-0 small">
          <li className="breadcrumb-item">
            <button
              type="button"
              className="btn btn-link btn-sm p-0 text-info"
              onClick={() => setCurrentPath('')}
              disabled={!currentPath || isLoading}
            >
              <i className="fa-solid fa-house me-1"></i>Run #{runId}
            </button>
          </li>
          {pathParts.map((part, index) => (
            <li className="breadcrumb-item" key={`${part}-${index}`}>
              {index === pathParts.length - 1 ? (
                <span className="text-light">{part}</span>
              ) : (
                <button
                  type="button"
                  className="btn btn-link btn-sm p-0 text-info"
                  onClick={() => setCurrentPath(pathParts.slice(0, index + 1).join('/'))}
                  disabled={isLoading}
                >
                  {part}
                </button>
              )}
            </li>
          ))}
        </ol>
      </nav>

      {isLoading ? (
        <div className="text-center py-4 text-muted">
          <span className="spinner-border spinner-border-sm me-2"></span>
          Loading output files...
        </div>
      ) : error ? (
        <div className="alert alert-secondary mb-0">
          <i className="fa-solid fa-folder-open me-2"></i>
          {error}
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-4 text-muted border border-secondary rounded">
          No output files found in this directory.
        </div>
      ) : (
        <>
          {isTruncated && (
            <div className="alert alert-warning py-2 small">
              Only the first 1000 files are shown in this directory.
            </div>
          )}
          <div className="table-responsive">
          <table className="table table-dark table-hover table-sm align-middle mb-0">
            <thead>
              <tr>
                <th>Name</th>
                <th>Size</th>
                <th>Modified</th>
                <th className="text-end">Action</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.path}>
                  <td>
                    {entry.type === 'directory' ? (
                      <button
                        type="button"
                        className="btn btn-link btn-sm p-0 text-info text-decoration-none"
                        onClick={() => setCurrentPath(entry.path)}
                      >
                        <i className="fa-solid fa-folder me-2 text-warning"></i>
                        {entry.name}
                      </button>
                    ) : (
                      <span>
                        <i className="fa-solid fa-file me-2 text-muted"></i>
                        {entry.name}
                      </span>
                    )}
                  </td>
                  <td className="text-muted small">
                    {entry.type === 'file' ? formatBytes(entry.size) : '-'}
                  </td>
                  <td className="text-muted small">
                    {formatDate(entry.modifiedAt)}
                  </td>
                  <td className="text-end">
                    {entry.type === 'file' && (
                      <a
                        className="btn btn-sm btn-outline-success"
                        href={API.getRunFileUrl(runId, entry.path)}
                        download={entry.name}
                        title={`Download ${entry.name}`}
                      >
                        <i className="fa-solid fa-download"></i>
                        <span className="visually-hidden">
                          Download {entry.name}
                        </span>
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      )}
    </div>
  );
}
