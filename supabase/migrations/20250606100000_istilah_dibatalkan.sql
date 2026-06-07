-- Istilah UI: "pembatalan" → "dibatalkan" pada teks yang tampil ke pengguna

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
    RAISE EXCEPTION 'Alasan dibatalkan wajib diisi (min. 10 karakter).';
  END IF;

  SELECT * INTO v_asal FROM transaksi WHERE id = p_transaksi_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaksi tidak ditemukan.';
  END IF;

  IF v_asal.dibatalkan_pada IS NOT NULL THEN
    RAISE EXCEPTION 'Transaksi sudah dibatalkan.';
  END IF;

  IF v_asal.jenis = 'pembatalan' THEN
    RAISE EXCEPTION 'Transaksi dibatalkan tidak dapat dibatalkan lagi.';
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
    'Dibatalkan: ' || left(trim(p_alasan), 200),
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
