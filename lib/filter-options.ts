import type { ReactNode } from "react";

export type ComboboxOption = {
  value: string;
  label: string;
  /** Teks pencarian (default: label). Berguna jika label menampilkan info tambahan seperti saldo. */
  searchText?: string;
  /** Info tambahan di kanan opsi dropdown (mis. saldo) */
  detail?: ReactNode;
};

function normalizeText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Semua karakter query muncul berurutan di label (cocok mendekati / typo) */
function subsequenceMatch(label: string, query: string): boolean {
  let j = 0;
  for (let i = 0; i < label.length && j < query.length; i++) {
    if (label[i] === query[j]) j++;
  }
  return j === query.length;
}

function scoreMatch(label: string, query: string): number | null {
  if (label === query) return 100;
  if (label.startsWith(query)) return 80;
  if (label.includes(query)) return 60;
  if (subsequenceMatch(label, query)) return 40;
  return null;
}

/** Filter opsi berdasarkan label — cocok persis, awalan, mengandung, atau mendekati */
export function filterOptionsByLabel(
  options: ComboboxOption[],
  query: string
): ComboboxOption[] {
  const q = normalizeText(query);
  if (!q) return options;

  return options
    .map((opt) => {
      const label = normalizeText(opt.searchText ?? opt.label);
      const score = scoreMatch(label, q);
      if (score === null) return null;
      return { opt, score };
    })
    .filter((item): item is { opt: ComboboxOption; score: number } => item !== null)
    .sort(
      (a, b) =>
        b.score - a.score || a.opt.label.localeCompare(b.opt.label, "id")
    )
    .map(({ opt }) => opt);
}
