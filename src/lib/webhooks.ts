import { db } from './db';
import { webhooks } from './schema';
import { eq, or } from 'drizzle-orm';
import axios from 'axios';

export class WebhookController {
  /**
   * Fetch all active webhooks that should trigger on run events
   */
  static async getRunWebhooks() {
    return db
      .select()
      .from(webhooks)
      .where(or(eq(webhooks.isActive, true), eq(webhooks.triggerOnRun, true)));
  }

  /**
   * Fetch all active webhooks that should trigger on message events
   */
  static async getMessageWebhooks() {
    return db
      .select()
      .from(webhooks)
      .where(
        or(eq(webhooks.isActive, true), eq(webhooks.triggerOnMessage, true)),
      );
  }

  /**
   * Helper to dispatch the webhook using Axios
   */
  private static async dispatch(
    url: string,
    secret: string | null,
    payload: any,
  ) {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (secret) {
        headers['Authorization'] = secret;
      }

      await axios.post(url, payload, { headers });
      console.log(`[Webhook] Successfully dispatched to ${url}`);
    } catch (error: any) {
      console.error(`[Webhook] Failed to dispatch to ${url}:`, error.message);
    }
  }

  /**
   * Parses string templates by replacing {keys} with values
   */
  private static interpolateString(
    str: string,
    vars: Record<string, any>,
  ): string {
    let result = str;
    for (const [key, value] of Object.entries(vars)) {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      const replacement =
        typeof value === 'object' ? JSON.stringify(value) : String(value);
      result = result.replace(regex, replacement);
    }
    return result;
  }

  /**
   * Recursively processes a JSON template object, replacing placeholders
   */
  private static processPayloadTemplate(
    template: any,
    vars: Record<string, any>,
  ): any {
    if (typeof template === 'string') {
      // Direct exact match to substitute object directly (e.g., "{parameterValues}")
      for (const [key, value] of Object.entries(vars)) {
        if (template === `{${key}}`) {
          return value;
        }
      }
      return this.interpolateString(template, vars);
    } else if (Array.isArray(template)) {
      return template.map((item) => this.processPayloadTemplate(item, vars));
    } else if (template !== null && typeof template === 'object') {
      const result: any = {};
      for (const [k, v] of Object.entries(template)) {
        result[k] = this.processPayloadTemplate(v, vars);
      }
      return result;
    }
    return template;
  }

  /**
   * Generates the final payload body for the webhook
   */
  private static buildPayload(webhook: any, eventType: string, eventData: any) {
    if (webhook.payloadTemplate) {
      try {
        const parsedTemplate = JSON.parse(webhook.payloadTemplate);

        // Flatten standard stuff into vars and provide some aliases for convenience
        const vars = {
          event: eventType,
          type: eventType,
          runId: eventData?.id,
          messageId: eventData?.id,
          ...eventData,
        };

        return this.processPayloadTemplate(parsedTemplate, vars);
      } catch (e) {
        console.error(
          `[Webhook] Failed to parse custom payload template for webhook ${webhook.id}, falling back to default.`,
          e,
        );
      }
    }

    // Default fallback payload
    return {
      event: eventType,
      timestamp: new Date().toISOString(),
      data: eventData,
    };
  }

  /**
   * Dispatches a run-related event to all configured run webhooks
   */
  static async dispatchRunEvent(
    eventType: 'run_started' | 'run_stopped' | 'run_error',
    runData: any,
  ) {
    const hooks = await this.getRunWebhooks();
    if (!hooks.length) return;

    // Filter to effectively apply both isActive AND triggerOnRun
    const activeRunHooks = hooks.filter((h) => h.isActive && h.triggerOnRun);
    if (!activeRunHooks.length) return;

    const promises = activeRunHooks.map((wh) => {
      const payload = this.buildPayload(wh, eventType, runData);
      return this.dispatch(wh.url, wh.secret, payload);
    });
    await Promise.allSettled(promises);
  }

  /**
   * Dispatches a message-related event to all configured message webhooks
   */
  static async dispatchMessageEvent(
    eventType: 'message_sent' | 'message_failed',
    messageData: any,
  ) {
    const hooks = await this.getMessageWebhooks();
    if (!hooks.length) return;

    // Filter to effectively apply both isActive AND triggerOnMessage
    const activeMessageHooks = hooks.filter(
      (h) => h.isActive && h.triggerOnMessage,
    );
    if (!activeMessageHooks.length) return;

    const promises = activeMessageHooks.map((wh) => {
      const payload = this.buildPayload(wh, eventType, messageData);
      return this.dispatch(wh.url, wh.secret, payload);
    });
    await Promise.allSettled(promises);
  }
}
