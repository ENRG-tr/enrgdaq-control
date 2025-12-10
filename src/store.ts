import { create } from 'zustand';
import {
  API,
  db,
  type RunRecord,
  generateCaenConfig,
  type LogEntry,
} from './api';

interface AppState {
  // Client State
  clients: string[];
  selectedClient: string | null;
  clientStatus: any;
  clientOnline: boolean;
  logs: LogEntry[];

  // Run State
  runs: RunRecord[];
  activeRun: RunRecord | null;

  // Actions
  fetchClients: () => Promise<void>;
  selectClient: (id: string) => void;
  pollClientStatus: () => Promise<void>;

  startRun: (description: string) => Promise<void>;
  stopRun: () => Promise<void>;
  fetchRuns: () => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  clients: [],
  selectedClient: null,
  clientStatus: null,
  clientOnline: false,
  logs: [],

  runs: [],
  activeRun: null,

  fetchClients: async () => {
    const clients = await API.getClients();
    set({ clients });
    if (!get().selectedClient && clients.length > 0) {
      set({ selectedClient: clients[0] });
    }
  },

  selectClient: (id: string) => {
    set({ selectedClient: id, logs: [] });
    // Trigger immediate poll
    get().pollClientStatus();
  },

  pollClientStatus: async () => {
    const { selectedClient } = get();
    if (!selectedClient) return;

    const online = await API.pingClient(selectedClient);
    set({ clientOnline: online });

    if (online) {
      const status = await API.getStatus(selectedClient);
      const newLogs = await API.getLogs(selectedClient);

      set(() => ({
        clientStatus: status,
        logs: newLogs,
      }));
    } else {
      set({ clientStatus: null });
    }
  },

  fetchRuns: async () => {
    const runs = await db.getRuns();
    // Check if we have a locally known running run
    const running = runs.find((r) => r.status === 'RUNNING');
    set({ runs, activeRun: running || null });
  },

  startRun: async (description: string) => {
    const { selectedClient, clientOnline } = get();
    if (!selectedClient || !clientOnline) throw new Error('No client online');

    // 1. Create DB Entry
    const run = await db.createRun(description);

    // 2. Generate Config
    const config = generateCaenConfig(run.id);

    // 3. Launch Job
    await API.runJob(selectedClient, config);

    // 4. Update State
    await get().fetchRuns();
  },

  stopRun: async () => {
    const { activeRun, selectedClient } = get();
    if (!activeRun || !selectedClient) return;

    // 1. Stop Job
    // We try to stop the job that corresponds to this run.
    // In a real system, we'd track the pid or the exact name assigned by Supervisor.
    // Here we use our naming convention or just stop 'DAQJobCAENDigitizer'

    // Attempt to stop by convention name (Simulated)
    // Also try to stop any DAQJobCAENDigitizer for safety in this demo
    const status = get().clientStatus;
    if (status && status.jobs) {
      const caenJob = Object.entries(status.jobs).find(
        ([, v]: [string, any]) => v.type === 'DAQJobCAENDigitizer'
      );
      if (caenJob) {
        await API.stopJob(selectedClient, caenJob[0]);
      }
    }

    // 2. Update DB
    await db.stopRun(activeRun.id);

    // 3. Update State
    await get().fetchRuns();
  },
}));
