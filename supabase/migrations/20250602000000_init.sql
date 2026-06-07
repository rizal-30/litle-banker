-- Bank Hemat: skema awal, view saldo, RLS, audit trigger

-- Enum jenis transaksi
CREATE TYPE jenis_transaksi AS ENUM (
  'setoran',
  'penarikan',
  'pinjaman_keluar',
  'pinjaman_kembali',
  'transfer_saku'
);

CREATE TYPE jenis_saku AS ENUM ('kas', 'bank', 'instrumen');

-- Profil admin (terhubung ke auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nama_lengkap TEXT NOT NULL DEFAULT '',
  peran TEXT NOT NULL DEFAULT 'admin' CHECK (peran = 'admin'),
  aktif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Saku: tempat uang fisik/disimpan
CREATE TABLE saku (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama TEXT NOT NULL,
  jenis jenis_saku NOT NULL DEFAULT 'kas',
  keterangan TEXT,
  aktif BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Nasabah (pedagang)
CREATE TABLE nasabah (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama TEXT NOT NULL,
  telepon TEXT,
  alamat TEXT,
  keterangan TEXT,
  aktif BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Transaksi keuangan
CREATE TABLE transaksi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
  jenis jenis_transaksi NOT NULL,
  jumlah NUMERIC(18, 2) NOT NULL CHECK (jumlah > 0),
  keterangan TEXT,
  nasabah_id UUID REFERENCES nasabah(id),
  saku_id UUID REFERENCES saku(id),
  saku_tujuan_id UUID REFERENCES saku(id),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT transfer_butuh_tujuan CHECK (
    jenis <> 'transfer_saku' OR saku_tujuan_id IS NOT NULL
  ),
  CONSTRAINT transfer_butuh_asal CHECK (
    jenis <> 'transfer_saku' OR saku_id IS NOT NULL
  )
);

-- Audit log (append-only)
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  aksi TEXT NOT NULL CHECK (aksi IN ('insert', 'update', 'delete')),
  tabel TEXT NOT NULL,
  record_id UUID NOT NULL,
  data_sebelum JSONB,
  data_sesudah JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fungsi audit generik
CREATE OR REPLACE FUNCTION fn_audit_log()
RETURNS TRIGGER AS $$
DECLARE
  v_user UUID;
  v_record_id UUID;
  v_old JSONB;
  v_new JSONB;
BEGIN
  v_user := auth.uid();

  IF TG_OP = 'DELETE' THEN
    v_record_id := OLD.id;
    v_old := to_jsonb(OLD);
    v_new := NULL;
    INSERT INTO audit_log (user_id, aksi, tabel, record_id, data_sebelum, data_sesudah)
    VALUES (v_user, 'delete', TG_TABLE_NAME, v_record_id, v_old, v_new);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    v_record_id := NEW.id;
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    INSERT INTO audit_log (user_id, aksi, tabel, record_id, data_sebelum, data_sesudah)
    VALUES (v_user, 'update', TG_TABLE_NAME, v_record_id, v_old, v_new);
    RETURN NEW;
  ELSE
    v_record_id := NEW.id;
    v_old := NULL;
    v_new := to_jsonb(NEW);
    INSERT INTO audit_log (user_id, aksi, tabel, record_id, data_sebelum, data_sesudah)
    VALUES (v_user, 'insert', TG_TABLE_NAME, v_record_id, v_old, v_new);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_audit_saku
  AFTER INSERT OR UPDATE OR DELETE ON saku
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER trg_audit_nasabah
  AFTER INSERT OR UPDATE OR DELETE ON nasabah
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER trg_audit_transaksi
  AFTER INSERT OR UPDATE OR DELETE ON transaksi
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- Auto-create profile on signup
-- Penting: trigger jalan di schema auth — wajib pakai public.profiles + search_path
CREATE OR REPLACE FUNCTION fn_handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nama_lengkap)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nama_lengkap', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION fn_handle_new_user();

-- View: saldo per saku (subquery agar transfer tidak double-count)
CREATE OR REPLACE VIEW v_saldo_saku AS
SELECT
  s.id,
  s.nama,
  s.jenis,
  s.aktif,
  (
    COALESCE((
      SELECT SUM(t.jumlah) FROM transaksi t
      WHERE t.saku_id = s.id
        AND t.jenis IN ('setoran', 'pinjaman_kembali')
    ), 0)
    - COALESCE((
      SELECT SUM(t.jumlah) FROM transaksi t
      WHERE t.saku_id = s.id
        AND t.jenis IN ('penarikan', 'pinjaman_keluar', 'transfer_saku')
    ), 0)
    + COALESCE((
      SELECT SUM(t.jumlah) FROM transaksi t
      WHERE t.saku_tujuan_id = s.id AND t.jenis = 'transfer_saku'
    ), 0)
  )::NUMERIC(18, 2) AS saldo
FROM saku s
WHERE s.aktif = true;

-- View: saldo per nasabah
CREATE OR REPLACE VIEW v_saldo_nasabah AS
SELECT
  n.id,
  n.nama,
  n.telepon,
  n.aktif,
  COALESCE(SUM(
    CASE
      WHEN t.jenis IN ('setoran', 'pinjaman_kembali') THEN t.jumlah
      WHEN t.jenis IN ('penarikan', 'pinjaman_keluar') THEN -t.jumlah
      ELSE 0
    END
  ), 0)::NUMERIC(18, 2) AS saldo
FROM nasabah n
LEFT JOIN transaksi t ON t.nasabah_id = n.id
WHERE n.aktif = true
GROUP BY n.id, n.nama, n.telepon, n.aktif;

-- View: ringkasan harian untuk chart
CREATE OR REPLACE VIEW v_ringkasan_harian AS
SELECT
  tanggal,
  COALESCE(SUM(CASE WHEN jenis IN ('setoran', 'pinjaman_kembali') THEN jumlah
    WHEN jenis = 'transfer_saku' AND saku_tujuan_id IS NOT NULL THEN jumlah ELSE 0 END), 0)::NUMERIC(18, 2) AS total_masuk,
  COALESCE(SUM(CASE WHEN jenis IN ('penarikan', 'pinjaman_keluar') THEN jumlah
    WHEN jenis = 'transfer_saku' AND saku_id IS NOT NULL THEN jumlah ELSE 0 END), 0)::NUMERIC(18, 2) AS total_keluar,
  COUNT(*)::INT AS jumlah_transaksi
FROM transaksi
GROUP BY tanggal
ORDER BY tanggal;

-- View: ringkasan per jenis
CREATE OR REPLACE VIEW v_ringkasan_jenis AS
SELECT
  jenis,
  COUNT(*)::INT AS jumlah_count,
  COALESCE(SUM(jumlah), 0)::NUMERIC(18, 2) AS total_jumlah
FROM transaksi
GROUP BY jenis;

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE saku ENABLE ROW LEVEL SECURITY;
ALTER TABLE nasabah ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaksi ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND peran = 'admin' AND aktif = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE POLICY profiles_select ON profiles FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY profiles_update_own ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() AND is_admin());

CREATE POLICY saku_all ON saku FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY nasabah_all ON nasabah FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY transaksi_all ON transaksi FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY audit_select ON audit_log FOR SELECT TO authenticated USING (is_admin());

-- Grant view access
GRANT SELECT ON v_saldo_saku TO authenticated;
GRANT SELECT ON v_saldo_nasabah TO authenticated;
GRANT SELECT ON v_ringkasan_harian TO authenticated;
GRANT SELECT ON v_ringkasan_jenis TO authenticated;
