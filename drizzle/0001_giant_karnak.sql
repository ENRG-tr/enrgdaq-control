ALTER TABLE "templates" ADD COLUMN "type" text DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "templates" DROP COLUMN "source";