-- ============================================================================
-- 09_fix_alumni_year_column_type.sql
-- Ensure alumni.year is text, matching the app's free-text "year" field.
--
-- WHY:
--   The Alumni admin form always sends a "year" value (even "" when left
--   blank), and the field is meant to hold free text like "2023" or
--   "Class of 2022". If this database's alumni.year column was created as
--   an integer (schema drift from an earlier ad-hoc setup), saving with the
--   year left blank fails with:
--   "invalid input syntax for type integer: """.
--   Converting the column to text (safe/idempotent if already text) fixes
--   this permanently and matches db/migrations/01_profiles_and_people.sql.
-- ============================================================================

alter table public.alumni
  alter column year type text using year::text;
