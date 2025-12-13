import { db } from './db';
import {
  messages,
  templates,
  templateParameters,
  messageParameterValues,
  type Message,
  type NewMessage,
  type TemplateParameter,
} from './schema';
import { eq, desc, count, and } from 'drizzle-orm';
import { ENRGDAQClient } from './enrgdaq-client';

export class MessageController {
  /**
   * Get all sent messages with pagination
   */
  static async getAllMessages(
    limit: number = 20,
    offset: number = 0
  ): Promise<{ messages: Message[]; total: number }> {
    const [totalResult] = await db.select({ count: count() }).from(messages);
    const total = totalResult?.count || 0;

    const data = await db
      .select()
      .from(messages)
      .orderBy(desc(messages.id))
      .limit(limit)
      .offset(offset);

    return { messages: data, total };
  }

  /**
   * Get message templates (templates where type='message')
   */
  static async getMessageTemplates() {
    return db
      .select()
      .from(templates)
      .where(eq(templates.type, 'message'))
      .orderBy(templates.displayName);
  }

  /**
   * Get parameters for a message template
   */
  static async getTemplateParameters(
    templateId: number
  ): Promise<TemplateParameter[]> {
    return db
      .select()
      .from(templateParameters)
      .where(eq(templateParameters.templateId, templateId));
  }

  /**
   * Create a new template parameter
   */
  static async createTemplateParameter(
    templateId: number,
    data: {
      name: string;
      displayName: string;
      type?: string;
      defaultValue?: string;
      required?: boolean;
    }
  ): Promise<TemplateParameter> {
    const [param] = await db
      .insert(templateParameters)
      .values({
        templateId,
        name: data.name,
        displayName: data.displayName,
        type: data.type || 'string',
        defaultValue: data.defaultValue || null,
        required: data.required ?? true,
      })
      .returning();
    return param;
  }

  static async deleteTemplateParameter(paramId: number): Promise<void> {
    await db
      .delete(templateParameters)
      .where(eq(templateParameters.id, paramId));
  }

  /**
   * Update a template parameter
   */
  static async updateTemplateParameter(
    paramId: number,
    data: {
      name?: string;
      displayName?: string;
      type?: string;
      defaultValue?: string;
      required?: boolean;
    }
  ): Promise<TemplateParameter> {
    const [updated] = await db
      .update(templateParameters)
      .set({
        name: data.name,
        displayName: data.displayName,
        type: data.type,
        defaultValue: data.defaultValue,
        required: data.required,
      })
      .where(eq(templateParameters.id, paramId))
      .returning();
    return updated;
  }

  /**
   * Resolve a DAQ job type to its unique_id from the current client status
   * If targetDaqJobType is null, returns null (broadcast)
   */
  static async resolveDaqJobUniqueId(
    clientId: string,
    targetDaqJobType: string | null
  ): Promise<string | null> {
    if (!targetDaqJobType) return null; // Broadcast mode

    try {
      const status = await ENRGDAQClient.getStatus(clientId);
      const jobs = status?.daq_jobs || [];

      // Find a job matching the type
      const matchingJob = jobs.find(
        (job: any) =>
          job.daq_job_type === targetDaqJobType ||
          job.unique_id?.includes(targetDaqJobType)
      );

      if (matchingJob) {
        return matchingJob.unique_id;
      }

      // If no match found, return null (will broadcast)
      console.warn(
        `No DAQ job found matching type: ${targetDaqJobType}, broadcasting instead`
      );
      return null;
    } catch (e) {
      console.error('Failed to resolve DAQ job unique ID:', e);
      return null;
    }
  }

  /**
   * Replace parameter placeholders in payload template
   */
  static replaceParameters(
    payloadTemplate: string,
    parameterValues: Record<string, string>
  ): string {
    let result = payloadTemplate;
    for (const [name, value] of Object.entries(parameterValues)) {
      const placeholder = new RegExp(`\\{${name.toUpperCase()}\\}`, 'g');
      result = result.replace(placeholder, value);
    }
    return result;
  }

  /**
   * Send a message using a template
   */
  static async sendMessageFromTemplate(
    templateId: number,
    clientId: string,
    targetDaqJobType: string | null,
    parameterValues: Record<string, string>,
    runId?: number | null
  ): Promise<Message> {
    // 1. Get the template
    const [template] = await db
      .select()
      .from(templates)
      .where(and(eq(templates.id, templateId), eq(templates.type, 'message')))
      .limit(1);

    if (!template) {
      throw new Error('Message template not found');
    }

    if (!template.messageType || !template.payloadTemplate) {
      throw new Error(
        'Invalid message template: missing messageType or payloadTemplate'
      );
    }

    // 2. Get template parameters and validate required ones
    const params = await this.getTemplateParameters(templateId);
    for (const param of params) {
      if (
        param.required &&
        !parameterValues[param.name] &&
        !param.defaultValue
      ) {
        throw new Error(`Missing required parameter: ${param.displayName}`);
      }
    }

    // 3. Replace parameters in payload
    const payload = this.replaceParameters(
      template.payloadTemplate,
      parameterValues
    );

    // 4. Resolve target DAQ job unique ID
    const targetDaqJobUniqueId = await this.resolveDaqJobUniqueId(
      clientId,
      targetDaqJobType
    );

    // 5. Try to send the message
    let status: 'SENT' | 'FAILED' = 'SENT';
    let errorMessage: string | null = null;

    try {
      await ENRGDAQClient.sendMessage(
        clientId,
        template.messageType,
        payload,
        targetDaqJobUniqueId
      );
    } catch (e: any) {
      status = 'FAILED';
      errorMessage = e.message || 'Unknown error';
    }

    // 6. Store the message record
    const [message] = await db
      .insert(messages)
      .values({
        templateId,
        clientId,
        targetDaqJobType,
        targetDaqJobUniqueId,
        messageType: template.messageType,
        payload,
        status,
        errorMessage,
        runId: runId || null,
      })
      .returning();

    // 7. Store parameter values
    const paramInserts = [];
    for (const param of params) {
      const value = parameterValues[param.name] || param.defaultValue;
      if (value !== undefined && value !== null) {
        paramInserts.push({
          messageId: message.id,
          parameterId: param.id,
          value,
        });
      }
    }

    if (paramInserts.length > 0) {
      await db.insert(messageParameterValues).values(paramInserts);
    }

    if (status === 'FAILED') {
      throw new Error(errorMessage || 'Failed to send message');
    }

    return message;
  }

  /**
   * Send a raw message (without template)
   */
  static async sendRawMessage(
    clientId: string,
    messageType: string,
    payload: string,
    targetDaqJobType: string | null,
    runId?: number | null
  ): Promise<Message> {
    // Resolve target DAQ job unique ID
    const targetDaqJobUniqueId = await this.resolveDaqJobUniqueId(
      clientId,
      targetDaqJobType
    );

    let status: 'SENT' | 'FAILED' = 'SENT';
    let errorMessage: string | null = null;

    try {
      await ENRGDAQClient.sendMessage(
        clientId,
        messageType,
        payload,
        targetDaqJobUniqueId
      );
    } catch (e: any) {
      status = 'FAILED';
      errorMessage = e.message || 'Unknown error';
    }

    const [message] = await db
      .insert(messages)
      .values({
        templateId: null,
        clientId,
        targetDaqJobType,
        targetDaqJobUniqueId,
        messageType,
        payload,
        status,
        errorMessage,
        runId: runId || null,
      })
      .returning();

    if (status === 'FAILED') {
      throw new Error(errorMessage || 'Failed to send message');
    }

    return message;
  }

  /**
   * Send all message templates associated with a run type.
   * Used when a run starts to auto-send messages.
   * @param runTypeId - The run type to get message templates for
   * @param runId - The run ID (used for {RUN_ID} placeholder)
   * @param clientId - The client/supervisor to send to
   * @param parameterValues - Run parameter values for placeholder replacement
   */
  static async sendMessagesForRunType(
    runTypeId: number,
    runId: number,
    clientId: string,
    parameterValues: Record<string, string>
  ): Promise<{ sent: number; failed: number }> {
    // Import dynamically to avoid circular dependency
    const { templateRunTypes } = await import('./schema');

    // Get message templates associated with this run type
    const messageTemplates = await db
      .select({
        id: templates.id,
        name: templates.name,
        messageType: templates.messageType,
        payloadTemplate: templates.payloadTemplate,
        targetDaqJobType: templates.targetDaqJobType,
      })
      .from(templates)
      .innerJoin(
        templateRunTypes,
        eq(templates.id, templateRunTypes.templateId)
      )
      .where(
        and(
          eq(templateRunTypes.runTypeId, runTypeId),
          eq(templates.type, 'message')
        )
      );

    if (messageTemplates.length === 0) {
      return { sent: 0, failed: 0 };
    }

    console.log(
      `Sending ${messageTemplates.length} message template(s) for run ${runId}`
    );

    let sent = 0;
    let failed = 0;

    for (const template of messageTemplates) {
      if (!template.messageType || !template.payloadTemplate) {
        console.warn(
          `Skipping invalid message template ${template.name}: missing messageType or payloadTemplate`
        );
        failed++;
        continue;
      }

      // Replace {RUN_ID} and parameters in payload
      let payload = template.payloadTemplate;
      payload = payload.replace(/\{RUN_ID\}/g, runId.toString());
      payload = this.replaceParameters(payload, parameterValues);

      // Also apply default values from template parameters
      const params = await this.getTemplateParameters(template.id);
      for (const param of params) {
        if (param.defaultValue) {
          const placeholder = new RegExp(
            `\\{${param.name.toUpperCase()}\\}`,
            'g'
          );
          payload = payload.replace(placeholder, param.defaultValue);
        }
      }

      // Resolve target DAQ job unique ID
      const targetDaqJobUniqueId = await this.resolveDaqJobUniqueId(
        clientId,
        template.targetDaqJobType
      );

      // Send the message
      let status: 'SENT' | 'FAILED' = 'SENT';
      let errorMessage: string | null = null;

      try {
        await ENRGDAQClient.sendMessage(
          clientId,
          template.messageType,
          payload,
          targetDaqJobUniqueId
        );
        sent++;
      } catch (e: any) {
        status = 'FAILED';
        errorMessage = e.message || 'Unknown error';
        failed++;
        console.error(`Failed to send message ${template.name}:`, e);
      }

      // Store the message record
      const [message] = await db
        .insert(messages)
        .values({
          templateId: template.id,
          clientId,
          targetDaqJobType: template.targetDaqJobType || null,
          targetDaqJobUniqueId,
          messageType: template.messageType,
          payload,
          status,
          errorMessage,
          runId,
        })
        .returning();

      // Store parameter values used
      const paramInserts = [];
      for (const param of params) {
        const value = parameterValues[param.name] || param.defaultValue;
        if (value !== undefined && value !== null) {
          paramInserts.push({
            messageId: message.id,
            parameterId: param.id,
            value,
          });
        }
      }

      if (paramInserts.length > 0) {
        await db.insert(messageParameterValues).values(paramInserts);
      }

      console.log(
        `Message ${template.name} ${
          status === 'SENT' ? 'sent' : 'failed'
        } for run ${runId}`
      );
    }

    return { sent, failed };
  }
}
