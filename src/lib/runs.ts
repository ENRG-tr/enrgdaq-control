import { db } from './db';
import { runs, type Run, type NewRun } from './schema';
import { eq, desc } from 'drizzle-orm';
import { ENRGDAQClient } from './enrgdaq-client';

export class RunController {
  
  static async getAllRuns(): Promise<Run[]> {
    return await db.select().from(runs).orderBy(desc(runs.id));
  }

  static async getActiveRun(): Promise<Run | null> {
    const result = await db.select().from(runs).where(eq(runs.status, 'RUNNING')).limit(1);
    return result[0] || null;
  }

  static async startRun(description: string, clientId: string): Promise<Run> {
    // 1. Check if run exists
    const existing = await this.getActiveRun();
    if (existing) {
      throw new Error('A run is already in progress');
    }

    // 2. Create Run Entry (to get ID)
    const [run] = await db.insert(runs).values({
      description,
      status: 'RUNNING',
      clientId,
    }).returning();

    // 3. Generate Config
    const daqJobName = `caen-run-${run.id}`;
    const config = this.generateCaenConfig(run.id, daqJobName);

    // 4. Update Run with Config
    await db.update(runs)
      .set({ config, daqJobName })
      .where(eq(runs.id, run.id));

    // 5. Start Job on CNC
    try {
      await ENRGDAQClient.runJob(clientId, config);
    } catch (e) {
      // Rollback status if failed
      await db.update(runs)
        .set({ status: 'STOPPED', endTime: new Date() })
        .where(eq(runs.id, run.id));
      throw e;
    }

    return { ...run, config, daqJobName };
  }

  static async stopRun(runId: number, clientId: string): Promise<void> {
    const [run] = await db.select().from(runs).where(eq(runs.id, runId)).limit(1);
    
    if (!run || run.status !== 'RUNNING') return;

    // Stop Job
    if (run.daqJobName) {
      try {
        await ENRGDAQClient.stopJob(clientId, run.daqJobName);
      } catch (e) {
        console.error('Failed to stop job remotely, but marking local run as stopped', e);
      }
    }

    // Update DB
    await db.update(runs)
      .set({ status: 'COMPLETED', endTime: new Date() })
      .where(eq(runs.id, runId));
  }

  private static generateCaenConfig(runId: number, jobName: string): string {
    return `daq_job_type = "DAQJobCAENDigitizer"
# --- Auto-generated for Run ${runId} ---
# Job Name: ${jobName}

# Connection
connection_type = "OPTICAL_LINK"
link_number = "1"
conet_node = 0
vme_base_address = 0

# Channels
channel_enable_mask = 0b11
record_length = 2048
acquisition_mode = "SW_CONTROLLED"

# Triggers
sw_trigger_mode = "ACQ_ONLY"
channel_self_trigger_threshold = 600
peak_threshold = 600

# Storage
[waveform_store_config.raw]
file_path = "runs/${runId}/caen_digitizer_waveforms.raw"
add_date = true
overwrite = true

[stats_store_config.csv]
file_path = "runs/${runId}/caen_digitizer_stats.csv"
add_date = true
overwrite = true
`;
  }
}
