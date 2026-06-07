/**
 * Tes logika periode dashboard + tabel pengaturan_periode.
 * Jalankan: node scripts/test-periode.mjs
 */
import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { loadProjectEnv, supabaseAnonKey } from "./load-env.mjs";
import { ADMIN_EMAIL, ADMIN_PASSWORD } from "./seed-admin.mjs";

const env = loadProjectEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54421";
const ANON_KEY = supabaseAnonKey(env);

let supabase;

before(async () => {
  supabase = createClient(SUPABASE_URL, ANON_KEY);
  const { error } = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  if (error) throw new Error(`Login gagal: ${error.message}`);
});

describe("Pengaturan periode", () => {
  test("baca default dari database", async () => {
    const { data, error } = await supabase
      .from("pengaturan_periode")
      .select("jenis, bulan_awal, kalender")
      .eq("id", true)
      .single();
    assert.equal(error, null);
    assert.ok(["minggu", "bulan", "kuartal", "tahun"].includes(data.jenis));
    assert.ok(data.bulan_awal >= 1 && data.bulan_awal <= 12);
    assert.ok(["masehi", "hijri"].includes(data.kalender));
  });

  test("update & restore pengaturan", async () => {
    const { data: awal } = await supabase
      .from("pengaturan_periode")
      .select("jenis, bulan_awal, kalender")
      .eq("id", true)
      .single();

    const { error: upErr } = await supabase
      .from("pengaturan_periode")
      .update({ jenis: "bulan", bulan_awal: 6, kalender: "masehi" })
      .eq("id", true);
    assert.equal(upErr, null);

    const { data: sesudah } = await supabase
      .from("pengaturan_periode")
      .select("jenis, bulan_awal, kalender")
      .eq("id", true)
      .single();
    assert.equal(sesudah.jenis, "bulan");
    assert.equal(sesudah.bulan_awal, 6);
    assert.equal(sesudah.kalender, "masehi");

    const { error: restoreErr } = await supabase
      .from("pengaturan_periode")
      .update(awal)
      .eq("id", true);
    assert.equal(restoreErr, null);
  });
});
