import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "slot_logs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"enrollment_id" integer NOT NULL,
  	"date" timestamp(3) with time zone NOT NULL,
  	"slot_index" numeric NOT NULL,
  	"slot_type_id" integer NOT NULL,
  	"minutes" numeric DEFAULT 0 NOT NULL,
  	"completed" boolean DEFAULT false NOT NULL,
  	"timer_started_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "slot_logs_id" integer;
  ALTER TABLE "slot_logs" ADD CONSTRAINT "slot_logs_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "slot_logs" ADD CONSTRAINT "slot_logs_slot_type_id_slot_types_id_fk" FOREIGN KEY ("slot_type_id") REFERENCES "public"."slot_types"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "slot_logs_enrollment_idx" ON "slot_logs" USING btree ("enrollment_id");
  CREATE INDEX "slot_logs_date_idx" ON "slot_logs" USING btree ("date");
  CREATE INDEX "slot_logs_slot_type_idx" ON "slot_logs" USING btree ("slot_type_id");
  CREATE INDEX "slot_logs_timer_started_at_idx" ON "slot_logs" USING btree ("timer_started_at");
  CREATE INDEX "slot_logs_updated_at_idx" ON "slot_logs" USING btree ("updated_at");
  CREATE INDEX "slot_logs_created_at_idx" ON "slot_logs" USING btree ("created_at");
  CREATE UNIQUE INDEX "enrollment_date_slotIndex_idx" ON "slot_logs" USING btree ("enrollment_id","date","slot_index");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_slot_logs_fk" FOREIGN KEY ("slot_logs_id") REFERENCES "public"."slot_logs"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_slot_logs_id_idx" ON "payload_locked_documents_rels" USING btree ("slot_logs_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "slot_logs" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "slot_logs" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_slot_logs_fk";
  
  DROP INDEX "payload_locked_documents_rels_slot_logs_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "slot_logs_id";`)
}
