import type { JenisSaku, JenisTransaksi } from "@/types/database";

const TRANSAKSI_NASABAH_TUNAI: JenisTransaksi[] = [
  "setoran",
  "penarikan",
  "pinjaman_keluar",
  "pinjaman_kembali",
];

function sakuCair(jenisSaku: JenisSaku): boolean {
  return jenisSaku === "kas" || jenisSaku === "bank";
}

function lolosPilihDiTransaksi(pilihDiTransaksi?: boolean): boolean {
  return pilihDiTransaksi !== false;
}

/** Saku asal (saku_id) yang boleh di combobox form transaksi */
export function sakuAsalUntukTransaksi(
  jenisSaku: JenisSaku,
  jenisTransaksi: JenisTransaksi,
  bayarDariTabungan = false,
  pilihDiTransaksi = true
): boolean {
  if (!lolosPilihDiTransaksi(pilihDiTransaksi)) return false;

  if (jenisTransaksi === "transfer_saku") return true;

  if (bayarDariTabungan) return false;

  if (TRANSAKSI_NASABAH_TUNAI.includes(jenisTransaksi)) {
    return sakuCair(jenisSaku);
  }

  return false;
}

/** Saku tujuan (saku_tujuan_id) yang boleh di combobox form transaksi */
export function sakuTujuanUntukTransaksi(
  jenisSaku: JenisSaku,
  jenisTransaksi: JenisTransaksi,
  pilihDiTransaksi = true
): boolean {
  if (!lolosPilihDiTransaksi(pilihDiTransaksi)) return false;
  return jenisTransaksi === "transfer_saku";
}

/** Petunjuk di bawah combobox saku */
export function getSakuFormHint(jenisTransaksi: JenisTransaksi): string {
  switch (jenisTransaksi) {
    case "setoran":
    case "pinjaman_kembali":
      return "Pilih saku kas atau bank — uang masuk dari nasabah.";
    case "penarikan":
    case "pinjaman_keluar":
      return "Pilih saku kas atau bank — uang keluar ke nasabah.";
    case "transfer_saku":
      return "Semua jenis saku boleh, termasuk deposito/instrumen.";
    default:
      return "";
  }
}
