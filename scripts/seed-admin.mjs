/**
 * Buat akun admin uji via Auth Admin API (GoTrue lokal tidak mendukung insert SQL langsung).
 * Idempotent — aman dijalankan ulang.
 *
 * Prasyarat: Supabase jalan + service key di .env / .env.local, atau stack lokal (supabase start)
 * Dipanggil otomatis setelah db:reset.
 */
import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import { loadProjectEnv, supabaseServiceKey, ROOT } from "./load-env.mjs";

export const ADMIN_EMAIL = "admin@bank-hemat.test";
export const ADMIN_PASSWORD = "Admin123!";
export const ADMIN_NAMA = "Admin Bank Hemat";

function secretFromStatus() {
  try {
    const out = execSync("node scripts/supabase.mjs status", {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    const m = out.match(/Secret\s+\│\s+(sb_secret_[^\s│]+)/);
    return m?.[1]?.trim() ?? null;
  } catch {
    return null;
  }
}

function getConfig() {
  const env = loadProjectEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54421";
  const serviceKey = supabaseServiceKey(env) ?? secretFromStatus();
  if (!serviceKey) {
    throw new Error(
      "Service role key tidak ditemukan. Set SUPABASE_SECRET_KEY atau SUPABASE_SERVICE_ROLE_KEY di .env, atau jalankan supabase start."
    );
  }
  return { url, serviceKey };
}

/** @returns {Promise<string>} user id admin */
export async function ensureAdminUser() {
  const { url, serviceKey } = getConfig();
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: list, error: listErr } = await admin.auth.admin.listUsers();
  if (listErr) throw new Error(`Gagal cek user: ${listErr.message}`);

  let userId = list.users.find((u) => u.email === ADMIN_EMAIL)?.id;

  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { nama_lengkap: ADMIN_NAMA },
    });
    if (error) throw new Error(`Gagal buat admin: ${error.message}`);
    userId = data.user.id;
    console.log(`Admin dibuat: ${ADMIN_EMAIL}`);
  } else {
    console.log(`Admin sudah ada: ${ADMIN_EMAIL}`);
  }

  await admin
    .from("profiles")
    .update({ nama_lengkap: ADMIN_NAMA })
    .eq("id", userId);

  const { error: backfillErr } = await admin
    .from("transaksi")
    .update({ created_by: userId, updated_by: userId })
    .is("created_by", null);

  if (backfillErr) {
    console.warn(`Backfill created_by transaksi: ${backfillErr.message}`);
  }

  return userId;
}

if (process.argv[1]?.includes("seed-admin")) {
  ensureAdminUser()
    .then((id) => {
      console.log(`ID admin: ${id}`);
      console.log(`Login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
    })
    .catch((err) => {
      console.error(err.message ?? err);
      process.exit(1);
    });
}
