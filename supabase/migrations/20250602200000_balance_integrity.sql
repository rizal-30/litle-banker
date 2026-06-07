-- Integritas saldo: hanya transaksi yang boleh mengubah arus kas / saldo
-- Saldo saku & nasabah dihitung dari view (read-only), tidak ada kolom saldo di tabel.

-- 1. Transaksi tidak boleh dihapus — buat transaksi koreksi/balik
CREATE OR REPLACE FUNCTION fn_block_transaksi_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'Transaksi tidak boleh dihapus. Saldo hanya berubah lewat transaksi baru (mis. koreksi setor/tarik/pinjaman).';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_block_transaksi_delete ON transaksi;
CREATE TRIGGER trg_block_transaksi_delete
  BEFORE DELETE ON transaksi
  FOR EACH ROW EXECUTE FUNCTION fn_block_transaksi_delete();

-- 2. Larangan edit field yang mengubah saldo — hanya keterangan boleh diperbaiki
CREATE OR REPLACE FUNCTION fn_restrict_transaksi_update()
RETURNS TRIGGER AS $$
BEGIN
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

DROP TRIGGER IF EXISTS trg_restrict_transaksi_update ON transaksi;
CREATE TRIGGER trg_restrict_transaksi_update
  BEFORE UPDATE ON transaksi
  FOR EACH ROW EXECUTE FUNCTION fn_restrict_transaksi_update();

-- 3. Tabel saku/nasabah tidak punya kolom saldo — dokumentasi constraint
COMMENT ON TABLE saku IS 'Hanya metadata saku. Saldo di v_saldo_saku — hanya berubah via transaksi.';
COMMENT ON TABLE nasabah IS 'Hanya data nasabah. Saldo di v_saldo_nasabah — hanya berubah via transaksi.';
