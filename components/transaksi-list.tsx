"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTableCard } from "@/components/data-table-card";
import { JenisTransaksiBadge } from "@/components/jenis-transaksi-badge";
import { SakuTransferLabel } from "@/components/saku-link";
import type { Transaksi } from "@/types/database";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MoreHorizontal } from "lucide-react";

function NasabahLink({
  id,
  nama,
  className,
}: {
  id: string | null;
  nama?: string | null;
  className?: string;
}) {
  if (!id || !nama) {
    return <span className={className}>—</span>;
  }

  return (
    <Link
      href={`/nasabah/${id}`}
      className={cn(
        "text-primary hover:underline touch-manipulation truncate",
        className
      )}
      title={nama}
    >
      {nama}
    </Link>
  );
}

function canBatalkan(t: Transaksi) {
  return t.jenis !== "pembatalan" && t.dibatalkan_pada == null;
}

function BatalkanMenu({
  t,
  onBatalkan,
  triggerClassName,
}: {
  t: Transaksi;
  onBatalkan: (t: Transaksi) => void;
  triggerClassName?: string;
}) {
  if (!canBatalkan(t)) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn("size-8 shrink-0", triggerClassName)}
          />
        }
      >
        <MoreHorizontal className="size-4" />
        <span className="sr-only">Aksi transaksi</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          variant="destructive"
          onClick={() => onBatalkan(t)}
        >
          Batalkan
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TransaksiStatusBadges({ t }: { t: Transaksi }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <JenisTransaksiBadge jenis={t.jenis} className="text-[11px]" />
      {t.dibatalkan_pada && (
        <Badge variant="outline" className="text-[10px] font-normal">
          Dibatalkan
        </Badge>
      )}
    </div>
  );
}

function TransaksiSubline({ t }: { t: Transaksi }) {
  const hasNasabah = Boolean(t.nasabah_id && t.nasabah?.nama);
  const hasSaku = Boolean(t.saku?.nama || t.saku_tujuan?.nama);

  if (!hasNasabah && !hasSaku) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <span className="inline min-w-0 truncate">
      {hasNasabah && (
        <NasabahLink
          id={t.nasabah_id}
          nama={t.nasabah?.nama}
          className="inline font-medium"
        />
      )}
      {hasNasabah && hasSaku && (
        <span className="text-muted-foreground"> · </span>
      )}
      {hasSaku && <SakuTransferLabel t={t} className="inline" />}
    </span>
  );
}

function TransaksiMobileCard({
  t,
  onBatalkan,
}: {
  t: Transaksi;
  onBatalkan: (t: Transaksi) => void;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-2.5 py-2",
        t.dibatalkan_pada && "opacity-60"
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <TransaksiStatusBadges t={t} />
            <span className="text-muted-foreground text-[11px]">
              {formatTanggal(t.tanggal)}
            </span>
          </div>
          <p className="mt-1 min-w-0 truncate text-xs leading-snug">
            <TransaksiSubline t={t} />
          </p>
          {t.keterangan && (
            <p className="text-muted-foreground mt-0.5 truncate text-[11px] leading-snug">
              {t.keterangan}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <p
            className={cn(
              "text-sm leading-tight font-semibold tabular-nums",
              t.dibatalkan_pada && "text-muted-foreground line-through"
            )}
          >
            {formatRupiah(Number(t.jumlah))}
          </p>
          <BatalkanMenu
            t={t}
            onBatalkan={onBatalkan}
            triggerClassName="size-7"
          />
        </div>
      </div>
    </div>
  );
}

interface TransaksiListProps {
  rows: Transaksi[];
  onBatalkan: (t: Transaksi) => void;
}

export function TransaksiList({ rows, onBatalkan }: TransaksiListProps) {
  return (
    <>
      <div className="space-y-1.5 sm:hidden">
        {rows.map((t) => (
          <TransaksiMobileCard
            key={t.id}
            t={t}
            onBatalkan={onBatalkan}
          />
        ))}
      </div>

      <DataTableCard className="hidden sm:block">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-28 pl-4">Tanggal</TableHead>
              <TableHead className="w-36">Jenis</TableHead>
              <TableHead className="hidden w-32 md:table-cell">Nasabah</TableHead>
              <TableHead className="hidden w-36 sm:table-cell">Saku</TableHead>
              <TableHead className="w-32 text-right">Jumlah</TableHead>
              <TableHead className="hidden w-24 lg:table-cell">Admin</TableHead>
              <TableHead className="w-12 pr-4">
                <span className="sr-only">Aksi</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((t) => (
              <TableRow
                key={t.id}
                className={cn(t.dibatalkan_pada && "opacity-60")}
              >
                <TableCell className="text-muted-foreground pl-4 text-xs whitespace-normal">
                  {formatTanggal(t.tanggal)}
                </TableCell>
                <TableCell className="whitespace-normal">
                  <div className="flex flex-col gap-1">
                    <NasabahLink
                      id={t.nasabah_id}
                      nama={t.nasabah?.nama}
                      className="truncate text-xs font-medium md:hidden"
                    />
                    <TransaksiStatusBadges t={t} />
                  </div>
                </TableCell>
                <TableCell className="hidden max-w-0 truncate md:table-cell">
                  <NasabahLink
                    id={t.nasabah_id}
                    nama={t.nasabah?.nama}
                    className="block font-medium"
                  />
                </TableCell>
                <TableCell className="hidden max-w-0 truncate sm:table-cell">
                  <SakuTransferLabel t={t} className="block" />
                </TableCell>
                <TableCell className="text-right tabular-nums text-xs sm:text-sm">
                  {formatRupiah(Number(t.jumlah))}
                </TableCell>
                <TableCell className="text-muted-foreground hidden max-w-0 truncate text-xs lg:table-cell">
                  {t.pembuat?.nama_lengkap ?? "—"}
                </TableCell>
                <TableCell className="w-12 p-1 pr-4">
                  <BatalkanMenu t={t} onBatalkan={onBatalkan} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataTableCard>
    </>
  );
}
