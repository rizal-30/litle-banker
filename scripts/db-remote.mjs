/**
 * Push migration ke Supabase cloud (.env) lalu seed admin jika service key ada.
 *
 * Prasyarat:
 *   1. node scripts/supabase.mjs login
 *   2. .env berisi NEXT_PUBLIC_SUPABASE_URL + publishable/anon key
 *   3. (opsional) SUPABASE_SECRET_KEY di .env untuk npm run seed setelah push
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ROOT,
  loadRemoteEnv,
  projectRefFromUrl,
  supabaseServiceKey,
  isRemoteSupabase,
} from "./load-env.mjs";

function runSupabase(args, extraEnv = {}) {
  const result = spawnSync("node", ["scripts/supabase.mjs", ...args], {
    cwd: ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, ...extraEnv },
  });
  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}

function linkedProjectRef() {
  const refPath = resolve(ROOT, "supabase", ".temp", "project-ref");
  if (!existsSync(refPath)) return null;
  return readFileSync(refPath, "utf8").trim() || null;
}

const env = loadRemoteEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;

if (!url) {
  console.error("NEXT_PUBLIC_SUPABASE_URL tidak ada di .env");
  process.exit(1);
}

if (!isRemoteSupabase(url)) {
  console.error(
    "URL bukan Supabase cloud. Untuk lokal pakai: npm run db:reset"
  );
  process.exit(1);
}

const projectRef = projectRefFromUrl(url);
const linked = linkedProjectRef();

console.log(`Proyek cloud: ${projectRef}`);

if (linked !== projectRef) {
  console.log(`Menghubungkan CLI ke ${projectRef}...`);
  runSupabase(["link", "--project-ref", projectRef]);
} else {
  console.log(`CLI sudah terhubung ke ${projectRef}`);
}

console.log("\nPush migration ke remote...\n");
runSupabase(["db", "push"]);

const serviceKey = supabaseServiceKey(env);
if (serviceKey) {
  console.log("\nSeed admin...\n");
  const seed = spawnSync("node", ["scripts/seed-admin.mjs"], {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  if ((seed.status ?? 1) !== 0) process.exit(seed.status ?? 1);
} else {
  console.log(`
Migration selesai.

Langkah berikutnya:
  1. Dashboard → Project Settings → API → salin Secret key
  2. Tambah ke .env: SUPABASE_SECRET_KEY=sb_secret_...
  3. npm run seed
  4. Authentication → matikan public signup (sudah di migration/config cloud)
  5. Deploy: set env NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
`);
}
