import axios from 'axios';

const api = axios.create({
  baseURL: process.env.ENRGDAQ_API_BASE || 'http://localhost:5090',
});

export class ENRGDAQClient {
  static async getClients(): Promise<{ id: string; tags: string[] }[]> {
    try {
      const { data } = await api.get('/clients');
      return Object.entries(data).map(([key, value]: [string, any]) => ({
        id: key,
        tags: value?.info?.supervisor_tags || [],
      }));
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

  static async stopJob(clientId: string, uniqueId: string, remove: boolean) {
    try {
      await api.post(`/clients/${clientId}/stop_daqjob`, {
        daq_job_unique_id: uniqueId,
        remove,
      });
    } catch (e: any) {
      throw new Error(`Failed to stop job: ${e.response?.data || e.message}`);
    }
  }

  static async getDAQJobSchemas(): Promise<Record<string, unknown>> {
    const { data } = await api.get('/templates/daqjobs');
    return data;
  }

  /**
   * Get message schemas from ENRGDAQ API
   * Returns available message types and their JSON schemas
   */
  static async getMessageSchemas(): Promise<Record<string, unknown>> {
    const { data } = await api.get('/templates/messages');
    return data;
  }

  /**
   * Send a message to a specific DAQ job or broadcast to all jobs
   * @param clientId - The client/supervisor ID
   * @param messageType - The message type (e.g., 'DAQJobMessageStop')
   * @param payload - The JSON payload string
   * @param targetDaqJobUniqueId - Optional target DAQ job unique ID (null = broadcast)
   */
  static async sendMessage(
    clientId: string,
    messageType: string,
    payload: string,
    targetDaqJobUniqueId?: string | null
  ): Promise<void> {
    try {
      await api.post(`/clients/${clientId}/send_message`, {
        message_type: messageType,
        payload: payload,
        target_daq_job_unique_id: targetDaqJobUniqueId || null,
      });
    } catch (e: any) {
      throw new Error(
        `Failed to send message: ${e.response?.data || e.message}`
      );
    }
  }
}
