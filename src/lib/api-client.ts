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
  source: string;
  editable: boolean;
}

const api = axios.create({
  baseURL: '/api',
});

export const API = {
  async getClients(): Promise<string[]> {
    const { data } = await api.get('/clients');
    return data;
  },

  async getRuns(): Promise<Run[]> {
    const { data } = await api.get('/runs');
    return data;
  },

  async startRun(description: string, clientId: string): Promise<Run> {
    const { data } = await api.post('/runs', { description, clientId });
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

  async createTemplate(createData: { name: string; displayName: string; config: string }): Promise<Template> {
    const { data } = await api.post('/templates', createData);
    return data;
  },

  async updateTemplate(id: number, updateData: { displayName?: string; config?: string }): Promise<Template> {
    const { data } = await api.put(`/templates/${id}`, updateData);
    return data;
  },

  async deleteTemplate(id: number): Promise<void> {
    await api.delete(`/templates/${id}`);
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
  
  async stopJob(clientId: string, jobName: string) {
      await api.post(`/clients/${clientId}/stop_daqjob`, { daq_job_name: jobName });
  },

  async getDAQJobSchemas(): Promise<Record<string, unknown>> {
    const { data } = await api.get('/templates/daqjobs');
    return data;
  },
};
