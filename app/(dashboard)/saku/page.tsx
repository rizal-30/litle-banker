"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DataTableCard } from "@/components/data-table-card";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SakuForm } from "@/components/saku-form";
import { EmptyState } from "@/components/empty-state";
import { TransaksiForm } from "@/components/transaksi-form";
import {
  TransaksiDialogContent,
  transaksiDialogDescriptionClass,
  transaksiDialogHeaderClass,
  transaksiDialogTitleClass,
} from "@/components/transaksi-dialog-content";
import { MoreHorizontal, Plus, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { JenisSaku, SaldoSaku, Saku } from "@/types/database";
import { JENIS_SAKU_LABEL } from "@/types/database";
import { formatRupiah } from "@/lib/format";
import { toast } from "sonner";

export default function SakuPage() {
  const router = useRouter();
  const [rows, setRows] = useState<SaldoSaku[]>([]);
  const [openSaku, setOpenSaku] = useState(false);
  const [openTransfer, setOpenTransfer] = useState(false);
  const [editSaku, setEditSaku] = useState<Saku | null>(null);
  const [hapusTarget, setHapusTarget] = useState<SaldoSaku | null>(null);
  const [transferDari, setTransferDari] = useState<SaldoSaku | null>(null);
  const [menghapus, setMenghapus] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("v_saldo_saku")
      .select("*")
      .order("nama");
    setRows((data ?? []) as SaldoSaku[]);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function bukaEdit(row: SaldoSaku) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("saku")
      .select("*")
      .eq("id", row.id)
      .single();
    if (error || !data) {
      toast.error(error?.message ?? "Gagal memuat data saku");
      return;
    }
    setEditSaku(data as Saku);
  }

  function bukaTransfer(dari?: SaldoSaku) {
    setTransferDari(dari ?? null);
    setOpenTransfer(true);
  }

  async function nonaktifkanSaku() {
    if (!hapusTarget) return;
    setMenghapus(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("saku")
      .update({ aktif: false })
      .eq("id", hapusTarget.id);
    setMenghapus(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(`Saku "${hapusTarget.nama}" dihapus`);
    setHapusTarget(null);
    load();
  }

  const total = rows.reduce((s, r) => s + Number(r.saldo), 0);
  const saldoHapus = hapusTarget ? Number(hapusTarget.saldo) : 0;
  const masihAdaSaldo = saldoHapus !== 0;

  function bukaSaku(sakuId: string) {
    router.push(`/saku/${sakuId}`);
  }

  function menuAksi(s: SaldoSaku) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-9 shrink-0 touch-manipulation"
            />
          }
        >
          <MoreHorizontal className="size-4" />
          <span className="sr-only">Aksi saku</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => bukaEdit(s)}>Edit</DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setHapusTarget(s)}
          >
            Hapus
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Saku</h1>
          <p className="text-muted-foreground text-sm">
            Total {formatRupiah(total)} · Klik nama saku untuk riwayat mutasi
          </p>
        </div>
        <div className="flex flex-row items-stretch gap-2">
          <Dialog open={openSaku} onOpenChange={setOpenSaku}>
            <DialogTrigger
              render={
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Tambah saku"
                  className="size-9 shrink-0 touch-manipulation sm:h-8 sm:w-auto sm:px-2.5"
                />
              }
            >
              <Plus className="size-4 sm:hidden" />
              <span className="hidden sm:inline">Tambah saku</span>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Saku baru</DialogTitle>
              </DialogHeader>
              <SakuForm
                onSuccess={() => {
                  setOpenSaku(false);
                  load();
                }}
              />
            </DialogContent>
          </Dialog>
          <Dialog
            open={openTransfer}
            onOpenChange={(open) => {
              setOpenTransfer(open);
              if (!open) setTransferDari(null);
            }}
          >
            <DialogTrigger
              render={
                <Button className="min-w-0 flex-1 touch-manipulation sm:w-auto sm:flex-none" />
              }
            >
              Transfer antar saku
            </DialogTrigger>
            <TransaksiDialogContent>
              <DialogHeader className={transaksiDialogHeaderClass}>
                <DialogTitle className={transaksiDialogTitleClass}>
                  Transfer saku
                </DialogTitle>
                {transferDari && Number(transferDari.saldo) > 0 && (
                  <DialogDescription className={transaksiDialogDescriptionClass}>
                    Pindahkan saldo {formatRupiah(Number(transferDari.saldo))}{" "}
                    dari {transferDari.nama} ke saku lain.
                  </DialogDescription>
                )}
              </DialogHeader>
              <TransaksiForm
                key={transferDari?.id ?? "transfer-baru"}
                seedSaku={
                  transferDari
                    ? [
                        {
                          id: transferDari.id,
                          nama: transferDari.nama,
                          saldo: Number(transferDari.saldo),
                          jenis: transferDari.jenis,
                          pilih_di_transaksi: transferDari.pilih_di_transaksi,
                        },
                      ]
                    : undefined
                }
                defaultValues={{
                  jenis: "transfer_saku",
                  saku_id: transferDari?.id,
                  jumlah: transferDari ? Number(transferDari.saldo) : 0,
                }}
                onSuccess={() => {
                  setOpenTransfer(false);
                  setTransferDari(null);
                  setHapusTarget(null);
                  load();
                }}
              />
            </TransaksiDialogContent>
          </Dialog>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          variant="page"
          icon={Wallet}
          title="Belum ada saku"
          description="Tambahkan saku kas, bank, atau instrumen untuk mulai mencatat saldo."
        />
      ) : (
        <>
      <div className="space-y-3 sm:hidden">
        {rows.map((s) => (
          <div key={s.id} className="rounded-lg border p-3">
            <div className="flex items-start gap-2">
              <button
                type="button"
                onClick={() => bukaSaku(s.id)}
                className="min-w-0 flex-1 text-left touch-manipulation"
              >
                <p className="truncate font-medium hover:underline">
                  {s.nama}
                </p>
                <Badge variant="outline" className="mt-1 text-xs">
                  {JENIS_SAKU_LABEL[s.jenis]}
                </Badge>
                {s.pilih_di_transaksi === false && (
                  <Badge variant="secondary" className="mt-1 ml-1 text-xs">
                    Tersembunyi
                  </Badge>
                )}
              </button>
              <div
                className="flex shrink-0 flex-col items-end gap-1"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="text-sm font-semibold tabular-nums">
                  {formatRupiah(Number(s.saldo))}
                </p>
                {menuAksi(s)}
              </div>
            </div>
          </div>
        ))}
      </div>

      <DataTableCard className="hidden sm:block">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%] pl-4">Nama</TableHead>
                  <TableHead className="w-28">Jenis</TableHead>
                  <TableHead className="w-36 text-right">Saldo</TableHead>
                  <TableHead className="w-12 pr-4">
                    <span className="sr-only">Aksi</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((s) => (
                  <TableRow
                    key={s.id}
                    className="cursor-pointer"
                    onClick={() => bukaSaku(s.id)}
                  >
                    <TableCell className="max-w-0 truncate pl-4 font-medium">
                      <span>{s.nama}</span>
                      {s.pilih_di_transaksi === false && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          Tersembunyi
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {JENIS_SAKU_LABEL[s.jenis]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatRupiah(Number(s.saldo))}
                    </TableCell>
                    <TableCell className="w-12 p-1 pr-4" onClick={(e) => e.stopPropagation()}>
                      {menuAksi(s)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
      </DataTableCard>
        </>
      )}

      <Dialog open={!!editSaku} onOpenChange={(o) => !o && setEditSaku(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit saku</DialogTitle>
          </DialogHeader>
          {editSaku && (
            <SakuForm
              id={editSaku.id}
              defaultValues={{
                nama: editSaku.nama,
                jenis: editSaku.jenis as JenisSaku,
                keterangan: editSaku.keterangan ?? "",
                pilih_di_transaksi: editSaku.pilih_di_transaksi ?? true,
              }}
              onSuccess={() => {
                setEditSaku(null);
                load();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!hapusTarget}
        onOpenChange={(o) => !o && setHapusTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus saku</DialogTitle>
            <DialogDescription>
              {masihAdaSaldo ? (
                <>
                  Saku <strong>{hapusTarget?.nama}</strong> masih berisi saldo{" "}
                  {formatRupiah(saldoHapus)}. Pindahkan uang ke saku lain
                  terlebih dahulu, baru hapus.
                </>
              ) : (
                <>
                  Nonaktifkan saku <strong>{hapusTarget?.nama}</strong>?
                  Riwayat transaksi tetap tersimpan.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            {masihAdaSaldo ? (
              <>
                <Button variant="outline" onClick={() => setHapusTarget(null)}>
                  Batal
                </Button>
                <Button
                  onClick={() => {
                    bukaTransfer(hapusTarget ?? undefined);
                  }}
                >
                  Transfer dulu
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setHapusTarget(null)}>
                  Batal
                </Button>
                <Button
                  variant="destructive"
                  disabled={menghapus}
                  onClick={nonaktifkanSaku}
                >
                  {menghapus ? "Menghapus..." : "Hapus saku"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
