import { AxiosError } from 'axios';
import { ENRGDAQClient } from './enrgdaq-client';

class PollingService {
  private static instance: PollingService;
  private statusCache: Map<string, any> = new Map();
  private logsCache: Map<string, any[]> = new Map();
  private isPolling = false;
  private clients: string[] = [];

  private constructor() {}

  public static getInstance(): PollingService {
    if (!PollingService.instance) {
      PollingService.instance = new PollingService();
    }
    return PollingService.instance;
  }

  public getStatus(clientId: string) {
    if (!this.isPolling) this.startPolling();
    return this.statusCache.get(clientId) || null;
  }

  public getLogs(clientId: string) {
    if (!this.isPolling) this.startPolling();
    return this.logsCache.get(clientId) || [];
  }

  public startPolling() {
    if (this.isPolling) return;
    this.isPolling = true;
    console.log('[PollingService] Starting service...');
    this.pollClients();
    this.pollData();
  }

  private async pollClients() {
    while (this.isPolling) {
      try {
        const clients = await ENRGDAQClient.getClients();
        // Only update if changed to avoid unnecessary churn?
        // Actually strings comparison is cheap.
        this.clients = clients.map((client) => client.id);
      } catch (error) {
        console.error('[PollingService] Error polling clients:', error);
      }
      // Poll clients list every 5 seconds
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  private async pollData() {
    while (this.isPolling) {
      // Create a snapshot of clients to iterate over
      const currentClients = [...this.clients];

      if (currentClients.length > 0) {
        await Promise.all(
          currentClients.map(async (clientId) => {
            try {
              const status = await ENRGDAQClient.getStatus(clientId);
              this.statusCache.set(clientId, status);

              const logs = await ENRGDAQClient.getLogs(clientId);
              this.logsCache.set(clientId, logs);
            } catch (error) {
              if (error instanceof AxiosError) {
                // Ignore if 504 error, which means we had a timeout
                if (error.response?.status === 504) {
                  return;
                }
              }
              console.error(
                `[PollingService] Error polling data for ${clientId}:`,
                error
              );
              // Optionally mark client as offline in cache?
              // For now, we keep the last known state or rely on the frontend handling stale/null.
            }
          })
        );
      }

      // Wait 1 second before next cycle
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

// Global persistence for dev mode to prevent multiple pollers on HMR
const globalForPolling = global as unknown as {
  pollingService: PollingService;
};

export const pollingService =
  globalForPolling.pollingService || PollingService.getInstance();

if (process.env.NODE_ENV !== 'production')
  globalForPolling.pollingService = pollingService;
