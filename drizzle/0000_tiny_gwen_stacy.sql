CREATE TABLE "message_parameter_values" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" integer NOT NULL,
	"parameter_id" integer NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_id" integer,
	"client_id" text NOT NULL,
	"target_daq_job_type" text,
	"target_daq_job_unique_id" text,
	"message_type" text NOT NULL,
	"payload" text NOT NULL,
	"status" text DEFAULT 'SENT' NOT NULL,
	"error_message" text,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"run_id" integer
);
--> statement-breakpoint
CREATE TABLE "run_parameter_values" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"parameter_id" integer NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "run_type_parameter_defaults" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_type_id" integer NOT NULL,
	"parameter_id" integer NOT NULL,
	"default_value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "run_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"required_tags" json,
	CONSTRAINT "run_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"description" text NOT NULL,
	"start_time" timestamp DEFAULT now() NOT NULL,
	"end_time" timestamp,
	"status" text DEFAULT 'RUNNING' NOT NULL,
	"daq_job_ids" json,
	"config" text,
	"client_id" text,
	"run_type_id" integer
);
--> statement-breakpoint
CREATE TABLE "template_parameters" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_id" integer NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"type" text DEFAULT 'string' NOT NULL,
	"default_value" text,
	"required" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template_run_types" (
	"template_id" integer NOT NULL,
	"run_type_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"config" text NOT NULL,
	"type" text DEFAULT 'normal' NOT NULL,
	"editable" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"message_type" text,
	"payload_template" text,
	"target_daq_job_type" text,
	CONSTRAINT "templates_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "message_parameter_values" ADD CONSTRAINT "message_parameter_values_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_parameter_values" ADD CONSTRAINT "message_parameter_values_parameter_id_template_parameters_id_fk" FOREIGN KEY ("parameter_id") REFERENCES "public"."template_parameters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_parameter_values" ADD CONSTRAINT "run_parameter_values_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_parameter_values" ADD CONSTRAINT "run_parameter_values_parameter_id_template_parameters_id_fk" FOREIGN KEY ("parameter_id") REFERENCES "public"."template_parameters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_type_parameter_defaults" ADD CONSTRAINT "run_type_parameter_defaults_run_type_id_run_types_id_fk" FOREIGN KEY ("run_type_id") REFERENCES "public"."run_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_type_parameter_defaults" ADD CONSTRAINT "run_type_parameter_defaults_parameter_id_template_parameters_id_fk" FOREIGN KEY ("parameter_id") REFERENCES "public"."template_parameters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_run_type_id_run_types_id_fk" FOREIGN KEY ("run_type_id") REFERENCES "public"."run_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_parameters" ADD CONSTRAINT "template_parameters_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_run_types" ADD CONSTRAINT "template_run_types_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_run_types" ADD CONSTRAINT "template_run_types_run_type_id_run_types_id_fk" FOREIGN KEY ("run_type_id") REFERENCES "public"."run_types"("id") ON DELETE no action ON UPDATE no action;