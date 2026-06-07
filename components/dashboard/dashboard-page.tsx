"use client";

/**
 * Halaman dashboard admin — Client Component karena:
 * - Tabs periode (state)
 * - Fetch data Supabase di browser setelah mount
 * - Chart Recharts hanya jalan di client
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCards, type DashboardStats } from "@/components/dashboard/stat-cards";
import { CashflowChart } from "@/components/dashboard/cashflow-chart";
import { JenisPieChart } from "@/components/dashboard/jenis-pie-chart";
import { SakuBarChart } from "@/components/dashboard/saku-bar-chart";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { createClient } from "@/lib/supabase/client";
import {
  buildRingkasanChart,
  getDaftarPeriode,
  getPeriodeRange,
  getPeriodeSekarang,
  labelPeriode,
  labelPeriodeSingkat,
} from "@/lib/periode";
import { normalizePengaturanPeriode } from "@/lib/pengaturan-periode";
import type {
  PengaturanPeriode,
  PeriodeFilter,
  RingkasanHarian,
  RingkasanJenis,
  SaldoSaku,
  Transaksi,
} from "@/types/database";

export function DashboardPage() {
  const [pengaturan, setPengaturan] = useState<PengaturanPeriode | null>(null);
  const [periode, setPeriode] = useState<PeriodeFilter | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [harian, setHarian] = useState<RingkasanHarian[]>([]);
  const [jenis, setJenis] = useState<RingkasanJenis[]>([]);
  const [saku, setSaku] = useState<SaldoSaku[]>([]);
  const [recent, setRecent] = useState<Transaksi[]>([]);

  const periodeTabs = useMemo(
    () => (pengaturan ? getDaftarPeriode(pengaturan, 3) : []),
    [pengaturan]
  );

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("pengaturan_periode")
      .select("jenis, bulan_awal, kalender")
      .eq("id", true)
      .single()
      .then(({ data }) => {
        const settings = normalizePengaturanPeriode(data ?? undefined);
        setPengaturan(settings);
        setPeriode(getPeriodeSekarang(settings));
      });
  }, []);

  const loadData = useCallback(async () => {
    if (!pengaturan || !periode) return;

    setLoading(true);
    const supabase = createClient();
    const { dari, sampai } = getPeriodeRange(pengaturan, periode);

    const [saldoSakuRes, saldoNasabahRes, transaksiRes, recentRes] =
      await Promise.all([
        supabase.from("v_saldo_saku").select("*"),
        supabase.from("v_saldo_nasabah").select("id"),
        supabase
          .from("transaksi")
          .select("jenis, jumlah, tanggal, dibatalkan_pada, bayar_dari_tabungan")
          .gte("tanggal", dari)
          .lte("tanggal", sampai)
          .is("dibatalkan_pada", null)
          .neq("jenis", "pembatalan"),
        supabase
          .from("transaksi")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

    const saldoSakuList = (saldoSakuRes.data ?? []) as SaldoSaku[];
    const totalSaldoSaku = saldoSakuList.reduce(
      (s, r) => s + Number(r.saldo),
      0
    );
    const jumlahNasabahAktif = (saldoNasabahRes.data ?? []).length;

    const trx = transaksiRes.data ?? [];

    let pinjamanKeluar = 0;
    let pinjamanKembali = 0;

    trx.forEach((t) => {
      const j = t.jenis as string;
      const jml = Number(t.jumlah);
      if (j === "pinjaman_keluar") pinjamanKeluar += jml;
      if (j === "pinjaman_kembali") pinjamanKembali += jml;
    });

    setStats({
      totalSaldoSaku,
      pinjamanDibayarPeriode: pinjamanKembali,
      pinjamanKeluarPeriode: pinjamanKeluar,
      persenPinjamanDibayar:
        pinjamanKeluar > 0 ? (pinjamanKembali / pinjamanKeluar) * 100 : 0,
      jumlahNasabahAktif,
      sisaPinjaman: pinjamanKeluar - pinjamanKembali,
    });

    setHarian(buildRingkasanChart(pengaturan, trx, dari, sampai));
    setSaku(saldoSakuList);

    const jenisMap = new Map<string, { count: number; total: number }>();
    trx.forEach((t) => {
      const j = t.jenis as string;
      if (j === "transfer_saku") return;
      const cur = jenisMap.get(j) ?? { count: 0, total: 0 };
      jenisMap.set(j, {
        count: cur.count + 1,
        total: cur.total + Number(t.jumlah),
      });
    });
    setJenis(
      Array.from(jenisMap.entries()).map(([jenis, v]) => ({
        jenis: jenis as RingkasanJenis["jenis"],
        jumlah_count: v.count,
        total_jumlah: v.total,
      }))
    );

    setRecent((recentRes.data ?? []) as Transaksi[]);
    setLoading(false);
  }, [pengaturan, periode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!pengaturan || !periode) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            Dashboard
          </h1>
          <p className="text-muted-foreground text-sm">Memuat pengaturan...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            Dashboard
          </h1>
          <p className="text-muted-foreground text-sm">
            Ringkasan keuangan Bank Hemat
          </p>
        </div>
        <Tabs
          value={periode}
          onValueChange={(v) => setPeriode(v as PeriodeFilter)}
          className="w-full sm:w-auto"
        >
          <TabsList className="grid w-full grid-cols-3 sm:inline-flex sm:w-auto">
            {periodeTabs.map((t) => (
              <TabsTrigger key={t} value={t}>
                {labelPeriodeSingkat(pengaturan, t)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <StatCards
        stats={stats}
        loading={loading}
        periode={periode}
        pengaturan={pengaturan}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <CashflowChart
          data={harian}
          loading={loading}
          periodeLabel={labelPeriode(pengaturan, periode)}
        />
        <JenisPieChart
          data={jenis}
          loading={loading}
          periodeLabel={labelPeriode(pengaturan, periode)}
        />
      </div>

      <SakuBarChart data={saku} loading={loading} />

      <RecentTransactions rows={recent} loading={loading} />
    </div>
  );
}
