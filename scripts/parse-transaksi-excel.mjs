/**
 * Helper export Excel untuk tes Node (mirror lib/export-excel.ts).
 */
import * as XLSX from "xlsx";

const JENIS_TRANSAKSI_LABEL = {
  setoran: "Menabung",
  penarikan: "Tarik",
  pinjaman_keluar: "Pinjaman",
  pinjaman_kembali: "Bayar Pinjaman",
  transfer_saku: "Transfer Antar Saku",
  pembatalan: "Dibatalkan",
};

export function exportTransaksiToBuffer(rows) {
  const data = rows.map((t) => ({
    Tanggal: t.tanggal,
    Jenis: JENIS_TRANSAKSI_LABEL[t.jenis] ?? t.jenis,
    Nasabah: t.nasabah_nama ?? "-",
    Saku: t.saku_nama ?? "-",
    "Saku tujuan": t.saku_tujuan_nama ?? "-",
    Jumlah: Number(t.jumlah),
    Keterangan: t.keterangan ?? "",
    "Dibuat oleh": t.pembuat ?? "-",
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Transaksi");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" });
}
