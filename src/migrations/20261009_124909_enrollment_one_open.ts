import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// D-SP-6: one assigned/active/paused enrollment per student. The collection hook checks it too;
// this partial unique index closes the race between two parallel assigns. Payload's schema cannot
// express a partial index, so it lives only here.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE UNIQUE INDEX IF NOT EXISTS "enrollments_one_open_per_student_idx" ON "enrollments" USING btree ("student_id") WHERE "status" IN ('assigned', 'active', 'paused');`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX IF EXISTS "enrollments_one_open_per_student_idx";`)
}
