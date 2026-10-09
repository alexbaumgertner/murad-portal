import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_task_pool_level" AS ENUM('A1', 'A2', 'B1', 'B2', 'C1', 'C2');
  CREATE TABLE "task_pool" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"level" "enum_task_pool_level" NOT NULL,
  	"slot_type_id" integer,
  	"title" varchar NOT NULL,
  	"text_ru" varchar NOT NULL,
  	"text_en" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "program_plan_items" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"program_id" integer NOT NULL,
  	"week" numeric NOT NULL,
  	"day" numeric NOT NULL,
  	"order" numeric DEFAULT 1 NOT NULL,
  	"task_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "task_pool_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "program_plan_items_id" integer;
  ALTER TABLE "task_pool" ADD CONSTRAINT "task_pool_slot_type_id_slot_types_id_fk" FOREIGN KEY ("slot_type_id") REFERENCES "public"."slot_types"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "program_plan_items" ADD CONSTRAINT "program_plan_items_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "program_plan_items" ADD CONSTRAINT "program_plan_items_task_id_task_pool_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task_pool"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "task_pool_level_idx" ON "task_pool" USING btree ("level");
  CREATE INDEX "task_pool_slot_type_idx" ON "task_pool" USING btree ("slot_type_id");
  CREATE INDEX "task_pool_updated_at_idx" ON "task_pool" USING btree ("updated_at");
  CREATE INDEX "task_pool_created_at_idx" ON "task_pool" USING btree ("created_at");
  CREATE INDEX "program_plan_items_program_idx" ON "program_plan_items" USING btree ("program_id");
  CREATE INDEX "program_plan_items_task_idx" ON "program_plan_items" USING btree ("task_id");
  CREATE INDEX "program_plan_items_updated_at_idx" ON "program_plan_items" USING btree ("updated_at");
  CREATE INDEX "program_plan_items_created_at_idx" ON "program_plan_items" USING btree ("created_at");
  CREATE UNIQUE INDEX "program_week_day_order_idx" ON "program_plan_items" USING btree ("program_id","week","day","order");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_task_pool_fk" FOREIGN KEY ("task_pool_id") REFERENCES "public"."task_pool"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_program_plan_items_fk" FOREIGN KEY ("program_plan_items_id") REFERENCES "public"."program_plan_items"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_task_pool_id_idx" ON "payload_locked_documents_rels" USING btree ("task_pool_id");
  CREATE INDEX "payload_locked_documents_rels_program_plan_items_id_idx" ON "payload_locked_documents_rels" USING btree ("program_plan_items_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "task_pool" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "program_plan_items" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "task_pool" CASCADE;
  DROP TABLE "program_plan_items" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_task_pool_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_program_plan_items_fk";
  
  DROP INDEX "payload_locked_documents_rels_task_pool_id_idx";
  DROP INDEX "payload_locked_documents_rels_program_plan_items_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "task_pool_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "program_plan_items_id";
  DROP TYPE "public"."enum_task_pool_level";`)
}
