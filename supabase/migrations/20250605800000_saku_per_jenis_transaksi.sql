-- Aturan saku per jenis transaksi + flag sembunyikan dari form transaksi

ALTER TABLE saku
  ADD COLUMN IF NOT EXISTS pilih_di_transaksi BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN saku.pilih_di_transaksi IS
  'false = saku tidak muncul di combobox form transaksi baru; saldo tetap dihitung.';

DROP VIEW IF EXISTS v_ringkasan_jenis;
DROP VIEW IF EXISTS v_ringkasan_harian;
DROP VIEW IF EXISTS v_saldo_nasabah;
DROP VIEW IF EXISTS v_saldo_saku;

CREATE OR REPLACE VIEW v_saldo_saku AS
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

CREATE OR REPLACE VIEW v_saldo_nasabah AS
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

CREATE OR REPLACE VIEW v_ringkasan_harian AS
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

CREATE OR REPLACE VIEW v_ringkasan_jenis AS
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

CREATE OR REPLACE FUNCTION fn_cek_saldo_non_negatif()
RETURNS TRIGGER AS $$
DECLARE
  v_saldo_saku NUMERIC(18, 2);
  v_saldo_nasabah NUMERIC(18, 2);
  v_tabungan NUMERIC(18, 2);
  v_hutang NUMERIC(18, 2);
  v_delta_saku NUMERIC(18, 2);
  v_delta_saku_tujuan NUMERIC(18, 2);
  v_delta_nasabah NUMERIC(18, 2);
  v_nama_saku TEXT;
  v_nama_saku_tujuan TEXT;
  v_nama_nasabah TEXT;
  v_jenis_saku jenis_saku;
  v_pilih_di_transaksi BOOLEAN;
  v_asal_jenis jenis_transaksi;
  v_asal_bayar_dari_tabungan BOOLEAN;
BEGIN
  IF NEW.jenis = 'pembatalan' THEN
    SELECT jenis, COALESCE(bayar_dari_tabungan, false)
    INTO v_asal_jenis, v_asal_bayar_dari_tabungan
    FROM transaksi WHERE id = NEW.transaksi_asal_id;

    IF v_asal_jenis IS NULL THEN
      RAISE EXCEPTION 'Transaksi asal pembatalan tidak ditemukan.';
    END IF;

    SELECT d.delta_saku_asal, d.delta_saku_tujuan, d.delta_nasabah
    INTO v_delta_saku, v_delta_saku_tujuan, v_delta_nasabah
    FROM fn_delta_pembatalan(v_asal_jenis, NEW.jumlah, v_asal_bayar_dari_tabungan) AS d;

    IF NEW.saku_id IS NOT NULL AND v_delta_saku < 0 THEN
      SELECT COALESCE(
        (SELECT saldo FROM v_saldo_saku WHERE id = NEW.saku_id), 0
      ) INTO v_saldo_saku;
      SELECT nama INTO v_nama_saku FROM saku WHERE id = NEW.saku_id;
      IF v_saldo_saku + v_delta_saku < 0 THEN
        RAISE EXCEPTION
          'Saldo saku "%" tidak cukup (tersedia %, butuh %).',
          COALESCE(v_nama_saku, 'saku'), v_saldo_saku, NEW.jumlah;
      END IF;
    END IF;

    IF NEW.saku_tujuan_id IS NOT NULL AND v_delta_saku_tujuan < 0 THEN
      SELECT COALESCE(
        (SELECT saldo FROM v_saldo_saku WHERE id = NEW.saku_tujuan_id), 0
      ) INTO v_saldo_saku;
      SELECT nama INTO v_nama_saku_tujuan FROM saku WHERE id = NEW.saku_tujuan_id;
      IF v_saldo_saku + v_delta_saku_tujuan < 0 THEN
        RAISE EXCEPTION
          'Saldo saku "%" tidak cukup (tersedia %, butuh %).',
          COALESCE(v_nama_saku_tujuan, 'saku tujuan'), v_saldo_saku, NEW.jumlah;
      END IF;
    END IF;

    IF NEW.nasabah_id IS NOT NULL AND v_delta_nasabah < 0 THEN
      SELECT COALESCE(
        (SELECT saldo FROM v_saldo_nasabah WHERE id = NEW.nasabah_id), 0
      ) INTO v_saldo_nasabah;
      SELECT nama INTO v_nama_nasabah FROM nasabah WHERE id = NEW.nasabah_id;
      IF v_saldo_nasabah + v_delta_nasabah < 0 THEN
        RAISE EXCEPTION
          'Saldo nasabah "%" tidak cukup (tersedia %, butuh %).',
          COALESCE(v_nama_nasabah, 'nasabah'), v_saldo_nasabah, NEW.jumlah;
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.jenis = 'pinjaman_kembali' AND NEW.bayar_dari_tabungan THEN
    IF NEW.nasabah_id IS NULL THEN
      RAISE EXCEPTION 'Nasabah wajib untuk setoran pinjaman dari tabungan.';
    END IF;

    SELECT
      COALESCE(tabungan, 0),
      COALESCE(hutang, 0),
      nama
    INTO v_tabungan, v_hutang, v_nama_nasabah
    FROM v_saldo_nasabah
    WHERE id = NEW.nasabah_id;

    IF v_tabungan < NEW.jumlah THEN
      RAISE EXCEPTION
        'Tabungan nasabah "%" tidak cukup (tersedia %, butuh %).',
        COALESCE(v_nama_nasabah, 'nasabah'), v_tabungan, NEW.jumlah;
    END IF;

    IF v_hutang < NEW.jumlah THEN
      RAISE EXCEPTION
        'Hutang nasabah "%" kurang dari jumlah pembayaran (hutang %, bayar %).',
        COALESCE(v_nama_nasabah, 'nasabah'), v_hutang, NEW.jumlah;
    END IF;

    RETURN NEW;
  END IF;

  -- Transaksi nasabah tunai: hanya kas/bank, bukan instrumen/deposito
  IF NEW.jenis IN ('setoran', 'penarikan', 'pinjaman_keluar')
     OR (NEW.jenis = 'pinjaman_kembali' AND NOT NEW.bayar_dari_tabungan) THEN
    IF NEW.saku_id IS NOT NULL THEN
      SELECT jenis, nama, COALESCE(pilih_di_transaksi, true)
      INTO v_jenis_saku, v_nama_saku, v_pilih_di_transaksi
      FROM saku WHERE id = NEW.saku_id;

      IF v_jenis_saku = 'instrumen' THEN
        RAISE EXCEPTION
          'Transaksi % tidak boleh memakai saku instrumen/deposito "%".',
          NEW.jenis, COALESCE(v_nama_saku, 'saku');
      END IF;

      IF NOT v_pilih_di_transaksi THEN
        RAISE EXCEPTION
          'Saku "%" tidak tersedia untuk transaksi baru.',
          COALESCE(v_nama_saku, 'saku');
      END IF;
    END IF;
  END IF;

  -- Transfer: semua jenis saku OK, tapi saku tersembunyi tetap ditolak
  IF NEW.jenis = 'transfer_saku' THEN
    IF NEW.saku_id IS NOT NULL THEN
      SELECT nama, COALESCE(pilih_di_transaksi, true)
      INTO v_nama_saku, v_pilih_di_transaksi
      FROM saku WHERE id = NEW.saku_id;
      IF NOT v_pilih_di_transaksi THEN
        RAISE EXCEPTION
          'Saku "%" tidak tersedia untuk transaksi baru.',
          COALESCE(v_nama_saku, 'saku');
      END IF;
    END IF;

    IF NEW.saku_tujuan_id IS NOT NULL THEN
      SELECT nama, COALESCE(pilih_di_transaksi, true)
      INTO v_nama_saku_tujuan, v_pilih_di_transaksi
      FROM saku WHERE id = NEW.saku_tujuan_id;
      IF NOT v_pilih_di_transaksi THEN
        RAISE EXCEPTION
          'Saku tujuan "%" tidak tersedia untuk transaksi baru.',
          COALESCE(v_nama_saku_tujuan, 'saku tujuan');
      END IF;
    END IF;
  END IF;

  IF NEW.saku_id IS NOT NULL THEN
    v_delta_saku := CASE NEW.jenis
      WHEN 'setoran' THEN NEW.jumlah
      WHEN 'pinjaman_kembali' THEN NEW.jumlah
      WHEN 'penarikan' THEN -NEW.jumlah
      WHEN 'pinjaman_keluar' THEN -NEW.jumlah
      WHEN 'transfer_saku' THEN -NEW.jumlah
      ELSE 0
    END;

    IF v_delta_saku < 0 THEN
      SELECT COALESCE(
        (SELECT saldo FROM v_saldo_saku WHERE id = NEW.saku_id), 0
      ) INTO v_saldo_saku;
      SELECT nama INTO v_nama_saku FROM saku WHERE id = NEW.saku_id;
      IF v_saldo_saku + v_delta_saku < 0 THEN
        RAISE EXCEPTION
          'Saldo saku "%" tidak cukup (tersedia %, butuh %).',
          COALESCE(v_nama_saku, 'saku'), v_saldo_saku, NEW.jumlah;
      END IF;
    END IF;
  END IF;

  IF NEW.nasabah_id IS NOT NULL AND NEW.jenis = 'penarikan' THEN
    SELECT COALESCE(
      (SELECT saldo FROM v_saldo_nasabah WHERE id = NEW.nasabah_id), 0
    ) INTO v_saldo_nasabah;
    SELECT nama INTO v_nama_nasabah FROM nasabah WHERE id = NEW.nasabah_id;
    IF v_saldo_nasabah - NEW.jumlah < 0 THEN
      RAISE EXCEPTION
        'Saldo nasabah "%" tidak cukup (tersedia %, butuh %).',
        COALESCE(v_nama_nasabah, 'nasabah'), v_saldo_nasabah, NEW.jumlah;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
