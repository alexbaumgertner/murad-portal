import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "planner_cells" ADD COLUMN "own" boolean DEFAULT false;
  CREATE INDEX IF NOT EXISTS "changelog_locales_parent_id_idx" ON "changelog_locales" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "challenges_locales_parent_id_idx" ON "challenges_locales" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "slot_types_locales_parent_id_idx" ON "slot_types_locales" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "programs_locales_parent_id_idx" ON "programs_locales" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX IF EXISTS "changelog_locales_parent_id_idx";
  DROP INDEX IF EXISTS "challenges_locales_parent_id_idx";
  DROP INDEX IF EXISTS "slot_types_locales_parent_id_idx";
  DROP INDEX IF EXISTS "programs_locales_parent_id_idx";
  ALTER TABLE "planner_cells" DROP COLUMN "own";`)
}
