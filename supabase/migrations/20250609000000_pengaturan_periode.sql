-- Pengaturan periode dashboard (singleton)
CREATE TABLE pengaturan_periode (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id = true),
  jenis TEXT NOT NULL DEFAULT 'tahun'
    CHECK (jenis IN ('minggu', 'bulan', 'kuartal', 'tahun')),
  bulan_awal INT NOT NULL DEFAULT 10
    CHECK (bulan_awal BETWEEN 1 AND 12),
  kalender TEXT NOT NULL DEFAULT 'hijri'
    CHECK (kalender IN ('masehi', 'hijri')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Default: tahun tabungan Hijri (1 Syawal), sama seperti sebelumnya
INSERT INTO pengaturan_periode (id, jenis, bulan_awal, kalender)
VALUES (true, 'tahun', 10, 'hijri');

ALTER TABLE pengaturan_periode ENABLE ROW LEVEL SECURITY;

CREATE POLICY pengaturan_periode_select ON pengaturan_periode
  FOR SELECT TO authenticated USING (is_admin());

CREATE POLICY pengaturan_periode_update ON pengaturan_periode
  FOR UPDATE TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

GRANT SELECT, UPDATE ON pengaturan_periode TO authenticated;
