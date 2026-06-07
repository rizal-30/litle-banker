/**
 * Wrapper Supabase CLI untuk npm scripts di Windows.
 * Scoop memasang CLI di ~/scoop/shims — sering tidak ada di PATH saat npm run.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

function findSupabaseExecutable() {
  const candidates = [];

  if (process.platform === "win32") {
    const home = homedir();
    candidates.push(
      join(home, "scoop", "shims", "supabase.exe"),
      join(home, "scoop", "apps", "supabase", "current", "supabase.exe")
    );
  }

  candidates.push("supabase");

  for (const cmd of candidates) {
    if (cmd === "supabase") return cmd;
    if (existsSync(cmd)) return cmd;
  }

  return "supabase";
}

const executable = findSupabaseExecutable();
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error("Usage: node scripts/supabase.mjs <command> [args...]");
  console.error("Example: node scripts/supabase.mjs start");
  process.exit(1);
}

const result = spawnSync(executable, args, {
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.error) {
  console.error("\nSupabase CLI tidak ditemukan.");
  console.error("Pasang: scoop install supabase");
  console.error("Atau pastikan 'supabase' ada di PATH sistem.\n");
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
