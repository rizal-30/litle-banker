-- Hapus nasabah hanya jika belum punya transaksi; nonaktifkan tetap butuh tabungan/hutang nol

CREATE OR REPLACE FUNCTION fn_block_nasabah_nonzero_deactivate()
RETURNS TRIGGER AS $$
DECLARE
  v_tabungan NUMERIC(18, 2);
  v_hutang NUMERIC(18, 2);
  v_trx_count BIGINT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT COUNT(*) INTO v_trx_count
    FROM transaksi
    WHERE nasabah_id = OLD.id;

    IF v_trx_count > 0 THEN
      RAISE EXCEPTION
        'Nasabah tidak boleh dihapus karena masih punya riwayat transaksi. Gunakan nonaktifkan.';
    END IF;

    RETURN OLD;
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

COMMENT ON FUNCTION fn_block_nasabah_nonzero_deactivate() IS
  'Nonaktifkan ditolak jika tabungan/hutang <> 0; hapus ditolak jika masih ada transaksi.';
