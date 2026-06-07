-- Gabungkan modal ke pinjaman, hapus jenis modal_keluar & modal_kembali
-- Idempotent: UPDATE 0 baris jika init.sql sudah tanpa modal

UPDATE transaksi SET jenis = 'pinjaman_keluar'::jenis_transaksi
WHERE jenis::text = 'modal_keluar';

UPDATE transaksi SET jenis = 'pinjaman_kembali'::jenis_transaksi
WHERE jenis::text = 'modal_kembali';

DROP VIEW IF EXISTS v_ringkasan_jenis;
DROP VIEW IF EXISTS v_ringkasan_harian;
DROP VIEW IF EXISTS v_saldo_nasabah;
DROP VIEW IF EXISTS v_saldo_saku;

DROP TRIGGER IF EXISTS trg_restrict_transaksi_update ON transaksi;
ALTER TABLE transaksi DROP CONSTRAINT IF EXISTS transfer_butuh_tujuan;
ALTER TABLE transaksi DROP CONSTRAINT IF EXISTS transfer_butuh_asal;

CREATE TYPE jenis_transaksi_new AS ENUM (
  'setoran',
  'penarikan',
  'pinjaman_keluar',
  'pinjaman_kembali',
  'transfer_saku'
);

ALTER TABLE transaksi
  ALTER COLUMN jenis TYPE jenis_transaksi_new
  USING jenis::text::jenis_transaksi_new;

DROP TYPE jenis_transaksi;
ALTER TYPE jenis_transaksi_new RENAME TO jenis_transaksi;

ALTER TABLE transaksi ADD CONSTRAINT transfer_butuh_tujuan CHECK (
  jenis <> 'transfer_saku' OR saku_tujuan_id IS NOT NULL
);
ALTER TABLE transaksi ADD CONSTRAINT transfer_butuh_asal CHECK (
  jenis <> 'transfer_saku' OR saku_id IS NOT NULL
);

CREATE TRIGGER trg_restrict_transaksi_update
  BEFORE UPDATE ON transaksi
  FOR EACH ROW EXECUTE FUNCTION fn_restrict_transaksi_update();

CREATE OR REPLACE VIEW v_saldo_saku AS
SELECT
  s.id,
  s.nama,
  s.jenis,
  s.aktif,
  (
    COALESCE((
      SELECT SUM(t.jumlah) FROM transaksi t
      WHERE t.saku_id = s.id
        AND t.jenis IN ('setoran', 'pinjaman_kembali')
    ), 0)
    - COALESCE((
      SELECT SUM(t.jumlah) FROM transaksi t
      WHERE t.saku_id = s.id
        AND t.jenis IN ('penarikan', 'pinjaman_keluar', 'transfer_saku')
    ), 0)
    + COALESCE((
      SELECT SUM(t.jumlah) FROM transaksi t
      WHERE t.saku_tujuan_id = s.id AND t.jenis = 'transfer_saku'
    ), 0)
  )::NUMERIC(18, 2) AS saldo
FROM saku s
WHERE s.aktif = true;

CREATE OR REPLACE VIEW v_saldo_nasabah AS
SELECT
  n.id,
  n.nama,
  n.telepon,
  n.aktif,
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

CREATE OR REPLACE VIEW v_ringkasan_harian AS
SELECT
  tanggal,
  COALESCE(SUM(CASE WHEN jenis IN ('setoran', 'pinjaman_kembali') THEN jumlah
    WHEN jenis = 'transfer_saku' AND saku_tujuan_id IS NOT NULL THEN jumlah ELSE 0 END), 0)::NUMERIC(18, 2) AS total_masuk,
  COALESCE(SUM(CASE WHEN jenis IN ('penarikan', 'pinjaman_keluar') THEN jumlah
    WHEN jenis = 'transfer_saku' AND saku_id IS NOT NULL THEN jumlah ELSE 0 END), 0)::NUMERIC(18, 2) AS total_keluar,
  COUNT(*)::INT AS jumlah_transaksi
FROM transaksi
GROUP BY tanggal
ORDER BY tanggal;

CREATE OR REPLACE VIEW v_ringkasan_jenis AS
SELECT
  jenis,
  COUNT(*)::INT AS jumlah_count,
  COALESCE(SUM(jumlah), 0)::NUMERIC(18, 2) AS total_jumlah
FROM transaksi
GROUP BY jenis;
