/**
 * Tes export Excel transaksi (satu arah: aplikasi → file).
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { exportTransaksiToBuffer } from "./parse-transaksi-excel.mjs";

describe("Bank Hemat — tes export Excel", () => {
  test("24. Export Excel — buffer berisi baris transaksi", () => {
    const buffer = exportTransaksiToBuffer([
      {
        tanggal: "2025-05-01",
        jenis: "setoran",
        jumlah: 500000,
        nasabah_nama: "Budi Santoso",
        saku_nama: "Kas Loket",
        saku_tujuan_nama: "-",
        keterangan: "Setoran",
        pembuat: "Admin",
      },
    ]);

    const wb = XLSX.read(buffer, { type: "array" });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].Jenis, "Menabung");
    assert.equal(rows[0].Jumlah, 500000);
    assert.equal(rows[0].Nasabah, "Budi Santoso");
  });
});
