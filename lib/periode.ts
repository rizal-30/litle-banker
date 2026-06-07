/**
 * Periode dashboard — rentang filter grafik & KPI.
 * Transaksi, export, dan penyimpanan tanggal di database tetap kalender Masehi.
 */
import type {
  PengaturanPeriode,
  PeriodeFilter,
  RingkasanHarian,
} from "@/types/database";
import { BULAN_HIJRI_LABEL, BULAN_LABEL } from "@/types/database";
import { DEFAULT_PENGATURAN_PERIODE } from "@/lib/pengaturan-periode";
import {
  addDays,
  eachDayOfInterval,
  eachMonthOfInterval,
  eachWeekOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getISOWeek,
  getISOWeekYear,
  parseISO,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";
import { id as localeId } from "date-fns/locale";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { toGregorian, toHijri } = require("hijri-converter") as {
  toGregorian: (
    hy: number,
    hm: number,
    hd: number
  ) => { gy: number; gm: number; gd: number };
  toHijri: (
    gy: number,
    gm: number,
    gd: number
  ) => { hy: number; hm: number; hd: number };
};

function hijriKeDate(hy: number, hm: number, hd: number): Date {
  const { gy, gm, gd } = toGregorian(hy, hm, hd);
  return new Date(gy, gm - 1, gd);
}

function tanggalHijriHariIni(): { hy: number; hm: number; hd: number } {
  const today = new Date();
  return toHijri(today.getFullYear(), today.getMonth() + 1, today.getDate());
}

function settingsOrDefault(
  settings?: PengaturanPeriode
): PengaturanPeriode {
  return settings ?? DEFAULT_PENGATURAN_PERIODE;
}

/** Tahun Hijri berjalan berdasarkan bulan awal Hijri */
function getTahunHijriSekarang(bulanAwal: number): number {
  const { hy, hm } = tanggalHijriHariIni();
  return hm >= bulanAwal ? hy : hy - 1;
}

function getTahunFiskalMasehiSekarang(bulanAwal: number): number {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth() + 1;
  return m >= bulanAwal ? y : y - 1;
}

function getKuartalFiskalSekarang(bulanAwal: number): {
  tahun: number;
  kuartal: number;
} {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth() + 1;
  const tahun = m >= bulanAwal ? y : y - 1;
  const offset = (m - bulanAwal + 12) % 12;
  const kuartal = Math.floor(offset / 3) + 1;
  return { tahun, kuartal };
}

export function getPeriodeSekarang(
  settings?: PengaturanPeriode
): PeriodeFilter {
  const s = settingsOrDefault(settings);
  const today = new Date();

  switch (s.jenis) {
    case "minggu": {
      const y = getISOWeekYear(today);
      const w = getISOWeek(today);
      return `${y}-W${String(w).padStart(2, "0")}`;
    }
    case "bulan":
      return format(today, "yyyy-MM");
    case "kuartal": {
      const { tahun, kuartal } = getKuartalFiskalSekarang(s.bulan_awal);
      return `${tahun}-Q${kuartal}`;
    }
    case "tahun":
      if (s.kalender === "hijri") {
        return String(getTahunHijriSekarang(s.bulan_awal));
      }
      return String(getTahunFiskalMasehiSekarang(s.bulan_awal));
    default:
      return String(getTahunHijriSekarang(10));
  }
}

export function parsePeriodeFilter(value: string | null): PeriodeFilter | null {
  if (!value) return null;
  if (/^\d{4}$/.test(value)) return value;
  if (/^\d{4}-W\d{2}$/.test(value)) return value;
  if (/^\d{4}-\d{2}$/.test(value)) return value;
  if (/^\d{4}-Q[1-4]$/.test(value)) return value;
  return null;
}

function shiftPeriode(
  settings: PengaturanPeriode,
  periode: PeriodeFilter,
  delta: number
): PeriodeFilter {
  const { dari } = getPeriodeRange(settings, periode);
  const anchor = parseISO(dari);

  switch (settings.jenis) {
    case "minggu": {
      const d = subWeeks(anchor, -delta);
      return `${getISOWeekYear(d)}-W${String(getISOWeek(d)).padStart(2, "0")}`;
    }
    case "bulan": {
      const d = subMonths(anchor, -delta);
      return format(d, "yyyy-MM");
    }
    case "kuartal": {
      const d = subMonths(anchor, -delta * 3);
      return getPeriodeSekarangFromDate(settings, d);
    }
    case "tahun": {
      if (settings.kalender === "hijri") {
        return String(Number(periode) + delta);
      }
      return String(Number(periode) + delta);
    }
    default:
      return periode;
  }
}

function getPeriodeSekarangFromDate(
  settings: PengaturanPeriode,
  date: Date
): PeriodeFilter {
  switch (settings.jenis) {
    case "minggu":
      return `${getISOWeekYear(date)}-W${String(getISOWeek(date)).padStart(2, "0")}`;
    case "bulan":
      return format(date, "yyyy-MM");
    case "kuartal": {
      const y = date.getFullYear();
      const m = date.getMonth() + 1;
      const tahun = m >= settings.bulan_awal ? y : y - 1;
      const offset = (m - settings.bulan_awal + 12) % 12;
      const kuartal = Math.floor(offset / 3) + 1;
      return `${tahun}-Q${kuartal}`;
    }
    case "tahun":
      if (settings.kalender === "hijri") {
        const { hy, hm } = toHijri(
          date.getFullYear(),
          date.getMonth() + 1,
          date.getDate()
        );
        return String(hm >= settings.bulan_awal ? hy : hy - 1);
      }
      {
        const y = date.getFullYear();
        const m = date.getMonth() + 1;
        return String(m >= settings.bulan_awal ? y : y - 1);
      }
    default:
      return getPeriodeSekarang(settings);
  }
}

/** N periode terakhir (termasuk yang berjalan), urut terbaru dulu */
export function getDaftarPeriode(
  settings?: PengaturanPeriode,
  jumlah = 3
): PeriodeFilter[] {
  const s = settingsOrDefault(settings);
  const current = getPeriodeSekarang(s);
  return Array.from({ length: jumlah }, (_, i) =>
    shiftPeriode(s, current, -i)
  );
}

function getHijriTahunRange(
  periode: PeriodeFilter,
  bulanAwal: number
): { dari: string; sampai: string } {
  const H = Number(periode);
  const dari = hijriKeDate(H, bulanAwal, 1);
  const awalBerikutnya = hijriKeDate(H + 1, bulanAwal, 1);
  const sampai = subDays(awalBerikutnya, 1);
  return {
    dari: format(dari, "yyyy-MM-dd"),
    sampai: format(sampai, "yyyy-MM-dd"),
  };
}

function getMasehiTahunFiskalRange(
  periode: PeriodeFilter,
  bulanAwal: number
): { dari: string; sampai: string } {
  const y = Number(periode);
  const dari = new Date(y, bulanAwal - 1, 1);
  const sampai = subDays(new Date(y + 1, bulanAwal - 1, 1), 1);
  return {
    dari: format(dari, "yyyy-MM-dd"),
    sampai: format(sampai, "yyyy-MM-dd"),
  };
}

function getKuartalRange(
  periode: PeriodeFilter,
  bulanAwal: number
): { dari: string; sampai: string } {
  const match = periode.match(/^(\d{4})-Q([1-4])$/);
  if (!match) {
    const now = getPeriodeSekarang({ jenis: "kuartal", bulan_awal: bulanAwal, kalender: "masehi" });
    return getKuartalRange(now, bulanAwal);
  }
  const tahun = Number(match[1]);
  const kuartal = Number(match[2]);
  const startMonth = bulanAwal + (kuartal - 1) * 3;
  const dariYear = startMonth > 12 ? tahun + 1 : tahun;
  const dariMonth = ((startMonth - 1) % 12) + 1;
  const dari = new Date(dariYear, dariMonth - 1, 1);
  const endDate = subDays(new Date(dariYear, dariMonth - 1 + 3, 1), 1);
  return {
    dari: format(dari, "yyyy-MM-dd"),
    sampai: format(endDate, "yyyy-MM-dd"),
  };
}

function parseWeekPeriode(periode: PeriodeFilter): Date {
  const match = periode.match(/^(\d{4})-W(\d{2})$/);
  if (!match) {
    return startOfWeek(new Date(), { weekStartsOn: 1 });
  }
  const year = Number(match[1]);
  const week = Number(match[2]);
  const jan4 = new Date(year, 0, 4);
  const start = startOfWeek(jan4, { weekStartsOn: 1 });
  return addDays(start, (week - 1) * 7);
}

export function getPeriodeRange(
  settingsOrPeriode: PengaturanPeriode | PeriodeFilter,
  periodeMaybe?: PeriodeFilter
): { dari: string; sampai: string } {
  let settings: PengaturanPeriode;
  let periode: PeriodeFilter;

  if (typeof settingsOrPeriode === "string") {
    settings = DEFAULT_PENGATURAN_PERIODE;
    periode = settingsOrPeriode;
  } else {
    settings = settingsOrPeriode;
    periode = periodeMaybe ?? getPeriodeSekarang(settings);
  }

  switch (settings.jenis) {
    case "minggu": {
      const start = parseWeekPeriode(periode);
      const end = endOfWeek(start, { weekStartsOn: 1 });
      return {
        dari: format(start, "yyyy-MM-dd"),
        sampai: format(end, "yyyy-MM-dd"),
      };
    }
    case "bulan": {
      const start = startOfMonth(parseISO(`${periode}-01`));
      const end = endOfMonth(start);
      return {
        dari: format(start, "yyyy-MM-dd"),
        sampai: format(end, "yyyy-MM-dd"),
      };
    }
    case "kuartal":
      return getKuartalRange(periode, settings.bulan_awal);
    case "tahun":
      if (settings.kalender === "hijri") {
        return getHijriTahunRange(periode, settings.bulan_awal);
      }
      return getMasehiTahunFiskalRange(periode, settings.bulan_awal);
    default:
      return getHijriTahunRange(periode, 10);
  }
}

export function labelPeriode(
  settingsOrPeriode: PengaturanPeriode | PeriodeFilter,
  periodeMaybe?: PeriodeFilter
): string {
  let settings: PengaturanPeriode;
  let periode: PeriodeFilter;

  if (typeof settingsOrPeriode === "string") {
    settings = DEFAULT_PENGATURAN_PERIODE;
    periode = settingsOrPeriode;
  } else {
    settings = settingsOrPeriode;
    periode = periodeMaybe ?? getPeriodeSekarang(settings);
  }

  const { dari, sampai } = getPeriodeRange(settings, periode);

  switch (settings.jenis) {
    case "minggu":
      return `Minggu ${periode.replace("-W", " ke-")} · ${format(parseISO(dari), "d MMM", { locale: localeId })} – ${format(parseISO(sampai), "d MMM yyyy", { locale: localeId })}`;
    case "bulan":
      return format(parseISO(`${periode}-01`), "MMMM yyyy", { locale: localeId });
    case "kuartal": {
      const q = periode.match(/Q(\d)/)?.[1] ?? "?";
      const bulanLabel = BULAN_LABEL[settings.bulan_awal];
      return `Kuartal ${q} · tahun fiskal ${periode.split("-")[0]} (awal ${bulanLabel})`;
    }
    case "tahun":
      if (settings.kalender === "hijri") {
        const H = Number(periode);
        const bulanLabel = BULAN_HIJRI_LABEL[settings.bulan_awal];
        return `Tahun tabungan ${H} H · 1 ${bulanLabel} ${H} – sebelum 1 ${bulanLabel} ${H + 1}`;
      }
      {
        const bulanLabel = BULAN_LABEL[settings.bulan_awal];
        return `Tahun fiskal ${periode} · 1 ${bulanLabel} ${periode} – sebelum 1 ${bulanLabel} ${Number(periode) + 1}`;
      }
    default:
      return periode;
  }
}

export function labelPeriodeSingkat(
  settingsOrPeriode: PengaturanPeriode | PeriodeFilter,
  periodeMaybe?: PeriodeFilter
): string {
  let settings: PengaturanPeriode;
  let periode: PeriodeFilter;

  if (typeof settingsOrPeriode === "string") {
    settings = DEFAULT_PENGATURAN_PERIODE;
    periode = settingsOrPeriode;
  } else {
    settings = settingsOrPeriode;
    periode = periodeMaybe ?? getPeriodeSekarang(settings);
  }

  switch (settings.jenis) {
    case "minggu":
      return `Mgg ${periode.replace(/^\d{4}-W/, "")}`;
    case "bulan":
      return format(parseISO(`${periode}-01`), "MMM yyyy", { locale: localeId });
    case "kuartal":
      return periode.replace("-", " ");
    case "tahun":
      return settings.kalender === "hijri" ? `${periode} H` : `FY ${periode}`;
    default:
      return periode;
  }
}

type TransaksiChartRow = {
  tanggal: string;
  jenis: string;
  jumlah: number;
  bayar_dari_tabungan?: boolean;
};

function isMasukChart(jenis: string, bayarDariTabungan: boolean): boolean {
  if (jenis === "setoran") return true;
  if (jenis === "pinjaman_kembali" && !bayarDariTabungan) return true;
  return false;
}

function isKeluarChart(jenis: string): boolean {
  return jenis === "penarikan" || jenis === "pinjaman_keluar";
}

/** Ringkasan harian untuk grafik — tanpa transfer antar saku (perpindahan internal) */
export function buildRingkasanHarianChart(
  trx: TransaksiChartRow[],
  dari: string,
  sampai: string
): RingkasanHarian[] {
  const map = new Map<string, RingkasanHarian>();

  for (const t of trx) {
    if (t.jenis === "transfer_saku" || t.jenis === "pembatalan") continue;

    const jml = Number(t.jumlah);
    const dariTabungan =
      t.jenis === "pinjaman_kembali" && Boolean(t.bayar_dari_tabungan);

    const cur = map.get(t.tanggal) ?? {
      tanggal: t.tanggal,
      total_masuk: 0,
      total_keluar: 0,
      jumlah_transaksi: 0,
    };

    if (isMasukChart(t.jenis, dariTabungan)) cur.total_masuk += jml;
    if (isKeluarChart(t.jenis)) cur.total_keluar += jml;
    cur.jumlah_transaksi += 1;
    map.set(t.tanggal, cur);
  }

  return fillRingkasanHarian(Array.from(map.values()), dari, sampai);
}

/** Ringkasan bulanan dalam periode — untuk grafik arus kas */
export function buildRingkasanBulananChart(
  trx: TransaksiChartRow[],
  dari: string,
  sampai: string
): RingkasanHarian[] {
  const harian = buildRingkasanHarianChart(trx, dari, sampai);
  const map = new Map<string, RingkasanHarian>();

  for (const d of harian) {
    const bulan = format(parseISO(d.tanggal), "yyyy-MM-01");
    const cur = map.get(bulan) ?? {
      tanggal: bulan,
      total_masuk: 0,
      total_keluar: 0,
      jumlah_transaksi: 0,
    };
    cur.total_masuk += d.total_masuk;
    cur.total_keluar += d.total_keluar;
    cur.jumlah_transaksi += d.jumlah_transaksi;
    map.set(bulan, cur);
  }

  return fillRingkasanBulanan(Array.from(map.values()), dari, sampai);
}

/** Ringkasan mingguan dalam periode */
export function buildRingkasanMingguanChart(
  trx: TransaksiChartRow[],
  dari: string,
  sampai: string
): RingkasanHarian[] {
  const harian = buildRingkasanHarianChart(trx, dari, sampai);
  const map = new Map<string, RingkasanHarian>();

  for (const d of harian) {
    const weekStart = format(
      startOfWeek(parseISO(d.tanggal), { weekStartsOn: 1 }),
      "yyyy-MM-dd"
    );
    const cur = map.get(weekStart) ?? {
      tanggal: weekStart,
      total_masuk: 0,
      total_keluar: 0,
      jumlah_transaksi: 0,
    };
    cur.total_masuk += d.total_masuk;
    cur.total_keluar += d.total_keluar;
    cur.jumlah_transaksi += d.jumlah_transaksi;
    map.set(weekStart, cur);
  }

  return fillRingkasanMingguan(Array.from(map.values()), dari, sampai);
}

/** Pilih granularitas grafik sesuai jenis periode */
export function buildRingkasanChart(
  settings: PengaturanPeriode,
  trx: TransaksiChartRow[],
  dari: string,
  sampai: string
): RingkasanHarian[] {
  switch (settings.jenis) {
    case "minggu":
    case "bulan":
      return buildRingkasanHarianChart(trx, dari, sampai);
    case "kuartal":
    case "tahun":
      return buildRingkasanBulananChart(trx, dari, sampai);
    default:
      return buildRingkasanBulananChart(trx, dari, sampai);
  }
}

/** Isi hari tanpa transaksi dengan nol agar grafik arus kas kontinu */
export function fillRingkasanHarian(
  data: RingkasanHarian[],
  dari: string,
  sampai: string
): RingkasanHarian[] {
  const map = new Map(data.map((d) => [d.tanggal, d]));
  const days = eachDayOfInterval({
    start: parseISO(dari),
    end: parseISO(sampai),
  });

  return days.map((day) => {
    const tanggal = format(day, "yyyy-MM-dd");
    return (
      map.get(tanggal) ?? {
        tanggal,
        total_masuk: 0,
        total_keluar: 0,
        jumlah_transaksi: 0,
      }
    );
  });
}

/** Isi bulan tanpa transaksi dengan nol dalam rentang periode */
export function fillRingkasanBulanan(
  data: RingkasanHarian[],
  dari: string,
  sampai: string
): RingkasanHarian[] {
  const map = new Map(data.map((d) => [d.tanggal, d]));
  const months = eachMonthOfInterval({
    start: parseISO(dari),
    end: parseISO(sampai),
  });

  return months.map((month) => {
    const tanggal = format(month, "yyyy-MM-01");
    return (
      map.get(tanggal) ?? {
        tanggal,
        total_masuk: 0,
        total_keluar: 0,
        jumlah_transaksi: 0,
      }
    );
  });
}

function fillRingkasanMingguan(
  data: RingkasanHarian[],
  dari: string,
  sampai: string
): RingkasanHarian[] {
  const map = new Map(data.map((d) => [d.tanggal, d]));
  const weeks = eachWeekOfInterval(
    { start: parseISO(dari), end: parseISO(sampai) },
    { weekStartsOn: 1 }
  );

  return weeks.map((week) => {
    const tanggal = format(week, "yyyy-MM-dd");
    return (
      map.get(tanggal) ?? {
        tanggal,
        total_masuk: 0,
        total_keluar: 0,
        jumlah_transaksi: 0,
      }
    );
  });
}

export function getEndOfMonth(): string {
  return format(endOfMonth(new Date()), "yyyy-MM-dd");
}
