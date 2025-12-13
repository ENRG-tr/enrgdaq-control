'use client';
import React, { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { API, type AggregatedParameter } from '@/lib/api-client';
import toast from 'react-hot-toast';

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
    runTypes,
    fetchRunTypes,
    runsTotal,
    runsPage,
    runsLimit,
    setRunsPage,
  } = useStore();

  const [description, setDescription] = useState('');
  const [selectedRunTypeId, setSelectedRunTypeId] = useState<number | ''>('');
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

  // Parameter state (aggregated from templates)
  const [parameters, setParameters] = useState<AggregatedParameter[]>([]);
  const [parameterValues, setParameterValues] = useState<
    Record<string, string>
  >({});
  const [loadingParams, setLoadingParams] = useState(false);

  useEffect(() => {
    fetchRunTypes();
  }, [fetchRunTypes]);

  // Fetch aggregated parameters when run type changes
  useEffect(() => {
    if (selectedRunTypeId === '') {
      setParameters([]);
      setParameterValues({});
      return;
    }

    const loadParameters = async () => {
      setLoadingParams(true);
      try {
        const params = await API.getAggregatedParametersForRunType(
          Number(selectedRunTypeId)
        );
        setParameters(params);
        // Initialize values with run type default > template default > empty
        const initialValues: Record<string, string> = {};
        for (const param of params) {
          initialValues[param.name] =
            param.runTypeDefault || param.defaultValue || '';
        }
        setParameterValues(initialValues);
      } catch (e) {
        console.error('Failed to fetch parameters:', e);
        setParameters([]);
      } finally {
        setLoadingParams(false);
      }
    };

    loadParameters();
  }, [selectedRunTypeId]);

  const activeRunType = runTypes.find(
    (rt) =>
      rt.id === (selectedRunTypeId === '' ? -1 : Number(selectedRunTypeId))
  );

  const filteredClients = React.useMemo(() => {
    if (
      !activeRunType ||
      !activeRunType.requiredTags ||
      activeRunType.requiredTags.length === 0
    ) {
      return clients;
    }
    console.log(activeRunType.requiredTags, clients);
    return clients.filter((c) => {
      return activeRunType.requiredTags!.every((tag) => c.tags.includes(tag));
    });
  }, [clients, activeRunType]);

  const handleStart = async () => {
    if (!description) return;

    // Validate required parameters
    for (const param of parameters) {
      if (param.required && !parameterValues[param.name]) {
        toast.error(`Please fill in required parameter: ${param.displayName}`);
        return;
      }
    }

    setIsStarting(true);
    try {
      await startRun(
        description,
        selectedRunTypeId ? Number(selectedRunTypeId) : undefined,
        parameterValues
      );
      setDescription('');
      setParameterValues({});
      toast.success('Acquisition started successfully');
    } catch (e: any) {
      console.error('Failed to start run:', e);
      toast.error('Failed to start run: ' + (e.message || e));
    } finally {
      setIsStarting(false);
    }
  };

  const handleStop = async () => {
    if (!activeRun) return;
    setIsStopping(true);
    try {
      await stopRun();
      toast.success(`Run #${activeRun.id} stopped successfully`);
    } catch (e: any) {
      console.error('Failed to stop run:', e);
      toast.error('Failed to stop run: ' + (e.message || e));
    } finally {
      setIsStopping(false);
    }
  };

  const getRunTypeName = (typeId: number | null) => {
    if (!typeId) return '-';
    return runTypes.find((rt) => rt.id === typeId)?.name || 'Unknown';
  };

  const handleParameterChange = (paramName: string, value: string) => {
    setParameterValues((prev) => ({
      ...prev,
      [paramName]: value,
    }));
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
            {filteredClients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id}
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
                  <div className="badge bg-secondary mb-2">
                    {getRunTypeName(activeRun.runTypeId)}
                  </div>
                  <p className="text-muted lead">"{activeRun.description}"</p>
                  <div className="mt-4 w-100 px-5">
                    <button
                      onClick={handleStop}
                      className="btn btn-danger btn-lg w-100 py-3 fw-bold"
                      disabled={isStopping}
                    >
                      {isStopping ? (
                        <>
                          <span
                            className="spinner-border spinner-border-sm me-2"
                            role="status"
                            aria-hidden="true"
                          ></span>
                          STOPPING...
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-stop me-2"></i> STOP RUN
                        </>
                      )}
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
                <label className="form-label text-muted">Run Type</label>
                <select
                  className="form-select form-select-lg bg-dark text-light border-secondary"
                  value={selectedRunTypeId}
                  onChange={(e) =>
                    setSelectedRunTypeId(
                      e.target.value === '' ? '' : Number(e.target.value)
                    )
                  }
                  disabled={!!activeRun || !clientOnline}
                >
                  <option value="" disabled>
                    -- Select Run Type --
                  </option>
                  {runTypes.map((rt) => (
                    <option key={rt.id} value={rt.id}>
                      {rt.name}
                    </option>
                  ))}
                </select>
                <div className="form-text">
                  Select a run type to use specific templates.
                </div>
              </div>

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

              {/* Parameter Inputs */}
              {loadingParams && (
                <div className="text-muted small mb-3">
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Loading parameters...
                </div>
              )}
              {parameters.length > 0 && (
                <div className="mb-4 p-3 border border-secondary rounded">
                  <label className="form-label text-info fw-bold mb-3">
                    <i className="fa-solid fa-sliders me-2"></i>Run Parameters
                  </label>
                  {parameters.map((param) => (
                    <div key={param.id} className="mb-3">
                      <label className="form-label text-muted small">
                        {param.displayName}
                        {param.required && (
                          <span className="text-danger ms-1">*</span>
                        )}
                      </label>
                      {param.type === 'bool' ? (
                        <select
                          className="form-select bg-dark text-light border-secondary"
                          value={parameterValues[param.name] || ''}
                          onChange={(e) =>
                            handleParameterChange(param.name, e.target.value)
                          }
                          disabled={!!activeRun || !clientOnline}
                        >
                          <option value="">-- Select --</option>
                          <option value="true">True</option>
                          <option value="false">False</option>
                        </select>
                      ) : (
                        <input
                          type={
                            param.type === 'int' || param.type === 'float'
                              ? 'number'
                              : 'text'
                          }
                          step={param.type === 'float' ? '0.01' : undefined}
                          className="form-control bg-dark text-light border-secondary"
                          placeholder={
                            param.defaultValue || `Enter ${param.displayName}`
                          }
                          value={parameterValues[param.name] || ''}
                          onChange={(e) =>
                            handleParameterChange(param.name, e.target.value)
                          }
                          disabled={!!activeRun || !clientOnline}
                        />
                      )}
                      <div className="form-text">
                        Use <code>{`{${param.name.toUpperCase()}}`}</code> in
                        templates
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="alert alert-info border-info d-flex align-items-center">
                <i className="fa-solid fa-info-circle fa-2x me-3"></i>
                <div>
                  {activeRunType ? (
                    <>
                      <p className="mb-1">
                        <strong>{activeRunType.name}</strong>
                      </p>
                      {activeRunType.description ||
                        'No description available for this run type.'}
                    </>
                  ) : (
                    <>Please select a run type to view its description.</>
                  )}
                </div>
              </div>

              <button
                onClick={handleStart}
                disabled={
                  !!activeRun ||
                  !clientOnline ||
                  !description ||
                  isStarting ||
                  !selectedRunTypeId
                }
                className="btn btn-primary btn-lg w-100 mt-3"
              >
                {isStarting ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                      aria-hidden="true"
                    ></span>
                    Initializing...
                  </>
                ) : (
                  'START RUN'
                )}
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
        <div className="card-header fw-bold d-flex justify-content-between align-items-center">
          <span>
            <i className="fa-solid fa-clock-rotate-left me-2"></i>Run History
          </span>
          <span className="badge bg-secondary">{runsTotal} Runs</span>
        </div>
        <div className="card-body p-0">
          <table className="table table-dark table-hover mb-0">
            <thead>
              <tr>
                <th className="ps-4">ID</th>
                <th>Type</th>
                <th>Description</th>
                <th>Start Time</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr
                  key={run.id}
                  className={run.status === 'RUNNING' ? 'table-active' : ''}
                >
                  <td className="ps-4 font-monospace">#{run.id}</td>
                  <td>
                    {run.runTypeId ? (
                      <span className="badge bg-info text-dark">
                        {getRunTypeName(run.runTypeId)}
                      </span>
                    ) : (
                      <span className="badge bg-secondary">Generic</span>
                    )}
                  </td>
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
                </tr>
              ))}
              {runs.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-4 text-muted">
                    No runs recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {runsTotal > runsLimit && (
            <div className="d-flex justify-content-between align-items-center p-3 border-top border-secondary">
              <button
                className="btn btn-sm btn-outline-secondary"
                disabled={runsPage === 1}
                onClick={() => setRunsPage(runsPage - 1)}
              >
                <i className="fa-solid fa-chevron-left me-1"></i> Prev
              </button>
              <span className="text-muted small">
                Page {runsPage} of {Math.ceil(runsTotal / runsLimit)}
              </span>
              <button
                className="btn btn-sm btn-outline-secondary"
                disabled={runsPage >= Math.ceil(runsTotal / runsLimit)}
                onClick={() => setRunsPage(runsPage + 1)}
              >
                Next <i className="fa-solid fa-chevron-right ms-1"></i>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RunDashboard;
