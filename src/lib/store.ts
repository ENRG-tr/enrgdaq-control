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
  runsTotal: number;
  runsPage: number;
  runsLimit: number;
  activeRun: Run | null;
  runTypes: RunType[];

  // Actions
  fetchClients: () => Promise<void>;
  selectClient: (id: string) => void;
  pollClientStatus: () => Promise<void>;

  startRun: (description: string, runTypeId?: number) => Promise<void>;
  stopRun: () => Promise<void>;
  fetchRuns: () => Promise<void>;
  setRunsPage: (page: number) => void;
  fetchRunTypes: () => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  clients: [],
  selectedClient: null,
  clientStatus: null,
  clientOnline: false,
  logs: [],

  runs: [],
  runsTotal: 0,
  runsPage: 1,
  runsLimit: 10,
  activeRun: null,
  runTypes: [],

  fetchClients: async () => {
    try {
      const clients = await API.getClients();
      set({ clients });
      if (!get().selectedClient && clients.length > 0) {
        set({ selectedClient: clients[0] });
      }
    } catch (e) {
      console.error('Failed to fetch clients', e);
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

      // Also refresh runs periodically to check status updates?
      // Actually fetchRuns is called manually or by actions.
      // Polling dashboard usually refreshes runs too or we rely on websockets/events?
      // The existing code did NOT poll fetchRuns inside pollClientStatus, so I leave it.
    } catch (e) {
      set({ clientOnline: false, clientStatus: null });
    }
  },

  fetchRuns: async () => {
    const { runsPage, runsLimit } = get();
    try {
      const { runs, total, activeRun } = await API.getRuns(runsPage, runsLimit);
      set({ runs, runsTotal: total, activeRun });
    } catch (e) {
      console.error('Failed to fetch runs', e);
    }
  },

  setRunsPage: (page: number) => {
    set({ runsPage: page });
    get().fetchRuns();
  },

  fetchRunTypes: async () => {
    try {
      const runTypes = await API.getRunTypes();
      set({ runTypes });
    } catch (e) {
      console.error('Failed to fetch run types', e);
    }
  },

  startRun: async (description: string, runTypeId?: number) => {
    const { selectedClient } = get();
    if (!selectedClient) throw new Error('No client selected');
    await API.startRun(description, selectedClient, runTypeId);
    set({ runsPage: 1 }); // Reset to first page on new run
    await get().fetchRuns();
  },

  stopRun: async () => {
    const { activeRun, selectedClient } = get();
    if (!activeRun || !selectedClient) return;
    await API.stopRun(activeRun.id, selectedClient);
    await get().fetchRuns();
  },
}));
