CREATE TABLE "run_metadata" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"user_id" integer,
	"details" text,
	CONSTRAINT "run_metadata_run_id_unique" UNIQUE("run_id")
);
--> statement-breakpoint
ALTER TABLE "run_metadata" ADD CONSTRAINT "run_metadata_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;