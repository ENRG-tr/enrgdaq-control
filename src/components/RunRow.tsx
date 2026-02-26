import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import toast from 'react-hot-toast';
import { type Run } from '@/lib/types';
import { useStore } from '@/lib/store';
import { formatDate } from '@/lib/date-utils';
import { API } from '@/lib/api-client';
import 'react-quill-new/dist/quill.snow.css';

const ReactQuill = dynamic(
  async () => {
    const { default: RQ } = await import('react-quill-new');
    return function ForwardedQuill(props: any) {
      return <RQ {...props} />;
    };
  },
  { ssr: false },
);

type ExtendedRun = Run & { hasMetadata?: boolean };

interface RunRowProps {
  run: ExtendedRun;
  runTypeName: string;
  duration: string;
  isAdmin: boolean;
  onDelete: (runId: number, status: string) => void;
}

export function RunRow({
  run,
  runTypeName,
  duration,
  isAdmin,
  onDelete,
}: RunRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [editDetails, setEditDetails] = useState('');
  const [lastUpdatedBy, setLastUpdatedBy] = useState('');
  const [lastUpdatedAt, setLastUpdatedAt] = useState('');
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);

  const toggleExpand = async () => {
    if (isExpanded) {
      setIsExpanded(false);
      setIsEditingMetadata(false);
      return;
    }

    setIsExpanded(true);
    setIsEditingMetadata(false);
    setEditDetails('');
    setLastUpdatedBy('');
    setLastUpdatedAt('');
    setIsLoadingMetadata(true);

    try {
      const data = await API.getRunMetadata(run.id);
      if (data) {
        setEditDetails(data.details || '');
        setLastUpdatedBy(data.updatedBy || '');
        setLastUpdatedAt(data.updatedAt ? formatDate(data.updatedAt) : '');
      }
    } catch (e) {
      console.error('Failed to fetch run metadata:', e);
      toast.error('Failed to load run metadata');
    } finally {
      setIsLoadingMetadata(false);
    }
  };

  const handleSaveMetadata = async () => {
    setIsSavingMetadata(true);
    try {
      const data = await API.updateRunMetadata(run.id, editDetails);
      toast.success(`Run #${run.id} metadata updated`);
      // We sync by refetching runs to update hasMetadata
      useStore.getState().fetchRuns();
      setLastUpdatedBy(data.updatedBy || '');
      setLastUpdatedAt(data.updatedAt ? formatDate(data.updatedAt) : '');
      setIsEditingMetadata(false);
    } catch (e: any) {
      console.error('Failed to save run metadata:', e);
      const errorMsg = e?.response?.data?.error || 'Failed to save metadata';
      toast.error(errorMsg);
    } finally {
      setIsSavingMetadata(false);
    }
  };

  return (
    <React.Fragment>
      <tr className={run.status === 'RUNNING' ? 'table-active' : ''}>
        <td className="ps-4 font-monospace">#{run.id}</td>
        <td>
          {run.runTypeId ? (
            <span className="badge bg-info text-dark">{runTypeName}</span>
          ) : (
            <span className="badge bg-secondary">Generic</span>
          )}
        </td>
        <td>{run.description}</td>
        <td>{formatDate(run.startTime)}</td>
        <td>
          <div>{run.endTime ? formatDate(run.endTime) : '-'}</div>
          <small className="text-muted">{duration}</small>
        </td>
        <td>
          <span
            className={`badge ${
              run.status === 'RUNNING' ? 'bg-success' : 'bg-secondary'
            }`}
          >
            {run.status}
          </span>
        </td>
        <td className="pe-4 text-end">
          <button
            className={`btn btn-sm me-2 ${
              run.hasMetadata ? 'btn-outline-info' : 'btn-outline-secondary'
            }`}
            onClick={toggleExpand}
            title={run.hasMetadata ? 'View Run Logs' : 'Add Run Logs'}
          >
            <i
              className={`fa-solid ${
                isExpanded ? 'fa-chevron-up' : 'fa-file-lines'
              }`}
            ></i>
          </button>
          {isAdmin && (
            <button
              className="btn btn-sm btn-outline-danger"
              onClick={() => onDelete(run.id, run.status)}
              disabled={run.status === 'RUNNING'}
              title="Delete Run"
            >
              <i className="fa-solid fa-trash"></i>
            </button>
          )}
        </td>
      </tr>

      {/* Expanded Row Content */}
      {isExpanded && (
        <tr className="bg-dark border-secondary">
          <td colSpan={7} className="p-0">
            <div
              className="p-4 border-bottom border-secondary shadow-inner"
              style={{ backgroundColor: '#1a1d20' }}
            >
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="text-light mb-0">
                  <i className="fa-solid fa-file-lines me-2 text-info"></i>
                  Run Logs
                </h5>
                {!isEditingMetadata && (
                  <button
                    className="btn btn-sm btn-outline-info"
                    onClick={() => setIsEditingMetadata(true)}
                  >
                    <i className="fa-solid fa-pen me-2"></i>Edit Logs
                  </button>
                )}
              </div>

              {isLoadingMetadata ? (
                <div className="text-center py-5 text-muted">
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Loading logs...
                </div>
              ) : (
                <>
                  {!isEditingMetadata ? (
                    <div className="border border-secondary rounded p-3 bg-dark text-light mb-3">
                      {editDetails ? (
                        <div
                          className="ql-editor p-0"
                          style={{
                            minHeight: '100px',
                            fontSize: '1.15rem',
                            backgroundColor: 'transparent',
                          }}
                          dangerouslySetInnerHTML={{
                            __html: editDetails,
                          }}
                        />
                      ) : (
                        <div className="text-muted fst-italic py-4 text-center">
                          No logs have been written for this run yet. Click
                          "Edit Logs" to add some.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mb-3">
                      <div
                        className="rounded dark-quill-container bg-dark"
                        style={{
                          paddingBottom: '42px',
                          minHeight: '300px',
                        }}
                      >
                        <ReactQuill
                          theme="snow"
                          value={editDetails}
                          onChange={setEditDetails}
                          style={{ height: '250px' }}
                        />
                      </div>
                      <div className="mt-3 d-flex justify-content-end gap-2">
                        <button
                          className="btn btn-outline-secondary"
                          onClick={() => setIsEditingMetadata(false)}
                        >
                          Cancel
                        </button>
                        <button
                          className="btn btn-info"
                          onClick={handleSaveMetadata}
                          disabled={isSavingMetadata}
                        >
                          {isSavingMetadata ? (
                            <>
                              <span className="spinner-border spinner-border-sm me-2"></span>
                              Saving...
                            </>
                          ) : (
                            <>
                              <i className="fa-solid fa-save me-2"></i>
                              Save Logs
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="text-muted small px-1 d-flex flex-wrap align-items-center">
                    <i className="fa-solid fa-clock-rotate-left me-2"></i>
                    {lastUpdatedBy ? (
                      <span>
                        Last updated by{' '}
                        <strong className="text-light">{lastUpdatedBy}</strong>{' '}
                        at{' '}
                        <strong className="text-light">{lastUpdatedAt}</strong>
                      </span>
                    ) : (
                      <span>No updates recorded yet.</span>
                    )}
                  </div>
                </>
              )}
            </div>
          </td>
        </tr>
      )}
    </React.Fragment>
  );
}
