import type { ChartConfig } from "@/components/ui/chart";
import { formatRupiah } from "@/lib/format";

type TooltipItem = {
  dataKey?: string | number | ((obj: unknown) => unknown);
  name?: string | number;
  color?: string;
  payload?: { fill?: string; name?: string };
};

/** Baris tooltip: dot warna + label + nominal Rupiah */
export function chartTooltipRupiahRow(
  value: unknown,
  _name: unknown,
  item: TooltipItem,
  config: ChartConfig
) {
  const rawKey = item.dataKey;
  const key = String(
    (typeof rawKey === "function" ? undefined : rawKey) ?? item.name ?? ""
  );
  const label =
    config[key]?.label ??
    (typeof item.payload?.name === "string" ? item.payload.name : key);
  const dotColor =
    item.color ?? item.payload?.fill ?? `var(--color-${key})`;

  return (
    <div className="flex w-full min-w-[10rem] items-center gap-2">
      <div
        className="size-2.5 shrink-0 rounded-[2px]"
        style={{ backgroundColor: dotColor }}
      />
      <div className="flex flex-1 items-center justify-between gap-3">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">
          {formatRupiah(Number(value))}
        </span>
      </div>
    </div>
  );
}
