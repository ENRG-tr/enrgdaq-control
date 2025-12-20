export interface Run {
  id: number;
  description: string;
  startTime: Date;
  endTime: Date | null;
  scheduledEndTime: Date | null;
  status: string;
  daqJobIds: string[] | null;
  config: string | null;
  clientId: string | null;
  runTypeId: number | null;
}

export interface DAQJobInfo {
  daq_job_type: string;
  unique_id: string;
  config: Record<string, unknown>;
  is_alive: boolean;
  is_running: boolean;
  restart_on_fail?: boolean;
}

export interface SupervisorInfo {
  supervisor_config: {
    supervisor_sleep_amount?: number;
    daq_job_stats_interval?: number;
  };
  supervisor_tags?: string[];
}

export interface ClientStatus {
  daq_jobs: DAQJobInfo[];
  info: SupervisorInfo;
}

export interface Client {
  id: string;
  tags: string[];
}

export interface LogEntry {
  type: string;
  level: string;
  message: string;
  timestamp: string;
  module: string;
  client_id: string;
  req_id: string | null;
}

// Template update data type (to replace `any` in updateTemplate)
export interface TemplateUpdateData {
  displayName?: string;
  config?: string;
  type?: string;
  runTypeIds?: number[];
  messageType?: string;
  payloadTemplate?: string;
  targetDaqJobType?: string | null;
  defaultClientId?: string | null;
  updatedAt?: Date;
}
