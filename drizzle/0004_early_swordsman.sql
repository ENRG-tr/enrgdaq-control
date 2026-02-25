ALTER TABLE "runs" ADD COLUMN "is_deleted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "templates" ADD COLUMN "restart_on_crash" boolean DEFAULT true NOT NULL;