-- Cegah saldo saku (kas/bank/instrumen) minus saat transaksi keluar
-- Cegah penarikan nasabah melebihi saldo tabungan

CREATE OR REPLACE FUNCTION fn_cek_saldo_non_negatif()
RETURNS TRIGGER AS $$
DECLARE
  v_saldo_saku NUMERIC(18, 2);
  v_saldo_nasabah NUMERIC(18, 2);
  v_delta_saku NUMERIC(18, 2);
  v_nama_saku TEXT;
  v_nama_nasabah TEXT;
BEGIN
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
        (SELECT saldo FROM v_saldo_saku WHERE id = NEW.saku_id),
        0
      ) INTO v_saldo_saku;

      SELECT nama INTO v_nama_saku FROM saku WHERE id = NEW.saku_id;

      IF v_saldo_saku + v_delta_saku < 0 THEN
        RAISE EXCEPTION
          'Saldo saku "%" tidak cukup (tersedia %, butuh %).',
          COALESCE(v_nama_saku, 'saku'),
          v_saldo_saku,
          NEW.jumlah;
      END IF;
    END IF;
  END IF;

  IF NEW.nasabah_id IS NOT NULL AND NEW.jenis = 'penarikan' THEN
    SELECT COALESCE(
      (SELECT saldo FROM v_saldo_nasabah WHERE id = NEW.nasabah_id),
      0
    ) INTO v_saldo_nasabah;

    SELECT nama INTO v_nama_nasabah FROM nasabah WHERE id = NEW.nasabah_id;

    IF v_saldo_nasabah - NEW.jumlah < 0 THEN
      RAISE EXCEPTION
        'Saldo nasabah "%" tidak cukup (tersedia %, butuh %).',
        COALESCE(v_nama_nasabah, 'nasabah'),
        v_saldo_nasabah,
        NEW.jumlah;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cek_saldo_non_negatif ON transaksi;
CREATE TRIGGER trg_cek_saldo_non_negatif
  BEFORE INSERT ON transaksi
  FOR EACH ROW EXECUTE FUNCTION fn_cek_saldo_non_negatif();

COMMENT ON FUNCTION fn_cek_saldo_non_negatif() IS
  'Tolak transaksi yang membuat saldo saku minus, atau penarikan melebihi saldo nasabah.';
