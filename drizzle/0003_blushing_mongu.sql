CREATE TABLE "run_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	CONSTRAINT "run_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "template_run_types" (
	"template_id" integer NOT NULL,
	"run_type_id" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "run_type_id" integer;--> statement-breakpoint
ALTER TABLE "template_run_types" ADD CONSTRAINT "template_run_types_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_run_types" ADD CONSTRAINT "template_run_types_run_type_id_run_types_id_fk" FOREIGN KEY ("run_type_id") REFERENCES "public"."run_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_run_type_id_run_types_id_fk" FOREIGN KEY ("run_type_id") REFERENCES "public"."run_types"("id") ON DELETE no action ON UPDATE no action;