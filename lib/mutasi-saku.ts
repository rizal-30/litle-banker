import type { JenisTransaksi, Transaksi } from "@/types/database";

type MutasiSakuInput = Pick<
  Transaksi,
  | "jenis"
  | "jumlah"
  | "saku_id"
  | "saku_tujuan_id"
  | "bayar_dari_tabungan"
  | "dibatalkan_pada"
>;

/** Arah mutasi uang dari sudut pandang saku tertentu. */
export function arahMutasiSaku(
  sakuId: string,
  t: MutasiSakuInput
): "masuk" | "keluar" | null {
  if (t.jenis === "pembatalan" || t.dibatalkan_pada) {
    return null;
  }

  if (t.saku_id === sakuId) {
    switch (t.jenis) {
      case "setoran":
        return "masuk";
      case "pinjaman_kembali":
        return t.bayar_dari_tabungan ? null : "masuk";
      case "penarikan":
      case "pinjaman_keluar":
      case "transfer_saku":
        return "keluar";
      default:
        return null;
    }
  }

  if (t.saku_tujuan_id === sakuId && t.jenis === "transfer_saku") {
    return "masuk";
  }

  return null;
}

export function hitungSaldoSaku(
  sakuId: string,
  transaksi: MutasiSakuInput[]
): number {
  return transaksi.reduce((saldo, t) => {
    const arah = arahMutasiSaku(sakuId, t);
    const jumlah = Number(t.jumlah);
    if (arah === "masuk") return saldo + jumlah;
    if (arah === "keluar") return saldo - jumlah;
    return saldo;
  }, 0);
}

/** Transaksi yang relevan untuk riwayat saku (tanpa baris pembatalan). */
export function transaksiUntukSaku(
  sakuId: string,
  rows: Transaksi[]
): Transaksi[] {
  return rows.filter(
    (t) =>
      t.jenis !== "pembatalan" &&
      (t.saku_id === sakuId || t.saku_tujuan_id === sakuId)
  );
}

export function keteranganMutasiSaku(
  sakuId: string,
  t: Transaksi & {
    saku?: { nama: string } | null;
    saku_tujuan?: { nama: string } | null;
    nasabah?: { nama: string } | null;
  }
): string {
  const parts: string[] = [];

  if (t.nasabah?.nama) {
    parts.push(t.nasabah.nama);
  }

  if (t.jenis === "transfer_saku") {
    if (t.saku_id === sakuId && t.saku_tujuan?.nama) {
      parts.push(`Ke ${t.saku_tujuan.nama}`);
    } else if (t.saku_tujuan_id === sakuId && t.saku?.nama) {
      parts.push(`Dari ${t.saku.nama}`);
    }
  }

  if (t.keterangan) {
    parts.push(t.keterangan);
  }

  return parts.length > 0 ? parts.join(" · ") : "—";
}

export type { JenisTransaksi };
