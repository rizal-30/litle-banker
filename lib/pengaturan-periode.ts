import type { PengaturanPeriode } from "@/types/database";

export const DEFAULT_PENGATURAN_PERIODE: PengaturanPeriode = {
  jenis: "tahun",
  bulan_awal: 10,
  kalender: "hijri",
};

export function normalizePengaturanPeriode(
  row: Partial<PengaturanPeriode> | null | undefined
): PengaturanPeriode {
  const jenis = row?.jenis;
  const kalender = row?.kalender;
  const bulan = row?.bulan_awal;

  return {
    jenis:
      jenis === "minggu" ||
      jenis === "bulan" ||
      jenis === "kuartal" ||
      jenis === "tahun"
        ? jenis
        : DEFAULT_PENGATURAN_PERIODE.jenis,
    bulan_awal:
      typeof bulan === "number" && bulan >= 1 && bulan <= 12
        ? bulan
        : DEFAULT_PENGATURAN_PERIODE.bulan_awal,
    kalender:
      kalender === "masehi" || kalender === "hijri"
        ? kalender
        : DEFAULT_PENGATURAN_PERIODE.kalender,
  };
}
