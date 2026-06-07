-- Cegah nonaktifkan/hapus saku yang masih ada saldonya

CREATE OR REPLACE FUNCTION fn_block_saku_nonzero_remove()
RETURNS TRIGGER AS $$
DECLARE
  v_saldo NUMERIC(18, 2);
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.aktif = true AND NEW.aktif = false THEN
    SELECT COALESCE((
      SELECT saldo FROM v_saldo_saku WHERE id = OLD.id
    ), 0) INTO v_saldo;

    IF v_saldo <> 0 THEN
      RAISE EXCEPTION
        'Saku masih berisi saldo. Pindahkan uang lewat transfer antar saku terlebih dahulu.';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    SELECT COALESCE((
      SELECT saldo FROM v_saldo_saku WHERE id = OLD.id
    ), 0) INTO v_saldo;

    IF v_saldo <> 0 THEN
      RAISE EXCEPTION
        'Saku masih berisi saldo. Pindahkan uang lewat transfer antar saku terlebih dahulu.';
    END IF;
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_block_saku_nonzero_remove ON saku;
CREATE TRIGGER trg_block_saku_nonzero_remove
  BEFORE UPDATE OF aktif OR DELETE ON saku
  FOR EACH ROW EXECUTE FUNCTION fn_block_saku_nonzero_remove();

COMMENT ON FUNCTION fn_block_saku_nonzero_remove() IS
  'Larang nonaktifkan/hapus saku jika v_saldo_saku <> 0 — uang harus ditransfer dulu.';
