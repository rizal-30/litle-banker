-- Kunci search_path pada fungsi trigger/RPC (cegah search_path hijacking).
-- https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

ALTER FUNCTION public.fn_audit_log() SET search_path = public;
ALTER FUNCTION public.fn_block_transaksi_delete() SET search_path = public;
ALTER FUNCTION public.fn_restrict_transaksi_update() SET search_path = public;
ALTER FUNCTION public.fn_cek_saldo_non_negatif() SET search_path = public;
ALTER FUNCTION public.fn_block_saku_nonzero_remove() SET search_path = public;
ALTER FUNCTION public.fn_block_nasabah_nonzero_deactivate() SET search_path = public;
ALTER FUNCTION public.fn_guard_pembatalan_insert() SET search_path = public;
ALTER FUNCTION public.fn_delta_pembatalan(jenis_transaksi, numeric, boolean)
  SET search_path = public;
