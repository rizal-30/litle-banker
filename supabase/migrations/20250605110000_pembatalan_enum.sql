-- Tambah jenis pembatalan (harus migration terpisah sebelum dipakai di constraint/view)

ALTER TYPE jenis_transaksi ADD VALUE IF NOT EXISTS 'pembatalan';
