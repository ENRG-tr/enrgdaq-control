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
    parameterValues?: Record<string, string>, // { parameterName: value }
    scheduledEndTime?: Date // Optional scheduled end time for timed runs
  ): Promise<Run> {
    console.log('[startRun] Starting run process...');

    // 1. Check if run exists
    console.log('[startRun] Checking for existing active run...');
    const existing = await this.getActiveRun();
    if (existing) {
      throw new Error('A run is already in progress');
    }
    console.log('[startRun] No active run found.');

    // 2. Generate Configs from Templates FIRST (before creating run entry)
    // We use a temporary ID (0) for config generation, then update after run is created
    console.log('[startRun] Generating configs from templates...');
    const runConfigs = await this.generateRunConfigs(
      0, // Temporary ID - we'll regenerate with real ID after
      runTypeId,
      parameterValues
    );
    console.log(`[startRun] Generated ${runConfigs.length} configs.`);

    if (runConfigs.length === 0) {
      throw new Error(
        `No templates with type="run" found for RunType: ${runTypeId}`
      );
    }

    const jobNames: string[] = [];
    const fullConfigDrafts: string[] = [];

    // 3. Start Jobs on CNC (before creating database entry)
    // Generate unique job names using a timestamp-based approach since we don't have run ID yet
    const runToken = crypto.randomUUID().split('-')[0];
    console.log(
      `[startRun] Starting ${runConfigs.length} jobs with token ${runToken}...`
    );

    try {
      for (const rc of runConfigs) {
        const uniqueJobName = `${rc.name}_${runToken}_${
          crypto.randomUUID().split('-')[0]
        }`;
        const configWithUtf8 =
          `daq_job_unique_id = "${uniqueJobName}"\n` + rc.config;

        console.log(
          `[startRun] Starting job: ${uniqueJobName} (restartOnCrash: ${rc.restartOnCrash})`
        );
        await ENRGDAQClient.runJob(clientId, configWithUtf8, rc.restartOnCrash);
        console.log(`[startRun] Job started: ${uniqueJobName}`);

        jobNames.push(uniqueJobName);
        fullConfigDrafts.push(configWithUtf8);
      }
    } catch (e) {
      console.error('[startRun] Failed to start one or more jobs:', e);
      // Clean up any jobs that were started
      if (jobNames.length > 0) {
        await this.cleanupJobs(clientId, jobNames);
      }
      throw new Error(
        `Failed to start DAQ jobs: ${
          e instanceof Error ? e.message : 'Unknown error'
        }`
      );
    }

    console.log(`[startRun] All ${jobNames.length} jobs started. Verifying...`);

    // 4. VERIFY all jobs are actually running before committing to database
    const JOB_VERIFICATION_DELAY_MS = 2000; // Wait 2 seconds for jobs to initialize
    const JOB_VERIFICATION_RETRIES = 3;
    const JOB_VERIFICATION_RETRY_DELAY_MS = 1000;

    console.log(
      `[startRun] Waiting ${JOB_VERIFICATION_DELAY_MS}ms before verification...`
    );
    await new Promise((resolve) =>
      setTimeout(resolve, JOB_VERIFICATION_DELAY_MS)
    );

    let verificationFailed = false;
    let failedJobs: string[] = [];

    for (let attempt = 0; attempt < JOB_VERIFICATION_RETRIES; attempt++) {
      try {
        const status = await ENRGDAQClient.getStatus(clientId);
        const activeJobs = status?.daq_jobs || [];
        const activeJobIds = activeJobs.map(
          (job: {
            unique_id: string;
            is_alive?: boolean;
            is_running?: boolean;
          }) => job.unique_id
        );

        // Check which expected jobs are present and alive
        failedJobs = [];
        for (const expectedJobId of jobNames) {
          const activeJob = activeJobs.find(
            (job: {
              unique_id: string;
              is_alive?: boolean;
              is_running?: boolean;
            }) => job.unique_id === expectedJobId
          );
          if (!activeJob) {
            failedJobs.push(expectedJobId);
          } else if (activeJob.is_alive === false) {
            // Job exists but is not alive - this indicates a startup failure
            failedJobs.push(expectedJobId);
          }
        }

        if (failedJobs.length === 0) {
          // All jobs verified successfully
          verificationFailed = false;
          break;
        }

        console.warn(
          `Job verification attempt ${
            attempt + 1
          }/${JOB_VERIFICATION_RETRIES}: ${
            failedJobs.length
          } jobs not yet active`
        );
        verificationFailed = true;

        if (attempt < JOB_VERIFICATION_RETRIES - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, JOB_VERIFICATION_RETRY_DELAY_MS)
          );
        }
      } catch (e) {
        console.error(
          `Failed to verify job status (attempt ${attempt + 1}):`,
          e
        );
        verificationFailed = true;
        if (attempt < JOB_VERIFICATION_RETRIES - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, JOB_VERIFICATION_RETRY_DELAY_MS)
          );
        }
      }
    }

    if (verificationFailed) {
      console.error(
        `Job verification failed. Failed jobs: ${failedJobs.join(', ')}`
      );
      // Clean up all started jobs
      await this.cleanupJobs(clientId, jobNames);
      throw new Error(
        `DAQ jobs failed to start properly. Failed jobs: ${failedJobs.join(
          ', '
        )}. ` +
          `Jobs have been terminated. Please check your configuration and try again.`
      );
    }

    // 5. Now that jobs are verified running, create the Run Entry in database
    const [run] = await db
      .insert(runs)
      .values({
        description,
        status: 'RUNNING',
        clientId,
        runTypeId: runTypeId || null,
        scheduledEndTime: scheduledEndTime || null,
      })
      .returning();

    // 6. Store parameter values if provided
    if (parameterValues && Object.keys(parameterValues).length > 0) {
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
            runId: run.id,
            parameterId: paramDef.id,
            value: value,
          });
        } else if (paramDef.defaultValue) {
          paramInserts.push({
            runId: run.id,
            parameterId: paramDef.id,
            value: paramDef.defaultValue,
          });
        }
      }

      if (paramInserts.length > 0) {
        await db.insert(runParameterValues).values(paramInserts);
      }
    }

    // Store combined config - replace the temporary run ID (0) with actual run ID in stored config
    // Note: The running jobs already have '0' in their configs, but for storage we record the real ID
    const configWithRealId = fullConfigDrafts
      .map((cfg) =>
        cfg
          .replace(/\{RUN_ID\}/g, run.id.toString())
          .replace(/run-0/g, `run-${run.id}`)
      )
      .join('\n\n# -- NEXT JOB --\n\n');

    // 7. Update Run with Config and Job IDs
    await db
      .update(runs)
      .set({ config: configWithRealId, daqJobIds: jobNames })
      .where(eq(runs.id, run.id));

    // 8. Send associated message templates (non-blocking, log errors)
    try {
      await this.sendRunMessages(
        run.id,
        clientId,
        runTypeId,
        parameterValues || {}
      );
    } catch (e) {
      console.error('Failed to send run messages:', e);
      // Don't fail the run if messages fail to send
    }

    return { ...run, config: configWithRealId, daqJobIds: jobNames };
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
