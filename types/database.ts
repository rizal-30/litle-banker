export type JenisTransaksi =
  | "setoran"
  | "penarikan"
  | "pinjaman_keluar"
  | "pinjaman_kembali"
  | "transfer_saku"
  | "pembatalan";

export type JenisSaku = "kas" | "bank" | "instrumen";

/** Identifikator periode aktif di dashboard, format bergantung jenis pengaturan */
export type PeriodeFilter = string;

export type JenisPeriode = "minggu" | "bulan" | "kuartal" | "tahun";
export type KalenderPeriode = "masehi" | "hijri";

export interface PengaturanPeriode {
  jenis: JenisPeriode;
  bulan_awal: number;
  kalender: KalenderPeriode;
}

export const JENIS_PERIODE_LABEL: Record<JenisPeriode, string> = {
  minggu: "Per minggu",
  bulan: "Per bulan",
  kuartal: "Per kuartal",
  tahun: "Per tahun",
};

export const BULAN_LABEL: Record<number, string> = {
  1: "Januari",
  2: "Februari",
  3: "Maret",
  4: "April",
  5: "Mei",
  6: "Juni",
  7: "Juli",
  8: "Agustus",
  9: "September",
  10: "Oktober",
  11: "November",
  12: "Desember",
};

export const BULAN_HIJRI_LABEL: Record<number, string> = {
  1: "Muharram",
  2: "Safar",
  3: "Rabiul Awal",
  4: "Rabiul Akhir",
  5: "Jumadil Awal",
  6: "Jumadil Akhir",
  7: "Rajab",
  8: "Sya'ban",
  9: "Ramadan",
  10: "Syawal",
  11: "Dzulqa'dah",
  12: "Dzulhijjah",
};

export interface Profile {
  id: string;
  nama_lengkap: string;
  peran: string;
  aktif: boolean;
}

export interface Saku {
  id: string;
  nama: string;
  jenis: JenisSaku;
  keterangan: string | null;
  pilih_di_transaksi: boolean;
  aktif: boolean;
  created_at: string;
}

export interface Nasabah {
  id: string;
  nama: string;
  telepon: string | null;
  alamat: string | null;
  keterangan: string | null;
  aktif: boolean;
  created_at: string;
}

export interface Transaksi {
  id: string;
  tanggal: string;
  jenis: JenisTransaksi;
  jumlah: number;
  keterangan: string | null;
  nasabah_id: string | null;
  saku_id: string | null;
  saku_tujuan_id: string | null;
  bayar_dari_tabungan: boolean;
  transaksi_asal_id: string | null;
  dibatalkan_pada: string | null;
  dibatalkan_oleh: string | null;
  alasan_pembatalan: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  nasabah?: { nama: string } | null;
  saku?: { nama: string } | null;
  saku_tujuan?: { nama: string } | null;
  pembuat?: { nama_lengkap: string } | null;
}

export interface SaldoSaku {
  id: string;
  nama: string;
  jenis: JenisSaku;
  aktif: boolean;
  pilih_di_transaksi: boolean;
  saldo: number;
}

export interface SaldoNasabah {
  id: string;
  nama: string;
  telepon: string | null;
  aktif: boolean;
  tabungan: number;
  hutang: number;
  saldo: number;
}

export interface RingkasanHarian {
  tanggal: string;
  total_masuk: number;
  total_keluar: number;
  jumlah_transaksi: number;
}

export interface RingkasanJenis {
  jenis: JenisTransaksi;
  jumlah_count: number;
  total_jumlah: number;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  aksi: string;
  tabel: string;
  record_id: string;
  data_sebelum: Record<string, unknown> | null;
  data_sesudah: Record<string, unknown> | null;
  created_at: string;
  profil?: { nama_lengkap: string } | null;
}

/** Baris dari RPC list_audit_log */
export type AuditLogListRow = Omit<AuditLog, "profil"> & {
  nama_lengkap: string | null;
};

export const JENIS_TRANSAKSI_LABEL: Record<JenisTransaksi, string> = {
  setoran: "Menabung",
  penarikan: "Tarik",
  pinjaman_keluar: "Pinjaman",
  pinjaman_kembali: "Bayar Pinjaman",
  transfer_saku: "Transfer Antar Saku",
  pembatalan: "Dibatalkan",
};

export const JENIS_SAKU_LABEL: Record<JenisSaku, string> = {
  kas: "Kas",
  bank: "Bank",
  instrumen: "Instrumen",
};
