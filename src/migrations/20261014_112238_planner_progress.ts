import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "planners" ADD COLUMN "show_week_progress" boolean DEFAULT true;
  ALTER TABLE "planners" ADD COLUMN "show_four_week_progress" boolean DEFAULT false;
  ALTER TABLE "planners" ADD COLUMN "show_deadline_progress" boolean DEFAULT false;
  ALTER TABLE "planners" ADD COLUMN "deadline_title" varchar;
  ALTER TABLE "planners" ADD COLUMN "deadline_date" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "planners" DROP COLUMN "show_week_progress";
  ALTER TABLE "planners" DROP COLUMN "show_four_week_progress";
  ALTER TABLE "planners" DROP COLUMN "show_deadline_progress";
  ALTER TABLE "planners" DROP COLUMN "deadline_title";
  ALTER TABLE "planners" DROP COLUMN "deadline_date";`)
}
