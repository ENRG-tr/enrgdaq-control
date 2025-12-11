import { create } from 'zustand';
import { API, type LogEntry, type RunType } from './api-client';
import type { Run } from './types';

interface AppState {
  // Client State
  clients: string[];
  selectedClient: string | null;
  clientStatus: any;
  clientOnline: boolean;
  logs: LogEntry[];

  // Run State
  runs: Run[];
  activeRun: Run | null;
  runTypes: RunType[];

  // Actions
  fetchClients: () => Promise<void>;
  selectClient: (id: string) => void;
  pollClientStatus: () => Promise<void>;

  startRun: (description: string, runTypeId?: number) => Promise<void>;
  stopRun: () => Promise<void>;
  fetchRuns: () => Promise<void>;
  fetchRunTypes: () => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  clients: [],
  selectedClient: null,
  clientStatus: null,
  clientOnline: false,
  logs: [],

  runs: [],
  activeRun: null,
  runTypes: [],

  fetchClients: async () => {
    try {
        const clients = await API.getClients();
        set({ clients });
        if (!get().selectedClient && clients.length > 0) {
        set({ selectedClient: clients[0] });
        }
    } catch(e) {
        console.error("Failed to fetch clients", e);
    }
  },

  selectClient: (id: string) => {
    set({ selectedClient: id, logs: [] });
    get().pollClientStatus();
  },

  pollClientStatus: async () => {
    const { selectedClient } = get();
    if (!selectedClient) return;

    try {
        // Simple ping check via status
        const status = await API.getStatus(selectedClient);
        const newLogs = await API.getLogs(selectedClient);
        set({ clientOnline: true, clientStatus: status, logs: newLogs });
    } catch (e) {
        set({ clientOnline: false, clientStatus: null });
    }
  },

  fetchRuns: async () => {
    try {
        const runs = await API.getRuns();
        const running = runs.find((r) => r.status === 'RUNNING');
        set({ runs, activeRun: running || null });
    } catch(e) {
        console.error("Failed to fetch runs", e);
    }
  },

  fetchRunTypes: async () => {
    try {
        const runTypes = await API.getRunTypes();
        set({ runTypes });
    } catch(e) {
        console.error("Failed to fetch run types", e);
    }
  },

  startRun: async (description: string, runTypeId?: number) => {
    const { selectedClient } = get();
    if (!selectedClient) throw new Error('No client selected');
    await API.startRun(description, selectedClient, runTypeId);
    await get().fetchRuns();
  },

  stopRun: async () => {
    const { activeRun, selectedClient } = get();
    if (!activeRun || !selectedClient) return;
    await API.stopRun(activeRun.id, selectedClient);
    await get().fetchRuns();
  },
}));
