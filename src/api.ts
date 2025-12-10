// --- API & DB SERVICE ---

export interface RunRecord {
  id: number;
  description: string;
  startTime: string;
  endTime?: string;
  status: 'RUNNING' | 'COMPLETED' | 'STOPPED';
  daqJobName?: string;
}

// Mock PostgreSQL Database
class MockDB {
  private runs: RunRecord[] = [];
  private nextId = 0;

  async createRun(description: string): Promise<RunRecord> {
    const run: RunRecord = {
      id: this.nextId++,
      description,
      startTime: new Date().toISOString(),
      status: 'RUNNING',
      daqJobName: `job-caen-run-${this.nextId}`, // Predictable job name
    };
    this.runs.unshift(run);
    return run;
  }

  async stopRun(id: number): Promise<void> {
    const run = this.runs.find((r) => r.id === id);
    if (run) {
      run.endTime = new Date().toISOString();
      run.status = 'COMPLETED';
    }
  }

  async getRuns(): Promise<RunRecord[]> {
    return [...this.runs];
  }
}

export const db = new MockDB();

// API Client
const API_BASE = 'http://localhost:5090';

// Mock Data for CNC
interface MockClient {
  status: 'online' | 'offline';
  jobs: Record<string, { type: string; status: string; pid: number }>;
}

export interface DAQJob {
  daq_job_type: string;
  daq_job_class_name: string;
  unique_id: string;
  instance_id: number;
  supervisor_info: {
    supervisor_id: string;
  };
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

const MOCK_CLIENTS: Record<string, MockClient> = {
  'cnc-server': {
    status: 'online',
    jobs: {
      'job-http': { type: 'DAQJobServeHTTP', status: 'running', pid: 101 },
    },
  },
  'cnc-client-1': {
    status: 'online',
    jobs: {
      // "job-caen-run-1001": { type: "DAQJobCAENDigitizer", status: "running", pid: 204 }
    },
  },
  'cnc-client-2': { status: 'offline', jobs: {} },
};

export class API {
  static useMock = false;

  static async getClients(): Promise<string[]> {
    if (this.useMock) return Object.keys(MOCK_CLIENTS);
    try {
      const res = await fetch(`${API_BASE}/clients`);
      if (!res.ok) throw new Error('API Error');
      const data = await res.json();
      return Object.keys(data);
    } catch (e) {
      console.warn('API unreachable, switching to Demo Mode');
      this.useMock = true;
      return Object.keys(MOCK_CLIENTS);
    }
  }

  static async pingClient(clientId: string): Promise<boolean> {
    if (this.useMock)
      return (
        MOCK_CLIENTS[clientId as keyof typeof MOCK_CLIENTS]?.status === 'online'
      );
    try {
      const res = await fetch(`${API_BASE}/clients/${clientId}/ping`, {
        method: 'POST',
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  static async getStatus(clientId: string): Promise<Record<string, any>> {
    if (this.useMock) {
      const clientMock = MOCK_CLIENTS[clientId as keyof typeof MOCK_CLIENTS];
      if (!clientMock) return { jobs: {} };

      const jobs = clientMock.jobs || {};
      const jobMap: Record<string, any> = {};
      Object.entries(jobs).forEach(([k, v]) => {
        jobMap[k] = { name: k, ...v };
      });
      return { jobs: jobMap };
    }
    const res = await fetch(`${API_BASE}/clients/${clientId}/status`);
    return await res.json();
  }

  static async getLogs(clientId: string): Promise<any[]> {
    if (this.useMock) {
      const timestamp = new Date().toISOString();
      return [
        {
          type: 'CNCMessageLog',
          level: 'INFO',
          message: 'Received ping, sending pong.',
          timestamp: timestamp,
          module: 'enrgdaq.cnc.base.SupervisorCNC',
          client_id: clientId,
          req_id: null,
        },
      ];
    }
    const res = await fetch(`${API_BASE}/clients/${clientId}/logs`);
    return (await res.json())['logs'];
  }

  static async runJob(clientId: string, config: string) {
    if (this.useMock) {
      // Parse config to get job type for mock
      const typeMatch = config.match(/daq_job_type\s*=\s*"([^"]+)"/);
      const type = typeMatch ? typeMatch[1] : 'Unknown';

      // Add to mock
      // We need to guess the name from how we construct configs or just generate one
      // In this demo we assume the run logic handles naming, but for general custom jobs:
      const mockName = `custom-job-${Date.now()}`;
      if (MOCK_CLIENTS[clientId as keyof typeof MOCK_CLIENTS]) {
        const client = MOCK_CLIENTS[clientId as keyof typeof MOCK_CLIENTS];
        if (client && client.jobs) {
          client.jobs[mockName] = {
            type,
            status: 'running',
            pid: Math.floor(Math.random() * 1000),
          };
        }
      }
      return;
    }
    await fetch(`${API_BASE}/clients/${clientId}/run_custom_daqjob`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config }),
    });
  }

  static async stopJob(clientId: string, jobName: string) {
    if (this.useMock) {
      if (MOCK_CLIENTS[clientId as keyof typeof MOCK_CLIENTS]?.jobs[jobName]) {
        delete MOCK_CLIENTS[clientId as keyof typeof MOCK_CLIENTS].jobs[
          jobName
        ];
      }
      return;
    }
    await fetch(`${API_BASE}/clients/${clientId}/stop_daqjob`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ daq_job_name: jobName, remove: true }),
    });
  }

  static async restartDaq(clientId: string) {
    if (this.useMock) return;
    await fetch(`${API_BASE}/clients/${clientId}/restart_daq`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ update: false }),
    });
  }

  static async stopAllJobs(clientId: string) {
    if (this.useMock) {
      if (MOCK_CLIENTS[clientId as keyof typeof MOCK_CLIENTS]) {
        MOCK_CLIENTS[clientId as keyof typeof MOCK_CLIENTS].jobs = {};
      }
      return;
    }
    await fetch(`${API_BASE}/clients/${clientId}/stop_daqjobs`, {
      method: 'POST',
    });
  }
}

// Helper to generate CAEN config
export const generateCaenConfig = (
  runId: number
) => `daq_job_type = "DAQJobCAENDigitizer"
# --- Auto-generated for Run ${runId} ---

# Connection
connection_type = "OPTICAL_LINK"
link_number = "1"
conet_node = 0
vme_base_address = 0

# Channels
channel_enable_mask = 0b11
record_length = 2048
acquisition_mode = "SW_CONTROLLED"

# Triggers
sw_trigger_mode = "ACQ_ONLY"
channel_self_trigger_threshold = 600
peak_threshold = 600

# Storage (DB Linked)
[waveform_store_config.raw]
file_path = "runs/${runId}/caen_digitizer_waveforms.raw"
add_date = true
overwrite = true

[stats_store_config.csv]
file_path = "runs/${runId}/caen_digitizer_stats.csv"
add_date = true
overwrite = true
`;
