import axios from 'axios';
import { type Run, type Webhook } from './schema';

export interface LogEntry {
  type: string;
  level: string;
  message: string;
  timestamp: string;
  module: string;
  client_id: string;
  req_id: string | null;
}

export interface AuthUserInfo {
  id: number;
  email: string;
  name: string;
  roles: string[];
}

export interface Template {
  id: number;
  name: string;
  displayName: string;
  config: string;
  type: string; // 'normal' | 'run' | 'message'
  editable: boolean;
  runTypeIds: number[];
  // Message template fields
  messageType?: string | null;
  payloadTemplate?: string | null;
  targetDaqJobType?: string | null; // Target DAQ job type, null = broadcast
  defaultClientId?: string | null; // Default client to select when using this template
  // Run template fields
  restartOnCrash?: boolean; // Restart job on crash (for run templates)
}

export interface RunType {
  id: number;
  name: string;
  description: string | null;
  requiredTags: string[] | null;
}

// Aggregated parameter from templates, with optional run type default
export interface AggregatedParameter {
  id: number;
  templateId: number;
  name: string;
  displayName: string;
  type: string;
  defaultValue: string | null;
  required: boolean;
  runTypeDefault?: string | null;
}

export interface TemplateParameter {
  id: number;
  templateId: number;
  name: string;
  displayName: string;
  type: string;
  defaultValue: string | null;
  required: boolean;
}

export interface Message {
  id: number;
  templateId: number | null;
  clientId: string;
  targetDaqJobType: string | null;
  targetDaqJobUniqueId: string | null;
  messageType: string;
  payload: string;
  status: string;
  errorMessage: string | null;
  sentAt: string;
  runId: number | null;
}

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
const api = axios.create({
  baseURL: basePath + '/api',
});

export const API = {
  async getAuthStatus(): Promise<{
    isAdmin: boolean;
    userInfo: AuthUserInfo | null;
  }> {
    const { data } = await api.get('/auth/status');
    return data;
  },

  async getClients(): Promise<{ id: string; tags: string[] }[]> {
    const { data } = await api.get('/clients');
    return data;
  },

  async getRuns(
    page: number = 1,
    limit: number = 10,
  ): Promise<{ runs: Run[]; total: number; activeRun: Run | null }> {
    const { data } = await api.get('/runs', { params: { page, limit } });
    return data;
  },

  async getRunTypes(): Promise<RunType[]> {
    const { data } = await api.get('/run-types');
    return data;
  },

  /**
   * Get aggregated parameters from all templates associated with this run type
   */
  async getAggregatedParametersForRunType(
    runTypeId: number,
  ): Promise<AggregatedParameter[]> {
    const { data } = await api.get(`/run-types/${runTypeId}/parameters`);
    return data;
  },

  /**
   * Set or remove a default value for a parameter on a run type
   */
  async setRunTypeParameterDefault(
    runTypeId: number,
    parameterId: number,
    defaultValue: string | null,
  ): Promise<void> {
    await api.post(`/run-types/${runTypeId}/parameters`, {
      parameterId,
      defaultValue,
    });
  },

  async createRunType(createData: {
    name: string;
    description?: string;
    requiredTags?: string[];
  }): Promise<RunType> {
    const { data } = await api.post('/run-types', createData);
    return data;
  },

  async updateRunType(
    id: number,
    updateData: {
      name?: string;
      description?: string;
      requiredTags?: string[];
    },
  ): Promise<RunType> {
    const { data } = await api.post(`/run-types/${id}/update`, updateData);
    return data;
  },

  async deleteRunType(id: number): Promise<void> {
    await api.post(`/run-types/${id}/delete`);
  },

  async updateRunTypeTemplates(
    id: number,
    templateIds: number[],
  ): Promise<void> {
    await api.post(`/run-types/${id}/templates`, { templateIds });
  },

  async startRun(
    description: string,
    clientId: string,
    runTypeId?: number,
    parameterValues?: Record<string, string>,
    scheduledEndTime?: Date | null,
  ): Promise<Run> {
    const { data } = await api.post('/runs', {
      description,
      clientId,
      runTypeId,
      parameterValues,
      scheduledEndTime: scheduledEndTime?.toISOString() || null,
    });
    return data;
  },

  async stopRun(runId: number, clientId: string): Promise<void> {
    await api.post(`/runs/${runId}/stop`, { clientId });
  },

  async deleteRun(runId: number): Promise<void> {
    await api.post(`/runs/${runId}/delete`);
  },

  // Templates
  async getTemplates(): Promise<Template[]> {
    const { data } = await api.get('/templates');
    return data;
  },

  async createTemplate(createData: {
    name: string;
    displayName: string;
    config?: string;
    type?: string;
    runTypeIds?: number[];
    messageType?: string;
    payloadTemplate?: string;
    targetDaqJobType?: string | null;
    defaultClientId?: string | null;
    restartOnCrash?: boolean;
  }): Promise<Template> {
    const { data } = await api.post('/templates', createData);
    return data;
  },

  async updateTemplate(
    id: number,
    updateData: {
      displayName?: string;
      config?: string;
      type?: string;
      runTypeIds?: number[];
      messageType?: string;
      payloadTemplate?: string;
      targetDaqJobType?: string | null;
      defaultClientId?: string | null;
      restartOnCrash?: boolean;
    },
  ): Promise<Template> {
    const { data } = await api.post(`/templates/${id}/update`, updateData);
    return data;
  },

  async deleteTemplate(id: number): Promise<void> {
    await api.post(`/templates/${id}/delete`);
  },

  async getStatus(clientId: string) {
    const { data } = await api.get(`/clients/${clientId}/status`);
    return data;
  },

  async getLogs(clientId: string) {
    const { data } = await api.get(`/clients/${clientId}/logs`);
    return data.logs;
  },

  async restartDaq(clientId: string) {
    await api.post(`/clients/${clientId}/restart_daq`);
  },

  async stopAllJobs(clientId: string) {
    await api.post(`/clients/${clientId}/stop_daqjobs`);
  },

  async runJob(clientId: string, config: string) {
    await api.post(`/clients/${clientId}/run_custom_daqjob`, { config });
  },

  async stopJob(clientId: string, uniqueId: string, remove: boolean = false) {
    await api.post(`/clients/${clientId}/stop_daqjob`, {
      daq_job_unique_id: uniqueId,
      remove,
    });
  },

  async getDAQJobSchemas(): Promise<Record<string, unknown>> {
    const { data } = await api.get('/templates/daqjobs');
    return data;
  },

  // ========== Messages ==========

  async getMessages(
    page: number = 1,
    limit: number = 20,
  ): Promise<{ messages: Message[]; total: number }> {
    const { data } = await api.get('/messages', { params: { page, limit } });
    return data;
  },

  async getMessageTemplates(): Promise<Template[]> {
    const { data } = await api.get('/messages/templates');
    return data;
  },

  async getMessageSchemas(): Promise<Record<string, unknown>> {
    const { data } = await api.get('/messages/schemas');
    return data;
  },

  async getTemplateParameters(
    templateId: number,
  ): Promise<TemplateParameter[]> {
    const { data } = await api.get(`/templates/${templateId}/parameters`);
    return data;
  },

  async createTemplateParameter(
    templateId: number,
    paramData: {
      name: string;
      displayName: string;
      type?: string;
      defaultValue?: string;
      required?: boolean;
    },
  ): Promise<TemplateParameter> {
    const { data } = await api.post(
      `/templates/${templateId}/parameters`,
      paramData,
    );
    return data;
  },

  async updateTemplateParameter(
    paramId: number,
    updateData: {
      name?: string;
      displayName?: string;
      type?: string;
      defaultValue?: string;
      required?: boolean;
    },
  ): Promise<TemplateParameter> {
    const { data } = await api.put(
      `/templates/parameters/${paramId}`,
      updateData,
    );
    return data;
  },

  async deleteTemplateParameter(paramId: number): Promise<void> {
    await api.delete(`/templates/parameters/${paramId}`);
  },

  async sendMessage(params: {
    templateId?: number;
    clientId: string;
    targetDaqJobType?: string | null;
    parameterValues?: Record<string, string>;
    runId?: number | null;
    // For raw messages
    messageType?: string;
    payload?: string;
  }): Promise<Message> {
    const { data } = await api.post('/messages', params);
    return data;
  },

  // Webhooks
  async getWebhooks(): Promise<Webhook[]> {
    const { data } = await api.get('/webhooks');
    return data;
  },

  async createWebhook(
    webhook: Omit<Webhook, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Webhook> {
    const { data } = await api.post('/webhooks', webhook);
    return data;
  },

  async updateWebhook(id: number, webhook: Partial<Webhook>): Promise<Webhook> {
    const { data } = await api.post(`/webhooks/${id}/update`, webhook);
    return data;
  },

  async deleteWebhook(id: number): Promise<void> {
    await api.post(`/webhooks/${id}/delete`);
  },
};
