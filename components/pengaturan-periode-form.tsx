"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_PENGATURAN_PERIODE,
  normalizePengaturanPeriode,
} from "@/lib/pengaturan-periode";
import { labelPeriode, getPeriodeSekarang } from "@/lib/periode";
import {
  resolveSelectLabel,
  selectOptionsFromRecord,
} from "@/lib/select-options";
import type { JenisPeriode, KalenderPeriode, PengaturanPeriode } from "@/types/database";
import {
  BULAN_HIJRI_LABEL,
  BULAN_LABEL,
  JENIS_PERIODE_LABEL,
} from "@/types/database";
import { toast } from "sonner";

const JENIS_ITEMS = selectOptionsFromRecord(JENIS_PERIODE_LABEL);
const KALENDER_ITEMS = [
  { value: "hijri", label: "Hijriah (kalender Islam)" },
  { value: "masehi", label: "Masehi (kalender Gregorian)" },
];

export function PengaturanPeriodeForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [jenis, setJenis] = useState<JenisPeriode>(DEFAULT_PENGATURAN_PERIODE.jenis);
  const [bulanAwal, setBulanAwal] = useState(DEFAULT_PENGATURAN_PERIODE.bulan_awal);
  const [kalender, setKalender] = useState<KalenderPeriode>(
    DEFAULT_PENGATURAN_PERIODE.kalender
  );

  const tampilkanBulanAwal = jenis === "kuartal" || jenis === "tahun";
  const tampilkanKalender = jenis === "tahun";

  const bulanItems = useMemo(() => {
    const labels = kalender === "hijri" ? BULAN_HIJRI_LABEL : BULAN_LABEL;
    return Object.entries(labels).map(([value, label]) => ({
      value,
      label,
    }));
  }, [kalender]);

  const preview = useMemo(() => {
    const settings: PengaturanPeriode = { jenis, bulan_awal: bulanAwal, kalender };
    const periode = getPeriodeSekarang(settings);
    return labelPeriode(settings, periode);
  }, [jenis, bulanAwal, kalender]);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("pengaturan_periode")
      .select("jenis, bulan_awal, kalender")
      .eq("id", true)
      .single()
      .then(({ data, error }) => {
        if (error) {
          toast.error("Gagal memuat pengaturan periode");
          setLoading(false);
          return;
        }
        const normalized = normalizePengaturanPeriode(data ?? undefined);
        setJenis(normalized.jenis);
        setBulanAwal(normalized.bulan_awal);
        setKalender(normalized.kalender);
        setLoading(false);
      });
  }, []);

  async function simpan() {
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("pengaturan_periode")
      .update({
        jenis,
        bulan_awal: bulanAwal,
        kalender,
        updated_by: user?.id ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", true);

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Pengaturan periode disimpan");
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Periode dashboard</CardTitle>
        <CardDescription>
          Atur cara membagian periode di dashboard: per minggu, bulan, kuartal,
          atau tahun. Bulan awal menentukan awal tahun fiskal (kuartal & tahun).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Jenis periode</Label>
          <Select
            items={JENIS_ITEMS}
            value={jenis}
            onValueChange={(v) => setJenis((v ?? "tahun") as JenisPeriode)}
            disabled={loading}
          >
            <SelectTrigger className="w-full">
              <SelectValue>
                {(value: string | null) =>
                  resolveSelectLabel(JENIS_ITEMS, value)
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(
                Object.entries(JENIS_PERIODE_LABEL) as [JenisPeriode, string][]
              ).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {tampilkanKalender && (
          <div className="space-y-2">
            <Label>Kalender tahun</Label>
            <Select
              items={KALENDER_ITEMS}
              value={kalender}
              onValueChange={(v) =>
                setKalender((v ?? "hijri") as KalenderPeriode)
              }
              disabled={loading}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(value: string | null) =>
                    resolveSelectLabel(KALENDER_ITEMS, value)
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {KALENDER_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {tampilkanBulanAwal && (
          <div className="space-y-2">
            <Label>Bulan awal</Label>
            <Select
              items={bulanItems}
              value={String(bulanAwal)}
              onValueChange={(v) => setBulanAwal(Number(v ?? 1))}
              disabled={loading}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(value: string | null) =>
                    resolveSelectLabel(bulanItems, value)
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {bulanItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              {jenis === "kuartal"
                ? "Kuartal dihitung dari bulan ini (Q1 = 3 bulan pertama, dst.)."
                : kalender === "hijri"
                  ? "Tahun tabungan dimulai 1 bulan ini (Hijriah)."
                  : "Tahun fiskal dimulai tanggal 1 bulan ini."}
            </p>
          </div>
        )}

        <div className="bg-muted/50 rounded-lg border p-3">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Contoh periode berjalan
          </p>
          <p className="mt-1 text-sm">{loading ? "Memuat..." : preview}</p>
        </div>

        <Button
          onClick={simpan}
          disabled={loading || saving}
          className="w-full sm:w-auto"
        >
          {saving ? "Menyimpan..." : "Simpan periode"}
        </Button>
      </CardContent>
    </Card>
  );
}
