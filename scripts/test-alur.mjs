/**
 * Tes integrasi semua alur Bank Hemat.
 * Prasyarat: Supabase lokal jalan + seed sudah di-load (npm run db:reset).
 *
 * Jalankan: npm test
 */
import { createClient } from "@supabase/supabase-js";
import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

import { loadProjectEnv, supabaseAnonKey } from "./load-env.mjs";

const env = loadProjectEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54421";
const ANON_KEY =
  supabaseAnonKey(env) ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ensureAdminUser,
} from "./seed-admin.mjs";

const JENIS_WAJIB = [
  "setoran",
  "penarikan",
  "pinjaman_keluar",
  "pinjaman_kembali",
  "transfer_saku",
];

/** Saldo nasabah efektif (view v_saldo_nasabah): asal dibatalkan = 0, pembatalan = audit saja) */
function hitungSaldoNasabah(trxList, nasabahId) {
  return trxList
    .filter((t) => t.nasabah_id === nasabahId)
    .reduce((sum, t) => {
      if (t.dibatalkan_pada || t.jenis === "pembatalan") return sum;
      const j = Number(t.jumlah);
      if (t.jenis === "setoran") return sum + j;
      if (t.jenis === "pinjaman_kembali" && !t.bayar_dari_tabungan) return sum + j;
      if (["penarikan", "pinjaman_keluar"].includes(t.jenis)) return sum - j;
      return sum;
    }, 0);
}

function hitungTabunganNasabah(trxList, nasabahId) {
  return trxList
    .filter((t) => t.nasabah_id === nasabahId)
    .reduce((sum, t) => {
      if (t.dibatalkan_pada || t.jenis === "pembatalan") return sum;
      const j = Number(t.jumlah);
      if (t.jenis === "setoran") return sum + j;
      if (t.jenis === "penarikan") return sum - j;
      if (t.jenis === "pinjaman_kembali" && t.bayar_dari_tabungan) return sum - j;
      return sum;
    }, 0);
}

function hitungHutangNasabah(trxList, nasabahId) {
  return trxList
    .filter((t) => t.nasabah_id === nasabahId)
    .reduce((sum, t) => {
      if (t.dibatalkan_pada || t.jenis === "pembatalan") return sum;
      const j = Number(t.jumlah);
      if (t.jenis === "pinjaman_keluar") return sum + j;
      if (t.jenis === "pinjaman_kembali") return sum - j;
      return sum;
    }, 0);
}

/** Saldo saku efektif (view v_saldo_saku) */
function hitungSaldoSaku(trxList, sakuId) {
  let saldo = 0;
  for (const t of trxList) {
    if (t.dibatalkan_pada || t.jenis === "pembatalan") continue;
    const j = Number(t.jumlah);
    if (t.saku_id === sakuId) {
      if (t.jenis === "setoran") saldo += j;
      if (t.jenis === "pinjaman_kembali" && !t.bayar_dari_tabungan) saldo += j;
      if (["penarikan", "pinjaman_keluar", "transfer_saku"].includes(t.jenis))
        saldo -= j;
    }
    if (t.saku_tujuan_id === sakuId && t.jenis === "transfer_saku") saldo += j;
  }
  return saldo;
}

/** Helper tes — ambil ID saku by nama */
async function idSaku(supabase, nama) {
  const { data, error } = await supabase
    .from("saku")
    .select("id")
    .eq("nama", nama)
    .single();
  assert.equal(error, null, error?.message);
  return data.id;
}

/** Helper tes — nasabah baru untuk skenario isolasi */
async function nasabahBaru(supabase, nama) {
  const { data, error } = await supabase
    .from("nasabah")
    .insert({ nama, telepon: "08188888000" })
    .select("id")
    .single();
  assert.equal(error, null, error?.message);
  return data.id;
}

describe("Bank Hemat — tes alur lengkap", () => {
  /** @type {import('@supabase/supabase-js').SupabaseClient} */
  let supabase;

  before(async () => {
    await ensureAdminUser();
    supabase = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });

  test("1. Login admin berhasil", async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    assert.equal(error, null, `Login gagal: ${error?.message}`);
    assert.ok(data.session?.access_token, "Session token harus ada");
    assert.equal(data.user?.email, ADMIN_EMAIL);
  });

  test("2. Profil admin terbaca (RLS)", async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("nama_lengkap, peran, aktif")
      .single();
    assert.equal(error, null, error?.message);
    assert.equal(data.peran, "admin");
    assert.equal(data.aktif, true);
    assert.match(data.nama_lengkap, /Admin/i);
  });

  test("3. Ada tepat 10 nasabah aktif", async () => {
    const { data, error } = await supabase
      .from("nasabah")
      .select("id, nama, aktif")
      .eq("aktif", true)
      .order("nama");
    assert.equal(error, null, error?.message);
    assert.equal(data.length, 10, `Harus 10 nasabah, dapat ${data.length}`);
    const nama = data.map((n) => n.nama);
    assert.ok(nama.includes("Budi Santoso"));
    assert.ok(nama.includes("Rina Wulandari"));
  });

  test("4. Ada 3 saku aktif (kas, bank, instrumen)", async () => {
    const { data, error } = await supabase
      .from("saku")
      .select("nama, jenis, aktif")
      .eq("aktif", true)
      .order("nama");
    assert.equal(error, null, error?.message);
    assert.equal(data.length, 3);
    const jenis = new Set(data.map((s) => s.jenis));
    assert.ok(jenis.has("kas"));
    assert.ok(jenis.has("bank"));
    assert.ok(jenis.has("instrumen"));
  });

  test("5. Semua jenis transaksi ada di seed", async () => {
    const { data, error } = await supabase.from("transaksi").select("jenis");
    assert.equal(error, null, error?.message);
    const ada = new Set(data.map((t) => t.jenis));
    for (const j of JENIS_WAJIB) {
      assert.ok(ada.has(j), `Jenis "${j}" belum ada di seed`);
    }
  });

  test("6. Saldo nasabah (view) konsisten dengan transaksi", async () => {
    const [trxRes, saldoRes] = await Promise.all([
      supabase.from("transaksi").select(
        "id, nasabah_id, jenis, jumlah, dibatalkan_pada, transaksi_asal_id"
      ),
      supabase
        .from("v_saldo_nasabah")
        .select("id, nama, tabungan, hutang, saldo"),
    ]);
    assert.equal(trxRes.error, null);
    assert.equal(saldoRes.error, null);

    for (const row of saldoRes.data) {
      const expectedSaldo = hitungSaldoNasabah(trxRes.data, row.id);
      const expectedTabungan = hitungTabunganNasabah(trxRes.data, row.id);
      const expectedHutang = hitungHutangNasabah(trxRes.data, row.id);
      assert.equal(
        Number(row.saldo),
        expectedSaldo,
        `Saldo ${row.nama}: view=${row.saldo}, hitung=${expectedSaldo}`
      );
      assert.equal(Number(row.tabungan), expectedTabungan);
      assert.equal(Number(row.hutang), expectedHutang);
      assert.equal(Number(row.saldo), Number(row.tabungan) - Number(row.hutang));
    }
  });

  test("7. Saldo saku (view) konsisten dengan transaksi", async () => {
    const [trxRes, saldoRes] = await Promise.all([
      supabase.from("transaksi").select(
        "id, saku_id, saku_tujuan_id, jenis, jumlah, dibatalkan_pada, transaksi_asal_id"
      ),
      supabase.from("v_saldo_saku").select("id, nama, saldo"),
    ]);
    assert.equal(trxRes.error, null);
    assert.equal(saldoRes.error, null);

    for (const row of saldoRes.data) {
      const expected = hitungSaldoSaku(trxRes.data, row.id);
      assert.equal(
        Number(row.saldo),
        expected,
        `Saldo saku ${row.nama}: view=${row.saldo}, hitung=${expected}`
      );
    }
  });

  test("8. Total saldo saku = total kewajiban nasabah", async () => {
    const [sakuRes, nasabahRes] = await Promise.all([
      supabase.from("v_saldo_saku").select("saldo"),
      supabase.from("v_saldo_nasabah").select("saldo"),
    ]);
    const totalSaku = sakuRes.data.reduce((s, r) => s + Number(r.saldo), 0);
    const totalNasabah = nasabahRes.data.reduce(
      (s, r) => s + Number(r.saldo),
      0
    );
    assert.equal(
      totalSaku,
      totalNasabah,
      `Total saku (${totalSaku}) harus sama kewajiban nasabah (${totalNasabah})`
    );
  });

  test("9. View ringkasan harian & jenis terbaca", async () => {
    const [harian, jenis] = await Promise.all([
      supabase.from("v_ringkasan_harian").select("*").limit(5),
      supabase.from("v_ringkasan_jenis").select("*"),
    ]);
    assert.equal(harian.error, null);
    assert.equal(jenis.error, null);
    assert.ok(harian.data.length > 0, "Ringkasan harian kosong");
    assert.equal(jenis.data.length, JENIS_WAJIB.length);
  });

  test("10. Audit log tercatat dari seed", async () => {
    const { data, error } = await supabase.rpc("list_audit_log", {
      p_limit: 500,
    });
    assert.equal(error, null, error?.message);
    const insertLogs = (data ?? []).filter(
      (row) =>
        row.aksi === "insert" &&
        ["nasabah", "saku", "transaksi"].includes(row.tabel)
    );
    assert.ok(
      insertLogs.length >= 10,
      "Audit insert nasabah/saku/transaksi harus ada"
    );
  });

  test("11. Tambah transaksi setoran (alur CRUD)", async () => {
    const { data: nasabah } = await supabase
      .from("nasabah")
      .select("id")
      .eq("nama", "Hendra Kusuma")
      .single();
    const { data: saku } = await supabase
      .from("saku")
      .select("id")
      .eq("nama", "Kas Loket")
      .single();

    const { data: saldoSebelum } = await supabase
      .from("v_saldo_nasabah")
      .select("saldo")
      .eq("id", nasabah.id)
      .single();

    const { data, error } = await supabase
      .from("transaksi")
      .insert({
        tanggal: "2025-06-03",
        jenis: "setoran",
        jumlah: 50000,
        keterangan: "Tes otomatis — setoran",
        nasabah_id: nasabah.id,
        saku_id: saku.id,
      })
      .select("id")
      .single();

    assert.equal(error, null, error?.message);
    assert.ok(data.id);

    const { data: saldoSesudah } = await supabase
      .from("v_saldo_nasabah")
      .select("saldo")
      .eq("id", nasabah.id)
      .single();
    assert.equal(
      Number(saldoSesudah.saldo),
      Number(saldoSebelum.saldo) + 50000
    );
  });

  test("12. Edit jumlah transaksi ditolak (integritas saldo)", async () => {
    const { data: trx } = await supabase
      .from("transaksi")
      .select("id")
      .limit(1)
      .single();

    const { error } = await supabase
      .from("transaksi")
      .update({ jumlah: 999999 })
      .eq("id", trx.id);

    assert.ok(error, "Update jumlah seharusnya ditolak trigger DB");
    assert.match(error.message, /tidak boleh|Saldo/i);
  });

  test("13. Hapus transaksi ditolak (integritas saldo)", async () => {
    const { data: trx } = await supabase
      .from("transaksi")
      .select("id")
      .limit(1)
      .single();

    const { error } = await supabase.from("transaksi").delete().eq("id", trx.id);
    assert.ok(error, "Delete transaksi seharusnya ditolak trigger DB");
    assert.match(error.message, /tidak boleh/i);
  });

  test("14. Akses tanpa login ditolak (RLS)", async () => {
    const anon = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await anon.from("nasabah").select("id");
    assert.equal(data?.length ?? 0, 0, "Tanpa login tidak boleh lihat nasabah");
    assert.ok(error === null || data.length === 0);
  });

  test("15. Tambah transaksi penarikan — saldo turun", async () => {
    const { data: nasabah } = await supabase
      .from("nasabah")
      .select("id")
      .eq("nama", "Fitri Rahayu")
      .single();
    const { data: saku } = await supabase
      .from("saku")
      .select("id")
      .eq("nama", "Kas Loket")
      .single();
    const { data: saldoSebelum } = await supabase
      .from("v_saldo_nasabah")
      .select("saldo")
      .eq("id", nasabah.id)
      .single();

    const jumlah = 25000;
    const { error } = await supabase.from("transaksi").insert({
      tanggal: "2025-06-04",
      jenis: "penarikan",
      jumlah,
      keterangan: "Tes otomatis — penarikan",
      nasabah_id: nasabah.id,
      saku_id: saku.id,
    });
    assert.equal(error, null, error?.message);

    const { data: saldoSesudah } = await supabase
      .from("v_saldo_nasabah")
      .select("saldo")
      .eq("id", nasabah.id)
      .single();
    assert.equal(Number(saldoSesudah.saldo), Number(saldoSebelum.saldo) - jumlah);
  });

  test("16. Tambah transaksi pinjaman keluar & kembali", async () => {
    const { data: nasabah } = await supabase
      .from("nasabah")
      .select("id")
      .eq("nama", "Joko Susilo")
      .single();
    const { data: saku } = await supabase
      .from("saku")
      .select("id")
      .eq("nama", "Kas Loket")
      .single();
    const { data: saldoAwal } = await supabase
      .from("v_saldo_nasabah")
      .select("saldo")
      .eq("id", nasabah.id)
      .single();

    const keluar = 80000;
    const kembali = 30000;
    assert.equal(
      (await supabase.from("transaksi").insert({
        tanggal: "2025-06-04",
        jenis: "pinjaman_keluar",
        jumlah: keluar,
        nasabah_id: nasabah.id,
        saku_id: saku.id,
        keterangan: "Tes pinjaman keluar",
      })).error,
      null
    );
    assert.equal(
      (await supabase.from("transaksi").insert({
        tanggal: "2025-06-05",
        jenis: "pinjaman_kembali",
        jumlah: kembali,
        nasabah_id: nasabah.id,
        saku_id: saku.id,
        keterangan: "Tes pinjaman kembali",
      })).error,
      null
    );

    const { data: saldoAkhir } = await supabase
      .from("v_saldo_nasabah")
      .select("saldo")
      .eq("id", nasabah.id)
      .single();
    assert.equal(
      Number(saldoAkhir.saldo),
      Number(saldoAwal.saldo) - keluar + kembali
    );
  });

  test("17. Tambah transfer antar saku — saldo pindah", async () => {
    const { data: sakuList } = await supabase.from("saku").select("id, nama");
    const kas = sakuList.find((s) => s.nama === "Kas Loket");
    const bank = sakuList.find((s) => s.nama === "Rekening BCA");
    assert.ok(kas && bank);

    const [saldoKasSebelum, saldoBankSebelum] = await Promise.all([
      supabase.from("v_saldo_saku").select("saldo").eq("id", kas.id).single(),
      supabase.from("v_saldo_saku").select("saldo").eq("id", bank.id).single(),
    ]);

    const jumlah = 75000;
    const { error } = await supabase.from("transaksi").insert({
      tanggal: "2025-06-05",
      jenis: "transfer_saku",
      jumlah,
      saku_id: kas.id,
      saku_tujuan_id: bank.id,
      keterangan: "Tes transfer otomatis",
    });
    assert.equal(error, null, error?.message);

    const [saldoKasSesudah, saldoBankSesudah] = await Promise.all([
      supabase.from("v_saldo_saku").select("saldo").eq("id", kas.id).single(),
      supabase.from("v_saldo_saku").select("saldo").eq("id", bank.id).single(),
    ]);
    assert.equal(
      Number(saldoKasSesudah.data.saldo),
      Number(saldoKasSebelum.data.saldo) - jumlah
    );
    assert.equal(
      Number(saldoBankSesudah.data.saldo),
      Number(saldoBankSebelum.data.saldo) + jumlah
    );
  });

  test("18. CRUD nasabah — tambah & edit", async () => {
    const { data: baru, error: insertErr } = await supabase
      .from("nasabah")
      .insert({
        nama: "Tes Nasabah Auto",
        telepon: "08199999001",
        alamat: "Unit test",
      })
      .select("id, nama")
      .single();
    assert.equal(insertErr, null, insertErr?.message);
    assert.equal(baru.nama, "Tes Nasabah Auto");

    const { error: updateErr } = await supabase
      .from("nasabah")
      .update({ nama: "Tes Nasabah Auto (edit)" })
      .eq("id", baru.id);
    assert.equal(updateErr, null, updateErr?.message);

    const { data: updated } = await supabase
      .from("nasabah")
      .select("nama")
      .eq("id", baru.id)
      .single();
    assert.equal(updated.nama, "Tes Nasabah Auto (edit)");
  });

  test("19. CRUD saku — tambah & edit", async () => {
    const { data: baru, error: insertErr } = await supabase
      .from("saku")
      .insert({
        nama: "Tes Saku Auto",
        jenis: "kas",
        keterangan: "Unit test",
      })
      .select("id, nama, jenis")
      .single();
    assert.equal(insertErr, null, insertErr?.message);
    assert.equal(baru.jenis, "kas");

    const { error: updateErr } = await supabase
      .from("saku")
      .update({ nama: "Tes Saku Auto (edit)" })
      .eq("id", baru.id);
    assert.equal(updateErr, null, updateErr?.message);

    const { data: saldo } = await supabase
      .from("v_saldo_saku")
      .select("saldo")
      .eq("id", baru.id)
      .single();
    assert.equal(Number(saldo.saldo), 0);
  });

  test("20. Buku tabungan nasabah — mutasi kronologis", async () => {
    const { data: nasabah } = await supabase
      .from("nasabah")
      .select("id")
      .eq("nama", "Budi Santoso")
      .single();

    const { data: mutasi, error } = await supabase
      .from("transaksi")
      .select("jenis, jumlah, tanggal")
      .eq("nasabah_id", nasabah.id)
      .order("tanggal", { ascending: true });
    assert.equal(error, null, error?.message);
    assert.ok(mutasi.length >= 2, "Budi harus punya setoran + penarikan di seed");

    const { data: saldoView } = await supabase
      .from("v_saldo_nasabah")
      .select("saldo")
      .eq("id", nasabah.id)
      .single();
    const hitung = hitungSaldoNasabah(
      mutasi.map((m) => ({ ...m, nasabah_id: nasabah.id })),
      nasabah.id
    );
    assert.equal(Number(saldoView.saldo), hitung);
  });

  test("21. Laporan — filter tanggal & jenis", async () => {
    const { data: setoranSeed, error: seedErr } = await supabase
      .from("transaksi")
      .select("tanggal")
      .eq("jenis", "setoran")
      .order("tanggal")
      .limit(10);
    assert.equal(seedErr, null);
    assert.equal(setoranSeed.length, 10, "Seed harus punya 10 setoran awal");

    const dari = setoranSeed[0].tanggal;
    const sampai = setoranSeed[9].tanggal;

    const { data: semua, error: e1 } = await supabase
      .from("transaksi")
      .select("jenis, tanggal")
      .gte("tanggal", dari)
      .lte("tanggal", sampai);
    assert.equal(e1, null);
    assert.ok(semua.length >= 10, "Seed setoran awal 10 nasabah");

    const { data: setoranSaja, error: e2 } = await supabase
      .from("transaksi")
      .select("jenis")
      .gte("tanggal", dari)
      .lte("tanggal", sampai)
      .eq("jenis", "setoran");
    assert.equal(e2, null);
    assert.ok(setoranSaja.every((t) => t.jenis === "setoran"));
    assert.equal(setoranSaja.length, 10);
  });

  test("22. Update profil admin (pengaturan)", async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    assert.ok(user);

    const namaBaru = "Admin Bank Hemat (tes)";
    const { error } = await supabase
      .from("profiles")
      .update({ nama_lengkap: namaBaru })
      .eq("id", user.id);
    assert.equal(error, null, error?.message);

    const { data: profil } = await supabase
      .from("profiles")
      .select("nama_lengkap")
      .eq("id", user.id)
      .single();
    assert.equal(profil.nama_lengkap, namaBaru);

    await supabase
      .from("profiles")
      .update({ nama_lengkap: "Admin Bank Hemat" })
      .eq("id", user.id);
  });

  test("23. Logout — session invalid, RLS menolak", async () => {
    const { error: signOutErr } = await supabase.auth.signOut();
    assert.equal(signOutErr, null, signOutErr?.message);

    const { data } = await supabase.from("nasabah").select("id");
    assert.equal(data?.length ?? 0, 0);

    const { error: loginErr } = await supabase.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    assert.equal(loginErr, null, "Re-login untuk tes berikutnya");
  });

  test("28. Hapus saku ditolak jika masih ada saldo", async () => {
    const { data: saku } = await supabase
      .from("v_saldo_saku")
      .select("id, saldo")
      .eq("nama", "Kas Loket")
      .single();
    assert.ok(Number(saku.saldo) > 0);

    const { error } = await supabase
      .from("saku")
      .update({ aktif: false })
      .eq("id", saku.id);
    assert.ok(error, "Nonaktifkan saku bersaldo harus ditolak");
    assert.match(error.message, /saldo|transfer/i);
  });

  test("29. Hapus saku berhasil jika saldo nol", async () => {
    const { data: baru, error: insertErr } = await supabase
      .from("saku")
      .insert({ nama: "Saku Hapus Tes", jenis: "kas" })
      .select("id")
      .single();
    assert.equal(insertErr, null);

    const { error: hapusErr } = await supabase
      .from("saku")
      .update({ aktif: false })
      .eq("id", baru.id);
    assert.equal(hapusErr, null, hapusErr?.message);

    const { data: masihAda } = await supabase
      .from("v_saldo_saku")
      .select("id")
      .eq("id", baru.id);
    assert.equal(masihAda?.length ?? 0, 0);
  });

  test("30. Transaksi ditolak jika saldo saku tidak cukup", async () => {
    const { data: kas } = await supabase
      .from("v_saldo_saku")
      .select("id, saldo")
      .eq("nama", "Kas Loket")
      .single();
    const { data: bank } = await supabase
      .from("saku")
      .select("id")
      .eq("nama", "Rekening BCA")
      .single();

    const { error } = await supabase.from("transaksi").insert({
      tanggal: "2025-06-06",
      jenis: "transfer_saku",
      jumlah: Number(kas.saldo) + 1,
      saku_id: kas.id,
      saku_tujuan_id: bank.id,
      keterangan: "Tes saldo saku tidak cukup",
    });
    assert.ok(error, "Transfer melebihi saldo kas harus ditolak");
    assert.match(error.message, /tidak cukup/i);
  });

  test("31. Penarikan ditolak jika tabungan tidak cukup", async () => {
    const { data: nasabahBaru, error: nErr } = await supabase
      .from("nasabah")
      .insert({ nama: "Tes Saldo Minus", telepon: "08111111001" })
      .select("id")
      .single();
    assert.equal(nErr, null);

    const { data: kas } = await supabase
      .from("saku")
      .select("id")
      .eq("nama", "Kas Loket")
      .single();

    assert.equal(
      (
        await supabase.from("transaksi").insert({
          tanggal: "2025-06-06",
          jenis: "setoran",
          jumlah: 50000,
          nasabah_id: nasabahBaru.id,
          saku_id: kas.id,
          keterangan: "Setoran awal tes",
        })
      ).error,
      null
    );

    const { error } = await supabase.from("transaksi").insert({
      tanggal: "2025-06-06",
      jenis: "penarikan",
      jumlah: 100000,
      nasabah_id: nasabahBaru.id,
      saku_id: kas.id,
      keterangan: "Penarikan melebihi saldo",
    });
    assert.ok(error, "Penarikan melebihi tabungan harus ditolak");
    assert.match(error.message, /tabungan|tidak cukup/i);
  });

  test("44. Penarikan ke Deposito ditolak", async () => {
    const nasabahId = await nasabahBaru(supabase, "Tes Penarikan Deposito");
    const kasId = await idSaku(supabase, "Kas Loket");
    const depositoId = await idSaku(supabase, "Deposito");

    assert.equal(
      (
        await supabase.from("transaksi").insert({
          tanggal: "2025-06-10",
          jenis: "setoran",
          jumlah: 100_000,
          nasabah_id: nasabahId,
          saku_id: kasId,
          keterangan: "Setoran awal",
        })
      ).error,
      null
    );

    const { error } = await supabase.from("transaksi").insert({
      tanggal: "2025-06-10",
      jenis: "penarikan",
      jumlah: 50_000,
      nasabah_id: nasabahId,
      saku_id: depositoId,
      keterangan: "Harus ditolak — deposito bukan saku tunai",
    });
    assert.ok(error, "Penarikan dari deposito harus ditolak");
    assert.match(error.message, /instrumen|deposito/i);
  });

  test("45. Pinjaman keluar ke Deposito ditolak", async () => {
    const nasabahId = await nasabahBaru(supabase, "Tes Pinjam Deposito");
    const depositoId = await idSaku(supabase, "Deposito");

    const { error } = await supabase.from("transaksi").insert({
      tanggal: "2025-06-10",
      jenis: "pinjaman_keluar",
      jumlah: 50_000,
      nasabah_id: nasabahId,
      saku_id: depositoId,
      keterangan: "Harus ditolak — deposito bukan saku tunai",
    });
    assert.ok(error, "Pinjaman keluar dari deposito harus ditolak");
    assert.match(error.message, /instrumen|deposito/i);
  });

  test("51. Batalkan penarikan — tabungan kembali", async () => {
    const kasId = await idSaku(supabase, "Kas Loket");
    const nasabahId = await nasabahBaru(supabase, "Tes Batal Penarikan");

    assert.equal(
      (
        await supabase.from("transaksi").insert({
          tanggal: "2025-06-11",
          jenis: "setoran",
          jumlah: 100_000,
          nasabah_id: nasabahId,
          saku_id: kasId,
          keterangan: "Setoran awal",
        })
      ).error,
      null
    );

    const { data: penarikan } = await supabase
      .from("transaksi")
      .insert({
        tanggal: "2025-06-11",
        jenis: "penarikan",
        jumlah: 40_000,
        nasabah_id: nasabahId,
        saku_id: kasId,
        keterangan: "Penarikan untuk dibatalkan",
      })
      .select("id")
      .single();

    const { data: sebelum } = await supabase
      .from("v_saldo_nasabah")
      .select("tabungan")
      .eq("id", nasabahId)
      .single();
    assert.equal(Number(sebelum.tabungan), 60_000);

    const { error: bErr } = await supabase.rpc("batalkan_transaksi", {
      p_transaksi_id: penarikan.id,
      p_alasan: "Tes batal penarikan",
    });
    assert.equal(bErr, null, bErr?.message);

    const { data: sesudah } = await supabase
      .from("v_saldo_nasabah")
      .select("tabungan")
      .eq("id", nasabahId)
      .single();
    assert.equal(Number(sesudah.tabungan), 100_000);
  });

  test("52. Batalkan pinjaman keluar — hutang kembali", async () => {
    const kasId = await idSaku(supabase, "Kas Loket");
    const nasabahId = await nasabahBaru(supabase, "Tes Batal Pinjam Keluar");

    assert.equal(
      (
        await supabase.from("transaksi").insert({
          tanggal: "2025-06-11",
          jenis: "setoran",
          jumlah: 150_000,
          nasabah_id: nasabahId,
          saku_id: kasId,
          keterangan: "Setoran awal",
        })
      ).error,
      null
    );

    const { data: pinjam } = await supabase
      .from("transaksi")
      .insert({
        tanggal: "2025-06-11",
        jenis: "pinjaman_keluar",
        jumlah: 50_000,
        nasabah_id: nasabahId,
        saku_id: kasId,
        keterangan: "Pinjam untuk dibatalkan",
      })
      .select("id")
      .single();

    const { data: sebelum } = await supabase
      .from("v_saldo_nasabah")
      .select("hutang, tabungan")
      .eq("id", nasabahId)
      .single();
    assert.equal(Number(sebelum.hutang), 50_000);
    assert.equal(Number(sebelum.tabungan), 150_000);

    const { error: bErr } = await supabase.rpc("batalkan_transaksi", {
      p_transaksi_id: pinjam.id,
      p_alasan: "Tes batal pinjaman keluar",
    });
    assert.equal(bErr, null, bErr?.message);

    const { data: sesudah } = await supabase
      .from("v_saldo_nasabah")
      .select("hutang, tabungan")
      .eq("id", nasabahId)
      .single();
    assert.equal(Number(sesudah.hutang), 0);
    assert.equal(Number(sesudah.tabungan), 150_000);
  });

  test("53. Batalkan pinjaman kembali tunai — hutang & saku kembali", async () => {
    const kasId = await idSaku(supabase, "Kas Loket");
    const nasabahId = await nasabahBaru(supabase, "Tes Batal Pinjam Kembali");

    assert.equal(
      (
        await supabase.from("transaksi").insert({
          tanggal: "2025-06-11",
          jenis: "setoran",
          jumlah: 200_000,
          nasabah_id: nasabahId,
          saku_id: kasId,
          keterangan: "Setoran awal",
        })
      ).error,
      null
    );
    assert.equal(
      (
        await supabase.from("transaksi").insert({
          tanggal: "2025-06-11",
          jenis: "pinjaman_keluar",
          jumlah: 80_000,
          nasabah_id: nasabahId,
          saku_id: kasId,
          keterangan: "Pinjam awal",
        })
      ).error,
      null
    );

    const { data: saldoKasSebelum } = await supabase
      .from("v_saldo_saku")
      .select("saldo")
      .eq("id", kasId)
      .single();

    const { data: kembali } = await supabase
      .from("transaksi")
      .insert({
        tanggal: "2025-06-12",
        jenis: "pinjaman_kembali",
        jumlah: 30_000,
        nasabah_id: nasabahId,
        saku_id: kasId,
        bayar_dari_tabungan: false,
        keterangan: "Angsuran tunai untuk dibatalkan",
      })
      .select("id")
      .single();

    const { data: sebelum } = await supabase
      .from("v_saldo_nasabah")
      .select("hutang")
      .eq("id", nasabahId)
      .single();
    assert.equal(Number(sebelum.hutang), 50_000);

    const { data: saldoKasSetelahBayar } = await supabase
      .from("v_saldo_saku")
      .select("saldo")
      .eq("id", kasId)
      .single();
    assert.equal(
      Number(saldoKasSetelahBayar.saldo),
      Number(saldoKasSebelum.saldo) + 30_000
    );

    const { error: bErr } = await supabase.rpc("batalkan_transaksi", {
      p_transaksi_id: kembali.id,
      p_alasan: "Tes batal pinjaman kembali tunai",
    });
    assert.equal(bErr, null, bErr?.message);

    const { data: sesudah } = await supabase
      .from("v_saldo_nasabah")
      .select("hutang")
      .eq("id", nasabahId)
      .single();
    assert.equal(Number(sesudah.hutang), 80_000);

    const { data: saldoKasSesudah } = await supabase
      .from("v_saldo_saku")
      .select("saldo")
      .eq("id", kasId)
      .single();
    assert.equal(
      Number(saldoKasSesudah.saldo),
      Number(saldoKasSebelum.saldo)
    );
  });

  test("54. Batalkan transfer saku — saldo asal & tujuan kembali", async () => {
    const kasId = await idSaku(supabase, "Kas Loket");
    const bankId = await idSaku(supabase, "Rekening BCA");
    const jumlah = 25_000;

    const [saldoKasSebelum, saldoBankSebelum] = await Promise.all([
      supabase.from("v_saldo_saku").select("saldo").eq("id", kasId).single(),
      supabase.from("v_saldo_saku").select("saldo").eq("id", bankId).single(),
    ]);

    const { data: transfer } = await supabase
      .from("transaksi")
      .insert({
        tanggal: "2025-06-12",
        jenis: "transfer_saku",
        jumlah,
        saku_id: kasId,
        saku_tujuan_id: bankId,
        keterangan: "Transfer untuk dibatalkan",
      })
      .select("id")
      .single();

    const { error: bErr } = await supabase.rpc("batalkan_transaksi", {
      p_transaksi_id: transfer.id,
      p_alasan: "Tes batal transfer",
    });
    assert.equal(bErr, null, bErr?.message);

    const [saldoKasSesudah, saldoBankSesudah] = await Promise.all([
      supabase.from("v_saldo_saku").select("saldo").eq("id", kasId).single(),
      supabase.from("v_saldo_saku").select("saldo").eq("id", bankId).single(),
    ]);
    assert.equal(
      Number(saldoKasSesudah.data.saldo),
      Number(saldoKasSebelum.data.saldo)
    );
    assert.equal(
      Number(saldoBankSesudah.data.saldo),
      Number(saldoBankSebelum.data.saldo)
    );
  });

  test("55. Pinjaman keluar ditolak jika saldo saku tidak cukup", async () => {
    const { data: kas } = await supabase
      .from("v_saldo_saku")
      .select("id, saldo")
      .eq("nama", "Kas Loket")
      .single();
    const nasabahId = await nasabahBaru(supabase, "Tes Pinjam Saku Kosong");

    const { error } = await supabase.from("transaksi").insert({
      tanggal: "2025-06-12",
      jenis: "pinjaman_keluar",
      jumlah: Number(kas.saldo) + 1,
      nasabah_id: nasabahId,
      saku_id: kas.id,
      keterangan: "Harus ditolak — saku tidak cukup",
    });
    assert.ok(error, "Pinjaman keluar melebihi saldo saku harus ditolak");
    assert.match(error.message, /tidak cukup/i);
  });

  test("56. Batalkan pinjaman kembali dari tabungan — hutang & tabungan kembali", async () => {
    const kasId = await idSaku(supabase, "Kas Loket");
    const nasabahId = await nasabahBaru(supabase, "Tes Batal Bayar Tabungan");

    assert.equal(
      (
        await supabase.from("transaksi").insert({
          tanggal: "2025-06-12",
          jenis: "setoran",
          jumlah: 200_000,
          nasabah_id: nasabahId,
          saku_id: kasId,
          keterangan: "Setoran awal",
        })
      ).error,
      null
    );
    assert.equal(
      (
        await supabase.from("transaksi").insert({
          tanggal: "2025-06-12",
          jenis: "pinjaman_keluar",
          jumlah: 80_000,
          nasabah_id: nasabahId,
          saku_id: kasId,
          keterangan: "Pinjam awal",
        })
      ).error,
      null
    );

    const { data: saldoKasSebelum } = await supabase
      .from("v_saldo_saku")
      .select("saldo")
      .eq("id", kasId)
      .single();

    const { data: bayarTabungan } = await supabase
      .from("transaksi")
      .insert({
        tanggal: "2025-06-13",
        jenis: "pinjaman_kembali",
        jumlah: 25_000,
        nasabah_id: nasabahId,
        bayar_dari_tabungan: true,
        keterangan: "Bayar tabungan untuk dibatalkan",
      })
      .select("id")
      .single();

    const { data: sebelum } = await supabase
      .from("v_saldo_nasabah")
      .select("tabungan, hutang")
      .eq("id", nasabahId)
      .single();
    assert.equal(Number(sebelum.tabungan), 175_000);
    assert.equal(Number(sebelum.hutang), 55_000);

    const { error: bErr } = await supabase.rpc("batalkan_transaksi", {
      p_transaksi_id: bayarTabungan.id,
      p_alasan: "Tes batal bayar dari tabungan",
    });
    assert.equal(bErr, null, bErr?.message);

    const { data: sesudah } = await supabase
      .from("v_saldo_nasabah")
      .select("tabungan, hutang")
      .eq("id", nasabahId)
      .single();
    assert.equal(Number(sesudah.tabungan), 200_000);
    assert.equal(Number(sesudah.hutang), 80_000);

    const { data: saldoKasSesudah } = await supabase
      .from("v_saldo_saku")
      .select("saldo")
      .eq("id", kasId)
      .single();
    assert.equal(
      Number(saldoKasSesudah.saldo),
      Number(saldoKasSebelum.saldo)
    );
  });

  test("57. Pinjaman kembali tunai ditolak jika hutang tidak cukup", async () => {
    const kasId = await idSaku(supabase, "Kas Loket");
    const nasabahId = await nasabahBaru(supabase, "Tes Kembali Tanpa Hutang");

    assert.equal(
      (
        await supabase.from("transaksi").insert({
          tanggal: "2025-06-13",
          jenis: "setoran",
          jumlah: 100_000,
          nasabah_id: nasabahId,
          saku_id: kasId,
          keterangan: "Setoran tanpa pinjaman",
        })
      ).error,
      null
    );

    const { error } = await supabase.from("transaksi").insert({
      tanggal: "2025-06-13",
      jenis: "pinjaman_kembali",
      jumlah: 50_000,
      nasabah_id: nasabahId,
      saku_id: kasId,
      bayar_dari_tabungan: false,
      keterangan: "Harus ditolak — tidak ada hutang",
    });
    assert.ok(error, "Setoran pinjaman tanpa hutang harus ditolak");
    assert.match(error.message, /hutang/i);
  });

  test("32. Batalkan setoran — saldo kembali & flag asal terisi", async () => {
    const { data: nasabahBaru } = await supabase
      .from("nasabah")
      .insert({ nama: "Tes Pembatalan", telepon: "08111111002" })
      .select("id")
      .single();
    const { data: kas } = await supabase
      .from("saku")
      .select("id")
      .eq("nama", "Kas Loket")
      .single();

    const { data: setoran } = await supabase
      .from("transaksi")
      .insert({
        tanggal: "2025-06-06",
        jenis: "setoran",
        jumlah: 75000,
        nasabah_id: nasabahBaru.id,
        saku_id: kas.id,
        keterangan: "Setoran untuk tes batal",
      })
      .select("id")
      .single();

    const { data: sebelum } = await supabase
      .from("v_saldo_nasabah")
      .select("saldo, tabungan")
      .eq("id", nasabahBaru.id)
      .single();
    assert.equal(Number(sebelum.saldo), 75000);

    const { data: pembatalanId, error: bErr } = await supabase.rpc(
      "batalkan_transaksi",
      {
        p_transaksi_id: setoran.id,
        p_alasan: "Tes otomatis pembatalan setoran",
      }
    );
    assert.equal(bErr, null, bErr?.message);
    assert.ok(pembatalanId);

    const { data: asal } = await supabase
      .from("transaksi")
      .select("dibatalkan_pada, alasan_pembatalan")
      .eq("id", setoran.id)
      .single();
    assert.ok(asal.dibatalkan_pada);
    assert.match(asal.alasan_pembatalan, /Tes otomatis/);

    const { data: sesudah } = await supabase
      .from("v_saldo_nasabah")
      .select("saldo, tabungan")
      .eq("id", nasabahBaru.id)
      .single();
    assert.equal(Number(sesudah.saldo), 0);
    assert.equal(Number(sesudah.tabungan), 0);
  });

  test("33. Batalkan transaksi kedua kali ditolak", async () => {
    const { data: trx } = await supabase
      .from("transaksi")
      .select("id")
      .eq("keterangan", "Setoran untuk tes batal")
      .single();

    const { error } = await supabase.rpc("batalkan_transaksi", {
      p_transaksi_id: trx.id,
      p_alasan: "Percobaan batal ulang yang harus gagal",
    });
    assert.ok(error, "Pembatalan ulang harus ditolak");
    assert.match(error.message, /sudah dibatalkan/i);
  });

  test("34. Batalkan setoran ditolak jika saldo nasabah sudah ditarik", async () => {
    const { data: nasabahBaru } = await supabase
      .from("nasabah")
      .insert({ nama: "Tes Batal Gagal", telepon: "08111111003" })
      .select("id")
      .single();
    const { data: kas } = await supabase
      .from("saku")
      .select("id")
      .eq("nama", "Kas Loket")
      .single();

    const { data: setoran } = await supabase
      .from("transaksi")
      .insert({
        tanggal: "2025-06-06",
        jenis: "setoran",
        jumlah: 100000,
        nasabah_id: nasabahBaru.id,
        saku_id: kas.id,
        keterangan: "Setoran tes batal gagal",
      })
      .select("id")
      .single();

    assert.equal(
      (
        await supabase.from("transaksi").insert({
          tanggal: "2025-06-06",
          jenis: "penarikan",
          jumlah: 80000,
          nasabah_id: nasabahBaru.id,
          saku_id: kas.id,
          keterangan: "Penarikan sebelum batal",
        })
      ).error,
      null
    );

    const { error } = await supabase.rpc("batalkan_transaksi", {
      p_transaksi_id: setoran.id,
      p_alasan: "Harus gagal karena saldo tidak cukup",
    });
    assert.ok(error, "Batalkan setoran saat saldo terpotong harus ditolak");
    assert.match(error.message, /tidak cukup/i);
  });

  test("35. Insert pembatalan manual ditolak (hanya RPC)", async () => {
    const { data: nasabahBaru } = await supabase
      .from("nasabah")
      .insert({ nama: "Tes Guard Pembatalan", telepon: "08111111004" })
      .select("id")
      .single();
    const { data: kas } = await supabase
      .from("saku")
      .select("id")
      .eq("nama", "Kas Loket")
      .single();

    const { data: trx } = await supabase
      .from("transaksi")
      .insert({
        tanggal: "2025-06-06",
        jenis: "setoran",
        jumlah: 1000,
        nasabah_id: nasabahBaru.id,
        saku_id: kas.id,
        keterangan: "Setoran untuk tes guard",
      })
      .select("id, jumlah, nasabah_id, saku_id")
      .single();

    const { error } = await supabase.from("transaksi").insert({
      tanggal: "2025-06-06",
      jenis: "pembatalan",
      jumlah: trx.jumlah,
      nasabah_id: trx.nasabah_id,
      saku_id: trx.saku_id,
      transaksi_asal_id: trx.id,
      keterangan: "Insert manual ilegal",
    });
    assert.ok(error, "Insert pembatalan manual harus ditolak");
    assert.match(error.message, /batalkan_transaksi/i);
  });

  test("36. Nama saku duplikat ditolak", async () => {
    const { error } = await supabase.from("saku").insert({
      nama: "Kas Loket",
      jenis: "kas",
      keterangan: "Duplikat nama",
    });
    assert.ok(error, "Nama saku duplikat harus ditolak");
  });

  test("37. Nama nasabah duplikat ditolak", async () => {
    const { error } = await supabase.from("nasabah").insert({
      nama: "Budi Santoso",
      telepon: "08123456789",
    });
    assert.ok(error, "Nama nasabah duplikat harus ditolak");
  });

  test("38. Nonaktifkan nasabah ditolak jika masih ada tabungan", async () => {
    const { data: nasabah } = await supabase
      .from("v_saldo_nasabah")
      .select("id, tabungan, hutang")
      .eq("nama", "Budi Santoso")
      .single();
    assert.ok(Number(nasabah.tabungan) > 0);

    const { error } = await supabase
      .from("nasabah")
      .update({ aktif: false })
      .eq("id", nasabah.id);
    assert.ok(error, "Nonaktifkan nasabah bersaldo harus ditolak");
    assert.match(error.message, /tabungan|hutang/i);
  });

  test("39. Nonaktifkan nasabah berhasil jika tabungan dan hutang nol", async () => {
    const { data: baru, error: insertErr } = await supabase
      .from("nasabah")
      .insert({
        nama: "Nasabah Nonaktif Tes",
        telepon: "08199999002",
      })
      .select("id")
      .single();
    assert.equal(insertErr, null);

    const { error: nonaktifErr } = await supabase
      .from("nasabah")
      .update({ aktif: false })
      .eq("id", baru.id);
    assert.equal(nonaktifErr, null, nonaktifErr?.message);

    const { data: masihAda } = await supabase
      .from("v_saldo_nasabah")
      .select("id")
      .eq("id", baru.id);
    assert.equal(masihAda?.length ?? 0, 0);
  });

  test("40. Hapus nasabah ditolak jika masih punya transaksi", async () => {
    const { data: nasabah } = await supabase
      .from("nasabah")
      .select("id")
      .eq("nama", "Budi Santoso")
      .single();

    const { error } = await supabase
      .from("nasabah")
      .delete()
      .eq("id", nasabah.id);
    assert.ok(error, "Hapus nasabah bers transaksi harus ditolak");
    assert.match(error.message, /transaksi/i);
  });

  test("41. Hapus nasabah berhasil jika belum punya transaksi", async () => {
    const { data: nasabah } = await supabase
      .from("nasabah")
      .select("id")
      .eq("nama", "Nasabah Nonaktif Tes")
      .single();

    const { error } = await supabase
      .from("nasabah")
      .delete()
      .eq("id", nasabah.id);
    assert.equal(error, null, error?.message);

    const { data: masihAda } = await supabase
      .from("nasabah")
      .select("id")
      .eq("id", nasabah.id);
    assert.equal(masihAda?.length ?? 0, 0);
  });

  test("42. Setoran pinjaman dari tabungan — hutang & tabungan turun, saku tidak berubah", async () => {
    const { data: kas } = await supabase
      .from("saku")
      .select("id")
      .eq("nama", "Kas Loket")
      .single();

    const { data: nasabahBaru, error: nasabahErr } = await supabase
      .from("nasabah")
      .insert({
        nama: "Nasabah Bayar Tabungan",
        telepon: "08199999003",
      })
      .select("id")
      .single();
    assert.equal(nasabahErr, null);

    const setoran = 200000;
    const pinjam = 80000;
    const bayar = 30000;

    assert.equal(
      (
        await supabase.from("transaksi").insert({
          tanggal: "2025-06-07",
          jenis: "setoran",
          jumlah: setoran,
          nasabah_id: nasabahBaru.id,
          saku_id: kas.id,
          keterangan: "Setoran awal tes bayar tabungan",
        })
      ).error,
      null
    );
    assert.equal(
      (
        await supabase.from("transaksi").insert({
          tanggal: "2025-06-07",
          jenis: "pinjaman_keluar",
          jumlah: pinjam,
          nasabah_id: nasabahBaru.id,
          saku_id: kas.id,
          keterangan: "Pinjam untuk tes bayar tabungan",
        })
      ).error,
      null
    );

    const { data: saldoSakuSebelum } = await supabase
      .from("v_saldo_saku")
      .select("saldo")
      .eq("id", kas.id)
      .single();

    const { error: bayarErr } = await supabase.from("transaksi").insert({
      tanggal: "2025-06-08",
      jenis: "pinjaman_kembali",
      jumlah: bayar,
      nasabah_id: nasabahBaru.id,
      bayar_dari_tabungan: true,
      keterangan: "Angsuran dari tabungan",
    });
    assert.equal(bayarErr, null, bayarErr?.message);

    const { data: saldoNasabah } = await supabase
      .from("v_saldo_nasabah")
      .select("tabungan, hutang, saldo")
      .eq("id", nasabahBaru.id)
      .single();
    assert.equal(Number(saldoNasabah.tabungan), setoran - bayar);
    assert.equal(Number(saldoNasabah.hutang), pinjam - bayar);
    assert.equal(Number(saldoNasabah.saldo), setoran - pinjam);

    const { data: saldoSakuSesudah } = await supabase
      .from("v_saldo_saku")
      .select("saldo")
      .eq("id", kas.id)
      .single();
    assert.equal(
      Number(saldoSakuSesudah.saldo),
      Number(saldoSakuSebelum.saldo)
    );
  });

  test("43. Setoran pinjaman dari tabungan ditolak jika tabungan tidak cukup", async () => {
    const { data: nasabah } = await supabase
      .from("nasabah")
      .select("id")
      .eq("nama", "Nasabah Bayar Tabungan")
      .single();

    const { data: saldo } = await supabase
      .from("v_saldo_nasabah")
      .select("tabungan, hutang")
      .eq("id", nasabah.id)
      .single();

    const { error } = await supabase.from("transaksi").insert({
      tanggal: "2025-06-09",
      jenis: "pinjaman_kembali",
      jumlah: Number(saldo.tabungan) + 1000,
      nasabah_id: nasabah.id,
      bayar_dari_tabungan: true,
      keterangan: "Harus ditolak tabungan kurang",
    });
    assert.ok(error, "Bayar dari tabungan melebihi saldo harus ditolak");
    assert.match(error.message, /tabungan/i);
  });

  test("46. Setoran ke Deposito ditolak", async () => {
    const { data: nasabah } = await supabase
      .from("nasabah")
      .select("id")
      .eq("nama", "Budi Santoso")
      .single();
    const { data: deposito } = await supabase
      .from("saku")
      .select("id")
      .eq("nama", "Deposito")
      .single();

    const { error } = await supabase.from("transaksi").insert({
      tanggal: "2025-06-10",
      jenis: "setoran",
      jumlah: 100_000,
      nasabah_id: nasabah.id,
      saku_id: deposito.id,
      keterangan: "Harus ditolak — deposito bukan saku tunai",
    });
    assert.ok(error, "Setoran ke deposito harus ditolak");
    assert.match(error.message, /instrumen|deposito/i);
  });

  test("47. Setoran pinjaman tunai ke Deposito ditolak", async () => {
    const nasabahId = await nasabahBaru(supabase, "Tes Pinjam Kembali Deposito");
    const kasId = await idSaku(supabase, "Kas Loket");
    const depositoId = await idSaku(supabase, "Deposito");

    assert.equal(
      (
        await supabase.from("transaksi").insert({
          tanggal: "2025-06-10",
          jenis: "pinjaman_keluar",
          jumlah: 100_000,
          nasabah_id: nasabahId,
          saku_id: kasId,
          keterangan: "Pinjam dulu agar ada hutang",
        })
      ).error,
      null
    );

    const { error } = await supabase.from("transaksi").insert({
      tanggal: "2025-06-10",
      jenis: "pinjaman_kembali",
      jumlah: 50_000,
      nasabah_id: nasabahId,
      saku_id: depositoId,
      bayar_dari_tabungan: false,
      keterangan: "Harus ditolak — deposito bukan saku tunai",
    });
    assert.ok(error, "Setoran pinjaman tunai ke deposito harus ditolak");
    assert.match(error.message, /instrumen|deposito/i);
  });

  test("48. Transfer BCA ke Deposito lulus", async () => {
    const { data: sakuList } = await supabase
      .from("saku")
      .select("id, nama")
      .in("nama", ["Rekening BCA", "Deposito"]);
    const bca = sakuList.find((s) => s.nama === "Rekening BCA");
    const deposito = sakuList.find((s) => s.nama === "Deposito");

    const { data: saldoBca } = await supabase
      .from("v_saldo_saku")
      .select("saldo")
      .eq("id", bca.id)
      .single();

    const jumlah = Math.min(10_000, Number(saldoBca.saldo));
    assert.ok(jumlah > 0, "BCA harus punya saldo untuk transfer");

    const { error } = await supabase.from("transaksi").insert({
      tanggal: "2025-06-10",
      jenis: "transfer_saku",
      jumlah,
      saku_id: bca.id,
      saku_tujuan_id: deposito.id,
      keterangan: "Transfer ke deposito — harus lulus",
    });
    assert.equal(error, null, error?.message ?? "Transfer BCA→Deposito harus lulus");
  });

  test("49. Saku tersembunyi ditolak untuk transaksi baru", async () => {
    const { data: nasabah } = await supabase
      .from("nasabah")
      .select("id")
      .eq("nama", "Budi Santoso")
      .single();

    const { data: sakuBaru, error: errSaku } = await supabase
      .from("saku")
      .insert({
        nama: "Saku Tersembunyi Tes",
        jenis: "kas",
        pilih_di_transaksi: false,
        keterangan: "Tes flag tersembunyi",
      })
      .select("id")
      .single();
    assert.equal(errSaku, null, errSaku?.message);

    const { error } = await supabase.from("transaksi").insert({
      tanggal: "2025-06-10",
      jenis: "setoran",
      jumlah: 1000,
      nasabah_id: nasabah.id,
      saku_id: sakuBaru.id,
      keterangan: "Harus ditolak — saku tersembunyi",
    });
    assert.ok(error, "Transaksi ke saku tersembunyi harus ditolak");
    assert.match(error.message, /tidak tersedia/i);

    const { data: sakuView } = await supabase
      .from("v_saldo_saku")
      .select("id, pilih_di_transaksi")
      .eq("id", sakuBaru.id)
      .maybeSingle();
    assert.ok(sakuView, "Saku tersembunyi tetap tampil di view saldo");
    assert.equal(sakuView.pilih_di_transaksi, false);

    await supabase.from("saku").update({ aktif: false }).eq("id", sakuBaru.id);
  });

  test("50. Penarikan ditolak jika tabungan tidak cukup (bukan saldo neto)", async () => {
    const { data: nasabahBaru, error: nErr } = await supabase
      .from("nasabah")
      .insert({ nama: "Tes Penarikan Tabungan", telepon: "08111111003" })
      .select("id")
      .single();
    assert.equal(nErr, null);

    const { data: kas } = await supabase
      .from("saku")
      .select("id")
      .eq("nama", "Kas Loket")
      .single();

    assert.equal(
      (
        await supabase.from("transaksi").insert({
          tanggal: "2025-06-10",
          jenis: "setoran",
          jumlah: 500_000,
          nasabah_id: nasabahBaru.id,
          saku_id: kas.id,
          keterangan: "Setoran awal",
        })
      ).error,
      null
    );

    assert.equal(
      (
        await supabase.from("transaksi").insert({
          tanggal: "2025-06-10",
          jenis: "pinjaman_keluar",
          jumlah: 400_000,
          nasabah_id: nasabahBaru.id,
          saku_id: kas.id,
          keterangan: "Pinjaman — saldo neto jadi 100rb",
        })
      ).error,
      null
    );

    const { data: saldo } = await supabase
      .from("v_saldo_nasabah")
      .select("tabungan, saldo")
      .eq("id", nasabahBaru.id)
      .single();
    assert.equal(Number(saldo.tabungan), 500_000);
    assert.equal(Number(saldo.saldo), 100_000);

    const { error: errLulus } = await supabase.from("transaksi").insert({
      tanggal: "2025-06-10",
      jenis: "penarikan",
      jumlah: 200_000,
      nasabah_id: nasabahBaru.id,
      saku_id: kas.id,
      keterangan: "Masih dalam tabungan 500rb",
    });
    assert.equal(errLulus, null, errLulus?.message);

    const { error: errTolak } = await supabase.from("transaksi").insert({
      tanggal: "2025-06-10",
      jenis: "penarikan",
      jumlah: 400_000,
      nasabah_id: nasabahBaru.id,
      saku_id: kas.id,
      keterangan: "Melebihi sisa tabungan 300rb",
    });
    assert.ok(errTolak, "Penarikan melebihi tabungan harus ditolak");
    assert.match(errTolak.message, /tabungan/i);
  });
});
