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
    parameterValues?: Record<string, string> // { parameterName: value }
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

    // 3. Store parameter values if provided
    // Parameters now come from templates, so we fetch all template parameters for this run type
    if (parameterValues && Object.keys(parameterValues).length > 0) {
      // Get all template parameters for templates associated with this run type
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

      // Deduplicate by parameter name (same param name from multiple templates)
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
        } else if (paramDef.required && !paramDef.defaultValue) {
          throw new Error(
            `Missing required parameter: ${paramDef.displayName}`
          );
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

    // 4. Generate Configs from Templates (with parameter replacements)
    const runConfigs = await this.generateRunConfigs(
      run.id,
      runTypeId,
      parameterValues
    );

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
        const uniqueJobName = `${rc.name}_run-${run.id}_${
          crypto.randomUUID().split('-')[0]
        }`;
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

    // 6. Update Run with Config
    await db
      .update(runs)
      .set({ config, daqJobIds: jobNames })
      .where(eq(runs.id, run.id));

    // 7. Send associated message templates (non-blocking, log errors)
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
    runTypeId: number,
    parameterValues?: Record<string, string>
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
