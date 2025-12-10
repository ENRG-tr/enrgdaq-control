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

const NEXT_JS_API_BASE = '/api';
const ENRGDAQ_API_BASE = process.env.ENRGDAQ_API_BASE || 'http://localhost:5090';

export const API = {
  async getClients(): Promise<string[]> {
    const res = await fetch(`${NEXT_JS_API_BASE}/clients`);
    return res.json();
  },

  async getRuns(): Promise<Run[]> {
    const res = await fetch(`${NEXT_JS_API_BASE}/runs`);
    return res.json();
  },

  async startRun(description: string, clientId: string): Promise<Run> {
    const res = await fetch(`${NEXT_JS_API_BASE}/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description, clientId }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async stopRun(runId: number, clientId: string): Promise<void> {
    const res = await fetch(`${NEXT_JS_API_BASE}/runs/${runId}/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId }),
    });
    if (!res.ok) throw new Error(await res.text());
  },

  // Templates
  async getTemplates(): Promise<Template[]> {
    const res = await fetch(`${NEXT_JS_API_BASE}/templates`);
    return res.json();
  },

  async createTemplate(data: { name: string; displayName: string; config: string }): Promise<Template> {
    const res = await fetch(`${NEXT_JS_API_BASE}/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async updateTemplate(id: number, data: { displayName?: string; config?: string }): Promise<Template> {
    const res = await fetch(`${NEXT_JS_API_BASE}/templates/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async deleteTemplate(id: number): Promise<void> {
    const res = await fetch(`${NEXT_JS_API_BASE}/templates/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(await res.text());
  },
  
  async getStatus(clientId: string) {
     const res = await fetch(`${ENRGDAQ_API_BASE}/clients/${clientId}/status`);
     return res.json();
  },

  async getLogs(clientId: string) {
      const res = await fetch(`${ENRGDAQ_API_BASE}/clients/${clientId}/logs`);
      const data = await res.json();
      return data.logs;
  },

  async restartDaq(clientId: string) {
      await fetch(`${ENRGDAQ_API_BASE}/clients/${clientId}/restart_daq`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ update: false }),
      });
  },

  async stopAllJobs(clientId: string) {
      await fetch(`${ENRGDAQ_API_BASE}/clients/${clientId}/stop_daqjobs`, { method: 'POST' });
  },

  async runJob(clientId: string, config: string) {
      await fetch(`${ENRGDAQ_API_BASE}/clients/${clientId}/run_custom_daqjob`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ config }),
      });
  },
  
  async stopJob(clientId: string, jobName: string) {
      await fetch(`${ENRGDAQ_API_BASE}/clients/${clientId}/stop_daqjob`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ daq_job_name: jobName, remove: true }),
      });
  }
};
