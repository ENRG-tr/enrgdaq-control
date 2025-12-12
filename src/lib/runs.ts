import { db } from './db';
import {
  runs,
  templates,
  templateRunTypes,
  type Run,
  type NewRun,
} from './schema';
import { eq, desc, and, count } from 'drizzle-orm';
import { ENRGDAQClient } from './enrgdaq-client';

const RUN_CONTROLLER_RUN_ALIVE_AFTER_MS = 2000;

export class RunController {
  static async getAllRuns(
    limit: number = 20,
    offset: number = 0
  ): Promise<{ runs: Run[]; total: number; activeRun: Run | null }> {
    // Check liveness of any locally RUNNING run before returning
    const activeRun = await this.getActiveRun(); // This triggers the check

    const [totalResult] = await db.select({ count: count() }).from(runs);
    const total = totalResult?.count || 0;

    const data = await db
      .select()
      .from(runs)
      .orderBy(desc(runs.id))
      .limit(limit)
      .offset(offset);

    return { runs: data, total, activeRun };
  }

  static async getActiveRun(): Promise<Run | null> {
    const result = await db
      .select()
      .from(runs)
      .where(eq(runs.status, 'RUNNING'))
      .limit(1);
    const run = result[0] || null;

    if (run) {
      // Verify liveness
      try {
        // If we don't know the client ID, we can't check.
        if (!run.clientId) return run;

        const status = await ENRGDAQClient.getStatus(run.clientId);
        const activeJobIds =
          status?.daq_jobs.map((job: any) => job.unique_id) || [];

        let expectedJobIds: string[] = [];
        if (run.daqJobIds && Array.isArray(run.daqJobIds)) {
          expectedJobIds = run.daqJobIds as string[];
        }

        // Check if ALL expected jobs are active
        const allActive =
          expectedJobIds.length > 0 &&
          expectedJobIds.every((id) => activeJobIds.includes(id));
        if (
          !allActive &&
          expectedJobIds.length > 0 &&
          new Date().getTime() - run.startTime.getTime() >
            RUN_CONTROLLER_RUN_ALIVE_AFTER_MS
        ) {
          // Run is effectively done (or crashed)
          console.log(
            `Run ${run.id} jobs are no longer active. Marking as COMPLETED. ${expectedJobIds} vs ${activeJobIds}`
          );
          await db
            .update(runs)
            .set({ status: 'COMPLETED', endTime: new Date() })
            .where(eq(runs.id, run.id));
          return null; // No longer active
        }
      } catch (e) {
        console.warn(`Failed to verify run ${run.id} liveness:`, e);
      }
    }

    return run;
  }

  static async startRun(
    description: string,
    clientId: string,
    runTypeId: number
  ): Promise<Run> {
    // 1. Check if run exists
    const existing = await this.getActiveRun();
    if (existing) {
      throw new Error('A run is already in progress');
    }

    // 2. Create Run Entry (to get ID)
    const [run] = await db
      .insert(runs)
      .values({
        description,
        status: 'RUNNING',
        clientId,
        runTypeId: runTypeId || null,
      })
      .returning();

    // 3. Generate Configs from Templates
    const runConfigs = await this.generateRunConfigs(run.id, runTypeId);

    if (runConfigs.length === 0) {
      console.warn(
        `No templates with type="run" found for Run ${run.id} (RunType: ${runTypeId})`
      );
    }

    const jobNames: string[] = [];
    const fullConfigDrafts: string[] = [];

    // 5. Start Jobs on CNC
    try {
      for (const rc of runConfigs) {
        const uniqueJobName = `${rc.name}_run-${run.id}_${Date.now()}`;
        const configWithUtf8 =
          `daq_job_unique_id = "${uniqueJobName}"\n` + rc.config;

        await ENRGDAQClient.runJob(clientId, configWithUtf8);

        jobNames.push(uniqueJobName);
        fullConfigDrafts.push(configWithUtf8);
      }
    } catch (e) {
      console.error('Failed to start one or more jobs:', e);
      if (jobNames.length > 0) {
        try {
          await Promise.all(
            jobNames.map((name) => ENRGDAQClient.stopJob(clientId, name, true))
          );
        } catch (cleanupErr) {
          console.error(
            'Failed to cleanup started jobs after error:',
            cleanupErr
          );
        }
      }

      await db
        .update(runs)
        .set({ status: 'STOPPED', endTime: new Date() })
        .where(eq(runs.id, run.id));
      throw e;
    }

    // Store as JSON column (jobNames array)
    // and combined config
    const config = fullConfigDrafts.join('\n\n# -- NEXT JOB --\n\n');

    // 4. Update Run with Config
    await db
      .update(runs)
      .set({ config, daqJobIds: jobNames })
      .where(eq(runs.id, run.id));

    return { ...run, config, daqJobIds: jobNames };
  }

  static async stopRun(runId: number, clientId: string): Promise<void> {
    const [run] = await db
      .select()
      .from(runs)
      .where(eq(runs.id, runId))
      .limit(1);

    if (!run || run.status !== 'RUNNING') return;

    // Stop Job(s)
    let jobNames: string[] = [];

    // Use JSON column if available
    if (run.daqJobIds && Array.isArray(run.daqJobIds)) {
      jobNames = run.daqJobIds as string[];
    }

    if (jobNames.length > 0) {
      try {
        await Promise.all(
          jobNames.map((name) =>
            ENRGDAQClient.stopJob(clientId, name, true).catch((e) =>
              console.error(`Failed to stop job ${name}`, e)
            )
          )
        );
      } catch (e) {
        console.error('Failed to stop jobs', e);
      }
    }

    // Update DB
    await db
      .update(runs)
      .set({ status: 'COMPLETED', endTime: new Date() })
      .where(eq(runs.id, runId));
  }

  private static async generateRunConfigs(
    runId: number,
    runTypeId: number
  ): Promise<Array<{ name: string; config: string }>> {
    const rows = await db
      .select({
        name: templates.name,
        config: templates.config,
      })
      .from(templates)
      .innerJoin(
        templateRunTypes,
        eq(templates.id, templateRunTypes.templateId)
      )
      .where(and(eq(templateRunTypes.runTypeId, runTypeId)));

    return rows.map((t) => ({
      name: t.name,
      config: t.config.replace(/\{RUN_ID\}/g, runId.toString()),
    }));
  }
}
