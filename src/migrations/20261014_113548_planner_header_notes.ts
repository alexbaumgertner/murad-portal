import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_planner_notes_kind" AS ENUM('exercises', 'questions');
  CREATE TABLE "planner_notes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"week_id" integer NOT NULL,
  	"kind" "enum_planner_notes_kind" NOT NULL,
  	"day" numeric NOT NULL,
  	"text" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "planners" ADD COLUMN "student_name" varchar;
  ALTER TABLE "planners" ADD COLUMN "goal" varchar;
  ALTER TABLE "planners" ADD COLUMN "subtitle" varchar;
  ALTER TABLE "planners" ADD COLUMN "labels" jsonb;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "planner_notes_id" integer;
  ALTER TABLE "planner_notes" ADD CONSTRAINT "planner_notes_week_id_planner_weeks_id_fk" FOREIGN KEY ("week_id") REFERENCES "public"."planner_weeks"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "planner_notes_week_idx" ON "planner_notes" USING btree ("week_id");
  CREATE INDEX "planner_notes_updated_at_idx" ON "planner_notes" USING btree ("updated_at");
  CREATE INDEX "planner_notes_created_at_idx" ON "planner_notes" USING btree ("created_at");
  CREATE UNIQUE INDEX "week_kind_day_idx" ON "planner_notes" USING btree ("week_id","kind","day");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_planner_notes_fk" FOREIGN KEY ("planner_notes_id") REFERENCES "public"."planner_notes"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_planner_notes_id_idx" ON "payload_locked_documents_rels" USING btree ("planner_notes_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "planner_notes" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "planner_notes" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_planner_notes_fk";
  
  DROP INDEX "payload_locked_documents_rels_planner_notes_id_idx";
  ALTER TABLE "planners" DROP COLUMN "student_name";
  ALTER TABLE "planners" DROP COLUMN "goal";
  ALTER TABLE "planners" DROP COLUMN "subtitle";
  ALTER TABLE "planners" DROP COLUMN "labels";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "planner_notes_id";
  DROP TYPE "public"."enum_planner_notes_kind";`)
}
