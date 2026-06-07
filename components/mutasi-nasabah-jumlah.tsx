import { cn } from "@/lib/utils";
import { formatRupiah } from "@/lib/format";
import { arahMutasiNasabah } from "@/lib/mutasi-nasabah";
import { jenisTransaksiJumlahClassName } from "@/lib/jenis-transaksi-style";
import type { JenisTransaksi } from "@/types/database";

export function MutasiNasabahJumlah({
  jenis,
  jumlah,
  bayarDariTabungan,
  dibatalkan,
  className,
}: {
  jenis: JenisTransaksi;
  jumlah: number;
  bayarDariTabungan?: boolean;
  dibatalkan?: boolean;
  className?: string;
}) {
  const arah = arahMutasiNasabah(jenis, bayarDariTabungan);
  const formatted = formatRupiah(jumlah);

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
        jenisTransaksiJumlahClassName(jenis, arah),
        className
      )}
    >
      {prefix} {formatted}
    </span>
  );
}
