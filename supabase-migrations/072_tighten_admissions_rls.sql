-- Tighten RLS on the legacy `admissions` table.
-- The original policies used USING (true) and WITH CHECK (true) for "demo purposes".
-- This table is no longer queried by the application (superseded by the `patients` table),
-- but RLS must still be correct before production launch.
--
-- Policy: restrict to authenticated users only (no anon access).
-- A future migration can add hospital_id scoping if this table is ever actively used.

DROP POLICY IF EXISTS "Allow public insert" ON admissions;
DROP POLICY IF EXISTS "Allow public read" ON admissions;

CREATE POLICY "Authenticated users can read admissions" ON admissions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert admissions" ON admissions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
