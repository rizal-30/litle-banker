-- Nama nasabah harus unik (abaikan perbedaan huruf besar/kecil & spasi tepi)

CREATE UNIQUE INDEX IF NOT EXISTS nasabah_nama_unique
  ON nasabah (lower(trim(nama)));

COMMENT ON INDEX nasabah_nama_unique IS 'Nama nasabah unik per instansi (case-insensitive).';
