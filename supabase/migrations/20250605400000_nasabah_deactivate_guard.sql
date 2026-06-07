-- Cegah nonaktifkan nasabah yang masih punya tabungan/hutang; larang hard delete

CREATE OR REPLACE FUNCTION fn_block_nasabah_nonzero_deactivate()
RETURNS TRIGGER AS $$
DECLARE
  v_tabungan NUMERIC(18, 2);
  v_hutang NUMERIC(18, 2);
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION
      'Nasabah tidak boleh dihapus. Gunakan nonaktifkan.';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.aktif = true AND NEW.aktif = false THEN
    SELECT
      COALESCE((SELECT tabungan FROM v_saldo_nasabah WHERE id = OLD.id), 0),
      COALESCE((SELECT hutang FROM v_saldo_nasabah WHERE id = OLD.id), 0)
    INTO v_tabungan, v_hutang;

    IF v_tabungan <> 0 THEN
      RAISE EXCEPTION
        'Nasabah masih punya tabungan. Tarik lewat Transaksi terlebih dahulu.';
    END IF;

    IF v_hutang <> 0 THEN
      RAISE EXCEPTION
        'Nasabah masih punya hutang. Lunasi lewat Transaksi terlebih dahulu.';
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_block_nasabah_nonzero_deactivate ON nasabah;
CREATE TRIGGER trg_block_nasabah_nonzero_deactivate
  BEFORE UPDATE OF aktif OR DELETE ON nasabah
  FOR EACH ROW EXECUTE FUNCTION fn_block_nasabah_nonzero_deactivate();

COMMENT ON FUNCTION fn_block_nasabah_nonzero_deactivate() IS
  'Larang nonaktifkan nasabah jika tabungan/hutang <> 0; hard delete selalu ditolak.';
