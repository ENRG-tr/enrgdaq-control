export class ENRGDAQClient {
  private static API_BASE = 'http://localhost:5090';

  static async getClients(): Promise<string[]> {
    try {
      const res = await fetch(`${this.API_BASE}/clients`);
      if (!res.ok) throw new Error('Failed to fetch clients');
      const data = await res.json();
      return Object.keys(data);
    } catch (e) {
      console.error('Error fetching clients:', e);
      return [];
    }
  }

  static async runJob(clientId: string, config: string) {
    const res = await fetch(`${this.API_BASE}/clients/${clientId}/run_custom_daqjob`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config }),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to run job: ${text}`);
    }
  }

  static async stopJob(clientId: string, jobName: string) {
    const res = await fetch(`${this.API_BASE}/clients/${clientId}/stop_daqjob`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ daq_job_name: jobName, remove: true }),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to stop job: ${text}`);
    }
  }
}
