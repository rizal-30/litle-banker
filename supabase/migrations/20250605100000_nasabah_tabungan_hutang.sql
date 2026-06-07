-- Breakdown tabungan & hutang di view nasabah (saldo neto tetap)

DROP VIEW IF EXISTS v_saldo_nasabah;

CREATE OR REPLACE VIEW v_saldo_nasabah AS
SELECT
  n.id,
  n.nama,
  n.telepon,
  n.aktif,
  COALESCE(SUM(
    CASE
      WHEN t.jenis = 'setoran' THEN t.jumlah
      WHEN t.jenis = 'penarikan' THEN -t.jumlah
      ELSE 0
    END
  ), 0)::NUMERIC(18, 2) AS tabungan,
  COALESCE(SUM(
    CASE
      WHEN t.jenis = 'pinjaman_keluar' THEN t.jumlah
      WHEN t.jenis = 'pinjaman_kembali' THEN -t.jumlah
      ELSE 0
    END
  ), 0)::NUMERIC(18, 2) AS hutang,
  COALESCE(SUM(
    CASE
      WHEN t.jenis IN ('setoran', 'pinjaman_kembali') THEN t.jumlah
      WHEN t.jenis IN ('penarikan', 'pinjaman_keluar') THEN -t.jumlah
      ELSE 0
    END
  ), 0)::NUMERIC(18, 2) AS saldo
FROM nasabah n
LEFT JOIN transaksi t ON t.nasabah_id = n.id
WHERE n.aktif = true
GROUP BY n.id, n.nama, n.telepon, n.aktif;

GRANT SELECT ON v_saldo_nasabah TO authenticated;

COMMENT ON VIEW v_saldo_nasabah IS
  'tabungan = setoran−penarikan; hutang = pinjaman_keluar−pinjaman_kembali; saldo = tabungan−hutang (neto).';
