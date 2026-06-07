import type { JenisTransaksi } from "@/types/database";

/** Warna badge per jenis — selaras makna arus kas (hijau masuk, oranye/merah keluar, dll.) */
export const JENIS_TRANSAKSI_BADGE_CLASS: Record<JenisTransaksi, string> = {
  setoran:
    "border-emerald-200 bg-emerald-500/10 text-emerald-800 dark:border-emerald-800 dark:text-emerald-400",
  penarikan:
    "border-red-200 bg-red-500/10 text-red-800 dark:border-red-800 dark:text-red-400",
  pinjaman_keluar:
    "border-amber-200 bg-amber-500/10 text-amber-900 dark:border-amber-800 dark:text-amber-400",
  pinjaman_kembali:
    "border-sky-200 bg-sky-500/10 text-sky-900 dark:border-sky-800 dark:text-sky-400",
  transfer_saku:
    "border-violet-200 bg-violet-500/10 text-violet-900 dark:border-violet-800 dark:text-violet-400",
  pembatalan:
    "border-destructive/30 bg-destructive/10 text-destructive dark:bg-destructive/20",
};

/** Warna chart tetap per jenis (pie / legend) */
export const JENIS_TRANSAKSI_CHART_COLOR: Record<JenisTransaksi, string> = {
  setoran: "var(--chart-1)",
  penarikan: "var(--chart-4)",
  pinjaman_keluar: "var(--chart-2)",
  pinjaman_kembali: "var(--chart-3)",
  transfer_saku: "var(--chart-5)",
  pembatalan: "var(--destructive)",
};

export function jenisTransaksiBadgeClassName(jenis: JenisTransaksi): string {
  return JENIS_TRANSAKSI_BADGE_CLASS[jenis];
}

/** Warna teks nominal mutasi nasabah — per jenis, bukan hanya arah masuk/keluar */
export function jenisTransaksiJumlahClassName(
  jenis: JenisTransaksi,
  arah: "masuk" | "keluar" | null
): string {
  switch (jenis) {
    case "setoran":
      return "text-green-600 dark:text-green-500";
    case "penarikan":
      return "text-red-600 dark:text-red-500";
    case "pinjaman_keluar":
      return "text-amber-600 dark:text-amber-500";
    case "pinjaman_kembali":
      return "text-sky-600 dark:text-sky-500";
    default:
      if (arah === "masuk") return "text-green-600 dark:text-green-500";
      if (arah === "keluar") return "text-red-600 dark:text-red-500";
      return "";
  }
}
