"use client";

/**
 * Buku tabungan nasabah — saldo + mutasi kronologis.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { MutasiNasabahList } from "@/components/mutasi-nasabah-list";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
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
import { NasabahForm } from "@/components/nasabah-form";
import {
  JENIS_TRANSAKSI_NASABAH,
  TransaksiForm,
} from "@/components/transaksi-form";
import {
  TransaksiDialogContent,
  transaksiDialogDescriptionClass,
  transaksiDialogHeaderClass,
  transaksiDialogTitleClass,
} from "@/components/transaksi-dialog-content";
import { createClient } from "@/lib/supabase/client";
import type { Transaksi, SaldoNasabah, Nasabah } from "@/types/database";
import { formatRupiah, whatsappUrl } from "@/lib/format";
import { SetBreadcrumbTitle } from "@/components/breadcrumb-provider";
import { EmptyState } from "@/components/empty-state";
import { HandCoins, MessageCircle, MoreHorizontal, PiggyBank, UserX, ArrowLeftRight, Wallet } from "lucide-react";
import { toast } from "sonner";

export default function BukuBankPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [nasabah, setNasabah] = useState<SaldoNasabah | null>(null);
  const [mutasi, setMutasi] = useState<Transaksi[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editNasabah, setEditNasabah] = useState<Nasabah | null>(null);
  const [nonaktifOpen, setNonaktifOpen] = useState(false);
  const [aktifOpen, setAktifOpen] = useState(false);
  const [transaksiOpen, setTransaksiOpen] = useState(false);
  const [hapusOpen, setHapusOpen] = useState(false);
  const [menonaktifkan, setMenonaktifkan] = useState(false);
  const [mengaktifkan, setMengaktifkan] = useState(false);
  const [menghapus, setMenghapus] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [nRes, tRes] = await Promise.all([
      supabase.from("v_saldo_nasabah").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("transaksi")
        .select("*, saku:saku_id(nama)")
        .eq("nasabah_id", id)
        .order("tanggal", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);

    let nasabahData = nRes.data as SaldoNasabah | null;
    if (!nasabahData) {
      const { data: profil } = await supabase
        .from("nasabah")
        .select("id, nama, telepon, aktif")
        .eq("id", id)
        .maybeSingle();
      if (profil) {
        nasabahData = {
          ...profil,
          tabungan: 0,
          hutang: 0,
          saldo: 0,
        };
      }
    }

    setNasabah(nasabahData);
    setMutasi((tRes.data ?? []) as Transaksi[]);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const canHapus = useMemo(() => mutasi.length === 0, [mutasi.length]);

  const tabunganNonaktif = nasabah ? Number(nasabah.tabungan) : 0;
  const hutangNonaktif = nasabah ? Number(nasabah.hutang) : 0;
  const masihAdaSaldo = tabunganNonaktif !== 0 || hutangNonaktif !== 0;

  async function bukaEdit() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("nasabah")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !data) {
      toast.error(error?.message ?? "Gagal memuat data nasabah");
      return;
    }
    setEditNasabah(data as Nasabah);
    setEditOpen(true);
  }

  async function nonaktifkanNasabah() {
    setMenonaktifkan(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("nasabah")
      .update({ aktif: false })
      .eq("id", id);
    setMenonaktifkan(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(`Nasabah "${nasabah?.nama}" dinonaktifkan`);
    setNonaktifOpen(false);
    router.push("/nasabah");
  }

  async function aktifkanNasabah() {
    setMengaktifkan(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("nasabah")
      .update({ aktif: true })
      .eq("id", id);
    setMengaktifkan(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(`Nasabah "${nasabah?.nama}" diaktifkan kembali`);
    setAktifOpen(false);
    load();
  }

  async function hapusNasabah() {
    setMenghapus(true);
    const supabase = createClient();
    const { error } = await supabase.from("nasabah").delete().eq("id", id);
    setMenghapus(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(`Nasabah "${nasabah?.nama}" dihapus`);
    setHapusOpen(false);
    router.push("/nasabah");
  }

  if (!nasabah) {
    return <p className="text-muted-foreground">Memuat buku tabungan...</p>;
  }

  const linkWhatsApp = nasabah.telepon ? whatsappUrl(nasabah.telepon) : null;
  const isNonaktif = !nasabah.aktif;

  return (
    <div className="min-w-0 space-y-6">
      <SetBreadcrumbTitle title={nasabah.nama} />
      {isNonaktif && (
        <Alert variant="destructive">
          <UserX />
          <AlertTitle>Nasabah nonaktif</AlertTitle>
          <AlertDescription>
            Tidak muncul di form transaksi. Riwayat mutasi tetap bisa dilihat.
          </AlertDescription>
          <AlertAction>
            <Button size="sm" disabled={mengaktifkan} onClick={() => setAktifOpen(true)}>
              Aktifkan
            </Button>
          </AlertAction>
        </Alert>
      )}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">
              {nasabah.nama}
            </h1>
            {nasabah.telepon && (
              <p className="mt-0.5 flex items-center gap-1.5 text-sm">
                <span className="text-muted-foreground">{nasabah.telepon}</span>
                {linkWhatsApp && (
                  <a
                    href={linkWhatsApp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-600 hover:text-green-700 dark:text-green-500 dark:hover:text-green-400 touch-manipulation"
                    aria-label={`WhatsApp ${nasabah.nama}`}
                  >
                    <MessageCircle className="size-4" />
                  </a>
                )}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!isNonaktif && (
              <Button
                type="button"
                size="sm"
                className="hidden touch-manipulation sm:inline-flex"
                onClick={() => setTransaksiOpen(true)}
              >
                Tambah transaksi
              </Button>
            )}
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
              <span className="sr-only">Aksi nasabah</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={bukaEdit}>Edit</DropdownMenuItem>
              {isNonaktif ? (
                <DropdownMenuItem onClick={() => setAktifOpen(true)}>
                  Aktifkan
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => setNonaktifOpen(true)}>
                  Nonaktifkan
                </DropdownMenuItem>
              )}
              {canHapus && (
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setHapusOpen(true)}
                >
                  Hapus
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </div>
        {!isNonaktif && (
          <Button
            type="button"
            className="w-full touch-manipulation sm:hidden"
            onClick={() => setTransaksiOpen(true)}
          >
            Tambah transaksi
          </Button>
        )}
      </div>

      <Dialog open={transaksiOpen} onOpenChange={setTransaksiOpen}>
        <TransaksiDialogContent>
          <DialogHeader className={transaksiDialogHeaderClass}>
            <DialogTitle className={transaksiDialogTitleClass}>
              Transaksi nasabah
            </DialogTitle>
            <DialogDescription className={transaksiDialogDescriptionClass}>
              Catat menabung, tarik, atau pinjaman untuk{" "}
              <strong>{nasabah.nama}</strong>.
            </DialogDescription>
          </DialogHeader>
          <TransaksiForm
            key={`${nasabah.id}-${transaksiOpen}`}
            jenisDiizinkan={JENIS_TRANSAKSI_NASABAH}
            kunciNasabah
            seedNasabah={[
              {
                id: nasabah.id,
                nama: nasabah.nama,
                saldo: Number(nasabah.saldo),
                tabungan: Number(nasabah.tabungan),
                hutang: Number(nasabah.hutang),
              },
            ]}
            defaultValues={{
              nasabah_id: nasabah.id,
              jenis: "setoran",
            }}
            onSuccess={() => {
              setTransaksiOpen(false);
              load();
            }}
          />
        </TransaksiDialogContent>
      </Dialog>

      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        <Card size="sm" className="min-w-0 py-0">
          <CardContent className="flex flex-col gap-1.5 p-3 sm:gap-2 sm:p-3.5">
            <div className="flex items-center justify-between gap-2">
              <CardDescription className="text-[10px] leading-tight sm:text-xs">
                Tabungan
              </CardDescription>
              <PiggyBank className="size-3.5 shrink-0 text-muted-foreground sm:size-4" />
            </div>
            <CardTitle className="text-xs leading-snug font-semibold break-words tabular-nums sm:text-base">
              {formatRupiah(Number(nasabah.tabungan))}
            </CardTitle>
          </CardContent>
        </Card>
        <Card size="sm" className="min-w-0 py-0">
          <CardContent className="flex flex-col gap-1.5 p-3 sm:gap-2 sm:p-3.5">
            <div className="flex items-center justify-between gap-2">
              <CardDescription className="text-[10px] leading-tight sm:text-xs">
                <span className="sm:hidden">Hutang</span>
                <span className="hidden sm:inline">Hutang pinjaman</span>
              </CardDescription>
              <HandCoins className="size-3.5 shrink-0 text-muted-foreground sm:size-4" />
            </div>
            <CardTitle className="text-xs leading-snug font-semibold break-words tabular-nums sm:text-base">
              {formatRupiah(Number(nasabah.hutang))}
            </CardTitle>
          </CardContent>
        </Card>
        <Card size="sm" className="min-w-0 py-0">
          <CardContent className="flex flex-col gap-1.5 p-3 sm:gap-2 sm:p-3.5">
            <div className="flex items-center justify-between gap-2">
              <CardDescription className="text-[10px] leading-tight sm:text-xs">
                Saldo
              </CardDescription>
              <Wallet className="size-3.5 shrink-0 text-muted-foreground sm:size-4" />
            </div>
            <CardTitle className="text-xs leading-snug font-semibold break-words tabular-nums sm:text-base">
              {formatRupiah(Number(nasabah.saldo))}
            </CardTitle>
          </CardContent>
        </Card>
      </div>

      {mutasi.length === 0 ? (
        <EmptyState
          variant="page"
          icon={ArrowLeftRight}
          title="Belum ada mutasi"
          description="Setoran, penarikan, dan pinjaman nasabah ini akan muncul di buku tabungan."
        />
      ) : (
        <MutasiNasabahList rows={mutasi} />
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit nasabah</DialogTitle>
          </DialogHeader>
          {editNasabah && (
            <NasabahForm
              id={editNasabah.id}
              defaultValues={{
                nama: editNasabah.nama,
                telepon: editNasabah.telepon ?? "",
                alamat: editNasabah.alamat ?? "",
                keterangan: editNasabah.keterangan ?? "",
              }}
              onSuccess={() => {
                setEditOpen(false);
                setEditNasabah(null);
                load();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={nonaktifOpen} onOpenChange={setNonaktifOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nonaktifkan nasabah</DialogTitle>
            <DialogDescription>
              {masihAdaSaldo ? (
                <>
                  Nasabah <strong>{nasabah.nama}</strong> masih punya tabungan{" "}
                  {formatRupiah(tabunganNonaktif)} dan hutang{" "}
                  {formatRupiah(hutangNonaktif)}. Selesaikan lewat Transaksi
                  terlebih dahulu.
                </>
              ) : (
                <>
                  Nonaktifkan nasabah <strong>{nasabah.nama}</strong>? Riwayat
                  transaksi tetap tersimpan.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setNonaktifOpen(false)}>
              {masihAdaSaldo ? "Tutup" : "Batal"}
            </Button>
            {!masihAdaSaldo && (
              <Button
                variant="destructive"
                disabled={menonaktifkan}
                onClick={nonaktifkanNasabah}
              >
                {menonaktifkan ? "Menonaktifkan..." : "Nonaktifkan"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={aktifOpen} onOpenChange={setAktifOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aktifkan nasabah</DialogTitle>
            <DialogDescription>
              Aktifkan kembali nasabah <strong>{nasabah.nama}</strong>? Nasabah
              akan muncul lagi di form transaksi.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setAktifOpen(false)}>
              Batal
            </Button>
            <Button disabled={mengaktifkan} onClick={aktifkanNasabah}>
              {mengaktifkan ? "Mengaktifkan..." : "Aktifkan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={hapusOpen} onOpenChange={setHapusOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus nasabah</DialogTitle>
            <DialogDescription>
              Hapus permanen nasabah <strong>{nasabah.nama}</strong>? Hanya bisa
              dilakukan karena belum ada transaksi.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setHapusOpen(false)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              disabled={menghapus}
              onClick={hapusNasabah}
            >
              {menghapus ? "Menghapus..." : "Hapus permanen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
