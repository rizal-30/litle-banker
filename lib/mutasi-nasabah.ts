import type { JenisTransaksi, Transaksi } from "@/types/database";

/** Arah mutasi dari sudut pandang nasabah (tabungan / saldo). */
export function arahMutasiNasabah(
  jenis: JenisTransaksi,
  bayarDariTabungan = false
): "masuk" | "keluar" | null {
  switch (jenis) {
    case "setoran":
      return "masuk";
    case "penarikan":
    case "pinjaman_keluar":
      return "keluar";
    case "pinjaman_kembali":
      return bayarDariTabungan ? "keluar" : "masuk";
    default:
      return null;
  }
}

export function keteranganMutasiNasabah(
  t: Transaksi & { saku?: { nama: string } | null }
): string {
  const parts: string[] = [];

  if (t.saku?.nama) {
    parts.push(t.saku.nama);
  }

  if (t.keterangan) {
    parts.push(t.keterangan);
  }

  return parts.length > 0 ? parts.join(" · ") : "—";
}
