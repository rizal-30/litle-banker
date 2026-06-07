-- fn_delta_pembatalan: overload lama (2 arg) masih ada setelah tambah bayar_dari_tabungan.
-- Linter flag fungsi yang search_path-nya belum dikunci.

DROP FUNCTION IF EXISTS public.fn_delta_pembatalan(jenis_transaksi, numeric);

CREATE OR REPLACE FUNCTION public.fn_delta_pembatalan(
  p_asal_jenis jenis_transaksi,
  p_jumlah NUMERIC,
  p_bayar_dari_tabungan BOOLEAN DEFAULT false,
  OUT delta_saku_asal NUMERIC,
  OUT delta_saku_tujuan NUMERIC,
  OUT delta_nasabah NUMERIC
)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  delta_saku_asal := 0;
  delta_saku_tujuan := 0;
  delta_nasabah := 0;
  CASE p_asal_jenis
    WHEN 'setoran' THEN
      delta_saku_asal := -p_jumlah;
      delta_nasabah := -p_jumlah;
    WHEN 'penarikan' THEN
      delta_saku_asal := p_jumlah;
      delta_nasabah := p_jumlah;
    WHEN 'pinjaman_keluar' THEN
      delta_saku_asal := p_jumlah;
      delta_nasabah := p_jumlah;
    WHEN 'pinjaman_kembali' THEN
      IF p_bayar_dari_tabungan THEN
        delta_saku_asal := 0;
        delta_nasabah := 0;
      ELSE
        delta_saku_asal := -p_jumlah;
        delta_nasabah := -p_jumlah;
      END IF;
    WHEN 'transfer_saku' THEN
      delta_saku_asal := p_jumlah;
      delta_saku_tujuan := -p_jumlah;
    ELSE NULL;
  END CASE;
END;
$$;
