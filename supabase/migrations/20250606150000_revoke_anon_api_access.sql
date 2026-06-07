-- Sembunyikan tabel/view admin dari GraphQL & REST anon (tanpa login).
-- RLS sudah blok data, tapi GRANT ke anon masih expose schema di introspection.
-- https://supabase.com/docs/guides/database/database-linter?lint=0026_pg_graphql_anon_table_exposed

REVOKE ALL ON TABLE public.audit_log FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.profiles FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.saku FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.nasabah FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.transaksi FROM anon, PUBLIC;

REVOKE ALL ON TABLE public.v_saldo_saku FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.v_saldo_nasabah FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.v_ringkasan_harian FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.v_ringkasan_jenis FROM anon, PUBLIC;

REVOKE ALL ON FUNCTION public.batalkan_transaksi(uuid, text) FROM anon, PUBLIC;

-- authenticated: akses lewat RLS (hanya admin)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.saku TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.nasabah TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.transaksi TO authenticated;

GRANT SELECT ON TABLE public.v_saldo_saku TO authenticated;
GRANT SELECT ON TABLE public.v_saldo_nasabah TO authenticated;
GRANT SELECT ON TABLE public.v_ringkasan_harian TO authenticated;
GRANT SELECT ON TABLE public.v_ringkasan_jenis TO authenticated;

GRANT EXECUTE ON FUNCTION public.batalkan_transaksi(uuid, text) TO authenticated;

-- Objek baru di public tidak auto-grant ke anon
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM anon, PUBLIC;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE USAGE, SELECT ON SEQUENCES FROM anon, PUBLIC;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, PUBLIC;
