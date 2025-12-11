import { pgTable, serial, text, timestamp, boolean, json } from 'drizzle-orm/pg-core';

// Runs table - tracks DAQ acquisition runs
export const runs = pgTable('runs', {
  id: serial('id').primaryKey(),
  description: text('description').notNull(),
  startTime: timestamp('start_time').notNull().defaultNow(),
  endTime: timestamp('end_time'),
  status: text('status').notNull().default('RUNNING'), // RUNNING, COMPLETED, STOPPED
  daqJobIds: json('daq_job_ids').$type<string[]>(),
  config: text('config'),
  clientId: text('client_id'),
});

// Templates table - DAQ job configuration templates
export const templates = pgTable('templates', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  displayName: text('display_name').notNull(),
  config: text('config').notNull(),
  type: text('type').notNull().default('normal'), // 'normal' or 'run' or other
  editable: boolean('editable').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Type exports
export type Run = typeof runs.$inferSelect;
export type NewRun = typeof runs.$inferInsert;
export type Template = typeof templates.$inferSelect;
export type NewTemplate = typeof templates.$inferInsert;
