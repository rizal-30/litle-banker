"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DataTableCard } from "@/components/data-table-card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { NasabahForm } from "@/components/nasabah-form";
import { EmptyState } from "@/components/empty-state";
import {
  AktivitasKolomLabel,
  NasabahFrekuensiIndikator,
} from "@/components/nasabah-frekuensi-indikator";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { filterOptionsByLabel } from "@/lib/filter-options";
import {
  agregatAktivitasNasabah,
  aktivitasDenganProporsi,
  aktivitasKosong,
  type AktivitasNasabah,
} from "@/lib/nasabah-frekuensi";
import type { SaldoNasabah } from "@/types/database";
import { formatRupiah } from "@/lib/format";
import { Search, UserPlus, Users } from "lucide-react";

export default function NasabahPage() {
  const router = useRouter();
  const [rows, setRows] = useState<SaldoNasabah[]>([]);
  const [aktivitasById, setAktivitasById] = useState<
    Map<string, AktivitasNasabah>
  >(new Map());
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();

    const [saldoRes, semuaRes, trxRes] = await Promise.all([
      supabase.from("v_saldo_nasabah").select("*"),
      supabase.from("nasabah").select("id, nama, telepon, aktif").order("nama"),
      supabase
        .from("transaksi")
        .select("nasabah_id, jenis, jumlah")
        .in("jenis", ["setoran", "penarikan", "pinjaman_keluar"])
        .is("dibatalkan_pada", null)
        .not("nasabah_id", "is", null),
    ]);

    const saldoMap = new Map(
      ((saldoRes.data ?? []) as SaldoNasabah[]).map((n) => [n.id, n])
    );

    const merged = (semuaRes.data ?? []).map((n) => {
      const saldo = saldoMap.get(n.id);
      if (saldo) return saldo;
      return {
        id: n.id,
        nama: n.nama,
        telepon: n.telepon,
        aktif: n.aktif,
        tabungan: 0,
        hutang: 0,
        saldo: 0,
      } satisfies SaldoNasabah;
    });

    merged.sort((a, b) => {
      if (a.aktif !== b.aktif) return a.aktif ? -1 : 1;
      return a.nama.localeCompare(b.nama, "id");
    });

    setRows(merged);

    const agregat = agregatAktivitasNasabah(trxRes.data ?? []);
    setAktivitasById(aktivitasDenganProporsi(agregat));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    let list = rows;
    if (query.trim()) {
      const matchedIds = new Set(
        filterOptionsByLabel(
          rows.map((n) => ({
            value: n.id,
            label: n.nama,
            searchText: [n.nama, n.telepon].filter(Boolean).join(" "),
          })),
          query
        ).map((o) => o.value)
      );

      list = rows.filter((n) => matchedIds.has(n.id));
    }

    return [...list].sort((a, b) => {
      if (a.aktif !== b.aktif) return a.aktif ? -1 : 1;
      return a.nama.localeCompare(b.nama, "id");
    });
  }, [rows, query]);

  function bukaNasabah(id: string) {
    router.push(`/nasabah/${id}`);
  }

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Nasabah
            </h1>
            <p className="text-muted-foreground text-sm">
              Daftar pedagang — klik baris untuk buku tabungan
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
              render={
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Tambah nasabah"
                  className="shrink-0 sm:h-8 sm:w-auto sm:px-2.5"
                />
              }
            >
              <UserPlus className="sm:hidden" />
              <span className="hidden sm:inline">Tambah nasabah</span>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nasabah baru</DialogTitle>
              </DialogHeader>
              <NasabahForm
                onSuccess={() => {
                  setOpen(false);
                  load();
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="relative">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari nama atau telepon..."
          className="pl-9"
          aria-label="Cari nasabah"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          variant="page"
          icon={Users}
          title={query.trim() ? "Tidak ditemukan" : "Belum ada nasabah"}
          description={
            query.trim()
              ? "Tidak ada nasabah yang cocok dengan pencarian."
              : "Tambahkan nasabah pertama untuk mulai mencatat tabungan."
          }
        />
      ) : (
        <>
      <div className="space-y-2 sm:hidden">
        {filtered.map((n) => (
          <div
            key={n.id}
            className={cn(
              "group overflow-hidden rounded-lg border transition-colors",
              !n.aktif && "border-dashed bg-muted/40"
            )}
          >
            <button
              type="button"
              onClick={() => bukaNasabah(n.id)}
              className="group-hover:bg-muted/50 group-active:bg-muted/60 w-full px-3 pt-3 pb-2.5 text-left touch-manipulation"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 font-medium leading-snug">
                    <span
                      className={cn(
                        "min-w-0 truncate",
                        !n.aktif && "text-muted-foreground"
                      )}
                    >
                      {n.nama}
                    </span>
                    {!n.aktif && (
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        Nonaktif
                      </Badge>
                    )}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold leading-snug tabular-nums">
                  {formatRupiah(Number(n.saldo))}
                </p>
              </div>
            </button>
            <div className="flex items-end gap-2 border-t border-border/60 px-3 py-2.5">
              <AktivitasKolomLabel className="text-muted-foreground shrink-0 text-[11px] font-medium" />
              <NasabahFrekuensiIndikator
                aktivitas={aktivitasById.get(n.id) ?? aktivitasKosong()}
                stretch
              />
            </div>
          </div>
        ))}
      </div>

      <DataTableCard className="hidden sm:block">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[42%] pl-4">Nama</TableHead>
                <TableHead className="w-28">
                  <AktivitasKolomLabel />
                </TableHead>
                <TableHead className="w-36 pr-4 text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((n) => (
                <TableRow
                  key={n.id}
                  className={`cursor-pointer${!n.aktif ? " bg-muted/40" : ""}`}
                  onClick={() => bukaNasabah(n.id)}
                >
                  <TableCell className="max-w-0 pl-4 font-medium">
                    <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
                      <span
                        className={cn(
                          "truncate",
                          !n.aktif && "text-muted-foreground"
                        )}
                      >
                        {n.nama}
                      </span>
                      {!n.aktif && (
                        <Badge variant="outline" className="shrink-0 text-[10px]">
                          Nonaktif
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell>
                    <NasabahFrekuensiIndikator
                      table
                      aktivitas={aktivitasById.get(n.id) ?? aktivitasKosong()}
                    />
                  </TableCell>
                  <TableCell className="pr-4 text-right tabular-nums font-medium">
                    {formatRupiah(Number(n.saldo))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
      </DataTableCard>
        </>
      )}
    </div>
  );
}
