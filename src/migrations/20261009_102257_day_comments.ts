import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "day_comments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"enrollment_id" integer NOT NULL,
  	"student_id" integer,
  	"date" timestamp(3) with time zone NOT NULL,
  	"text" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "day_comments_id" integer;
  ALTER TABLE "day_comments" ADD CONSTRAINT "day_comments_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "day_comments" ADD CONSTRAINT "day_comments_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "day_comments_enrollment_idx" ON "day_comments" USING btree ("enrollment_id");
  CREATE INDEX "day_comments_student_idx" ON "day_comments" USING btree ("student_id");
  CREATE INDEX "day_comments_date_idx" ON "day_comments" USING btree ("date");
  CREATE INDEX "day_comments_updated_at_idx" ON "day_comments" USING btree ("updated_at");
  CREATE INDEX "day_comments_created_at_idx" ON "day_comments" USING btree ("created_at");
  CREATE UNIQUE INDEX "enrollment_date_idx" ON "day_comments" USING btree ("enrollment_id","date");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_day_comments_fk" FOREIGN KEY ("day_comments_id") REFERENCES "public"."day_comments"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_day_comments_id_idx" ON "payload_locked_documents_rels" USING btree ("day_comments_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "day_comments" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "day_comments" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_day_comments_fk";
  
  DROP INDEX "payload_locked_documents_rels_day_comments_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "day_comments_id";`)
}
