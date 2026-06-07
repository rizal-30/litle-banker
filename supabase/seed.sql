-- Data uji Bank Hemat: 3 saku, 10 nasabah, transaksi semua jenis
-- Tanggal transaksi relatif ke CURRENT_DATE agar chart dashboard selalu punya data.
-- Admin dibuat lewat: npm run seed (Auth Admin API)
-- Login admin: admin@bank-hemat.test / Admin123!

INSERT INTO saku (id, nama, jenis, keterangan) VALUES
  ('b0000000-0000-4000-8000-000000000001', 'Kas Loket', 'kas', 'Kas harian di loket'),
  ('b0000000-0000-4000-8000-000000000002', 'Rekening BCA', 'bank', 'Rekening operasional'),
  ('b0000000-0000-4000-8000-000000000003', 'Deposito', 'instrumen', 'Deposito berjangka');

INSERT INTO nasabah (id, nama, telepon, alamat) VALUES
  ('c0000000-0000-4000-8000-000000000001', 'Budi Santoso', '08123456001', 'Pasar A Blok 1'),
  ('c0000000-0000-4000-8000-000000000002', 'Siti Aminah', '08123456002', 'Pasar A Blok 2'),
  ('c0000000-0000-4000-8000-000000000003', 'Agus Wijaya', '08123456003', 'Pasar B Blok 1'),
  ('c0000000-0000-4000-8000-000000000004', 'Dewi Lestari', '08123456004', 'Pasar B Blok 2'),
  ('c0000000-0000-4000-8000-000000000005', 'Rudi Hartono', '08123456005', 'Pasar C Blok 1'),
  ('c0000000-0000-4000-8000-000000000006', 'Maya Sari', '08123456006', 'Pasar C Blok 2'),
  ('c0000000-0000-4000-8000-000000000007', 'Hendra Kusuma', '08123456007', 'Pasar D Blok 1'),
  ('c0000000-0000-4000-8000-000000000008', 'Fitri Rahayu', '08123456008', 'Pasar D Blok 2'),
  ('c0000000-0000-4000-8000-000000000009', 'Joko Susilo', '08123456009', 'Pasar E Blok 1'),
  ('c0000000-0000-4000-8000-000000000010', 'Rina Wulandari', '08123456010', 'Pasar E Blok 2');

-- Setoran awal 10 nasabah → Kas Loket (25–16 hari lalu)
INSERT INTO transaksi (tanggal, jenis, jumlah, keterangan, nasabah_id, saku_id) VALUES
  ((CURRENT_DATE - INTERVAL '25 days')::date, 'setoran', 500000, 'Setoran minggu 1', 'c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001'),
  ((CURRENT_DATE - INTERVAL '24 days')::date, 'setoran', 750000, 'Setoran minggu 1', 'c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001'),
  ((CURRENT_DATE - INTERVAL '23 days')::date, 'setoran', 1000000, 'Setoran minggu 1', 'c0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001'),
  ((CURRENT_DATE - INTERVAL '22 days')::date, 'setoran', 400000, 'Setoran minggu 1', 'c0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001'),
  ((CURRENT_DATE - INTERVAL '21 days')::date, 'setoran', 600000, 'Setoran minggu 1', 'c0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000001'),
  ((CURRENT_DATE - INTERVAL '20 days')::date, 'setoran', 850000, 'Setoran minggu 1', 'c0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000001'),
  ((CURRENT_DATE - INTERVAL '19 days')::date, 'setoran', 550000, 'Setoran minggu 1', 'c0000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000001'),
  ((CURRENT_DATE - INTERVAL '18 days')::date, 'setoran', 900000, 'Setoran minggu 1', 'c0000000-0000-4000-8000-000000000008', 'b0000000-0000-4000-8000-000000000001'),
  ((CURRENT_DATE - INTERVAL '17 days')::date, 'setoran', 450000, 'Setoran minggu 1', 'c0000000-0000-4000-8000-000000000009', 'b0000000-0000-4000-8000-000000000001'),
  ((CURRENT_DATE - INTERVAL '16 days')::date, 'setoran', 700000, 'Setoran minggu 1', 'c0000000-0000-4000-8000-000000000010', 'b0000000-0000-4000-8000-000000000001');

INSERT INTO transaksi (tanggal, jenis, jumlah, keterangan, nasabah_id, saku_id) VALUES
  ((CURRENT_DATE - INTERVAL '14 days')::date, 'penarikan', 200000, 'Penarikan tunai', 'c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001'),
  ((CURRENT_DATE - INTERVAL '13 days')::date, 'penarikan', 150000, 'Penarikan tunai', 'c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001'),
  ((CURRENT_DATE - INTERVAL '12 days')::date, 'penarikan', 300000, 'Penarikan tunai', 'c0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001'),
  ((CURRENT_DATE - INTERVAL '2 days')::date, 'penarikan', 100000, 'Penarikan akhir bulan', 'c0000000-0000-4000-8000-000000000009', 'b0000000-0000-4000-8000-000000000001');

INSERT INTO transaksi (tanggal, jenis, jumlah, keterangan, nasabah_id, saku_id) VALUES
  ((CURRENT_DATE - INTERVAL '10 days')::date, 'pinjaman_keluar', 250000, 'Pinjaman modal dagang', 'c0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000001'),
  ((CURRENT_DATE - INTERVAL '9 days')::date, 'pinjaman_keluar', 100000, 'Pinjaman modal dagang', 'c0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000001'),
  ((CURRENT_DATE - INTERVAL '8 days')::date, 'pinjaman_kembali', 100000, 'Angsuran pinjaman', 'c0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000001'),
  ((CURRENT_DATE - INTERVAL '7 days')::date, 'pinjaman_kembali', 50000, 'Angsuran pinjaman', 'c0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000001');

INSERT INTO transaksi (tanggal, jenis, jumlah, keterangan, saku_id, saku_tujuan_id) VALUES
  ((CURRENT_DATE - INTERVAL '5 days')::date, 'transfer_saku', 1000000, 'Setor ke rekening bank', 'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002'),
  ((CURRENT_DATE - INTERVAL '4 days')::date, 'transfer_saku', 500000, 'Alokasi ke deposito', 'b0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000003');

INSERT INTO transaksi (tanggal, jenis, jumlah, keterangan, nasabah_id, saku_id) VALUES
  ((CURRENT_DATE - INTERVAL '3 days')::date, 'setoran', 300000, 'Setoran via transfer bank', 'c0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000002');
