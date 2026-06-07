"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TransaksiList } from "@/components/transaksi-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  TransaksiDialogContent,
  transaksiDialogHeaderClass,
  transaksiDialogTitleClass,
} from "@/components/transaksi-dialog-content";
import { TransaksiForm } from "@/components/transaksi-form";
import { BatalkanTransaksiDialog } from "@/components/batalkan-transaksi-dialog";
import { EmptyState } from "@/components/empty-state";
import { createClient } from "@/lib/supabase/client";
import { attachPembuatToTransaksi } from "@/lib/transaksi-pembuat";
import {
  parseTransaksiSearchParams,
  jenisForTransaksiFilter,
  labelTransaksiFilter,
  PINJAMAN_JENIS,
} from "@/lib/transaksi-filter";
import type { Transaksi } from "@/types/database";
import { formatRentangTanggal } from "@/lib/format";
import { X, ArrowLeftRight } from "lucide-react";

function TransaksiPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { filter, tanggal } = useMemo(
    () => parseTransaksiSearchParams(searchParams),
    [searchParams]
  );

  const [rows, setRows] = useState<Transaksi[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [batalTarget, setBatalTarget] = useState<Transaksi | null>(null);
  const [batalOpen, setBatalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    if (filter === "hutang_nasabah") {
      const { data: hutangRows } = await supabase
        .from("v_saldo_nasabah")
        .select("id")
        .gt("hutang", 0);

      const nasabahIds = (hutangRows ?? []).map((n) => n.id);

      if (nasabahIds.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      let q = supabase
        .from("transaksi")
        .select(
          `
          *,
          nasabah:nasabah_id(nama),
          saku:saku_id(nama),
          saku_tujuan:saku_tujuan_id(nama)
        `
        )
        .in("nasabah_id", nasabahIds)
        .in("jenis", PINJAMAN_JENIS)
        .order("tanggal", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100);

      if (tanggal) {
        q = q.gte("tanggal", tanggal.dari).lte("tanggal", tanggal.sampai);
      }

      const { data } = await q;
      setRows(
        await attachPembuatToTransaksi(supabase, (data ?? []) as Transaksi[])
      );
      setLoading(false);
      return;
    }

    let q = supabase
      .from("transaksi")
      .select(
        `
        *,
        nasabah:nasabah_id(nama),
        saku:saku_id(nama),
        saku_tujuan:saku_tujuan_id(nama)
      `
      )
      .order("tanggal", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100);

    if (tanggal) {
      q = q.gte("tanggal", tanggal.dari).lte("tanggal", tanggal.sampai);
    }

    if (filter !== "all") {
      const jenis = jenisForTransaksiFilter(filter);
      if (jenis) q = q.in("jenis", jenis);
    }

    const { data } = await q;
    setRows(await attachPembuatToTransaksi(supabase, (data ?? []) as Transaksi[]));
    setLoading(false);
  }, [filter, tanggal]);

  useEffect(() => {
    load();
  }, [load]);

  function hapusFilter() {
    router.push("/transaksi");
  }

  const filterAktif = filter !== "all" || tanggal != null;
  const deskripsiRiwayat = filterAktif
    ? `Filter ${labelTransaksiFilter(filter).toLowerCase()}${tanggal ? ` · ${formatRentangTanggal(tanggal.dari, tanggal.sampai)}` : ""} · max. 100 baris`
    : "Catatan uang keluar dan masuk — 100 transaksi terakhir";

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            Transaksi
          </h1>
          <p className="text-muted-foreground text-sm">{deskripsiRiwayat}</p>
          {filterAktif && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="gap-1 pr-1">
                {labelTransaksiFilter(filter)}
                {tanggal && (
                  <span className="text-muted-foreground">
                    · {formatRentangTanggal(tanggal.dari, tanggal.sampai)}
                  </span>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="size-5"
                  onClick={hapusFilter}
                  aria-label="Hapus filter"
                >
                  <X className="size-3" />
                </Button>
              </Badge>
            </div>
          )}
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button className="w-full sm:w-auto" />}>
            Tambah transaksi
          </DialogTrigger>
          <TransaksiDialogContent>
            <DialogHeader className={transaksiDialogHeaderClass}>
              <DialogTitle className={transaksiDialogTitleClass}>
                Transaksi baru
              </DialogTitle>
            </DialogHeader>
            <TransaksiForm
              onSuccess={() => {
                setOpen(false);
                load();
              }}
            />
          </TransaksiDialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-muted-foreground py-10 text-center text-sm">
          Memuat...
        </p>
      ) : rows.length === 0 ? (
        <EmptyState
          variant="page"
          icon={ArrowLeftRight}
          title="Tidak ada transaksi"
          description={
            filter === "hutang_nasabah"
              ? "Tidak ada transaksi pinjaman untuk nasabah yang masih berhutang."
              : filterAktif
                ? "Tidak ada transaksi untuk filter ini. Coba ubah filter atau rentang tanggal."
                : "Belum ada transaksi tercatat. Tambah transaksi pertama dari tombol di atas."
          }
        />
      ) : (
        <TransaksiList
          rows={rows}
          onBatalkan={(t) => {
            setBatalTarget(t);
            setBatalOpen(true);
          }}
        />
      )}

      <BatalkanTransaksiDialog
        transaksi={batalTarget}
        open={batalOpen}
        onOpenChange={setBatalOpen}
        onSuccess={load}
      />
    </div>
  );
}

export default function TransaksiPage() {
  return (
    <Suspense
      fallback={
        <p className="text-muted-foreground py-12 text-center text-sm">
          Memuat transaksi...
        </p>
      }
    >
      <TransaksiPageContent />
    </Suspense>
  );
}
