"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { DataTableCard } from "@/components/data-table-card";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { createClient } from "@/lib/supabase/client";
import { exportTransaksiExcel } from "@/lib/export-excel";
import {
  resolveSelectLabel,
  selectOptionsFromRecord,
} from "@/lib/select-options";
import type { Transaksi, JenisTransaksi } from "@/types/database";
import { JENIS_TRANSAKSI_LABEL } from "@/types/database";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { toast } from "sonner";
import { Download, FileSpreadsheet } from "lucide-react";

export default function LaporanPage() {
  const [dari, setDari] = useState(
    format(new Date(new Date().setDate(1)), "yyyy-MM-dd")
  );
  const [sampai, setSampai] = useState(format(new Date(), "yyyy-MM-dd"));
  const [jenis, setJenis] = useState<string>("all");
  const [rows, setRows] = useState<Transaksi[]>([]);
  const [loading, setLoading] = useState(false);
  const [sudahDimuat, setSudahDimuat] = useState(false);

  const jenisFilterItems = useMemo(
    () => [
      { value: "all", label: "Semua jenis" },
      ...selectOptionsFromRecord(JENIS_TRANSAKSI_LABEL),
    ],
    []
  );

  async function muatLaporan() {
    setLoading(true);
    const supabase = createClient();
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
      .gte("tanggal", dari)
      .lte("tanggal", sampai)
      .order("tanggal", { ascending: false });

    if (jenis !== "all") {
      q = q.eq("jenis", jenis);
    }

    const { data, error } = await q;
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    const enriched = await Promise.all(
      (data ?? []).map(async (t) => {
        if (!t.created_by) return { ...t, pembuat: null };
        const { data: p } = await supabase
          .from("profiles")
          .select("nama_lengkap")
          .eq("id", t.created_by)
          .single();
        return { ...t, pembuat: p };
      })
    );

    setRows(enriched as Transaksi[]);
    setSudahDimuat(true);
    setLoading(false);
  }

  function unduhExcel() {
    if (rows.length === 0) {
      toast.error("Muat laporan terlebih dahulu");
      return;
    }
    exportTransaksiExcel(rows, `laporan-bank-hemat_${dari}_${sampai}`);
    toast.success("File Excel diunduh");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Laporan</h1>
        <p className="text-muted-foreground text-sm">
          Filter rentang tanggal Masehi, unduh Excel
          {rows.length > 0 && ` · ${rows.length} transaksi`}
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="dari">Dari tanggal</Label>
              <Input
                id="dari"
                type="date"
                value={dari}
                onChange={(e) => setDari(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sampai">Sampai tanggal</Label>
              <Input
                id="sampai"
                type="date"
                value={sampai}
                onChange={(e) => setSampai(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Jenis</Label>
              <Select
                items={jenisFilterItems}
                value={jenis}
                onValueChange={(v) => setJenis(v ?? "all")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Semua jenis">
                    {(value: string | null) =>
                      resolveSelectLabel(jenisFilterItems, value)
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua jenis</SelectItem>
                  {(
                    Object.entries(JENIS_TRANSAKSI_LABEL) as [
                      JenisTransaksi,
                      string,
                    ][]
                  ).map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button onClick={muatLaporan} disabled={loading} className="w-full sm:w-auto">
              {loading ? "Memuat..." : "Tampilkan laporan"}
            </Button>
            <Button variant="outline" onClick={unduhExcel} className="w-full sm:w-auto">
              <Download className="mr-2 size-4" />
              Unduh Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      {sudahDimuat && rows.length === 0 ? (
        <DataTableCard>
          <EmptyState
            variant="inset"
            icon={FileSpreadsheet}
            title="Tidak ada data"
            description="Tidak ada transaksi pada rentang tanggal dan jenis filter yang dipilih."
          />
        </DataTableCard>
      ) : rows.length > 0 ? (
        <DataTableCard>
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-28 pl-4">Tanggal</TableHead>
                <TableHead className="w-36">Jenis</TableHead>
                <TableHead>Nasabah</TableHead>
                <TableHead className="w-36 pr-4 text-right">Jumlah</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="text-muted-foreground pl-4 text-sm">
                    {formatTanggal(t.tanggal)}
                  </TableCell>
                  <TableCell>
                    <JenisTransaksiBadge jenis={t.jenis} />
                  </TableCell>
                  <TableCell className="max-w-0 truncate">
                    {t.nasabah?.nama ?? "—"}
                  </TableCell>
                  <TableCell className="pr-4 text-right tabular-nums">
                    {formatRupiah(Number(t.jumlah))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataTableCard>
      ) : null}
    </div>
  );
}
