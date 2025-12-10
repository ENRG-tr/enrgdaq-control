import React, { useState } from 'react';
import { useStore } from '../store';
import { API } from '../api';

const TEMPLATES: Record<string, string> = {
  'caen_digitizer.toml': `daq_job_type = "DAQJobCAENDigitizer"
connection_type = "OPTICAL_LINK"
link_number = "1"
conet_node = 0
vme_base_address = 0
channel_enable_mask = 0b11
record_length = 1024
acquisition_mode = "SW_CONTROLLED"
[waveform_store_config.raw]
file_path = "caen_digitizer_waveforms.raw"
add_date = true
overwrite = true`,
  'n1081b.toml': `daq_job_type = "DAQJobN1081B"
host = "1.2.3.4"
port = "8080"
password = "password"
[store_config.csv]
file_path = "n1081b.csv"
add_date = true`,
  'test_gen.toml': `daq_job_type = "DAQJobTest"
rand_min = 1
rand_max = 100
[store_config.csv]
file_path = "test.csv"
add_date = true`,
};

const AdvancedControl = () => {
  const {
    clients,
    selectedClient,
    clientStatus,
    clientOnline,
    logs,
    selectClient,
  } = useStore();

  const [configTemplate, setConfigTemplate] = useState<string>(
    Object.keys(TEMPLATES)[0]
  );
  const [customConfig, setCustomConfig] = useState<string>(
    TEMPLATES[Object.keys(TEMPLATES)[0]]
  );

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const t = e.target.value;
    setConfigTemplate(t);
    setCustomConfig(TEMPLATES[t]);
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
                  {activeJobs.map((job: DAQJob) => (
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
                <select
                  className="form-select bg-dark text-light border-secondary"
                  value={configTemplate}
                  onChange={handleTemplateChange}
                >
                  {Object.keys(TEMPLATES).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
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
                  .concat(logs)
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
