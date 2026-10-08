import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_role" AS ENUM('owner', 'student');
  CREATE TYPE "public"."enum_users_locale" AS ENUM('ru', 'en');
  CREATE TYPE "public"."enum_users_address_form" AS ENUM('ty', 'vy');
  ALTER TABLE "users" ADD COLUMN "role" "enum_users_role" DEFAULT 'owner' NOT NULL;
  ALTER TABLE "users" ADD COLUMN "name" varchar;
  ALTER TABLE "users" ADD COLUMN "invited_at" timestamp(3) with time zone;
  ALTER TABLE "users" ADD COLUMN "locale" "enum_users_locale" DEFAULT 'ru';
  ALTER TABLE "users" ADD COLUMN "address_form" "enum_users_address_form" DEFAULT 'ty';
  CREATE INDEX "users_role_idx" ON "users" USING btree ("role");`)
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
