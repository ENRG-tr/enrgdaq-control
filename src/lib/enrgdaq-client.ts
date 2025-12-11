import axios from 'axios';

const api = axios.create({
  baseURL: process.env.ENRGDAQ_API_BASE || 'http://localhost:5090',
});

export class ENRGDAQClient {
  static async getClients(): Promise<string[]> {
    try {
      const { data } = await api.get('/clients');
      return Object.keys(data);
    } catch (e) {
      console.error('Error fetching clients:', e);
      return [];
    }
  }

  static async getStatus(clientId: string) {
    const { data } = await api.get(`/clients/${clientId}/status`);
    return data;
  }

  static async getLogs(clientId: string) {
    const { data } = await api.get(`/clients/${clientId}/logs`);
    return data.logs;
  }

  static async restartDaq(clientId: string) {
    await api.post(`/clients/${clientId}/restart_daq`, { update: false });
  }

  static async stopAllJobs(clientId: string) {
    await api.post(`/clients/${clientId}/stop_daqjobs`);
  }

  static async runJob(clientId: string, config: string) {
    try {
      await api.post(`/clients/${clientId}/run_custom_daqjob`, { config });
    } catch (e: any) {
       throw new Error(`Failed to run job: ${e.response?.data || e.message}`);
    }
  }

  static async stopJob(clientId: string, jobName: string) {
    try {
        await api.post(`/clients/${clientId}/stop_daqjob`, { daq_job_name: jobName, remove: true });
    } catch (e: any) {
        throw new Error(`Failed to stop job: ${e.response?.data || e.message}`);
    }
  }

  static async getDAQJobSchemas(): Promise<Record<string, unknown>> {
    const { data } = await api.get('/templates/daqjobs');
    return data;
  }
}
