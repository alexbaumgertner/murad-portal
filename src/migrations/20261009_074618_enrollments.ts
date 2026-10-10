import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_enrollments_placement_test" AS ENUM('murad', 'ielts', 'toefl', 'cambridge', 'duolingo', 'pte', 'efset', 'other');
  CREATE TYPE "public"."enum_enrollments_placement_cefr" AS ENUM('A1', 'A2', 'B1', 'B2', 'C1', 'C2');
  CREATE TYPE "public"."enum_enrollments_placement_exam" AS ENUM('KET', 'PET', 'FCE', 'CAE', 'CPE');
  CREATE TYPE "public"."enum_enrollments_status" AS ENUM('assigned', 'active', 'paused', 'finished');
  CREATE TABLE "enrollments_pauses" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"from" timestamp(3) with time zone NOT NULL,
  	"to" timestamp(3) with time zone
  );
  
  CREATE TABLE "enrollments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"student_id" integer NOT NULL,
  	"placement_test" "enum_enrollments_placement_test" DEFAULT 'murad' NOT NULL,
  	"placement_cefr" "enum_enrollments_placement_cefr" NOT NULL,
  	"placement_taken_at" timestamp(3) with time zone NOT NULL,
  	"placement_test_name" varchar,
  	"placement_score_text" varchar,
  	"placement_exam" "enum_enrollments_placement_exam",
  	"placement_score" numeric,
  	"placement_note" varchar,
  	"program_id" integer NOT NULL,
  	"status" "enum_enrollments_status" DEFAULT 'assigned' NOT NULL,
  	"assigned_at" timestamp(3) with time zone,
  	"start_date" timestamp(3) with time zone,
  	"timezone" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "enrollments_id" integer;
  ALTER TABLE "enrollments_pauses" ADD CONSTRAINT "enrollments_pauses_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "enrollments_pauses_order_idx" ON "enrollments_pauses" USING btree ("_order");
  CREATE INDEX "enrollments_pauses_parent_id_idx" ON "enrollments_pauses" USING btree ("_parent_id");
  CREATE INDEX "enrollments_student_idx" ON "enrollments" USING btree ("student_id");
  CREATE INDEX "enrollments_program_idx" ON "enrollments" USING btree ("program_id");
  CREATE INDEX "enrollments_status_idx" ON "enrollments" USING btree ("status");
  CREATE INDEX "enrollments_updated_at_idx" ON "enrollments" USING btree ("updated_at");
  CREATE INDEX "enrollments_created_at_idx" ON "enrollments" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_enrollments_fk" FOREIGN KEY ("enrollments_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_enrollments_id_idx" ON "payload_locked_documents_rels" USING btree ("enrollments_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "enrollments_pauses" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "enrollments" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "enrollments_pauses" CASCADE;
  DROP TABLE "enrollments" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_enrollments_fk";
  
  DROP INDEX IF EXISTS "payload_locked_documents_rels_enrollments_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "enrollments_id";
  DROP TYPE "public"."enum_enrollments_placement_test";
  DROP TYPE "public"."enum_enrollments_placement_cefr";
  DROP TYPE "public"."enum_enrollments_placement_exam";
  DROP TYPE "public"."enum_enrollments_status";`)
}
