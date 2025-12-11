'use client';

import React, { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { API, type LogEntry, type Template } from '@/lib/api-client';
import TomlForm from './TomlForm';
import toast from 'react-hot-toast';

const AdvancedControl = () => {
  const {
    clients,
    selectedClient,
    clientStatus,
    clientOnline,
    logs,
    selectClient,
  } = useStore();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [customConfig, setCustomConfig] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [stoppingJobId, setStoppingJobId] = useState<string | null>(null);
  const [isRestarting, setIsRestarting] = useState(false);
  const [isStoppingAll, setIsStoppingAll] = useState(false);

  // Fetch templates on mount
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const data = await API.getTemplates();
        setTemplates(data);
        if (data.length > 0) {
          setSelectedTemplate(data[0].name);
          setCustomConfig(data[0].config);
        }
      } catch (e) {
        console.error('Failed to fetch templates:', e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTemplates();
  }, []);

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const name = e.target.value;
    setSelectedTemplate(name);
    const template = templates.find(t => t.name === name);
    if (template) {
      setCustomConfig(template.config);
    }
  };

  const handleEditConfig = (config: string, uniqueId: string) => {
    setCustomConfig(config);
    setEditingJobId(uniqueId);
    setIsEditing(true);
    setSelectedTemplate('');
  };

  const handleStopEditing = () => {
    setIsEditing(false);
    setEditingJobId(null);
    if (templates.length > 0) {
        const first = templates[0];
        setSelectedTemplate(first.name);
        setCustomConfig(first.config);
    }
  };

  const handleStopJob = async (jobId: string) => {
    if (!selectedClient) return;
    setStoppingJobId(jobId);
    try {
        await API.stopJob(selectedClient, jobId);
        toast.success('Job stopped successfully');
    } catch (e: any) {
        console.error("Failed to stop job:", e);
        toast.error(`Failed to stop job: ${e.message || e}`);
    } finally {
        setStoppingJobId(null);
    }
  };

  const handleExecute = async () => {
    if (!selectedClient) return;
    
    setIsExecuting(true);
    try {
        if (isEditing && editingJobId) {
            await API.stopJob(selectedClient, editingJobId, true);
        }
        await API.runJob(selectedClient, customConfig);
        
        // Confirmation
        if (isEditing) {
             toast.success('Process updated successfully.');
             handleStopEditing();
        } else {
             toast.success('Process started successfully.');
        }
    } catch (e: any) {
        console.error("Execution failed:", e);
        toast.error(`Execution failed: ${e.message || e}`);
    } finally {
        setIsExecuting(false);
    }
  };

  const handleRestartDaq = async () => {
    if (!selectedClient) return;
    setIsRestarting(true);
    try {
        await API.restartDaq(selectedClient);
        toast.success('DAQ restarted successfully');
    } catch (e: any) {
        console.error("Failed to restart DAQ:", e);
        toast.error(`Failed to restart DAQ: ${e.message || e}`);
    } finally {
        setIsRestarting(false);
    }
  };

  const handleStopAllJobs = async () => {
    if (!selectedClient) return;
    setIsStoppingAll(true);
    try {
        await API.stopAllJobs(selectedClient);
        toast.success('All jobs stopped successfully');
    } catch (e: any) {
        console.error("Failed to stop all jobs:", e);
        toast.error(`Failed to stop all jobs: ${e.message || e}`);
    } finally {
        setIsStoppingAll(false);
    }
  };

  const activeJobs = clientStatus?.daq_jobs || [];

  return (
    <div className="container-fluid h-100 overflow-auto p-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="mb-0 text-light">Advanced Control</h2>

        <div className="d-flex align-items-center">
          <select
            className="form-select bg-dark text-light border-secondary me-3"
            style={{ width: '200px' }}
            value={selectedClient || ''}
            onChange={(e) => selectClient(e.target.value)}
          >
            {clients.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <div className="btn-group">
            <button
              className="btn btn-outline-warning"
              onClick={handleRestartDaq}
              disabled={!clientOnline || isRestarting}
            >
              {isRestarting ? (
                 <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Restarting...
                 </>
              ) : (
                 <>
                    <i className="fa-solid fa-rotate-right me-2"></i> Restart DAQ
                 </>
              )}
            </button>
            <button
              className="btn btn-outline-danger"
              onClick={handleStopAllJobs}
              disabled={!clientOnline || isStoppingAll}
            >
              {isStoppingAll ? (
                 <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Stopping...
                 </>
              ) : (
                 <>
                    <i className="fa-solid fa-stop me-2"></i> Stop All
                 </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="row g-4">
        {/* Active Jobs */}
        <div className="col-12">
          <div className="card mb-4">
            <div className="card-header fw-bold bg-dark border-secondary">
              <i className="fa-solid fa-microchip me-2"></i>Raw Process List
            </div>
            <div className="card-body">
              {activeJobs.length > 0 ? (
                <div className="row g-3">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {activeJobs.map((job: any) => (
                    <div key={job.unique_id} className="col-md-4 col-lg-3">
                      <div className="card h-100 border-secondary bg-black">
                        <div className="card-body">
                          <div className="d-flex justify-content-between mb-2"></div>
                          <h6
                            className="card-title text-info text-truncate"
                            title={job.unique_id}
                          >
                            {job.daq_job_type}
                          </h6>
                          <p className="card-text text-muted small mb-3">
                            {job.unique_id}
                          </p>
                          <div className="d-grid gap-2">
                             <button
                                className="btn btn-sm btn-outline-info"
                                onClick={() => {
                                    if (job.config) {
                                        handleEditConfig(job.config, job.unique_id);
                                    } else {
                                        toast.error("No configuration available for this job.");
                                    }
                                }}
                             >
                                <i className="fa-solid fa-pen-to-square pe-2"></i>
                                Edit Config
                             </button>
                             <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleStopJob(job.unique_id)}
                                disabled={!!stoppingJobId}
                              >
                                {stoppingJobId === job.unique_id ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                        Stopping...
                                    </>
                                ) : (
                                    <>
                                        <i className="fa-solid fa-stop pe-2"></i> 
                                        Stop Process
                                    </>
                                )}
                              </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted py-3">
                  No active processes.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Manual Job Launch */}
        <div className="col-lg-7">
          <div className="card h-100">
            <div className={`card-header fw-bold border-secondary ${isEditing ? 'bg-warning text-dark' : 'bg-dark'}`}>
              <i className={`fa-solid ${isEditing ? 'fa-pen-to-square' : 'fa-code'} me-2`}></i>
              {isEditing ? 'Editing Run Configuration' : 'Manual Job Launcher'}
            </div>
            <div className="card-body">
              {!isEditing && (
                <div className="mb-3">
                    <label className="form-label text-muted">Template</label>
                    {isLoading ? (
                    <div className="text-muted">Loading templates...</div>
                    ) : (
                    <select
                        className="form-select bg-dark text-light border-secondary"
                        value={selectedTemplate}
                        onChange={handleTemplateChange}
                    >
                        {Array.isArray(templates)  && templates.map((t) => (
                        <option key={t.name} value={t.name}>
                            {t.displayName} {t.source === 'custom' && '(Custom)'}
                        </option>
                        ))}
                    </select>
                    )}
                </div>
              )}

              {isEditing && (
                <div className="mb-3 d-flex justify-content-between align-items-center">
                    <span className="text-warning small"><i className="fa-solid fa-circle-info me-1"></i>You are modifying a running configuration.</span>
                    <button className="btn btn-sm btn-outline-secondary" onClick={handleStopEditing}>
                        Cancel / Stop Editing
                    </button>
                </div>
              )}

              <div className="mb-3">
                <TomlForm
                  initialToml={customConfig}
                  onChange={setCustomConfig}
                  disabled={!clientOnline}
                  disableJobType={isEditing}
                />
              </div>
              <button
                className="btn btn-primary w-100"
                onClick={handleExecute}
                disabled={!clientOnline || isExecuting}
              >
                {isExecuting ? (
                    <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Processing...
                    </>
                ) : (
                    <>
                        <i className={`fa-solid ${isEditing ? 'fa-rotate' : 'fa-terminal'} me-2`}></i> 
                        {isEditing ? 'Terminate & Restart' : 'Execute'}
                    </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Logs */}
        <div className="col-lg-5">
          <div className="card h-100">
            <div className="card-header fw-bold bg-dark border-secondary">
              <i className="fa-solid fa-list-ul me-2"></i>Supervisor Logs
            </div>
            <div className="card-body p-0">
              <div
                className="console-logs m-0 h-100 border-0 rounded-0"
                style={{ minHeight: '450px', maxHeight: '450px' }}
              >
                {[]
                  .concat(logs as any)
                  .reverse()
                  .filter((l: LogEntry) => l !== null)
                  .map((l: LogEntry, i) => (
                    <div key={i} className="log-entry">
                      <small className="text-muted">[{l.timestamp}]</small>{' '}
                      <span
                        className={`log-level log-level-${l.level.toLowerCase()}`}
                      >
                        {l.level}
                      </span>{' '}
                      <span className="log-message">{l.message}</span>
                    </div>
                  ))}
                {logs.length === 0 && (
                  <span className="text-muted">No logs received.</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvancedControl;
