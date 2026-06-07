-- Setoran pinjaman bisa dibayar dari tabungan nasabah (offset internal, tanpa arus kas saku)

ALTER TABLE transaksi
  ADD COLUMN IF NOT EXISTS bayar_dari_tabungan BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE transaksi DROP CONSTRAINT IF EXISTS bayar_dari_tabungan_hanya_pinjaman;
ALTER TABLE transaksi ADD CONSTRAINT bayar_dari_tabungan_hanya_pinjaman CHECK (
  NOT bayar_dari_tabungan OR jenis = 'pinjaman_kembali'
);

ALTER TABLE transaksi DROP CONSTRAINT IF EXISTS bayar_dari_tabungan_tanpa_saku;
ALTER TABLE transaksi ADD CONSTRAINT bayar_dari_tabungan_tanpa_saku CHECK (
  NOT bayar_dari_tabungan OR saku_id IS NULL
);

COMMENT ON COLUMN transaksi.bayar_dari_tabungan IS
  'Hanya pinjaman_kembali: hutang turun dan tabungan turun, tanpa uang masuk saku.';

CREATE OR REPLACE FUNCTION fn_delta_pembatalan(
  p_asal_jenis jenis_transaksi,
  p_jumlah NUMERIC,
  p_bayar_dari_tabungan BOOLEAN DEFAULT false,
  OUT delta_saku_asal NUMERIC,
  OUT delta_saku_tujuan NUMERIC,
  OUT delta_nasabah NUMERIC
) AS $$
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
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION fn_restrict_transaksi_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.dibatalkan_pada IS NOT NULL
     AND (
       OLD.dibatalkan_pada IS DISTINCT FROM NEW.dibatalkan_pada
       OR OLD.dibatalkan_oleh IS DISTINCT FROM NEW.dibatalkan_oleh
       OR OLD.alasan_pembatalan IS DISTINCT FROM NEW.alasan_pembatalan
     ) THEN
    RAISE EXCEPTION 'Flag pembatalan tidak boleh diubah.';
  END IF;

  IF OLD.transaksi_asal_id IS DISTINCT FROM NEW.transaksi_asal_id THEN
    RAISE EXCEPTION 'transaksi_asal_id tidak boleh diubah.';
  END IF;

  IF OLD.tanggal IS DISTINCT FROM NEW.tanggal
     OR OLD.jenis IS DISTINCT FROM NEW.jenis
     OR OLD.jumlah IS DISTINCT FROM NEW.jumlah
     OR OLD.nasabah_id IS DISTINCT FROM NEW.nasabah_id
     OR OLD.saku_id IS DISTINCT FROM NEW.saku_id
     OR OLD.saku_tujuan_id IS DISTINCT FROM NEW.saku_tujuan_id
     OR OLD.bayar_dari_tabungan IS DISTINCT FROM NEW.bayar_dari_tabungan THEN
    RAISE EXCEPTION
      'Saldo tidak boleh diubah dengan edit transaksi lama. Buat transaksi baru (setor/tarik/pengeluaran/transfer).';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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
