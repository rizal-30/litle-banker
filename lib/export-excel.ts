import type { Transaksi } from "@/types/database";
import { JENIS_TRANSAKSI_LABEL } from "@/types/database";
import { formatTanggal } from "@/lib/format";
import * as XLSX from "xlsx";

/** Generate dan unduh file Excel dari daftar transaksi */
export function exportTransaksiExcel(
  rows: Transaksi[],
  filename = "laporan-bank-hemat"
) {
  const data = rows.map((t) => ({
    Tanggal: formatTanggal(t.tanggal),
    Jenis: JENIS_TRANSAKSI_LABEL[t.jenis],
    Status: t.dibatalkan_pada ? "Dibatalkan" : "Aktif",
    Nasabah: t.nasabah?.nama ?? "-",
    Saku: t.saku?.nama ?? "-",
    "Saku tujuan": t.saku_tujuan?.nama ?? "-",
    Jumlah: Number(t.jumlah),
    Keterangan: t.keterangan ?? "",
    "Dibuat oleh": t.pembuat?.nama_lengkap ?? "-",
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Transaksi");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
