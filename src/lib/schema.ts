import {
  pgTable,
  serial,
  text,
  timestamp,
  boolean,
  json,
  integer,
} from 'drizzle-orm/pg-core';

// Runs table - tracks DAQ acquisition runs
export const runs = pgTable('runs', {
  id: serial('id').primaryKey(),
  description: text('description').notNull(),
  startTime: timestamp('start_time').notNull().defaultNow(),
  endTime: timestamp('end_time'),
  scheduledEndTime: timestamp('scheduled_end_time'), // Optional scheduled end time for timed runs
  status: text('status').notNull().default('RUNNING'), // RUNNING, COMPLETED, STOPPED
  daqJobIds: json('daq_job_ids').$type<string[]>(),
  config: text('config'),
  clientId: text('client_id'),
  runTypeId: integer('run_type_id').references(() => runTypes.id),
  isDeleted: boolean('is_deleted').notNull().default(false),
});

// Run Types table - Defines types/modes of runs (e.g. Calibration, Physics)
export const runTypes = pgTable('run_types', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  requiredTags: json('required_tags').$type<string[]>(),
});

// Templates table - DAQ job configuration templates and message templates
// type: 'normal' = general template, 'run' = used in runs, 'message' = message template
export const templates = pgTable('templates', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  displayName: text('display_name').notNull(),
  config: text('config').notNull(), // TOML config for run templates, ignored for message templates
  type: text('type').notNull().default('normal'), // 'normal' | 'run' | 'message'
  editable: boolean('editable').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  // Message-specific fields (used when type='message')
  messageType: text('message_type'), // e.g., 'DAQJobMessageStop'
  payloadTemplate: text('payload_template'), // JSON template with placeholders like {REASON}
  targetDaqJobType: text('target_daq_job_type'), // e.g., 'DAQJobStoreCSV', null = broadcast
  defaultClientId: text('default_client_id'), // Default client to select when using this message template
  // Run template fields (used when type='run')
  restartOnCrash: boolean('restart_on_crash').notNull().default(true), // Restart job on crash
});

// Junction table for Many-to-Many relationship between Templates and RunTypes
export const templateRunTypes = pgTable(
  'template_run_types',
  {
    templateId: integer('template_id')
      .references(() => templates.id)
      .notNull(),
    runTypeId: integer('run_type_id')
      .references(() => runTypes.id)
      .notNull(),
  },
  (t) => ({
    pk: { columns: [t.templateId, t.runTypeId] },
  }),
);

// Template Parameters - Shared parameter system for ALL templates (run and message)
// Parameters are defined on templates with placeholders like {MV_THRESHOLD} or {REASON}
export const templateParameters = pgTable('template_parameters', {
  id: serial('id').primaryKey(),
  templateId: integer('template_id')
    .references(() => templates.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "mv_threshold" or "reason"
  displayName: text('display_name').notNull(), // e.g., "MV Threshold" or "Stop Reason"
  type: text('type').notNull().default('string'), // 'string' | 'int' | 'float' | 'bool'
  defaultValue: text('default_value'), // Optional default
  required: boolean('required').notNull().default(true),
});

// Run Type Parameter Defaults - Optional default values for template parameters per run type
// Allows a run type to set default values for parameters from its associated templates
export const runTypeParameterDefaults = pgTable('run_type_parameter_defaults', {
  id: serial('id').primaryKey(),
  runTypeId: integer('run_type_id')
    .references(() => runTypes.id)
    .notNull(),
  parameterId: integer('parameter_id')
    .references(() => templateParameters.id)
    .notNull(),
  defaultValue: text('default_value').notNull(),
});

// Run Parameter Values - Stores actual parameter values used for each run
// References templateParameters since that's now the source of truth
export const runParameterValues = pgTable('run_parameter_values', {
  id: serial('id').primaryKey(),
  runId: integer('run_id')
    .references(() => runs.id)
    .notNull(),
  parameterId: integer('parameter_id')
    .references(() => templateParameters.id)
    .notNull(),
  value: text('value').notNull(),
});

// Messages table - tracks sent DAQJob messages
export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  templateId: integer('template_id').references(() => templates.id),
  clientId: text('client_id').notNull(),
  targetDaqJobType: text('target_daq_job_type'), // e.g., 'DAQJobStoreCSV', null = broadcast
  targetDaqJobUniqueId: text('target_daq_job_unique_id'), // resolved unique_id, null = broadcast
  messageType: text('message_type').notNull(), // e.g., 'DAQJobMessageStop'
  payload: text('payload').notNull(), // The final JSON payload sent
  status: text('status').notNull().default('SENT'), // SENT, FAILED
  errorMessage: text('error_message'), // Error message if failed
  sentAt: timestamp('sent_at').notNull().defaultNow(),
  runId: integer('run_id').references(() => runs.id), // Optional: link to a run
});

// Message Parameter Values - Stores parameter values used for each message
export const messageParameterValues = pgTable('message_parameter_values', {
  id: serial('id').primaryKey(),
  messageId: integer('message_id')
    .references(() => messages.id)
    .notNull(),
  parameterId: integer('parameter_id')
    .references(() => templateParameters.id)
    .notNull(),
  value: text('value').notNull(),
});

// Type exports
export type Run = typeof runs.$inferSelect;
export type NewRun = typeof runs.$inferInsert;
export type Template = typeof templates.$inferSelect;
export type NewTemplate = typeof templates.$inferInsert;
export type RunType = typeof runTypes.$inferSelect;
export type NewRunType = typeof runTypes.$inferInsert;
export type TemplateRunType = typeof templateRunTypes.$inferSelect;
export type TemplateParameter = typeof templateParameters.$inferSelect;
export type NewTemplateParameter = typeof templateParameters.$inferInsert;
export type RunTypeParameterDefault =
  typeof runTypeParameterDefaults.$inferSelect;
export type NewRunTypeParameterDefault =
  typeof runTypeParameterDefaults.$inferInsert;
export type RunParameterValue = typeof runParameterValues.$inferSelect;
export type NewRunParameterValue = typeof runParameterValues.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type MessageParameterValue = typeof messageParameterValues.$inferSelect;
export type NewMessageParameterValue =
  typeof messageParameterValues.$inferInsert;
