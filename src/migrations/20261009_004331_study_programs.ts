import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_programs_level_from" AS ENUM('A1', 'A2', 'B1', 'B2', 'C1');
  CREATE TYPE "public"."enum_programs_level_to" AS ENUM('A2', 'B1', 'B2', 'C1', 'C2');
  CREATE TYPE "public"."enum_programs_status" AS ENUM('draft', 'published');
  CREATE TABLE "slot_types" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"default_min_minutes" numeric DEFAULT 20 NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "slot_types_locales" (
  	"name" varchar NOT NULL,
  	"description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "programs_week_template_slots" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"slot_type_id" integer NOT NULL,
  	"min_minutes" numeric
  );
  
  CREATE TABLE "programs_week_template" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "programs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar NOT NULL,
  	"level_from" "enum_programs_level_from" NOT NULL,
  	"level_to" "enum_programs_level_to" NOT NULL,
  	"duration_weeks" numeric DEFAULT 52 NOT NULL,
  	"status" "enum_programs_status" DEFAULT 'draft' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "programs_locales" (
  	"title" varchar NOT NULL,
  	"summary" varchar,
  	"materials" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "slot_types_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "programs_id" integer;
  ALTER TABLE "slot_types_locales" ADD CONSTRAINT "slot_types_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."slot_types"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "programs_week_template_slots" ADD CONSTRAINT "programs_week_template_slots_slot_type_id_slot_types_id_fk" FOREIGN KEY ("slot_type_id") REFERENCES "public"."slot_types"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "programs_week_template_slots" ADD CONSTRAINT "programs_week_template_slots_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."programs_week_template"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "programs_week_template" ADD CONSTRAINT "programs_week_template_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "programs_locales" ADD CONSTRAINT "programs_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "slot_types_updated_at_idx" ON "slot_types" USING btree ("updated_at");
  CREATE INDEX "slot_types_created_at_idx" ON "slot_types" USING btree ("created_at");
  CREATE UNIQUE INDEX "slot_types_locales_locale_parent_id_unique" ON "slot_types_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "programs_week_template_slots_order_idx" ON "programs_week_template_slots" USING btree ("_order");
  CREATE INDEX "programs_week_template_slots_parent_id_idx" ON "programs_week_template_slots" USING btree ("_parent_id");
  CREATE INDEX "programs_week_template_slots_slot_type_idx" ON "programs_week_template_slots" USING btree ("slot_type_id");
  CREATE INDEX "programs_week_template_order_idx" ON "programs_week_template" USING btree ("_order");
  CREATE INDEX "programs_week_template_parent_id_idx" ON "programs_week_template" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "programs_slug_idx" ON "programs" USING btree ("slug");
  CREATE INDEX "programs_status_idx" ON "programs" USING btree ("status");
  CREATE INDEX "programs_updated_at_idx" ON "programs" USING btree ("updated_at");
  CREATE INDEX "programs_created_at_idx" ON "programs" USING btree ("created_at");
  CREATE UNIQUE INDEX "programs_locales_locale_parent_id_unique" ON "programs_locales" USING btree ("_locale","_parent_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_slot_types_fk" FOREIGN KEY ("slot_types_id") REFERENCES "public"."slot_types"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_programs_fk" FOREIGN KEY ("programs_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_slot_types_id_idx" ON "payload_locked_documents_rels" USING btree ("slot_types_id");
  CREATE INDEX "payload_locked_documents_rels_programs_id_idx" ON "payload_locked_documents_rels" USING btree ("programs_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "slot_types" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "slot_types_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "programs_week_template_slots" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "programs_week_template" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "programs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "programs_locales" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "slot_types" CASCADE;
  DROP TABLE "slot_types_locales" CASCADE;
  DROP TABLE "programs_week_template_slots" CASCADE;
  DROP TABLE "programs_week_template" CASCADE;
  DROP TABLE "programs" CASCADE;
  DROP TABLE "programs_locales" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_slot_types_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_programs_fk";
  
  DROP INDEX "payload_locked_documents_rels_slot_types_id_idx";
  DROP INDEX "payload_locked_documents_rels_programs_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "slot_types_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "programs_id";
  DROP TYPE "public"."enum_programs_level_from";
  DROP TYPE "public"."enum_programs_level_to";
  DROP TYPE "public"."enum_programs_status";`)
}
