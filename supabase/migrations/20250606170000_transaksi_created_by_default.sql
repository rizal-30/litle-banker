-- Isi created_by otomatis jika klien/RPC lupa set (auth.uid() saat insert).

CREATE OR REPLACE FUNCTION fn_set_transaksi_created_by()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  IF NEW.updated_by IS NULL THEN
    NEW.updated_by := COALESCE(auth.uid(), NEW.created_by);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_transaksi_created_by ON transaksi;
CREATE TRIGGER trg_set_transaksi_created_by
  BEFORE INSERT ON transaksi
  FOR EACH ROW EXECUTE FUNCTION fn_set_transaksi_created_by();
