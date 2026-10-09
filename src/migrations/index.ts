import * as migration_20260930_181743_initial from './20260930_181743_initial';
import * as migration_20260930_185348_email_otp_auth from './20260930_185348_email_otp_auth';
import * as migration_20261001_144024_localize_changelog from './20261001_144024_localize_changelog';
import * as migration_20261007_214306_challenges from './20261007_214306_challenges';
import * as migration_20261008_175101_user_roles from './20261008_175101_user_roles';
import * as migration_20261009_004331_study_programs from './20261009_004331_study_programs';
import * as migration_20261009_065237_study_plan from './20261009_065237_study_plan';
import * as migration_20261009_074618_enrollments from './20261009_074618_enrollments';
import * as migration_20261009_083238_student_plan from './20261009_083238_student_plan';
import * as migration_20261009_094359_slot_timer from './20261009_094359_slot_timer';

export const migrations = [
  {
    up: migration_20260930_181743_initial.up,
    down: migration_20260930_181743_initial.down,
    name: '20260930_181743_initial',
  },
  {
    up: migration_20260930_185348_email_otp_auth.up,
    down: migration_20260930_185348_email_otp_auth.down,
    name: '20260930_185348_email_otp_auth',
  },
  {
    up: migration_20261001_144024_localize_changelog.up,
    down: migration_20261001_144024_localize_changelog.down,
    name: '20261001_144024_localize_changelog',
  },
  {
    up: migration_20261007_214306_challenges.up,
    down: migration_20261007_214306_challenges.down,
    name: '20261007_214306_challenges',
  },
  {
    up: migration_20261008_175101_user_roles.up,
    down: migration_20261008_175101_user_roles.down,
    name: '20261008_175101_user_roles',
  },
  {
    up: migration_20261009_004331_study_programs.up,
    down: migration_20261009_004331_study_programs.down,
    name: '20261009_004331_study_programs',
  },
  {
    up: migration_20261009_065237_study_plan.up,
    down: migration_20261009_065237_study_plan.down,
    name: '20261009_065237_study_plan',
  },
  {
    up: migration_20261009_074618_enrollments.up,
    down: migration_20261009_074618_enrollments.down,
    name: '20261009_074618_enrollments',
  },
  {
    up: migration_20261009_083238_student_plan.up,
    down: migration_20261009_083238_student_plan.down,
    name: '20261009_083238_student_plan',
  },
  {
    up: migration_20261009_094359_slot_timer.up,
    down: migration_20261009_094359_slot_timer.down,
    name: '20261009_094359_slot_timer'
  },
];
