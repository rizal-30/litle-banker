"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTableCard } from "@/components/data-table-card";
import { JenisTransaksiBadge } from "@/components/jenis-transaksi-badge";
import { MutasiSakuJumlah } from "@/components/mutasi-saku-jumlah";
import { keteranganMutasiSaku } from "@/lib/mutasi-saku";
import type { Transaksi } from "@/types/database";
import { formatTanggal } from "@/lib/format";
import { cn } from "@/lib/utils";

function MutasiStatusBadges({ t }: { t: Transaksi }) {
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

function MutasiSakuMobileCard({
  sakuId,
  t,
}: {
  sakuId: string;
  t: Transaksi;
}) {
  const keterangan = keteranganMutasiSaku(sakuId, t);

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
            <MutasiStatusBadges t={t} />
            <span className="text-muted-foreground text-[11px]">
              {formatTanggal(t.tanggal)}
            </span>
          </div>
          {keterangan !== "—" && (
            <p className="text-muted-foreground mt-1 min-w-0 truncate text-xs leading-snug">
              {keterangan}
            </p>
          )}
        </div>
        <MutasiSakuJumlah
          sakuId={sakuId}
          transaksi={t}
          className="shrink-0 text-sm leading-tight"
        />
      </div>
    </div>
  );
}

interface MutasiSakuListProps {
  sakuId: string;
  rows: Transaksi[];
}

export function MutasiSakuList({ sakuId, rows }: MutasiSakuListProps) {
  return (
    <>
      <div className="space-y-1.5 sm:hidden">
        {rows.map((t) => (
          <MutasiSakuMobileCard key={t.id} sakuId={sakuId} t={t} />
        ))}
      </div>

      <DataTableCard className="hidden sm:block">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-28 pl-4">Tanggal</TableHead>
              <TableHead className="w-36">Jenis</TableHead>
              <TableHead className="w-36 text-right">Jumlah</TableHead>
              <TableHead>Keterangan</TableHead>
              <TableHead className="hidden w-24 pr-4 lg:table-cell">
                Admin
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((t) => (
              <TableRow
                key={t.id}
                className={cn(t.dibatalkan_pada && "opacity-60")}
              >
                <TableCell className="text-muted-foreground pl-4 text-sm">
                  {formatTanggal(t.tanggal)}
                </TableCell>
                <TableCell>
                  <MutasiStatusBadges t={t} />
                </TableCell>
                <TableCell className="text-right">
                  <MutasiSakuJumlah sakuId={sakuId} transaksi={t} />
                </TableCell>
                <TableCell className="text-muted-foreground max-w-0 truncate">
                  {keteranganMutasiSaku(sakuId, t)}
                </TableCell>
                <TableCell className="text-muted-foreground hidden max-w-0 truncate pr-4 text-xs lg:table-cell">
                  {t.pembuat?.nama_lengkap ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataTableCard>
    </>
  );
}
