import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(__dirname, "..");

/** Muat satu file env */
export function loadEnvFile(name) {
  const env = {};
  const path = resolve(ROOT, name);
  if (!existsSync(path)) return env;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const m = trimmed.match(/^([^=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim();
  }
  return env;
}

/** Muat .env lalu .env.local (local menimpa) — untuk dev Next.js & seed lokal */
export function loadProjectEnv() {
  return { ...process.env, ...loadEnvFile(".env"), ...loadEnvFile(".env.local") };
}

/** Hanya .env — untuk Supabase cloud (db:remote) */
export function loadRemoteEnv() {
  return { ...process.env, ...loadEnvFile(".env") };
}

export function supabaseAnonKey(env) {
  return (
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    null
  );
}

export function supabaseServiceKey(env) {
  return env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SECRET_KEY ?? null;
}

/** lvlftomqujavrvqlzgce dari https://xxx.supabase.co */
export function projectRefFromUrl(url) {
  if (!url) return null;
  try {
    const host = new URL(url).hostname;
    const ref = host.split(".")[0];
    return ref && ref !== "127" && ref !== "localhost" ? ref : null;
  } catch {
    return null;
  }
}

export function isRemoteSupabase(url) {
  return Boolean(projectRefFromUrl(url));
}
