"use client";

import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRupiah } from "@/lib/format";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  BAR_AKTIVITAS_LEBAR_PX,
  BAR_AKTIVITAS_MAX_PX,
  BAR_AKTIVITAS_MIN_PX,
  BAR_AKTIVITAS_TABLE_LEBAR_PX,
  tinggiBarAktivitas,
  type AktivitasNasabah,
} from "@/lib/nasabah-frekuensi";

type NasabahAktivitasIndikatorProps = {
  aktivitas: AktivitasNasabah;
  className?: string;
  /** Isi lebar tersedia (mis. kartu mobile) */
  stretch?: boolean;
  /** Kolom tabel desktop — bar sedikit lebih lebar */
  table?: boolean;
};

export function NasabahFrekuensiIndikator({
  aktivitas,
  className,
  stretch = false,
  table = false,
}: NasabahAktivitasIndikatorProps) {
  const {
    jumlahTransaksi,
    levelFrekuensi,
    nominalSetoran,
    nominalPenarikan,
    nominalPinjaman,
    pctSetoran,
    pctPenarikan,
    pctPinjaman,
  } = aktivitas;

  const tinggi = tinggiBarAktivitas(levelFrekuensi);
  const adaAktivitas = jumlahTransaksi > 0;

  return (
    <span
      className={cn(
        "inline-flex shrink-0",
        stretch && "min-w-0 flex-1",
        className
      )}
      style={{
        width: stretch
          ? undefined
          : table
            ? BAR_AKTIVITAS_TABLE_LEBAR_PX
            : BAR_AKTIVITAS_LEBAR_PX,
      }}
      aria-label={`Menabung ${formatRupiah(nominalSetoran)}, tarik ${formatRupiah(nominalPenarikan)}, hutang ${formatRupiah(nominalPinjaman)}`}
    >
      <span
        className={cn(
          "flex w-full overflow-hidden rounded-full transition-[height]",
          adaAktivitas
            ? "bg-muted"
            : "bg-muted-foreground/35 dark:bg-muted-foreground/30"
        )}
        style={{
          height: tinggi,
          minHeight: BAR_AKTIVITAS_MIN_PX,
          maxHeight: BAR_AKTIVITAS_MAX_PX,
        }}
        aria-hidden
      >
        {pctSetoran > 0 && (
          <span
            className="bg-green-500 dark:bg-green-400 block h-full shrink-0"
            style={{ width: `${pctSetoran}%` }}
          />
        )}
        {pctPenarikan > 0 && (
          <span
            className="bg-red-500 dark:bg-red-400 block h-full shrink-0"
            style={{ width: `${pctPenarikan}%` }}
          />
        )}
        {pctPinjaman > 0 && (
          <span
            className="bg-amber-500 dark:bg-amber-400 block h-full shrink-0"
            style={{ width: `${pctPinjaman}%` }}
          />
        )}
      </span>
    </span>
  );
}

export function AktivitasKolomLabel({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      Aktivitas
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground inline-flex shrink-0 rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              aria-label="Penjelasan kolom aktivitas"
            />
          }
        >
          <Info className="size-3.5" />
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="start"
          className="flex max-w-56 flex-col items-start gap-2 text-left font-normal"
        >
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="inline-flex items-center gap-1">
              <span className="bg-green-500 inline-block size-2 rounded-full" />
              Menabung
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="bg-red-500 inline-block size-2 rounded-full" />
              <span className="text-red-300">Tarik</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="bg-amber-500 inline-block size-2 rounded-full" />
              <span className="text-amber-300">Hutang</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="bg-muted-foreground/35 inline-block size-2 rounded-full" />
              Kosong
            </span>
          </span>
          <span className="text-background/80 leading-snug">
            Lebar = perbandingan nominal <br />
            tinggi = frekuensi transaksi
          </span>
        </TooltipContent>
      </Tooltip>
    </span>
  );
}
