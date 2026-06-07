"use client";

/**
 * Kartu statistik KPI di dashboard admin.
 * Menerima data dari parent yang fetch Supabase.
 */
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatRupiah } from "@/lib/format";
import { getPeriodeRange } from "@/lib/periode";
import { buildTransaksiHref } from "@/lib/transaksi-filter";
import type { PengaturanPeriode, PeriodeFilter } from "@/types/database";
import { Landmark, Users, HandCoins, CircleDollarSign } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export interface DashboardStats {
  totalSaldoSaku: number;
  pinjamanDibayarPeriode: number;
  pinjamanKeluarPeriode: number;
  persenPinjamanDibayar: number;
  jumlahNasabahAktif: number;
  sisaPinjaman: number;
}

interface StatCardsProps {
  stats: DashboardStats | null;
  loading: boolean;
  periode: PeriodeFilter;
  pengaturan: PengaturanPeriode;
}

type StatCard = {
  title: string;
  desc: string;
  value: string;
  icon: LucideIcon;
  href?: string;
};

export function StatCards({
  stats,
  loading,
  periode,
  pengaturan,
}: StatCardsProps) {
  const { dari, sampai } = getPeriodeRange(pengaturan, periode);

  const cards: StatCard[] = [
    {
      title: "Total saldo saku",
      desc: "Uang di semua instrumen",
      value: stats ? formatRupiah(stats.totalSaldoSaku) : "-",
      icon: Landmark,
      href: "/saku",
    },
    {
      title: "Nasabah aktif",
      desc: "Pedagang terdaftar",
      value: stats ? String(stats.jumlahNasabahAktif) : "-",
      icon: Users,
      href: "/nasabah",
    },
    {
      title: "Bayar pinjaman",
      desc: stats
        ? stats.pinjamanKeluarPeriode > 0
          ? `${Math.round(stats.persenPinjamanDibayar)}% dari ${formatRupiah(stats.pinjamanKeluarPeriode)} pinjaman`
          : "Belum ada pinjaman periode ini"
        : "Belum ada data",
      value: stats ? formatRupiah(stats.pinjamanDibayarPeriode) : "-",
      icon: CircleDollarSign,
      href: buildTransaksiHref({ filter: "bayar_pinjaman", dari, sampai }),
    },
    {
      title: "Sisa pinjaman",
      desc: "Pinjaman − bayar pinjaman periode",
      value: stats ? formatRupiah(stats.sisaPinjaman) : "-",
      icon: HandCoins,
      href: buildTransaksiHref({ filter: "hutang_nasabah", dari, sampai }),
    },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl sm:h-28" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {cards.map((card) => {
        const inner = (
          <>
            <CardHeader className="flex flex-row items-start justify-between space-y-0 p-3 pb-1 sm:p-6 sm:pb-2">
              <CardDescription className="line-clamp-2 text-xs leading-snug sm:text-sm">
                {card.title}
              </CardDescription>
              <card.icon className="size-4 shrink-0 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <CardTitle className="text-base tabular-nums sm:text-xl">
                {card.value}
              </CardTitle>
              <p className="text-muted-foreground mt-1 line-clamp-2 text-[10px] leading-tight sm:line-clamp-none sm:text-xs">
                {card.desc}
              </p>
            </CardContent>
          </>
        );

        if (card.href) {
          return (
            <Link
              key={card.title}
              href={card.href}
              className="min-w-0 touch-manipulation"
            >
              <Card
                className={cn(
                  "h-full transition-colors hover:bg-muted/40",
                  "ring-foreground/10 hover:ring-foreground/20"
                )}
              >
                {inner}
              </Card>
            </Link>
          );
        }

        return (
          <Card key={card.title} className="min-w-0">
            {inner}
          </Card>
        );
      })}
    </div>
  );
}
