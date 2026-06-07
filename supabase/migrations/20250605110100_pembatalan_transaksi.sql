-- Pembatalan transaksi: storno + flag asal, view saldo efektif, RPC atomik

ALTER TABLE transaksi
  ADD COLUMN IF NOT EXISTS transaksi_asal_id UUID REFERENCES transaksi(id),
  ADD COLUMN IF NOT EXISTS dibatalkan_pada TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dibatalkan_oleh UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS alasan_pembatalan TEXT;

ALTER TABLE transaksi DROP CONSTRAINT IF EXISTS pembatalan_butuh_asal;
ALTER TABLE transaksi ADD CONSTRAINT pembatalan_butuh_asal CHECK (
  jenis <> 'pembatalan' OR transaksi_asal_id IS NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS transaksi_pembatalan_asal_uniq
  ON transaksi (transaksi_asal_id)
  WHERE jenis = 'pembatalan' AND transaksi_asal_id IS NOT NULL;

-- Delta keuangan pembatalan = kebalikan jenis asal
CREATE OR REPLACE FUNCTION fn_delta_pembatalan(
  p_asal_jenis jenis_transaksi,
  p_jumlah NUMERIC,
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
      delta_saku_asal := -p_jumlah;
      delta_nasabah := -p_jumlah;
    WHEN 'transfer_saku' THEN
      delta_saku_asal := p_jumlah;
      delta_saku_tujuan := -p_jumlah;
    ELSE NULL;
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION fn_guard_pembatalan_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.jenis = 'pembatalan' THEN
    IF current_setting('app.batalkan', true) IS DISTINCT FROM '1' THEN
      RAISE EXCEPTION 'Pembatalan hanya lewat batalkan_transaksi().';
    END IF;
    IF NEW.transaksi_asal_id IS NULL THEN
      RAISE EXCEPTION 'Pembatalan wajib punya transaksi_asal_id.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_guard_pembatalan_insert ON transaksi;
CREATE TRIGGER trg_01_guard_pembatalan_insert
  BEFORE INSERT ON transaksi
  FOR EACH ROW EXECUTE FUNCTION fn_guard_pembatalan_insert();

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
     OR OLD.saku_tujuan_id IS DISTINCT FROM NEW.saku_tujuan_id THEN
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
  v_delta_saku NUMERIC(18, 2);
  v_delta_saku_tujuan NUMERIC(18, 2);
  v_delta_nasabah NUMERIC(18, 2);
  v_nama_saku TEXT;
  v_nama_saku_tujuan TEXT;
  v_nama_nasabah TEXT;
  v_asal_jenis jenis_transaksi;
BEGIN
  IF NEW.jenis = 'pembatalan' THEN
    SELECT jenis INTO v_asal_jenis
    FROM transaksi WHERE id = NEW.transaksi_asal_id;

    IF v_asal_jenis IS NULL THEN
      RAISE EXCEPTION 'Transaksi asal pembatalan tidak ditemukan.';
    END IF;

    SELECT d.delta_saku_asal, d.delta_saku_tujuan, d.delta_nasabah
    INTO v_delta_saku, v_delta_saku_tujuan, v_delta_nasabah
    FROM fn_delta_pembatalan(v_asal_jenis, NEW.jumlah) AS d;

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

-- View saldo saku (efektif, termasuk pembatalan)
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
          WHEN t.jenis IN ('setoran', 'pinjaman_kembali') THEN t.jumlah
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
      WHEN t.jenis IN ('setoran', 'pinjaman_kembali') THEN t.jumlah
      WHEN t.jenis IN ('penarikan', 'pinjaman_keluar') THEN -t.jumlah
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
      WHEN t.jenis IN ('setoran', 'pinjaman_kembali') THEN t.jumlah
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

CREATE OR REPLACE FUNCTION batalkan_transaksi(
  p_transaksi_id UUID,
  p_alasan TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_asal transaksi%ROWTYPE;
  v_pembatalan_id UUID;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Hanya admin yang boleh membatalkan transaksi.';
  END IF;

  IF p_alasan IS NULL OR length(trim(p_alasan)) < 10 THEN
    RAISE EXCEPTION 'Alasan pembatalan wajib diisi (min. 10 karakter).';
  END IF;

  SELECT * INTO v_asal FROM transaksi WHERE id = p_transaksi_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaksi tidak ditemukan.';
  END IF;

  IF v_asal.dibatalkan_pada IS NOT NULL THEN
    RAISE EXCEPTION 'Transaksi sudah dibatalkan.';
  END IF;

  IF v_asal.jenis = 'pembatalan' THEN
    RAISE EXCEPTION 'Transaksi pembatalan tidak bisa dibatalkan.';
  END IF;

  PERFORM set_config('app.batalkan', '1', true);

  INSERT INTO transaksi (
    tanggal,
    jenis,
    jumlah,
    keterangan,
    nasabah_id,
    saku_id,
    saku_tujuan_id,
    transaksi_asal_id,
    created_by,
    updated_by
  ) VALUES (
    CURRENT_DATE,
    'pembatalan',
    v_asal.jumlah,
    'Pembatalan: ' || left(trim(p_alasan), 200),
    v_asal.nasabah_id,
    v_asal.saku_id,
    v_asal.saku_tujuan_id,
    v_asal.id,
    auth.uid(),
    auth.uid()
  )
  RETURNING id INTO v_pembatalan_id;

  UPDATE transaksi SET
    dibatalkan_pada = now(),
    dibatalkan_oleh = auth.uid(),
    alasan_pembatalan = trim(p_alasan),
    updated_by = auth.uid()
  WHERE id = v_asal.id;

  RETURN v_pembatalan_id;
END;
$$;

GRANT EXECUTE ON FUNCTION batalkan_transaksi(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION batalkan_transaksi(UUID, TEXT) IS
  'Batalkan transaksi: insert storno + tandai asal (atomik).';
