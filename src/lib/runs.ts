import { db } from './db';
import {
  runs,
  templates,
  templateRunTypes,
  templateParameters,
  runTypeParameterDefaults,
  runParameterValues,
  type Run,
} from './schema';
import { eq, desc, and, count } from 'drizzle-orm';
import { ENRGDAQClient } from './enrgdaq-client';
import { MessageController } from './messages';

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
      // Check if scheduled end time has passed
      if (run.scheduledEndTime && new Date() >= run.scheduledEndTime) {
        console.log(
          `Run ${run.id} reached scheduled end time. Automatically stopping.`
        );
        if (run.clientId) {
          try {
            await this.stopRun(run.id, run.clientId);
          } catch (e) {
            console.error(`Failed to auto-stop run ${run.id}:`, e);
          }
        } else {
          // No clientId, just mark as completed
          await db
            .update(runs)
            .set({ status: 'COMPLETED', endTime: new Date() })
            .where(eq(runs.id, run.id));
        }
        return null; // No longer active
      }

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
    runTypeId: number,
    parameterValues?: Record<string, string>,
    scheduledEndTime?: Date
  ): Promise<Run> {
    console.log('[startRun] Starting run process...');

    // 1. Check for existing active run
    await this.ensureNoActiveRun();

    // 2. Create the run entry FIRST with PENDING status to get the real ID
    console.log('[startRun] Creating run entry to obtain run ID...');
    const [run] = await db
      .insert(runs)
      .values({
        description,
        status: 'PENDING',
        clientId,
        runTypeId: runTypeId || null,
        scheduledEndTime: scheduledEndTime || null,
      })
      .returning();
    console.log(`[startRun] Created run with ID: ${run.id}`);

    try {
      // 3. Generate configs with real run ID
      console.log('[startRun] Generating configs from templates...');
      const runConfigs = await this.generateRunConfigs(
        run.id,
        runTypeId,
        parameterValues
      );
      console.log(`[startRun] Generated ${runConfigs.length} configs.`);

      if (runConfigs.length === 0) {
        throw new Error(
          `No templates with type="run" found for RunType: ${runTypeId}`
        );
      }

      // 4. Start jobs with real run ID in config
      const runToken = crypto.randomUUID().split('-')[0];
      const { jobNames, fullConfigs } = await this.startDAQJobs(
        clientId,
        runConfigs,
        runToken
      );

      // 5. Verify all jobs are running
      await this.verifyDAQJobs(clientId, jobNames);

      // 6. Store parameter values
      await this.storeRunParameterValues(run.id, runTypeId, parameterValues);

      // 7. Update run to RUNNING with config and job IDs
      const combinedConfig = fullConfigs.join('\n\n# -- NEXT JOB --\n\n');
      await db
        .update(runs)
        .set({
          status: 'RUNNING',
          config: combinedConfig,
          daqJobIds: jobNames,
        })
        .where(eq(runs.id, run.id));

      // 8. Send associated message templates (non-blocking)
      this.sendRunMessages(
        run.id,
        clientId,
        runTypeId,
        parameterValues || {}
      ).catch((e) => console.error('Failed to send run messages:', e));

      return {
        ...run,
        status: 'RUNNING',
        config: combinedConfig,
        daqJobIds: jobNames,
      };
    } catch (e) {
      // Cleanup: delete the PENDING run entry on failure
      console.error('[startRun] Failed, cleaning up run entry:', e);
      await db.delete(runs).where(eq(runs.id, run.id));
      throw e;
    }
  }

  /**
   * Ensures no run is currently active. Throws if one exists.
   */
  private static async ensureNoActiveRun(): Promise<void> {
    console.log('[startRun] Checking for existing active run...');
    const existing = await this.getActiveRun();
    if (existing) {
      throw new Error('A run is already in progress');
    }
    console.log('[startRun] No active run found.');
  }

  /**
   * Prepares a job config by prepending the unique job ID.
   */
  private static prepareJobConfig(
    templateName: string,
    config: string,
    runToken: string
  ): { uniqueJobName: string; fullConfig: string } {
    const uniqueJobName = `${templateName}_${runToken}_${
      crypto.randomUUID().split('-')[0]
    }`;
    const fullConfig = `daq_job_unique_id = "${uniqueJobName}"\n` + config;
    return { uniqueJobName, fullConfig };
  }

  /**
   * Starts DAQ jobs on the client. Returns job names and full configs.
   * Cleans up started jobs if any job fails to start.
   */
  private static async startDAQJobs(
    clientId: string,
    runConfigs: Array<{
      name: string;
      config: string;
      restartOnCrash: boolean;
    }>,
    runToken: string
  ): Promise<{ jobNames: string[]; fullConfigs: string[] }> {
    const jobNames: string[] = [];
    const fullConfigs: string[] = [];

    console.log(
      `[startRun] Starting ${runConfigs.length} jobs with token ${runToken}...`
    );

    try {
      for (const rc of runConfigs) {
        const { uniqueJobName, fullConfig } = this.prepareJobConfig(
          rc.name,
          rc.config,
          runToken
        );

        console.log(
          `[startRun] Starting job: ${uniqueJobName} (restartOnCrash: ${rc.restartOnCrash})`
        );
        await ENRGDAQClient.runJob(clientId, fullConfig, rc.restartOnCrash);
        console.log(`[startRun] Job started: ${uniqueJobName}`);

        jobNames.push(uniqueJobName);
        fullConfigs.push(fullConfig);
      }
    } catch (e) {
      console.error('[startRun] Failed to start one or more jobs:', e);
      if (jobNames.length > 0) {
        await this.cleanupJobs(clientId, jobNames);
      }
      throw new Error(
        `Failed to start DAQ jobs: ${
          e instanceof Error ? e.message : 'Unknown error'
        }`
      );
    }

    console.log(`[startRun] All ${jobNames.length} jobs started.`);
    return { jobNames, fullConfigs };
  }

  /**
   * Verifies that all expected jobs are running on the client.
   * Retries verification with delays. Cleans up and throws on failure.
   */
  private static async verifyDAQJobs(
    clientId: string,
    jobNames: string[]
  ): Promise<void> {
    const VERIFICATION_DELAY_MS = 2000;
    const VERIFICATION_RETRIES = 3;
    const RETRY_DELAY_MS = 1000;

    console.log(
      `[startRun] Waiting ${VERIFICATION_DELAY_MS}ms before verification...`
    );
    await new Promise((resolve) => setTimeout(resolve, VERIFICATION_DELAY_MS));

    let failedJobs: string[] = [];

    for (let attempt = 0; attempt < VERIFICATION_RETRIES; attempt++) {
      try {
        const status = await ENRGDAQClient.getStatus(clientId);
        const activeJobs = status?.daq_jobs || [];

        failedJobs = this.findFailedJobs(jobNames, activeJobs);

        if (failedJobs.length === 0) {
          console.log('[startRun] All jobs verified successfully.');
          return;
        }

        console.warn(
          `Job verification attempt ${attempt + 1}/${VERIFICATION_RETRIES}: ` +
            `${failedJobs.length} jobs not yet active`
        );

        if (attempt < VERIFICATION_RETRIES - 1) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        }
      } catch (e) {
        console.error(
          `Failed to verify job status (attempt ${attempt + 1}):`,
          e
        );
        if (attempt < VERIFICATION_RETRIES - 1) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        }
      }
    }

    // Verification failed after all retries
    console.error(
      `Job verification failed. Failed jobs: ${failedJobs.join(', ')}`
    );
    await this.cleanupJobs(clientId, jobNames);
    throw new Error(
      `DAQ jobs failed to start properly. Failed jobs: ${failedJobs.join(
        ', '
      )}. ` +
        `Jobs have been terminated. Please check your configuration and try again.`
    );
  }

  /**
   * Finds jobs that are not present or not alive in the active jobs list.
   */
  private static findFailedJobs(
    expectedJobIds: string[],
    activeJobs: Array<{ unique_id: string; is_alive?: boolean }>
  ): string[] {
    const failedJobs: string[] = [];
    for (const expectedJobId of expectedJobIds) {
      const activeJob = activeJobs.find(
        (job) => job.unique_id === expectedJobId
      );
      if (!activeJob || activeJob.is_alive === false) {
        failedJobs.push(expectedJobId);
      }
    }
    return failedJobs;
  }

  /**
   * Stores parameter values for a run.
   */
  private static async storeRunParameterValues(
    runId: number,
    runTypeId: number,
    parameterValues?: Record<string, string>
  ): Promise<void> {
    if (!parameterValues || Object.keys(parameterValues).length === 0) {
      return;
    }

    const paramDefs = await db
      .select({
        id: templateParameters.id,
        name: templateParameters.name,
        displayName: templateParameters.displayName,
        required: templateParameters.required,
        defaultValue: templateParameters.defaultValue,
      })
      .from(templateParameters)
      .innerJoin(
        templateRunTypes,
        eq(templateParameters.templateId, templateRunTypes.templateId)
      )
      .where(eq(templateRunTypes.runTypeId, runTypeId));

    // Deduplicate by parameter name
    const uniqueParams = new Map<string, (typeof paramDefs)[0]>();
    for (const param of paramDefs) {
      if (!uniqueParams.has(param.name)) {
        uniqueParams.set(param.name, param);
      }
    }

    const paramInserts = [];
    for (const paramDef of Array.from(uniqueParams.values())) {
      const value = parameterValues[paramDef.name];
      if (value !== undefined) {
        paramInserts.push({
          runId,
          parameterId: paramDef.id,
          value: value,
        });
      } else if (paramDef.defaultValue) {
        paramInserts.push({
          runId,
          parameterId: paramDef.id,
          value: paramDef.defaultValue,
        });
      }
    }

    if (paramInserts.length > 0) {
      await db.insert(runParameterValues).values(paramInserts);
    }
  }

  /**
   * Helper to clean up started jobs when startup fails
   */
  private static async cleanupJobs(
    clientId: string,
    jobNames: string[]
  ): Promise<void> {
    console.log(`Cleaning up ${jobNames.length} jobs after startup failure...`);
    try {
      await Promise.all(
        jobNames.map((name) =>
          ENRGDAQClient.stopJob(clientId, name, true).catch((e) =>
            console.error(`Failed to cleanup job ${name}:`, e)
          )
        )
      );
    } catch (cleanupErr) {
      console.error('Failed to cleanup started jobs:', cleanupErr);
    }
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
    runTypeId: number,
    parameterValues?: Record<string, string>
  ): Promise<Array<{ name: string; config: string; restartOnCrash: boolean }>> {
    const rows = await db
      .select({
        name: templates.name,
        config: templates.config,
        restartOnCrash: templates.restartOnCrash,
      })
      .from(templates)
      .innerJoin(
        templateRunTypes,
        eq(templates.id, templateRunTypes.templateId)
      )
      .where(
        and(
          eq(templateRunTypes.runTypeId, runTypeId),
          eq(templates.type, 'run')
        )
      );

    return rows.map((t) => {
      // Replace {RUN_ID} with actual run ID
      let config = t.config.replace(/\{RUN_ID\}/g, runId.toString());

      // Replace parameter placeholders like {MV_THRESHOLD}
      if (parameterValues) {
        for (const [paramName, value] of Object.entries(parameterValues)) {
          const placeholder = new RegExp(
            `\\{${paramName.toUpperCase()}\\}`,
            'g'
          );
          config = config.replace(placeholder, value);
        }
      }

      return {
        name: t.name,
        config,
        restartOnCrash: t.restartOnCrash,
      };
    });
  }

  static async getRunParameterValues(
    runId: number
  ): Promise<Array<{ name: string; displayName: string; value: string }>> {
    const values = await db
      .select({
        name: templateParameters.name,
        displayName: templateParameters.displayName,
        value: runParameterValues.value,
      })
      .from(runParameterValues)
      .innerJoin(
        templateParameters,
        eq(runParameterValues.parameterId, templateParameters.id)
      )
      .where(eq(runParameterValues.runId, runId));

    return values;
  }

  /**
   * Send all message templates associated with a run type.
   * Delegates to MessageController for actual sending.
   */
  private static async sendRunMessages(
    runId: number,
    clientId: string,
    runTypeId: number,
    parameterValues: Record<string, string>
  ): Promise<void> {
    await MessageController.sendMessagesForRunType(
      runTypeId,
      runId,
      clientId,
      parameterValues
    );
  }
}
