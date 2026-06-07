import { getPeriodeRange, parsePeriodeFilter } from "@/lib/periode";
import type { JenisTransaksi } from "@/types/database";

export const PINJAMAN_JENIS: JenisTransaksi[] = [
  "pinjaman_keluar",
  "pinjaman_kembali",
];

export const BAYAR_PINJAMAN_JENIS: JenisTransaksi[] = ["pinjaman_kembali"];

export type TransaksiListFilter =
  | "all"
  | "pinjaman"
  | "bayar_pinjaman"
  | "hutang_nasabah";

export type TransaksiTanggalFilter = {
  dari: string;
  sampai: string;
};

function parseTanggalMasehi(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value;
}

export function labelTransaksiFilter(filter: TransaksiListFilter): string {
  switch (filter) {
    case "pinjaman":
      return "Pinjaman";
    case "bayar_pinjaman":
      return "Bayar pinjaman";
    case "hutang_nasabah":
      return "Belum bayar";
    default:
      return "Semua";
  }
}

export function parseTransaksiSearchParams(searchParams: URLSearchParams): {
  filter: TransaksiListFilter;
  tanggal: TransaksiTanggalFilter | null;
} {
  const jenis = searchParams.get("jenis");
  let filter: TransaksiListFilter = "all";
  if (jenis === "pinjaman") filter = "pinjaman";
  if (jenis === "bayar_pinjaman") filter = "bayar_pinjaman";
  if (jenis === "hutang_nasabah") filter = "hutang_nasabah";

  let dari = parseTanggalMasehi(searchParams.get("dari"));
  let sampai = parseTanggalMasehi(searchParams.get("sampai"));

  // URL lama ?periode=1446 → rentang Masehi setara tahun tabungan Hijri
  const legacyPeriode = parsePeriodeFilter(searchParams.get("periode"));
  if ((!dari || !sampai) && legacyPeriode && /^\d{4}$/.test(legacyPeriode)) {
    const range = getPeriodeRange(
      { jenis: "tahun", bulan_awal: 10, kalender: "hijri" },
      legacyPeriode
    );
    dari = range.dari;
    sampai = range.sampai;
  }

  const tanggal = dari && sampai ? { dari, sampai } : null;
  return { filter, tanggal };
}

/** Filter transaksi & export memakai tanggal Masehi (yyyy-MM-dd). */
export function buildTransaksiHref(opts: {
  filter?: TransaksiListFilter;
  dari?: string;
  sampai?: string;
}): string {
  const params = new URLSearchParams();
  if (opts.filter === "pinjaman") params.set("jenis", "pinjaman");
  if (opts.filter === "bayar_pinjaman") params.set("jenis", "bayar_pinjaman");
  if (opts.filter === "hutang_nasabah") params.set("jenis", "hutang_nasabah");
  if (opts.dari) params.set("dari", opts.dari);
  if (opts.sampai) params.set("sampai", opts.sampai);
  const q = params.toString();
  return q ? `/transaksi?${q}` : "/transaksi";
}

export function jenisForTransaksiFilter(
  filter: TransaksiListFilter
): JenisTransaksi[] | null {
  if (filter === "pinjaman") return PINJAMAN_JENIS;
  if (filter === "bayar_pinjaman") return BAYAR_PINJAMAN_JENIS;
  return null;
}

export function matchesTransaksiFilter(
  jenis: JenisTransaksi,
  filter: TransaksiListFilter
): boolean {
  const allowed = jenisForTransaksiFilter(filter);
  if (!allowed) return true;
  return allowed.includes(jenis);
}
