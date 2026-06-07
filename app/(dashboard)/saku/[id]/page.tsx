"use client";

/**
 * Buku saku — saldo + mutasi keluar masuk uang.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { MutasiSakuList } from "@/components/mutasi-saku-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SakuForm } from "@/components/saku-form";
import { TransaksiForm } from "@/components/transaksi-form";
import {
  TransaksiDialogContent,
  transaksiDialogDescriptionClass,
  transaksiDialogHeaderClass,
  transaksiDialogTitleClass,
} from "@/components/transaksi-dialog-content";
import { SetBreadcrumbTitle } from "@/components/breadcrumb-provider";
import { EmptyState } from "@/components/empty-state";
import { attachPembuatToTransaksi } from "@/lib/transaksi-pembuat";
import { hitungSaldoSaku, transaksiUntukSaku } from "@/lib/mutasi-saku";
import { createClient } from "@/lib/supabase/client";
import type { JenisSaku, Saku, Transaksi } from "@/types/database";
import { JENIS_SAKU_LABEL } from "@/types/database";
import { formatRupiah } from "@/lib/format";
import { MoreHorizontal, ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";

export default function BukuSakuPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [saku, setSaku] = useState<Saku | null>(null);
  const [semuaTransaksi, setSemuaTransaksi] = useState<Transaksi[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [hapusOpen, setHapusOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [menghapus, setMenghapus] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [sRes, tRes] = await Promise.all([
      supabase.from("saku").select("*").eq("id", id).single(),
      supabase
        .from("transaksi")
        .select(
          `
          *,
          nasabah:nasabah_id(nama),
          saku:saku_id(nama),
          saku_tujuan:saku_tujuan_id(nama)
        `
        )
        .or(`saku_id.eq.${id},saku_tujuan_id.eq.${id}`)
        .order("tanggal", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);

    setSaku(sRes.data as Saku | null);
    setSemuaTransaksi(
      await attachPembuatToTransaksi(
        supabase,
        (tRes.data ?? []) as Transaksi[]
      )
    );
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const mutasi = useMemo(
    () => transaksiUntukSaku(id, semuaTransaksi),
    [id, semuaTransaksi]
  );

  const saldo = useMemo(
    () => hitungSaldoSaku(id, semuaTransaksi),
    [id, semuaTransaksi]
  );

  const masihAdaSaldo = saldo !== 0;

  async function nonaktifkanSaku() {
    setMenghapus(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("saku")
      .update({ aktif: false })
      .eq("id", id);
    setMenghapus(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(`Saku "${saku?.nama}" dihapus`);
    setHapusOpen(false);
    router.push("/saku");
  }

  if (!saku) {
    return <p className="text-muted-foreground">Memuat buku saku...</p>;
  }

  return (
    <div className="min-w-0 space-y-6">
      <SetBreadcrumbTitle title={saku.nama} />
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xl font-semibold tracking-tight sm:text-2xl">
              <span className="truncate">{saku.nama}</span>
              <Badge variant="outline" className="shrink-0 font-normal">
                {JENIS_SAKU_LABEL[saku.jenis]}
              </Badge>
              {saku.pilih_di_transaksi === false && (
                <Badge variant="secondary" className="shrink-0 font-normal">
                  Tersembunyi
                </Badge>
              )}
              {!saku.aktif && (
                <Badge variant="secondary" className="shrink-0 font-normal">
                  Nonaktif
                </Badge>
              )}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Saldo {formatRupiah(saldo)} · Riwayat uang masuk dan keluar
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="icon-sm"
                  className="size-9 shrink-0 touch-manipulation"
                />
              }
            >
              <MoreHorizontal className="size-4" />
              <span className="sr-only">Aksi saku</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditOpen(true)}>
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setHapusOpen(true)}>
                Hapus
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {mutasi.length === 0 ? (
        <EmptyState
          variant="page"
          icon={ArrowLeftRight}
          title="Belum ada mutasi"
          description="Transaksi yang melibatkan saku ini akan muncul di sini."
        />
      ) : (
        <MutasiSakuList sakuId={id} rows={mutasi} />
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit saku</DialogTitle>
          </DialogHeader>
          <SakuForm
            id={saku.id}
            defaultValues={{
              nama: saku.nama,
              jenis: saku.jenis as JenisSaku,
              keterangan: saku.keterangan ?? "",
              pilih_di_transaksi: saku.pilih_di_transaksi ?? true,
            }}
            onSuccess={() => {
              setEditOpen(false);
              load();
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={hapusOpen} onOpenChange={setHapusOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus saku</DialogTitle>
            <DialogDescription>
              {masihAdaSaldo ? (
                <>
                  Saku <strong>{saku.nama}</strong> masih berisi saldo{" "}
                  {formatRupiah(saldo)}. Pindahkan uang ke saku lain terlebih
                  dahulu, baru hapus.
                </>
              ) : (
                <>
                  Nonaktifkan saku <strong>{saku.nama}</strong>? Riwayat
                  transaksi tetap tersimpan.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            {masihAdaSaldo ? (
              <>
                <Button variant="outline" onClick={() => setHapusOpen(false)}>
                  Batal
                </Button>
                <Button
                  onClick={() => {
                    setHapusOpen(false);
                    setTransferOpen(true);
                  }}
                >
                  Transfer dulu
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setHapusOpen(false)}>
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

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <TransaksiDialogContent>
          <DialogHeader className={transaksiDialogHeaderClass}>
            <DialogTitle className={transaksiDialogTitleClass}>
              Transfer saku
            </DialogTitle>
            <DialogDescription className={transaksiDialogDescriptionClass}>
              Pindahkan saldo {formatRupiah(saldo)} dari {saku.nama} ke saku
              lain.
            </DialogDescription>
          </DialogHeader>
          <TransaksiForm
            key={saku.id}
            seedSaku={[
              {
                id: saku.id,
                nama: saku.nama,
                saldo,
                jenis: saku.jenis,
                pilih_di_transaksi: saku.pilih_di_transaksi,
              },
            ]}
            defaultValues={{
              jenis: "transfer_saku",
              saku_id: saku.id,
              jumlah: saldo > 0 ? saldo : 0,
            }}
            onSuccess={() => {
              setTransferOpen(false);
              load();
            }}
          />
        </TransaksiDialogContent>
      </Dialog>
    </div>
  );
}
