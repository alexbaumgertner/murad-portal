import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "student_assignments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"enrollment_id" integer NOT NULL,
  	"week" numeric NOT NULL,
  	"day" numeric NOT NULL,
  	"order" numeric DEFAULT 1 NOT NULL,
  	"source_task_id" integer,
  	"text_ru" varchar,
  	"text_en" varchar,
  	"edited_by_owner" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "student_assignments_id" integer;
  ALTER TABLE "student_assignments" ADD CONSTRAINT "student_assignments_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "student_assignments" ADD CONSTRAINT "student_assignments_source_task_id_task_pool_id_fk" FOREIGN KEY ("source_task_id") REFERENCES "public"."task_pool"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "student_assignments_enrollment_idx" ON "student_assignments" USING btree ("enrollment_id");
  CREATE INDEX "student_assignments_source_task_idx" ON "student_assignments" USING btree ("source_task_id");
  CREATE INDEX "student_assignments_updated_at_idx" ON "student_assignments" USING btree ("updated_at");
  CREATE INDEX "student_assignments_created_at_idx" ON "student_assignments" USING btree ("created_at");
  CREATE UNIQUE INDEX "enrollment_week_day_order_idx" ON "student_assignments" USING btree ("enrollment_id","week","day","order");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_student_assignments_fk" FOREIGN KEY ("student_assignments_id") REFERENCES "public"."student_assignments"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_student_assignments_id_idx" ON "payload_locked_documents_rels" USING btree ("student_assignments_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "student_assignments" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "student_assignments" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_student_assignments_fk";
  
  DROP INDEX "payload_locked_documents_rels_student_assignments_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "student_assignments_id";`)
}
