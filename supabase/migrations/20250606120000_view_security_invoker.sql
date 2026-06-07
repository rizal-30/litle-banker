-- View default (security definer) bypass RLS pemilik view — ubah ke security invoker.
-- https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view

DROP VIEW IF EXISTS v_ringkasan_jenis;
DROP VIEW IF EXISTS v_ringkasan_harian;
DROP VIEW IF EXISTS v_saldo_nasabah;
DROP VIEW IF EXISTS v_saldo_saku;

CREATE VIEW v_saldo_saku
WITH (security_invoker = true)
AS
SELECT
  s.id,
  s.nama,
  s.jenis,
  s.aktif,
  s.pilih_di_transaksi,
  (
    COALESCE((
      SELECT SUM(
        CASE
          WHEN t.dibatalkan_pada IS NOT NULL THEN 0
          WHEN t.jenis = 'setoran' THEN t.jumlah
          WHEN t.jenis = 'pinjaman_kembali'
            AND NOT COALESCE(t.bayar_dari_tabungan, false) THEN t.jumlah
          WHEN t.jenis IN ('penarikan', 'pinjaman_keluar', 'transfer_saku') THEN -t.jumlah
          WHEN t.jenis = 'pembatalan' THEN 0
          ELSE 0
        END
      )
      FROM transaksi t
      LEFT JOIN transaksi a ON a.id = t.transaksi_asal_id
      WHERE t.saku_id = s.id
    ), 0)
    + COALESCE((
      SELECT SUM(
        CASE
          WHEN t.dibatalkan_pada IS NOT NULL THEN 0
          WHEN t.jenis = 'transfer_saku' THEN t.jumlah
          WHEN t.jenis = 'pembatalan' THEN 0
          ELSE 0
        END
      )
      FROM transaksi t
      LEFT JOIN transaksi a ON a.id = t.transaksi_asal_id
      WHERE t.saku_tujuan_id = s.id
    ), 0)
  )::NUMERIC(18, 2) AS saldo
FROM saku s
WHERE s.aktif = true;

CREATE VIEW v_saldo_nasabah
WITH (security_invoker = true)
AS
SELECT
  n.id,
  n.nama,
  n.telepon,
  n.aktif,
  COALESCE(SUM(
    CASE
      WHEN t.dibatalkan_pada IS NOT NULL THEN 0
      WHEN t.jenis = 'setoran' THEN t.jumlah
      WHEN t.jenis = 'penarikan' THEN -t.jumlah
      WHEN t.jenis = 'pinjaman_kembali'
        AND COALESCE(t.bayar_dari_tabungan, false) THEN -t.jumlah
      WHEN t.jenis = 'pembatalan' THEN 0
      ELSE 0
    END
  ), 0)::NUMERIC(18, 2) AS tabungan,
  COALESCE(SUM(
    CASE
      WHEN t.dibatalkan_pada IS NOT NULL THEN 0
      WHEN t.jenis = 'pinjaman_keluar' THEN t.jumlah
      WHEN t.jenis = 'pinjaman_kembali' THEN -t.jumlah
      WHEN t.jenis = 'pembatalan' THEN 0
      ELSE 0
    END
  ), 0)::NUMERIC(18, 2) AS hutang,
  COALESCE(SUM(
    CASE
      WHEN t.dibatalkan_pada IS NOT NULL THEN 0
      WHEN t.jenis = 'setoran' THEN t.jumlah
      WHEN t.jenis = 'penarikan' THEN -t.jumlah
      WHEN t.jenis = 'pinjaman_keluar' THEN -t.jumlah
      WHEN t.jenis = 'pinjaman_kembali'
        AND NOT COALESCE(t.bayar_dari_tabungan, false) THEN t.jumlah
      WHEN t.jenis = 'pembatalan' THEN 0
      ELSE 0
    END
  ), 0)::NUMERIC(18, 2) AS saldo
FROM nasabah n
LEFT JOIN transaksi t ON t.nasabah_id = n.id
LEFT JOIN transaksi a ON a.id = t.transaksi_asal_id
WHERE n.aktif = true
GROUP BY n.id, n.nama, n.telepon, n.aktif;

CREATE VIEW v_ringkasan_harian
WITH (security_invoker = true)
AS
SELECT
  t.tanggal,
  COALESCE(SUM(
    CASE
      WHEN t.dibatalkan_pada IS NOT NULL THEN 0
      WHEN t.jenis = 'setoran' THEN t.jumlah
      WHEN t.jenis = 'pinjaman_kembali'
        AND NOT COALESCE(t.bayar_dari_tabungan, false) THEN t.jumlah
      WHEN t.jenis = 'transfer_saku' AND t.saku_tujuan_id IS NOT NULL THEN t.jumlah
      WHEN t.jenis = 'pembatalan' THEN 0
      ELSE 0
    END
  ), 0)::NUMERIC(18, 2) AS total_masuk,
  COALESCE(SUM(
    CASE
      WHEN t.dibatalkan_pada IS NOT NULL THEN 0
      WHEN t.jenis IN ('penarikan', 'pinjaman_keluar') THEN t.jumlah
      WHEN t.jenis = 'transfer_saku' AND t.saku_id IS NOT NULL THEN t.jumlah
      WHEN t.jenis = 'pembatalan' THEN 0
      ELSE 0
    END
  ), 0)::NUMERIC(18, 2) AS total_keluar,
  COUNT(*) FILTER (WHERE t.dibatalkan_pada IS NULL)::INT AS jumlah_transaksi
FROM transaksi t
LEFT JOIN transaksi a ON a.id = t.transaksi_asal_id
GROUP BY t.tanggal
ORDER BY t.tanggal;

CREATE VIEW v_ringkasan_jenis
WITH (security_invoker = true)
AS
SELECT
  t.jenis,
  COUNT(*) FILTER (WHERE t.dibatalkan_pada IS NULL)::INT AS jumlah_count,
  COALESCE(SUM(
    CASE WHEN t.dibatalkan_pada IS NOT NULL THEN 0 ELSE t.jumlah END
  ), 0)::NUMERIC(18, 2) AS total_jumlah
FROM transaksi t
GROUP BY t.jenis;

GRANT SELECT ON v_saldo_saku TO authenticated;
GRANT SELECT ON v_saldo_nasabah TO authenticated;
GRANT SELECT ON v_ringkasan_harian TO authenticated;
GRANT SELECT ON v_ringkasan_jenis TO authenticated;

COMMENT ON VIEW v_saldo_nasabah IS
  'tabungan = setoran−penarikan; hutang = pinjaman_keluar−pinjaman_kembali; saldo = tabungan−hutang (neto). RLS invoker.';
