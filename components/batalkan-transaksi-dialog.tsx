"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import type { Transaksi } from "@/types/database";
import { JENIS_TRANSAKSI_LABEL } from "@/types/database";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { toast } from "sonner";

interface BatalkanTransaksiDialogProps {
  transaksi: Transaksi | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function BatalkanTransaksiDialog({
  transaksi,
  open,
  onOpenChange,
  onSuccess,
}: BatalkanTransaksiDialogProps) {
  const [alasan, setAlasan] = useState("");
  const [loading, setLoading] = useState(false);

  const handleOpenChange = (next: boolean) => {
    if (!next) setAlasan("");
    onOpenChange(next);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!transaksi) return;

    const trimmed = alasan.trim();
    if (trimmed.length < 10) {
      toast.error("Alasan wajib diisi (min. 10 karakter).");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("batalkan_transaksi", {
      p_transaksi_id: transaksi.id,
      p_alasan: trimmed,
    });
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Transaksi dibatalkan.");
    setAlasan("");
    onOpenChange(false);
    onSuccess();
  }

  if (!transaksi) return null;

  const sudahBatal =
    transaksi.dibatalkan_pada != null || transaksi.jenis === "pembatalan";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Batalkan transaksi</DialogTitle>
            <DialogDescription>
              Saldo akan dibalik lewat transaksi dibatalkan baru. Transaksi asal
              tetap tercatat dengan status dibatalkan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-sm">
            <div className="rounded-md border bg-muted/40 p-3 space-y-1">
              <p>
                <span className="text-muted-foreground">Tanggal: </span>
                {formatTanggal(transaksi.tanggal)}
              </p>
              <p>
                <span className="text-muted-foreground">Jenis: </span>
                {JENIS_TRANSAKSI_LABEL[transaksi.jenis]}
              </p>
              <p>
                <span className="text-muted-foreground">Jumlah: </span>
                {formatRupiah(Number(transaksi.jumlah))}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="alasan-dibatalkan">Alasan dibatalkan</Label>
              <Textarea
                id="alasan-dibatalkan"
                value={alasan}
                onChange={(e) => setAlasan(e.target.value)}
                placeholder="Contoh: Salah input jumlah / nasabah salah"
                rows={3}
                disabled={loading || sudahBatal}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={loading || sudahBatal || alasan.trim().length < 10}
            >
              {loading ? "Memproses..." : "Batalkan transaksi"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
