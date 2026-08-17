'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '@/lib/store';
import { API, type Template } from '@/lib/api-client';
import type { DAQJobInfo, LogEntry } from '@/lib/types';
import TomlForm from './TomlForm';
import toast from 'react-hot-toast';

const AdvancedControl = () => {
  const {
    clients,
    selectedClient,
    clientStatus,
    clientOnline,
    logs,
    logsLimit,
    increaseLogsLimit,
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

  // --- Log filter state ---
  const [logSearch, setLogSearch] = useState('');
  const [logLevels, setLogLevels] = useState<string[]>([]);
  // Draft: what the user is typing into the inputs
  const [logDateFrom, setLogDateFrom] = useState('');
  const [logTimeFrom, setLogTimeFrom] = useState('');
  const [logDateTo, setLogDateTo] = useState('');
  const [logTimeTo, setLogTimeTo] = useState('');
  // Applied: string values for exact, flexible filtering (supports date, time, or date+time)
  const [appliedDateFrom, setAppliedDateFrom] = useState('');
  const [appliedTimeFrom, setAppliedTimeFrom] = useState('');
  const [appliedDateTo, setAppliedDateTo] = useState('');
  const [appliedTimeTo, setAppliedTimeTo] = useState('');
  // Test/Mock logs state to verify filtering behavior
  const [testLogs, setTestLogs] = useState<LogEntry[]>([]);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const ALL_LEVELS = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'];

  const toggleLevel = (level: string) =>
    setLogLevels((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level],
    );

  interface ParsedLogTime {
    dateMs: number;
    timeOfDaySec: number;
  }

  const parseLogTime = (tsRaw: string | number | null | undefined): ParsedLogTime | null => {
    if (!tsRaw) return null;
    if (typeof tsRaw === 'number') {
      const ms = tsRaw > 1e11 ? tsRaw : tsRaw * 1000;
      const d = new Date(ms);
      return {
        dateMs: ms,
        timeOfDaySec: d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds(),
      };
    }
    if (typeof tsRaw === 'string') {
      const str = tsRaw.trim();
      if (!str) return null;
      // Direct match for ISO format YYYY-MM-DDTHH:mm:ss or YYYY-MM-DD HH:mm:ss
      const match = str.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:[.,](\d+))?/);
      if (match) {
        const [_, yStr, mStr, dStr, hStr, minStr, sStr, msStr] = match;
        const year = parseInt(yStr, 10);
        const month = parseInt(mStr, 10) - 1;
        const day = parseInt(dStr, 10);
        const hour = parseInt(hStr, 10);
        const min = parseInt(minStr, 10);
        const sec = parseInt(sStr, 10);
        const ms = msStr ? parseInt(msStr.substring(0, 3).padEnd(3, '0'), 10) : 0;

        const dateObj = new Date(year, month, day, hour, min, sec, ms);
        return {
          dateMs: dateObj.getTime(),
          timeOfDaySec: hour * 3600 + min * 60 + sec,
        };
      }

      // Generic fallback parser
      const normalized = str.replace(/,(\d{1,6})/, '.$1').replace(/\.(\d{3})\d+/, '.$1');
      const parsed = new Date(normalized).getTime();
      if (!isNaN(parsed)) {
        const d = new Date(parsed);
        return {
          dateMs: parsed,
          timeOfDaySec: d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds(),
        };
      }
    }
    return null;
  };

  const activeLogSource = useMemo(() => {
    return testLogs.length > 0 ? testLogs : logs;
  }, [testLogs, logs]);

  const hasDateOrTimeFilter = Boolean(
    appliedDateFrom || appliedTimeFrom || appliedDateTo || appliedTimeTo,
  );

  const filteredLogs = useMemo(() => {
    const keyword = logSearch.trim().toLowerCase();

    // 1. Full timestamp boundary (when Date is specified)
    let fromTsLimit: number | null = null;
    if (appliedDateFrom) {
      const [y, m, d] = appliedDateFrom.split('-').map(Number);
      const [hh, mm] = appliedTimeFrom ? appliedTimeFrom.split(':').map(Number) : [0, 0];
      fromTsLimit = new Date(y, m - 1, d, hh || 0, mm || 0, 0, 0).getTime();
    }

    let toTsLimit: number | null = null;
    if (appliedDateTo) {
      const [y, m, d] = appliedDateTo.split('-').map(Number);
      const [hh, mm] = appliedTimeTo ? appliedTimeTo.split(':').map(Number) : [23, 59];
      toTsLimit = new Date(y, m - 1, d, hh ?? 23, mm ?? 59, 59, 999).getTime();
    }

    // 2. Time-of-day only (when Date is omitted, but Time is entered)
    let timeOfDayFromSec: number | null = null;
    if (!appliedDateFrom && appliedTimeFrom) {
      const [hh, mm] = appliedTimeFrom.split(':').map(Number);
      timeOfDayFromSec = (hh || 0) * 3600 + (mm || 0) * 60;
    }

    let timeOfDayToSec: number | null = null;
    if (!appliedDateTo && appliedTimeTo) {
      const [hh, mm] = appliedTimeTo.split(':').map(Number);
      timeOfDayToSec = (hh || 0) * 3600 + (mm || 0) * 60 + 59;
    }

    return [...activeLogSource]
      .reverse()
      .filter((l: LogEntry) => {
        if (!l) return false;

        // Level filter
        if (logLevels.length > 0 && !logLevels.includes(l.level?.toUpperCase()))
          return false;

        // Keyword filter (checks message, module, level, AND timestamp)
        if (keyword) {
          const matchMsg = l.message?.toLowerCase().includes(keyword);
          const matchMod = l.module?.toLowerCase().includes(keyword);
          const matchLvl = l.level?.toLowerCase().includes(keyword);
          const matchTs = l.timestamp?.toLowerCase().includes(keyword);
          if (!matchMsg && !matchMod && !matchLvl && !matchTs) {
            return false;
          }
        }

        // Date / Time filter
        if (hasDateOrTimeFilter) {
          const parsed = parseLogTime(l.timestamp);
          if (!parsed) return false;

          // Date timestamp range
          if (fromTsLimit !== null && parsed.dateMs < fromTsLimit) return false;
          if (toTsLimit !== null && parsed.dateMs > toTsLimit) return false;

          // Time of day range
          if (timeOfDayFromSec !== null && parsed.timeOfDaySec < timeOfDayFromSec)
            return false;
          if (timeOfDayToSec !== null && parsed.timeOfDaySec > timeOfDayToSec)
            return false;
        }

        return true;
      });
  }, [
    activeLogSource,
    logSearch,
    logLevels,
    hasDateOrTimeFilter,
    appliedDateFrom,
    appliedTimeFrom,
    appliedDateTo,
    appliedTimeTo,
  ]);

  const handleApplyDateFilter = () => {
    setAppliedDateFrom(logDateFrom.trim());
    setAppliedTimeFrom(logTimeFrom.trim());
    setAppliedDateTo(logDateTo.trim());
    setAppliedTimeTo(logTimeTo.trim());
  };

  const handleClearDateFilter = () => {
    setLogDateFrom('');
    setLogTimeFrom('');
    setLogDateTo('');
    setLogTimeTo('');
    setAppliedDateFrom('');
    setAppliedTimeFrom('');
    setAppliedDateTo('');
    setAppliedTimeTo('');
  };

  const handleClearAllFilters = () => {
    setLogSearch('');
    setLogLevels([]);
    handleClearDateFilter();
  };

  const handleExportLogs = (format: 'txt' | 'json') => {
    if (filteredLogs.length === 0) {
      toast.error('Dışa aktarılacak log bulunamadı.');
      return;
    }

    let fileContent = '';
    let fileName = '';
    const nowStr = new Date().toISOString().replace(/[:.]/g, '-');

    if (format === 'json') {
      fileContent = JSON.stringify(filteredLogs, null, 2);
      fileName = `enrgdaq_logs_${nowStr}.json`;
    } else {
      fileContent = filteredLogs
        .map((l) => `[${l.timestamp}] [${l.module}] ${l.level} ${l.message}`)
        .join('\n');
      fileName = `enrgdaq_logs_${nowStr}.log`;
    }

    const blob = new Blob([fileContent], {
      type: format === 'json' ? 'application/json' : 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`${filteredLogs.length} adet log ${format.toUpperCase()} formatında indirildi.`);
  };

  const handleCopyLogs = async () => {
    if (filteredLogs.length === 0) {
      toast.error('Kopyalanacak log bulunamadı.');
      return;
    }
    const text = filteredLogs
      .map((l) => `[${l.timestamp}] [${l.module}] ${l.level} ${l.message}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${filteredLogs.length} adet log panoya kopyalandı!`);
    } catch {
      toast.error('Loglar panoya kopyalanamadı.');
    }
  };

  const handleGenerateTestLogs = () => {
    const samples: LogEntry[] = [
      {
        type: 'log',
        level: 'INFO',
        module: 'DAQJobN1081B(30)',
        message: 'Connected!',
        timestamp: '2026-08-16T21:09:56.497777',
        client_id: selectedClient || 'client-1',
        req_id: null,
      },
      {
        type: 'log',
        level: 'INFO',
        module: 'DAQJobN1081B(30)',
        message: 'Connecting to the device...',
        timestamp: '2026-08-16T21:09:56.457199',
        client_id: selectedClient || 'client-1',
        req_id: null,
      },
      {
        type: 'log',
        level: 'ERROR',
        module: 'Supervisor(enrg_cpu)',
        message: 'Error on DAQJobN1081B.start(): [Errno 111] Connection refused Traceback (most recent call last): File "/home/daq/enrgdaq/src/enrgdaq/daq/base.py", line 617, in start instance.start() ConnectionRefusedError: [Errno 111] Connection refused',
        timestamp: '2026-08-16T21:09:54.309834',
        client_id: selectedClient || 'client-1',
        req_id: null,
      },
      {
        type: 'log',
        level: 'INFO',
        module: 'DAQJobN1081B(29)',
        message: 'Connecting to the device...',
        timestamp: '2026-08-16T21:09:54.307531',
        client_id: selectedClient || 'client-1',
        req_id: null,
      },
      {
        type: 'log',
        level: 'ERROR',
        module: 'Supervisor(enrg_cpu)',
        message: 'Error on DAQJobN1081B.start(): Connection to remote host was lost. websocket._exceptions.WebSocketConnectionClosedException: Connection to remote host was lost.',
        timestamp: '2026-08-16T21:09:43.627289',
        client_id: selectedClient || 'client-1',
        req_id: null,
      },
      {
        type: 'log',
        level: 'INFO',
        module: 'DAQJobN1081B(24)',
        message: 'Connected!',
        timestamp: '2026-08-16T03:31:02.556585',
        client_id: selectedClient || 'client-1',
        req_id: null,
      },
      {
        type: 'log',
        level: 'INFO',
        module: 'DAQJobN1081B(24)',
        message: 'Connecting to the device...',
        timestamp: '2026-08-16T03:31:02.517192',
        client_id: selectedClient || 'client-1',
        req_id: null,
      },
      {
        type: 'log',
        level: 'ERROR',
        module: 'Supervisor(enrg_cpu)',
        message: 'Error on DAQJobN1081B.start(): [Errno 111] Connection refused',
        timestamp: '2026-08-16T03:31:00.374059',
        client_id: selectedClient || 'client-1',
        req_id: null,
      },
      {
        type: 'log',
        level: 'ERROR',
        module: 'Supervisor(enrg_cpu)',
        message: 'Connection to remote host was lost. websocket._exceptions.WebSocketConnectionClosedException',
        timestamp: '2026-08-16T03:30:49.699500',
        client_id: selectedClient || 'client-1',
        req_id: null,
      },
      {
        type: 'log',
        level: 'INFO',
        module: 'DAQJobN1081B(18)',
        message: 'Connected!',
        timestamp: '2026-08-15T09:52:29.386645',
        client_id: selectedClient || 'client-1',
        req_id: null,
      },
      {
        type: 'log',
        level: 'INFO',
        module: 'DAQJobN1081B(18)',
        message: 'Connecting to the device...',
        timestamp: '2026-08-15T09:52:29.345714',
        client_id: selectedClient || 'client-1',
        req_id: null,
      },
    ];

    setTestLogs(samples);
    toast.success('Gerçek DAQ log örnekleri yüklendi! Filtreleri test edebilirsiniz.');
  };

  const handleClearTestLogs = () => {
    setTestLogs([]);
    toast.success('Test logları temizlendi, canlı akışa dönüldü.');
  };

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
    const template = templates.find((t) => t.name === name);
    if (template) {
      setCustomConfig(template.config);
    }
  };

  const handleLogsScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    // We check if we are near the bottom of the container
    // Using Math.abs for scrollTop in case of flex-col-reverse implementations
    if (scrollHeight - Math.abs(scrollTop) <= clientHeight + 50) {
      // If we already loaded exactly as many logs as the limit, there might be more to fetch
      if (logs.length >= logsLimit) {
        increaseLogsLimit();
      }
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
    } catch (e: unknown) {
      const error = e as { message?: string };
      console.error('Failed to stop job:', e);
      toast.error(`Failed to stop job: ${error.message || 'Unknown error'}`);
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
    } catch (e: unknown) {
      const error = e as { message?: string };
      console.error('Execution failed:', e);
      toast.error(`Execution failed: ${error.message || 'Unknown error'}`);
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
    } catch (e: unknown) {
      const error = e as { message?: string };
      console.error('Failed to restart DAQ:', e);
      toast.error(`Failed to restart DAQ: ${error.message || 'Unknown error'}`);
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
    } catch (e: unknown) {
      const error = e as { message?: string };
      console.error('Failed to stop all jobs:', e);
      toast.error(
        `Failed to stop all jobs: ${error.message || 'Unknown error'}`,
      );
    } finally {
      setIsStoppingAll(false);
    }
  };

  const activeJobs = clientStatus?.daq_jobs || [];

  return (
    <div className="container-fluid h-100 overflow-auto p-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="mb-0 text-light fw-bold">
          <i className="fa-solid fa-sliders me-3"></i>Advanced Control
        </h2>

        <div className="d-flex align-items-center">
          <select
            className="form-select bg-dark text-light border-secondary me-3"
            style={{ width: '200px' }}
            value={selectedClient || ''}
            onChange={(e) => selectClient(e.target.value)}
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id}
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
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                    aria-hidden="true"
                  ></span>
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
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                    aria-hidden="true"
                  ></span>
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
                  {activeJobs.map((job: DAQJobInfo) => (
                    <div key={job.unique_id} className="col-md-4 col-lg-3">
                      <div className="card h-100 border-secondary bg-dark">
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
                                const jobConfig = (
                                  job as DAQJobInfo & { config?: string }
                                ).config;
                                if (jobConfig) {
                                  handleEditConfig(jobConfig, job.unique_id);
                                } else {
                                  toast.error(
                                    'No configuration available for this job.',
                                  );
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
                                  <span
                                    className="spinner-border spinner-border-sm me-2"
                                    role="status"
                                    aria-hidden="true"
                                  ></span>
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
          <div className="card h-100 border-secondary bg-dark">
            <div
              className={`card-header fw-bold border-secondary ${
                isEditing ? 'bg-warning text-dark' : 'bg-dark'
              }`}
            >
              <i
                className={`fa-solid ${
                  isEditing ? 'fa-pen-to-square' : 'fa-code'
                } me-2`}
              ></i>
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
                      {Array.isArray(templates) &&
                        templates.map((t) => (
                          <option key={t.name} value={t.name}>
                            {t.displayName}
                          </option>
                        ))}
                    </select>
                  )}
                </div>
              )}

              {isEditing && (
                <div className="mb-3 d-flex justify-content-between align-items-center">
                  <span className="text-warning small">
                    <i className="fa-solid fa-circle-info me-1"></i>You are
                    modifying a running configuration.
                  </span>
                  <button
                    className="btn btn-sm btn-outline-secondary"
                    onClick={handleStopEditing}
                  >
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
                className="btn btn-primary btn-lg w-100"
                onClick={handleExecute}
                disabled={!clientOnline || isExecuting}
              >
                {isExecuting ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                      aria-hidden="true"
                    ></span>
                    Processing...
                  </>
                ) : (
                  <>
                    <i
                      className={`fa-solid ${
                        isEditing ? 'fa-rotate' : 'fa-terminal'
                      } me-2`}
                    ></i>
                    {isEditing ? 'Terminate & Restart' : 'Execute'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Logs */}
        <div className="col-lg-5">
          <div className="card h-100 border-secondary bg-dark d-flex flex-column">
            <div className="card-header fw-bold bg-dark border-secondary d-flex justify-content-between align-items-center py-2">
              <div className="d-flex align-items-center">
                <i className="fa-solid fa-list-ul me-2"></i>Supervisor Logs
              </div>
              <div className="d-flex align-items-center gap-1">
                <button
                  type="button"
                  className="btn btn-xs btn-outline-secondary px-2 text-light d-inline-flex align-items-center justify-content-center"
                  style={{ fontSize: '0.72rem', height: '24px', lineHeight: 1 }}
                  onClick={handleCopyLogs}
                  title="Filtrelenmiş logları panoya kopyala"
                  disabled={filteredLogs.length === 0}
                >
                  <i className="fa-solid fa-copy me-1"></i>Copy
                </button>
                <div className="position-relative d-inline-flex align-items-center">
                  <button
                    type="button"
                    className={`btn btn-xs ${showExportMenu ? 'btn-secondary text-white' : 'btn-outline-secondary text-light'} px-2 d-inline-flex align-items-center justify-content-center`}
                    style={{ fontSize: '0.72rem', height: '24px', lineHeight: 1 }}
                    onClick={() => setShowExportMenu((prev) => !prev)}
                    title="Logları dışa aktar (.log veya .json)"
                    disabled={filteredLogs.length === 0}
                  >
                    <i className="fa-solid fa-download me-1"></i>Export<i className="fa-solid fa-caret-down ms-1" style={{ fontSize: '0.65rem' }}></i>
                  </button>
                  {showExportMenu && (
                    <div
                      className="position-absolute end-0 top-100 mt-1 py-1 rounded shadow bg-dark border border-secondary"
                      style={{ zIndex: 1050, minWidth: '170px' }}
                    >
                      <button
                        className="dropdown-item text-light px-3 py-1 small d-flex align-items-center"
                        style={{ cursor: 'pointer', background: 'transparent' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#2b3035')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        onClick={() => {
                          handleExportLogs('txt');
                          setShowExportMenu(false);
                        }}
                      >
                        <i className="fa-regular fa-file-lines me-2 text-info"></i>.log / .txt (Metin)
                      </button>
                      <button
                        className="dropdown-item text-light px-3 py-1 small d-flex align-items-center"
                        style={{ cursor: 'pointer', background: 'transparent' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#2b3035')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        onClick={() => {
                          handleExportLogs('json');
                          setShowExportMenu(false);
                        }}
                      >
                        <i className="fa-solid fa-code me-2 text-warning"></i>.json (Yapılandırılmış)
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Filter bar ── */}
            <div className="px-2 pt-2 pb-1 border-bottom border-secondary" style={{ background: '#1a1d21' }}>
              {/* Keyword search */}
              <div className="input-group input-group-sm mb-2">
                <span className="input-group-text bg-dark border-secondary text-muted">
                  <i className="fa-solid fa-magnifying-glass"></i>
                </span>
                <input
                  type="text"
                  className="form-control form-control-sm bg-dark text-light border-secondary"
                  placeholder="Search message or module…"
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                />
                {logSearch && (
                  <button
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => setLogSearch('')}
                    title="Clear search"
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                )}
              </div>

              {/* Level toggles */}
              <div className="d-flex flex-wrap gap-1 mb-2">
                {ALL_LEVELS.map((lvl) => {
                  const active = logLevels.includes(lvl);
                  const colorMap: Record<string, string> = {
                    DEBUG: 'secondary',
                    INFO: 'info',
                    WARNING: 'warning',
                    ERROR: 'danger',
                    CRITICAL: 'danger',
                  };
                  const color = colorMap[lvl] ?? 'secondary';
                  return (
                    <button
                      key={lvl}
                      className={`btn btn-xs py-0 px-2 ${
                        active ? `btn-${color}` : `btn-outline-${color}`
                      }`}
                      style={{ fontSize: '0.7rem' }}
                      onClick={() => toggleLevel(lvl)}
                      title={active ? `Hide ${lvl}` : `Show only ${lvl}`}
                    >
                      {lvl}
                    </button>
                  );
                })}
                {logLevels.length > 0 && (
                  <button
                    className="btn btn-xs py-0 px-2 btn-outline-light"
                    style={{ fontSize: '0.7rem' }}
                    onClick={() => setLogLevels([])}
                    title="Clear level filter"
                  >
                    All levels
                  </button>
                )}
              </div>

              {/* Date + optional time range (From / To side by side) */}
              <div className="row g-1 mb-1">
                <div className="col-6">
                  <label className="text-muted d-block mb-1 fw-semibold" style={{ fontSize: '0.65rem' }}>From</label>
                  <div className="d-flex gap-1">
                    <input
                      type="date"
                      className="form-control form-control-sm bg-dark text-light border-secondary px-1"
                      style={{ fontSize: '0.70rem', colorScheme: 'dark', flex: '1 1 58%' }}
                      value={logDateFrom}
                      onChange={(e) => setLogDateFrom(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleApplyDateFilter(); }}
                    />
                    <input
                      type="time"
                      className="form-control form-control-sm bg-dark text-light border-secondary px-1"
                      style={{ fontSize: '0.70rem', colorScheme: 'dark', flex: '1 1 42%' }}
                      value={logTimeFrom}
                      onChange={(e) => setLogTimeFrom(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleApplyDateFilter(); }}
                      placeholder="00:00"
                      title="Optional — defaults to 00:00:00"
                    />
                  </div>
                </div>
                <div className="col-6">
                  <label className="text-muted d-block mb-1 fw-semibold" style={{ fontSize: '0.65rem' }}>To</label>
                  <div className="d-flex gap-1">
                    <input
                      type="date"
                      className="form-control form-control-sm bg-dark text-light border-secondary px-1"
                      style={{ fontSize: '0.70rem', colorScheme: 'dark', flex: '1 1 58%' }}
                      value={logDateTo}
                      onChange={(e) => setLogDateTo(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleApplyDateFilter(); }}
                    />
                    <input
                      type="time"
                      className="form-control form-control-sm bg-dark text-light border-secondary px-1"
                      style={{ fontSize: '0.70rem', colorScheme: 'dark', flex: '1 1 42%' }}
                      value={logTimeTo}
                      onChange={(e) => setLogTimeTo(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleApplyDateFilter(); }}
                      placeholder="23:59"
                      title="Optional — defaults to 23:59:59"
                    />
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="d-flex gap-1 mt-1">
                <button
                  className="btn btn-sm btn-primary py-0 px-2 flex-grow-1"
                  style={{ fontSize: '0.72rem' }}
                  onClick={handleApplyDateFilter}
                  disabled={!logDateFrom && !logDateTo && !logTimeFrom && !logTimeTo}
                >
                  <i className="fa-solid fa-filter me-1"></i>Apply Filter
                </button>
                {hasDateOrTimeFilter && (
                  <button
                    className="btn btn-sm btn-outline-secondary py-0 px-2"
                    style={{ fontSize: '0.72rem' }}
                    onClick={handleClearDateFilter}
                    title="Clear date/time filter"
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                )}
                <button
                  className={`btn btn-sm ${testLogs.length > 0 ? 'btn-warning text-dark fw-semibold' : 'btn-outline-info'} py-0 px-2`}
                  style={{ fontSize: '0.70rem' }}
                  onClick={testLogs.length > 0 ? handleClearTestLogs : handleGenerateTestLogs}
                  title={testLogs.length > 0 ? "Clear test logs and return to live DAQ logs" : "Load 10 realistic test logs to test filtering"}
                >
                  <i className={`fa-solid ${testLogs.length > 0 ? 'fa-xmark' : 'fa-flask'} me-1`}></i>
                  {testLogs.length > 0 ? 'Clear Test' : 'Test Logs'}
                </button>
              </div>

              {/* Filter stats & Reset */}
              <div
                className="d-flex justify-content-between align-items-center mt-2 pt-1 px-1 border-top border-secondary text-muted"
                style={{ fontSize: '0.68rem' }}
              >
                <div>
                  <span>
                    Showing <strong>{filteredLogs.length}</strong> / <strong>{activeLogSource.length}</strong> logs
                  </span>
                  {testLogs.length > 0 && (
                    <span className="badge bg-warning text-dark ms-2" style={{ fontSize: '0.62rem' }}>
                      <i className="fa-solid fa-vial me-1"></i>Test Mode ({testLogs.length})
                    </span>
                  )}
                </div>
                {(logSearch || logLevels.length > 0 || hasDateOrTimeFilter) && (
                  <button
                    className="btn btn-link btn-xs text-danger text-decoration-none p-0"
                    style={{ fontSize: '0.68rem' }}
                    onClick={handleClearAllFilters}
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            </div>

            <div
              className="card-body p-0 flex-grow-1 position-relative"
              style={{ minHeight: '400px' }}
            >
              <div
                className="console-logs m-0 position-absolute top-0 start-0 w-100 h-100 border-0 rounded-0 overflow-auto"
                onScroll={handleLogsScroll}
              >
                {filteredLogs.map((l: LogEntry, i) => (
                  <div key={i} className="log-entry">
                    <small className="text-muted">[{l.timestamp}]</small>{' '}
                    <span className="text-info">[{l.module}]</span>{' '}
                    <span
                      className={`log-level log-level-${l.level.toLowerCase()}`}
                    >
                      {l.level}
                    </span>{' '}
                    <span className="log-message">{l.message}</span>
                  </div>
                ))}
                {filteredLogs.length === 0 && (
                  <span className="text-muted">
                    {activeLogSource.length === 0 ? 'No logs received.' : 'No logs match the current filters.'}
                  </span>
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
