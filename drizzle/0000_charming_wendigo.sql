CREATE TABLE "runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"description" text NOT NULL,
	"start_time" timestamp DEFAULT now() NOT NULL,
	"end_time" timestamp,
	"status" text DEFAULT 'RUNNING' NOT NULL,
	"daq_job_name" text,
	"config" text,
	"client_id" text
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"config" text NOT NULL,
	"source" text DEFAULT 'custom' NOT NULL,
	"editable" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "templates_name_unique" UNIQUE("name")
);
