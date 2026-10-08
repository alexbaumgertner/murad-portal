import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Idempotent on purpose: production once ran `create-admin` in push mode from this branch, which
  // created these objects outside migrations. Every statement is a no-op when the object exists.
  await db.execute(sql`
   DO $$ BEGIN
    CREATE TYPE "public"."enum_users_role" AS ENUM('owner', 'student');
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN
    CREATE TYPE "public"."enum_users_locale" AS ENUM('ru', 'en');
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN
    CREATE TYPE "public"."enum_users_address_form" AS ENUM('ty', 'vy');
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" "enum_users_role" DEFAULT 'owner' NOT NULL;
  ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "name" varchar;
  ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "invited_at" timestamp(3) with time zone;
  ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "locale" "enum_users_locale" DEFAULT 'ru';
  ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "address_form" "enum_users_address_form" DEFAULT 'ty';
  CREATE INDEX IF NOT EXISTS "users_role_idx" ON "users" USING btree ("role");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "users_role_idx";
  ALTER TABLE "users" DROP COLUMN "role";
  ALTER TABLE "users" DROP COLUMN "name";
  ALTER TABLE "users" DROP COLUMN "invited_at";
  ALTER TABLE "users" DROP COLUMN "locale";
  ALTER TABLE "users" DROP COLUMN "address_form";
  DROP TYPE "public"."enum_users_role";
  DROP TYPE "public"."enum_users_locale";
  DROP TYPE "public"."enum_users_address_form";`)
}
