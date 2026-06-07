import { cn } from "@/lib/utils";
import { formatRupiah } from "@/lib/format";
import { arahMutasiSaku } from "@/lib/mutasi-saku";
import type { Transaksi } from "@/types/database";

export function MutasiSakuJumlah({
  sakuId,
  transaksi,
  className,
}: {
  sakuId: string;
  transaksi: Transaksi;
  className?: string;
}) {
  const arah = arahMutasiSaku(sakuId, transaksi);
  const jumlah = Number(transaksi.jumlah);
  const formatted = formatRupiah(jumlah);
  const dibatalkan = !!transaksi.dibatalkan_pada;

  if (!arah || dibatalkan) {
    return (
      <span
        className={cn(
          "tabular-nums",
          dibatalkan && "text-muted-foreground line-through",
          className
        )}
      >
        {formatted}
      </span>
    );
  }

  const prefix = arah === "masuk" ? "+" : "−";
  return (
    <span
      className={cn(
        "font-semibold tabular-nums",
        arah === "masuk"
          ? "text-green-600 dark:text-green-500"
          : "text-red-600 dark:text-red-500",
        className
      )}
    >
      {prefix} {formatted}
    </span>
  );
}
