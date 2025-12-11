ALTER TABLE "runs" ADD COLUMN "daq_job_ids" json;--> statement-breakpoint
ALTER TABLE "runs" DROP COLUMN "daq_job_name";