/**
 * Tes unit lib/periode.ts
 * Jalankan: node --experimental-strip-types scripts/test-periode-lib.mjs
 */
import assert from "node:assert/strict";
import {
  getPeriodeSekarang,
  getDaftarPeriode,
  getPeriodeRange,
  labelPeriode,
  parsePeriodeFilter,
  buildRingkasanChart,
} from "../lib/periode.ts";

const hijriTahun = { jenis: "tahun", bulan_awal: 10, kalender: "hijri" };
const masehiBulan = { jenis: "bulan", bulan_awal: 1, kalender: "masehi" };
const masehiKuartal = { jenis: "kuartal", bulan_awal: 4, kalender: "masehi" };
const masehiMinggu = { jenis: "minggu", bulan_awal: 1, kalender: "masehi" };
const masehiTahun = { jenis: "tahun", bulan_awal: 4, kalender: "masehi" };

const nowH = getPeriodeSekarang(hijriTahun);
assert.match(nowH, /^\d{4}$/, "hijri tahun id");
const rangeH = getPeriodeRange(hijriTahun, nowH);
assert.ok(rangeH.dari <= rangeH.sampai, "hijri range valid");
assert.ok(labelPeriode(hijriTahun, nowH).includes("H"), "hijri label");

const nowB = getPeriodeSekarang(masehiBulan);
assert.match(nowB, /^\d{4}-\d{2}$/, "bulan id");
const rangeB = getPeriodeRange(masehiBulan, nowB);
assert.match(rangeB.dari, /-01$/, "bulan starts day 1");

const nowQ = getPeriodeSekarang(masehiKuartal);
assert.match(nowQ, /^\d{4}-Q[1-4]$/, "kuartal id");
const rangeQ = getPeriodeRange(masehiKuartal, nowQ);
assert.ok(rangeQ.dari < rangeQ.sampai, "kuartal range");

const nowW = getPeriodeSekarang(masehiMinggu);
assert.match(nowW, /^\d{4}-W\d{2}$/, "minggu id");
const rangeW = getPeriodeRange(masehiMinggu, nowW);
const days =
  (new Date(rangeW.sampai).getTime() - new Date(rangeW.dari).getTime()) /
  86400000;
assert.ok(days <= 6, "minggu max 7 hari");

const nowFY = getPeriodeSekarang(masehiTahun);
assert.match(nowFY, /^\d{4}$/, "tahun fiskal id");
const rangeFY = getPeriodeRange(masehiTahun, nowFY);
assert.match(rangeFY.dari, /-04-01$/, "FY apr starts april");

const tabs = getDaftarPeriode(hijriTahun, 3);
assert.equal(tabs.length, 3);
assert.equal(Number(tabs[0]) - Number(tabs[1]), 1);

assert.ok(parsePeriodeFilter("1446"));
assert.ok(parsePeriodeFilter("2025-06"));
assert.ok(parsePeriodeFilter("2025-W24"));
assert.ok(parsePeriodeFilter("2025-Q2"));
assert.equal(parsePeriodeFilter("invalid"), null);

const chart = buildRingkasanChart(masehiBulan, [], rangeB.dari, rangeB.sampai);
assert.ok(chart.length > 0, "chart has buckets for bulan");

console.log(
  `OK — periode lib (hijri=${nowH}, bulan=${nowB}, kuartal=${nowQ}, minggu=${nowW})`
);
