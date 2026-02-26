CREATE TABLE "webhooks" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"secret" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"trigger_on_run" boolean DEFAULT false NOT NULL,
	"trigger_on_message" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
