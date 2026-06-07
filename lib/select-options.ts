import type { ReactNode } from "react";

export type SelectOption = { value: string; label: ReactNode };

/** Buat prop `items` untuk Base UI Select dari map value → label */
export function selectOptionsFromRecord(
  record: Record<string, ReactNode>
): SelectOption[] {
  return Object.entries(record).map(([value, label]) => ({ value, label }));
}

/** Fallback label jika SelectValue perlu formatter eksplisit */
export function resolveSelectLabel(
  items: SelectOption[],
  value: string | null | undefined
): ReactNode | null {
  if (value == null || value === "") return null;
  return items.find((item) => item.value === value)?.label ?? null;
}
