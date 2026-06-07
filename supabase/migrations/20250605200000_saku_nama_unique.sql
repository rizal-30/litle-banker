-- Nama saku harus unik (abaikan perbedaan huruf besar/kecil & spasi tepi)

CREATE UNIQUE INDEX IF NOT EXISTS saku_nama_unique
  ON saku (lower(trim(nama)));

COMMENT ON INDEX saku_nama_unique IS 'Nama saku unik per instansi (case-insensitive).';
