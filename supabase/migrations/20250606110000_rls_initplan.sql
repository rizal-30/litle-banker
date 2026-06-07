-- RLS InitPlan: auth.uid() / is_admin() dievaluasi sekali per query, bukan per baris.
-- https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = (SELECT auth.uid())
      AND peran = 'admin'
      AND aktif = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

DROP POLICY IF EXISTS profiles_select ON profiles;
DROP POLICY IF EXISTS profiles_update_own ON profiles;
DROP POLICY IF EXISTS saku_all ON saku;
DROP POLICY IF EXISTS nasabah_all ON nasabah;
DROP POLICY IF EXISTS transaksi_all ON transaksi;
DROP POLICY IF EXISTS audit_select ON audit_log;

CREATE POLICY profiles_select ON profiles
  FOR SELECT TO authenticated
  USING ((SELECT is_admin()));

CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()) AND (SELECT is_admin()));

CREATE POLICY saku_all ON saku
  FOR ALL TO authenticated
  USING ((SELECT is_admin()))
  WITH CHECK ((SELECT is_admin()));

CREATE POLICY nasabah_all ON nasabah
  FOR ALL TO authenticated
  USING ((SELECT is_admin()))
  WITH CHECK ((SELECT is_admin()));

CREATE POLICY transaksi_all ON transaksi
  FOR ALL TO authenticated
  USING ((SELECT is_admin()))
  WITH CHECK ((SELECT is_admin()));

CREATE POLICY audit_select ON audit_log
  FOR SELECT TO authenticated
  USING ((SELECT is_admin()));
