"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { JenisTransaksiBadge } from "@/components/jenis-transaksi-badge";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";
import type { Transaksi } from "@/types/database";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeftRight } from "lucide-react";

interface RecentTransactionsProps {
  rows: Transaksi[];
  loading: boolean;
}

export function RecentTransactions({ rows, loading }: RecentTransactionsProps) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <CardTitle className="text-base sm:text-lg">Transaksi terbaru</CardTitle>
          <CardDescription>5 transaksi terakhir</CardDescription>
        </div>
        <Link
          href="/transaksi"
          className={buttonVariants({
            variant: "outline",
            size: "sm",
            className: "w-full shrink-0 sm:w-auto",
          })}
        >
          Lihat semua
        </Link>
      </CardHeader>
      <CardContent className="px-0 sm:px-6">
        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : rows.length === 0 ? (
          <EmptyState
            variant="inset"
            icon={ArrowLeftRight}
            title="Belum ada transaksi"
            description="Transaksi terbaru akan muncul di sini."
            className="py-8"
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead className="text-right">Jumlah</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-xs sm:text-sm">
                      {formatTanggal(t.tanggal)}
                    </TableCell>
                    <TableCell>
                      <JenisTransaksiBadge
                        jenis={t.jenis}
                        className="max-w-[7rem] truncate text-xs sm:max-w-none"
                      />
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums sm:text-sm">
                      {formatRupiah(Number(t.jumlah))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
