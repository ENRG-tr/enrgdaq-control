'use client';

import React, { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';

const RunDashboard = () => {
  const {
    runs,
    activeRun,
    startRun,
    stopRun,
    selectedClient,
    clientOnline,
    clients,
    selectClient,
    fetchClients,
    fetchRuns,
    pollClientStatus
  } = useStore();

  useEffect(() => {
    fetchClients();
    fetchRuns();

    const interval = setInterval(() => {
        fetchClients();
        pollClientStatus();
        fetchRuns();
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const [description, setDescription] = useState('');
  const [isStarting, setIsStarting] = useState(false);

  const handleStart = async () => {
    if (!description) return;
    setIsStarting(true);
    try {
      await startRun(description);
      setDescription('');
    } catch (e) {
      alert('Failed to start run: ' + e);
    } finally {
      setIsStarting(false);
    }
  };

  const handleStop = async () => {
    if (confirm('Are you sure you want to stop the current acquisition?')) {
      await stopRun();
    }
  };

  return (
    <div className="container-fluid h-100 overflow-auto p-4">
      {/* Top Bar: Client Selector */}
      <div className="d-flex justify-content-between align-items-center mb-5">
        <h2 className="fw-bold text-light mb-0">Run Dashboard</h2>
        <div className="d-flex align-items-center bg-dark border border-secondary rounded px-3 py-2">
          <span className="text-muted me-2">Target Node:</span>
          <select
            className="form-select form-select-sm bg-dark text-light border-0"
            style={{ width: 'auto', boxShadow: 'none' }}
            value={selectedClient || ''}
            onChange={(e) => selectClient(e.target.value)}
          >
            {clients.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <div
            className={`ms-3 status-dot ${
                clientOnline ? 'status-online' : 'status-offline'
            }`}
          ></div>
        </div>
      </div>

      <div className="row g-4 mb-5">
        {/* Status Card */}
        <div className="col-lg-6">
          <div
            className={`card h-100 border-2 ${
              activeRun ? 'border-success' : 'border-secondary'
            }`}
          >
            <div className="card-body d-flex flex-column justify-content-center align-items-center p-5 text-center">
              {activeRun ? (
                <>
                  <div className="display-1 text-success mb-3">
                    <i className="fa-solid fa-heart-pulse fa-beat"></i>
                  </div>
                  <h3 className="text-success fw-bold">ACQUISITION ACTIVE</h3>
                  <h5 className="text-light mt-3">Run ID: #{activeRun.id}</h5>
                  <p className="text-muted lead">"{activeRun.description}"</p>
                  <div className="mt-4 w-100 px-5">
                    <button
                      onClick={handleStop}
                      className="btn btn-danger btn-lg w-100 py-3 fw-bold"
                    >
                      <i className="fa-solid fa-stop me-2"></i> STOP RUN
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="display-1 text-muted mb-3 opacity-25">
                    <i className="fa-solid fa-wave-square"></i>
                  </div>
                  <h3 className="text-muted">System Idle</h3>
                  <p className="text-muted small">
                    Ready for new acquisition configuration.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Control Card */}
        <div className="col-lg-6">
          <div className="card h-100">
            <div className="card-header fw-bold py-3">
              <i className="fa-solid fa-play me-2"></i>Start New Acquisition
            </div>
            <div className="card-body p-4">
              <div className="mb-4">
                <label className="form-label text-muted">
                  Experiment Description
                </label>
                <input
                  type="text"
                  className="form-control form-control-lg bg-dark text-light border-secondary"
                  placeholder="e.g. Cosmic Ray Calibration Run 1"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={!!activeRun || !clientOnline}
                />
                <div className="form-text">
                  This will be stored in the PostgreSQL runs table.
                </div>
              </div>

              <div className="alert alert-info border-info d-flex align-items-center">
                <i className="fa-solid fa-info-circle fa-2x me-3"></i>
                <div>
                  <strong>Auto-Configuration:</strong> Starting a run will
                  automatically configure the CAEN Digitizer (Optical Link) and
                  store data to <code>runs/[ID]/...</code>.
                </div>
              </div>

              <button
                onClick={handleStart}
                disabled={
                  !!activeRun || !clientOnline || !description || isStarting
                }
                className="btn btn-primary btn-lg w-100 mt-3"
              >
                {isStarting ? 'Initializing...' : 'START RUN'}
              </button>
              {!clientOnline && (
                <div className="text-danger mt-2 text-center small">
                  Supervisor Offline
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="card">
        <div className="card-header fw-bold">
          <i className="fa-solid fa-clock-rotate-left me-2"></i>Run History
        </div>
        <div className="card-body p-0">
          <table className="table table-dark table-hover mb-0">
            <thead>
              <tr>
                <th className="ps-4">ID</th>
                <th>Description</th>
                <th>Start Time</th>
                <th>Status</th>
                <th>Data Path</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr
                  key={run.id}
                  className={run.status === 'RUNNING' ? 'table-active' : ''}
                >
                  <td className="ps-4 font-monospace">#{run.id}</td>
                  <td>{run.description}</td>
                  <td>{new Date(run.startTime).toLocaleString()}</td>
                  <td>
                    <span
                      className={`badge ${
                        run.status === 'RUNNING' ? 'bg-success' : 'bg-secondary'
                      }`}
                    >
                      {run.status}
                    </span>
                  </td>
                  <td className="font-monospace text-muted small">
                    runs/{run.id}/...
                  </td>
                </tr>
              ))}
              {runs.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-4 text-muted">
                    No runs recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RunDashboard;
