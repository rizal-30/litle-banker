import type { SupabaseClient } from "@supabase/supabase-js";

type RowWithCreator = { created_by: string | null };

export async function attachPembuatToTransaksi<T extends RowWithCreator>(
  supabase: SupabaseClient,
  rows: T[]
): Promise<(T & { pembuat: { nama_lengkap: string } | null })[]> {
  const creatorIds = [
    ...new Set(
      rows.map((r) => r.created_by).filter((id): id is string => Boolean(id))
    ),
  ];

  if (creatorIds.length === 0) {
    return rows.map((r) => ({ ...r, pembuat: null }));
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, nama_lengkap")
    .in("id", creatorIds);

  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

  return rows.map((r) => ({
    ...r,
    pembuat: r.created_by ? (byId.get(r.created_by) ?? null) : null,
  }));
}
