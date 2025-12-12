import axios from 'axios';
import { type Run } from './schema';

export interface LogEntry {
  type: string;
  level: string;
  message: string;
  timestamp: string;
  module: string;
  client_id: string;
  req_id: string | null;
}

export interface Template {
  id: number;
  name: string;
  displayName: string;
  config: string;
  type: string;
  editable: boolean;
  runTypeIds: number[];
}

export interface RunType {
  id: number;
  name: string;
  description: string | null;
  requiredTags: string[] | null;
}

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
const api = axios.create({
  baseURL: basePath + '/api',
});

export const API = {
  async getClients(): Promise<{ id: string; tags: string[] }[]> {
    const { data } = await api.get('/clients');
    return data;
  },

  async getRuns(
    page: number = 1,
    limit: number = 10
  ): Promise<{ runs: Run[]; total: number; activeRun: Run | null }> {
    const { data } = await api.get('/runs', { params: { page, limit } });
    return data;
  },

  async getRunTypes(): Promise<RunType[]> {
    const { data } = await api.get('/run-types');
    return data;
  },

  async createRunType(createData: {
    name: string;
    description?: string;
    requiredTags?: string[];
  }): Promise<RunType> {
    const { data } = await api.post('/run-types', createData);
    return data;
  },

  async updateRunType(
    id: number,
    updateData: { name?: string; description?: string; requiredTags?: string[] }
  ): Promise<RunType> {
    const { data } = await api.post(`/run-types/${id}/update`, updateData);
    return data;
  },

  async deleteRunType(id: number): Promise<void> {
    await api.post(`/run-types/${id}/delete`);
  },

  async startRun(
    description: string,
    clientId: string,
    runTypeId?: number
  ): Promise<Run> {
    const { data } = await api.post('/runs', {
      description,
      clientId,
      runTypeId,
    });
    return data;
  },

  async stopRun(runId: number, clientId: string): Promise<void> {
    await api.post(`/runs/${runId}/stop`, { clientId });
  },

  // Templates
  async getTemplates(): Promise<Template[]> {
    const { data } = await api.get('/templates');
    return data;
  },

  async createTemplate(createData: {
    name: string;
    displayName: string;
    config: string;
    runTypeIds?: number[];
  }): Promise<Template> {
    const { data } = await api.post('/templates', createData);
    return data;
  },

  async updateTemplate(
    id: number,
    updateData: { displayName?: string; config?: string; runTypeIds?: number[] }
  ): Promise<Template> {
    const { data } = await api.post(`/templates/${id}/update`, updateData);
    return data;
  },

  async deleteTemplate(id: number): Promise<void> {
    await api.post(`/templates/${id}/delete`);
  },

  async getStatus(clientId: string) {
    const { data } = await api.get(`/clients/${clientId}/status`);
    return data;
  },

  async getLogs(clientId: string) {
    const { data } = await api.get(`/clients/${clientId}/logs`);
    return data.logs;
  },

  async restartDaq(clientId: string) {
    await api.post(`/clients/${clientId}/restart_daq`);
  },

  async stopAllJobs(clientId: string) {
    await api.post(`/clients/${clientId}/stop_daqjobs`);
  },

  async runJob(clientId: string, config: string) {
    await api.post(`/clients/${clientId}/run_custom_daqjob`, { config });
  },

  async stopJob(clientId: string, uniqueId: string, remove: boolean = false) {
    await api.post(`/clients/${clientId}/stop_daqjob`, {
      daq_job_unique_id: uniqueId,
      remove,
    });
  },

  async getDAQJobSchemas(): Promise<Record<string, unknown>> {
    const { data } = await api.get('/templates/daqjobs');
    return data;
  },
};
