import type { JenisTransaksi } from "@/types/database";

export type LevelFrekuensi = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Level aktif tertinggi (level 0 = kosong) */
export const LEVEL_AKTIF_MAX = 6;

export interface AktivitasNasabah {
  /** Jumlah transaksi setoran + penarikan + pinjaman keluar */
  jumlahTransaksi: number;
  levelFrekuensi: LevelFrekuensi;
  nominalSetoran: number;
  nominalPenarikan: number;
  nominalPinjaman: number;
  /** Proporsi lebar bar (0–100), jumlah ≈ 100 jika ada aktivitas */
  pctSetoran: number;
  pctPenarikan: number;
  pctPinjaman: number;
}

type TrxAktivitas = {
  nasabah_id: string | null;
  jenis: JenisTransaksi;
  jumlah: number;
};

const JENIS_AKTIVITAS: JenisTransaksi[] = [
  "setoran",
  "penarikan",
  "pinjaman_keluar",
];

/** Skala 0–6 relatif terhadap nasabah paling aktif; tinggi bar +1 px per level (4–10 px). */
export function levelFrekuensiRelatif(
  count: number,
  max: number
): LevelFrekuensi {
  if (count <= 0 || max <= 0) return 0;
  const ratio = count / max;
  const level = Math.ceil(ratio * LEVEL_AKTIF_MAX);
  return Math.max(1, Math.min(LEVEL_AKTIF_MAX, level)) as LevelFrekuensi;
}

export function agregatAktivitasNasabah(
  trx: TrxAktivitas[]
): Map<
  string,
  {
    jumlahTransaksi: number;
    nominalSetoran: number;
    nominalPenarikan: number;
    nominalPinjaman: number;
  }
> {
  const map = new Map<
    string,
    {
      jumlahTransaksi: number;
      nominalSetoran: number;
      nominalPenarikan: number;
      nominalPinjaman: number;
    }
  >();

  for (const t of trx) {
    if (!t.nasabah_id) continue;
    if (!JENIS_AKTIVITAS.includes(t.jenis)) continue;

    const jml = Number(t.jumlah);
    const cur = map.get(t.nasabah_id) ?? {
      jumlahTransaksi: 0,
      nominalSetoran: 0,
      nominalPenarikan: 0,
      nominalPinjaman: 0,
    };

    cur.jumlahTransaksi += 1;
    if (t.jenis === "setoran") cur.nominalSetoran += jml;
    else if (t.jenis === "penarikan") cur.nominalPenarikan += jml;
    else cur.nominalPinjaman += jml;

    map.set(t.nasabah_id, cur);
  }

  return map;
}

function proporsiNominal(
  setoran: number,
  penarikan: number,
  pinjaman: number
): Pick<AktivitasNasabah, "pctSetoran" | "pctPenarikan" | "pctPinjaman"> {
  const total = setoran + penarikan + pinjaman;
  if (total <= 0) {
    return { pctSetoran: 0, pctPenarikan: 0, pctPinjaman: 0 };
  }
  return {
    pctSetoran: (setoran / total) * 100,
    pctPenarikan: (penarikan / total) * 100,
    pctPinjaman: (pinjaman / total) * 100,
  };
}

export function aktivitasDenganProporsi(
  agregat: Map<
    string,
    {
      jumlahTransaksi: number;
      nominalSetoran: number;
      nominalPenarikan: number;
      nominalPinjaman: number;
    }
  >
): Map<string, AktivitasNasabah> {
  let maxTransaksi = 0;
  for (const c of agregat.values()) {
    if (c.jumlahTransaksi > maxTransaksi) maxTransaksi = c.jumlahTransaksi;
  }

  const result = new Map<string, AktivitasNasabah>();

  for (const [id, c] of agregat) {
    result.set(id, {
      jumlahTransaksi: c.jumlahTransaksi,
      levelFrekuensi: levelFrekuensiRelatif(
        c.jumlahTransaksi,
        maxTransaksi
      ),
      nominalSetoran: c.nominalSetoran,
      nominalPenarikan: c.nominalPenarikan,
      nominalPinjaman: c.nominalPinjaman,
      ...proporsiNominal(
        c.nominalSetoran,
        c.nominalPenarikan,
        c.nominalPinjaman
      ),
    });
  }

  return result;
}

export function aktivitasKosong(): AktivitasNasabah {
  return {
    jumlahTransaksi: 0,
    levelFrekuensi: 0,
    nominalSetoran: 0,
    nominalPenarikan: 0,
    nominalPinjaman: 0,
    pctSetoran: 0,
    pctPenarikan: 0,
    pctPinjaman: 0,
  };
}

export const BAR_AKTIVITAS_MIN_PX = 4;
export const BAR_AKTIVITAS_MAX_PX = 10;
export const BAR_AKTIVITAS_LEBAR_PX = 72;
export const BAR_AKTIVITAS_TABLE_LEBAR_PX = 88;

/** Tinggi bar = min + level (4 px … 10 px, naik 1 px per level). */
export function tinggiBarAktivitas(level: LevelFrekuensi): number {
  return BAR_AKTIVITAS_MIN_PX + level;
}
