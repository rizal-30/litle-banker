-- audit_log: cabut SELECT authenticated agar tidak muncul di GraphQL schema (lint 0027).
-- Baca lewat RPC list_audit_log (hanya admin).

CREATE OR REPLACE FUNCTION public.list_audit_log(p_limit integer DEFAULT 200)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  aksi text,
  tabel text,
  record_id uuid,
  data_sebelum jsonb,
  data_sesudah jsonb,
  created_at timestamptz,
  nama_lengkap text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (SELECT public.is_admin()) THEN
    RAISE EXCEPTION 'Hanya admin yang boleh melihat audit log.';
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    a.user_id,
    a.aksi,
    a.tabel,
    a.record_id,
    a.data_sebelum,
    a.data_sesudah,
    a.created_at,
    p.nama_lengkap
  FROM public.audit_log a
  LEFT JOIN public.profiles p ON p.id = a.user_id
  ORDER BY a.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 200), 500));
END;
$$;

REVOKE ALL ON TABLE public.audit_log FROM authenticated, PUBLIC;

REVOKE ALL ON FUNCTION public.list_audit_log(integer) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_audit_log(integer) TO authenticated;

COMMENT ON FUNCTION public.list_audit_log(integer) IS
  'Audit log untuk admin — tabel audit_log tidak di-GRANT ke authenticated (GraphQL).';
