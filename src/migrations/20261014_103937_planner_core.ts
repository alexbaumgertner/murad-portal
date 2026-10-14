import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "planners" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"student_id" integer NOT NULL,
  	"base_date" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "planner_weeks" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"planner_id" integer NOT NULL,
  	"index" numeric NOT NULL,
  	"row_count" numeric DEFAULT 1 NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "planner_cells" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"week_id" integer NOT NULL,
  	"row" numeric NOT NULL,
  	"day" numeric NOT NULL,
  	"text" varchar DEFAULT '',
  	"done" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "planners_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "planner_weeks_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "planner_cells_id" integer;
  ALTER TABLE "planners" ADD CONSTRAINT "planners_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "planner_weeks" ADD CONSTRAINT "planner_weeks_planner_id_planners_id_fk" FOREIGN KEY ("planner_id") REFERENCES "public"."planners"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "planner_cells" ADD CONSTRAINT "planner_cells_week_id_planner_weeks_id_fk" FOREIGN KEY ("week_id") REFERENCES "public"."planner_weeks"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "planners_student_idx" ON "planners" USING btree ("student_id");
  CREATE INDEX "planners_updated_at_idx" ON "planners" USING btree ("updated_at");
  CREATE INDEX "planners_created_at_idx" ON "planners" USING btree ("created_at");
  CREATE INDEX "planner_weeks_planner_idx" ON "planner_weeks" USING btree ("planner_id");
  CREATE INDEX "planner_weeks_updated_at_idx" ON "planner_weeks" USING btree ("updated_at");
  CREATE INDEX "planner_weeks_created_at_idx" ON "planner_weeks" USING btree ("created_at");
  CREATE UNIQUE INDEX "planner_index_idx" ON "planner_weeks" USING btree ("planner_id","index");
  CREATE INDEX "planner_cells_week_idx" ON "planner_cells" USING btree ("week_id");
  CREATE INDEX "planner_cells_updated_at_idx" ON "planner_cells" USING btree ("updated_at");
  CREATE INDEX "planner_cells_created_at_idx" ON "planner_cells" USING btree ("created_at");
  CREATE UNIQUE INDEX "week_row_day_idx" ON "planner_cells" USING btree ("week_id","row","day");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_planners_fk" FOREIGN KEY ("planners_id") REFERENCES "public"."planners"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_planner_weeks_fk" FOREIGN KEY ("planner_weeks_id") REFERENCES "public"."planner_weeks"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_planner_cells_fk" FOREIGN KEY ("planner_cells_id") REFERENCES "public"."planner_cells"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_planners_id_idx" ON "payload_locked_documents_rels" USING btree ("planners_id");
  CREATE INDEX "payload_locked_documents_rels_planner_weeks_id_idx" ON "payload_locked_documents_rels" USING btree ("planner_weeks_id");
  CREATE INDEX "payload_locked_documents_rels_planner_cells_id_idx" ON "payload_locked_documents_rels" USING btree ("planner_cells_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "planners" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "planner_weeks" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "planner_cells" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "planners" CASCADE;
  DROP TABLE "planner_weeks" CASCADE;
  DROP TABLE "planner_cells" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_planners_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_planner_weeks_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_planner_cells_fk";
  
  DROP INDEX "payload_locked_documents_rels_planners_id_idx";
  DROP INDEX "payload_locked_documents_rels_planner_weeks_id_idx";
  DROP INDEX "payload_locked_documents_rels_planner_cells_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "planners_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "planner_weeks_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "planner_cells_id";`)
}
