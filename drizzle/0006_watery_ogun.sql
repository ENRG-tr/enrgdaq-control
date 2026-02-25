ALTER TABLE "run_metadata" ADD COLUMN "updated_by" text;--> statement-breakpoint
ALTER TABLE "run_metadata" ADD COLUMN "updated_at" timestamp DEFAULT now();