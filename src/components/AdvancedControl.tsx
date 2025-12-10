'use client';

import React, { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { API, type LogEntry, type Template } from '@/lib/api-client';

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
              onClick={() => selectedClient && API.restartDaq(selectedClient)}
              disabled={!clientOnline}
            >
              <i className="fa-solid fa-rotate-right"></i> Restart DAQ
            </button>
            <button
              className="btn btn-outline-danger"
              onClick={() => selectedClient && API.stopAllJobs(selectedClient)}
              disabled={!clientOnline}
            >
              <i className="fa-solid fa-stop"></i> Stop All
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
                          <button
                            className="btn btn-sm btn-outline-danger w-100"
                            onClick={() =>
                              selectedClient &&
                              API.stopJob(selectedClient, job.unique_id)
                            }
                          >
                            Stop Process
                          </button>
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
            <div className="card-header fw-bold bg-dark border-secondary">
              <i className="fa-solid fa-code me-2"></i>Manual Job Launcher
            </div>
            <div className="card-body">
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
                    {templates.map((t) => (
                      <option key={t.name} value={t.name}>
                        {t.displayName} {t.source === 'custom' && '(Custom)'}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="mb-3">
                <textarea
                  className="form-control bg-black text-warning border-secondary font-monospace"
                  rows={10}
                  value={customConfig}
                  onChange={(e) => setCustomConfig(e.target.value)}
                ></textarea>
              </div>
              <button
                className="btn btn-primary w-100"
                onClick={() =>
                  selectedClient && API.runJob(selectedClient, customConfig)
                }
                disabled={!clientOnline}
              >
                <i className="fa-solid fa-terminal me-2"></i> Execute
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
