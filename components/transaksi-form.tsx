"use client";

/**
 * Form transaksi — pola shadcn Form + react-hook-form + zod.
 * Client Component: ada state form dan event submit.
 */
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { InputRupiah } from "@/components/ui/input-rupiah";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { DialogClose } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import {
  resolveSelectLabel,
  selectOptionsFromRecord,
  type SelectOption,
} from "@/lib/select-options";
import { createClient } from "@/lib/supabase/client";
import { formatRupiah } from "@/lib/format";
import {
  JENIS_TRANSAKSI_LABEL,
  type JenisTransaksi,
  type SaldoNasabah,
  type SaldoSaku,
} from "@/types/database";
import {
  getSakuFormHint,
  sakuAsalUntukTransaksi,
  sakuTujuanUntukTransaksi,
} from "@/lib/saku-rules";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const mobileInputClass = "max-sm:h-12 max-sm:px-3 max-sm:text-base";
const mobileSelectTriggerClass = "max-sm:h-12 max-sm:px-3 max-sm:text-base";
const mobileSelectItemClass = "max-sm:py-3 max-sm:text-base";
const mobileFormLabelClass = "max-sm:text-base";

/** Cegah scroll parent saat popup Select terbuka di dalam dialog mobile */
const selectInDialogProps = {
  alignItemWithTrigger: false,
  side: "bottom" as const,
};

const schema = z
  .object({
    tanggal: z.string().min(1, "Tanggal wajib diisi"),
    jenis: z.string().min(1, "Jenis wajib dipilih"),
    jumlah: z.number({ error: "Jumlah wajib diisi" }).positive("Jumlah harus lebih dari 0"),
    keterangan: z.string().optional(),
    nasabah_id: z.string().optional(),
    saku_id: z.string().optional(),
    saku_tujuan_id: z.string().optional(),
    bayar_dari_tabungan: z.boolean().optional(),
  })
  .refine(
    (d) => {
      const butuhSaku = [
        "setoran",
        "penarikan",
        "pinjaman_keluar",
        "transfer_saku",
      ];
      const pinjamanTunai =
        d.jenis === "pinjaman_kembali" && !d.bayar_dari_tabungan;
      if ((butuhSaku.includes(d.jenis) || pinjamanTunai) && !d.saku_id)
        return false;
      return true;
    },
    { message: "Saku wajib dipilih", path: ["saku_id"] }
  )
  .refine(
    (d) => {
      if (d.jenis === "transfer_saku" && !d.saku_tujuan_id) return false;
      return true;
    },
    { message: "Saku tujuan wajib untuk transfer", path: ["saku_tujuan_id"] }
  )
  .refine(
    (d) => {
      const butuhNasabah = [
        "setoran",
        "penarikan",
        "pinjaman_keluar",
        "pinjaman_kembali",
      ];
      if (butuhNasabah.includes(d.jenis) && !d.nasabah_id) return false;
      return true;
    },
    { message: "Nasabah wajib untuk jenis ini", path: ["nasabah_id"] }
  );

type FormValues = z.infer<typeof schema>;

const emptyFormValues: FormValues = {
  tanggal: new Date().toISOString().slice(0, 10),
  jenis: "setoran",
  jumlah: 0,
  keterangan: "",
  nasabah_id: "",
  saku_id: "",
  saku_tujuan_id: "",
  bayar_dari_tabungan: false,
};

const JENIS_TRANSAKSI_ITEMS: SelectOption[] = selectOptionsFromRecord(
  JENIS_TRANSAKSI_LABEL
);

/** Jenis transaksi yang melibatkan nasabah (bukan transfer antar saku) */
export const JENIS_TRANSAKSI_NASABAH: JenisTransaksi[] = [
  "setoran",
  "penarikan",
  "pinjaman_keluar",
  "pinjaman_kembali",
];

/** Base UI Select wajib controlled — value tidak boleh undefined */
function selectProps(field: { value?: string; onChange: (v: string) => void }) {
  return {
    value: field.value ?? "",
    onValueChange: (v: string | null) => field.onChange(v ?? ""),
  };
}

interface TransaksiFormProps {
  onSuccess?: () => void;
  defaultValues?: Partial<FormValues & { id: string }>;
  /** Saku + saldo untuk label sebelum fetch selesai (mis. dialog transfer) */
  seedSaku?: Pick<
    SaldoSaku,
    "id" | "nama" | "saldo" | "jenis" | "pilih_di_transaksi"
  >[];
  seedNasabah?: Pick<SaldoNasabah, "id" | "nama" | "saldo" | "tabungan" | "hutang">[];
  /** Batasi opsi jenis — mis. hanya transaksi nasabah di buku tabungan */
  jenisDiizinkan?: JenisTransaksi[];
  /** Sembunyikan pemilih nasabah; wajib isi nasabah_id lewat defaultValues/seed */
  kunciNasabah?: boolean;
}

export function TransaksiForm({
  onSuccess,
  defaultValues,
  seedSaku,
  seedNasabah,
  jenisDiizinkan,
  kunciNasabah = false,
}: TransaksiFormProps) {
  const [saldoNasabah, setSaldoNasabah] = useState<SaldoNasabah[]>([]);
  const [saldoSaku, setSaldoSaku] = useState<SaldoSaku[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      ...emptyFormValues,
      ...defaultValues,
    },
  });

  const jenis = form.watch("jenis");
  const bayarDariTabungan = form.watch("bayar_dari_tabungan");
  const nasabahId = form.watch("nasabah_id");
  const sakuId = form.watch("saku_id");

  const jenisItems = useMemo(() => {
    if (!jenisDiizinkan?.length) return JENIS_TRANSAKSI_ITEMS;
    return JENIS_TRANSAKSI_ITEMS.filter((item) =>
      jenisDiizinkan.includes(item.value as JenisTransaksi)
    );
  }, [jenisDiizinkan]);

  useEffect(() => {
    if (!jenisDiizinkan?.length) return;
    const current = form.getValues("jenis") as JenisTransaksi;
    if (!jenisDiizinkan.includes(current)) {
      form.setValue("jenis", jenisDiizinkan[0]);
    }
  }, [form, jenisDiizinkan]);
  const jumlah = form.watch("jumlah");

  const butuhCekSaldoSaku = [
    "penarikan",
    "pinjaman_keluar",
    "transfer_saku",
  ].includes(jenis);

  useEffect(() => {
    if (jenis !== "pinjaman_kembali") {
      form.setValue("bayar_dari_tabungan", false);
    }
  }, [jenis, form]);

  useEffect(() => {
    if (bayarDariTabungan) {
      form.setValue("saku_id", "");
    }
  }, [bayarDariTabungan, form]);

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase
        .from("v_saldo_nasabah")
        .select("id, nama, saldo, tabungan, hutang, aktif")
        .eq("aktif", true)
        .order("nama"),
      supabase.from("v_saldo_saku").select("*").order("nama"),
    ]).then(([n, s]) => {
      setSaldoNasabah((n.data ?? []) as SaldoNasabah[]);
      setSaldoSaku((s.data ?? []) as SaldoSaku[]);
    });
  }, []);

  const butuhNasabah = [
    "setoran",
    "penarikan",
    "pinjaman_keluar",
    "pinjaman_kembali",
  ].includes(jenis);
  const butuhSakuTujuan = jenis === "transfer_saku";
  const butuhSaku =
    !bayarDariTabungan &&
    ["setoran", "penarikan", "pinjaman_keluar", "pinjaman_kembali", "transfer_saku"].includes(
      jenis
    );

  const displayNasabah = useMemo(() => {
    const map = new Map<
      string,
      Pick<SaldoNasabah, "id" | "nama" | "saldo" | "tabungan" | "hutang">
    >();
    for (const n of seedNasabah ?? []) map.set(n.id, n);
    for (const n of saldoNasabah) map.set(n.id, n);
    return [...map.values()].sort((a, b) => a.nama.localeCompare(b.nama));
  }, [saldoNasabah, seedNasabah]);

  const displaySaku = useMemo(() => {
    const map = new Map<
      string,
      Pick<SaldoSaku, "id" | "nama" | "saldo" | "jenis" | "pilih_di_transaksi">
    >();
    for (const s of seedSaku ?? []) map.set(s.id, s);
    for (const s of saldoSaku) map.set(s.id, s);
    return [...map.values()].sort((a, b) => a.nama.localeCompare(b.nama));
  }, [saldoSaku, seedSaku]);

  const seedIds = useMemo(
    () => new Set((seedSaku ?? []).map((s) => s.id)),
    [seedSaku]
  );

  const jenisTransaksi = jenis as JenisTransaksi;
  const sakuHint = getSakuFormHint(jenisTransaksi);

  const sakuAsalList = useMemo(() => {
    return displaySaku.filter((s) => {
      if (seedIds.has(s.id)) return true;
      return sakuAsalUntukTransaksi(
        s.jenis,
        jenisTransaksi,
        bayarDariTabungan,
        s.pilih_di_transaksi
      );
    });
  }, [displaySaku, seedIds, jenisTransaksi, bayarDariTabungan]);

  const sakuTujuanList = useMemo(() => {
    return displaySaku.filter((s) => {
      if (seedIds.has(s.id)) return true;
      return sakuTujuanUntukTransaksi(
        s.jenis,
        jenisTransaksi,
        s.pilih_di_transaksi
      );
    });
  }, [displaySaku, seedIds, jenisTransaksi]);

  useEffect(() => {
    const currentAsal = form.getValues("saku_id");
    if (
      currentAsal &&
      !sakuAsalList.some((s) => s.id === currentAsal)
    ) {
      form.setValue("saku_id", "");
    }
    const currentTujuan = form.getValues("saku_tujuan_id");
    if (
      currentTujuan &&
      !sakuTujuanList.some((s) => s.id === currentTujuan)
    ) {
      form.setValue("saku_tujuan_id", "");
    }
  }, [form, sakuAsalList, sakuTujuanList]);

  useEffect(() => {
    if (kunciNasabah) return;
    const currentNasabah = form.getValues("nasabah_id");
    if (
      currentNasabah &&
      !displayNasabah.some((n) => n.id === currentNasabah)
    ) {
      form.setValue("nasabah_id", "");
    }
  }, [form, displayNasabah, kunciNasabah]);

  useEffect(() => {
    if (!kunciNasabah || !seedNasabah?.[0]?.id) return;
    if (!form.getValues("nasabah_id")) {
      form.setValue("nasabah_id", seedNasabah[0].id);
    }
  }, [kunciNasabah, seedNasabah, form]);

  const nasabahTerpilih = useMemo(
    () => displayNasabah.find((n) => n.id === nasabahId),
    [displayNasabah, nasabahId]
  );

  const hutangNasabah = nasabahTerpilih ? Number(nasabahTerpilih.hutang) : 0;

  const jenisItemsTampil = useMemo(() => {
    if (hutangNasabah > 0) return jenisItems;
    return jenisItems.filter((item) => item.value !== "pinjaman_kembali");
  }, [jenisItems, hutangNasabah]);

  useEffect(() => {
    if (jenis !== "pinjaman_kembali" || hutangNasabah > 0) return;
    const pengganti =
      (jenisItemsTampil[0]?.value as JenisTransaksi | undefined) ?? "setoran";
    form.setValue("jenis", pengganti);
  }, [jenis, hutangNasabah, jenisItemsTampil, form]);

  const sakuTerpilih = useMemo(
    () => displaySaku.find((s) => s.id === sakuId),
    [displaySaku, sakuId]
  );

  const nasabahOptions = useMemo(
    () =>
      displayNasabah.map((n) => ({
        value: n.id,
        label: n.nama,
        searchText: n.nama,
        detail: (
          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
            {formatRupiah(Number(n.saldo))}
          </span>
        ),
      })),
    [displayNasabah]
  );

  const sakuAsalOptions: SelectOption[] = useMemo(
    () =>
      sakuAsalList.map((s) => ({
        value: s.id,
        label: s.nama,
      })),
    [sakuAsalList]
  );

  const sakuTujuanOptions: SelectOption[] = useMemo(
    () =>
      sakuTujuanList.map((s) => ({
        value: s.id,
        label: s.nama,
      })),
    [sakuTujuanList]
  );

  const saldoSakuTerpilih = sakuTerpilih ? Number(sakuTerpilih.saldo) : null;
  const tabunganNasabah = nasabahTerpilih ? Number(nasabahTerpilih.tabungan) : null;

  const jumlahMelebihiTabungan =
    jenis === "penarikan" &&
    tabunganNasabah !== null &&
    jumlah > 0 &&
    jumlah > tabunganNasabah;

  const jumlahMelebihiSaldoSaku =
    butuhCekSaldoSaku &&
    saldoSakuTerpilih !== null &&
    jumlah > 0 &&
    jumlah > saldoSakuTerpilih;

  async function onSubmit(values: FormValues) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Sesi habis, silakan login lagi");
      return;
    }

    if (
      values.jenis === "penarikan" &&
      values.nasabah_id &&
      tabunganNasabah !== null &&
      values.jumlah > tabunganNasabah
    ) {
      toast.error(
        `Tabungan nasabah tidak cukup (tersedia ${formatRupiah(tabunganNasabah)}, butuh ${formatRupiah(values.jumlah)})`
      );
      return;
    }

    if (
      butuhCekSaldoSaku &&
      values.saku_id &&
      saldoSakuTerpilih !== null &&
      values.jumlah > saldoSakuTerpilih
    ) {
      toast.error(
        `Saldo saku tidak cukup (tersedia ${formatRupiah(saldoSakuTerpilih)}, butuh ${formatRupiah(values.jumlah)})`
      );
      return;
    }

    const dariTabungan =
      values.jenis === "pinjaman_kembali" && values.bayar_dari_tabungan;

    const payload = {
      tanggal: values.tanggal,
      jenis: values.jenis as JenisTransaksi,
      jumlah: values.jumlah,
      keterangan: values.keterangan || null,
      nasabah_id: values.nasabah_id || null,
      saku_id: dariTabungan ? null : values.saku_id || null,
      saku_tujuan_id: values.saku_tujuan_id || null,
      bayar_dari_tabungan: dariTabungan,
      created_by: user.id,
      updated_by: user.id,
    };

    const editId = (defaultValues as { id?: string })?.id;
    const { error } = editId
      ? await supabase.from("transaksi").update(payload).eq("id", editId)
      : await supabase.from("transaksi").insert(payload);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(editId ? "Transaksi diperbarui" : "Transaksi tersimpan");
    form.reset(emptyFormValues);
    onSuccess?.();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="tanggal"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={mobileFormLabelClass}>Tanggal</FormLabel>
                <FormControl>
                  <Input type="date" className={mobileInputClass} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="jenis"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={mobileFormLabelClass}>
                  Jenis transaksi
                </FormLabel>
                <Select {...selectProps(field)} items={jenisItemsTampil}>
                  <FormControl>
                    <SelectTrigger
                      className={cn("w-full", mobileSelectTriggerClass)}
                    >
                      <SelectValue placeholder="Pilih jenis">
                        {(value: string | null) =>
                          resolveSelectLabel(jenisItemsTampil, value)
                        }
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent {...selectInDialogProps}>
                    {jenisItemsTampil.map(({ value, label }) => (
                      <SelectItem
                        key={value}
                        value={value}
                        className={mobileSelectItemClass}
                      >
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="jumlah"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={mobileFormLabelClass}>Jumlah</FormLabel>
              <FormControl>
                <InputRupiah
                  name={field.name}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  value={field.value}
                  onChange={field.onChange}
                  className={mobileInputClass}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {kunciNasabah ? (
          <FormField
            control={form.control}
            name="nasabah_id"
            render={() => (
              <FormItem>
                <FormLabel className={mobileFormLabelClass}>Nasabah</FormLabel>
                <FormControl>
                  <div
                    className={cn(
                      "bg-muted flex h-9 w-full items-center justify-between gap-3 rounded-md border px-3 text-sm",
                      "max-sm:h-12 max-sm:px-3 max-sm:text-base"
                    )}
                  >
                    <span className="truncate font-medium">
                      {nasabahTerpilih?.nama ?? ""}
                    </span>
                    {nasabahTerpilih && (
                      <span className="text-muted-foreground shrink-0 tabular-nums">
                        {formatRupiah(Number(nasabahTerpilih.saldo))}
                      </span>
                    )}
                  </div>
                </FormControl>
                {jenis === "penarikan" && jumlahMelebihiTabungan && (
                  <p className="text-destructive text-sm">
                    Jumlah melebihi tabungan — penarikan tidak bisa disimpan.
                  </p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        ) : (
          butuhNasabah && (
          <FormField
            control={form.control}
            name="nasabah_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={mobileFormLabelClass}>Nasabah</FormLabel>
                <FormControl>
                  <Combobox
                    options={nasabahOptions}
                    placeholder="Cari nama nasabah..."
                    name={field.name}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    className={mobileInputClass}
                  />
                </FormControl>
                {jenis === "penarikan" && jumlahMelebihiTabungan && (
                  <p className="text-destructive text-sm">
                    Jumlah melebihi tabungan — penarikan tidak bisa disimpan.
                  </p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
          )
        )}

        {jenis === "pinjaman_kembali" && (
          <FormField
            control={form.control}
            name="bayar_dari_tabungan"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start gap-3 rounded-md border p-3 max-sm:gap-4 max-sm:p-4">
                <FormControl>
                  <input
                    type="checkbox"
                    className="mt-1 size-4 shrink-0 rounded border max-sm:mt-0.5 max-sm:size-5"
                    checked={field.value ?? false}
                    onChange={(e) => field.onChange(e.target.checked)}
                  />
                </FormControl>
                <div className="space-y-1 leading-snug">
                  <FormLabel className="cursor-pointer font-normal max-sm:text-base">
                    Bayar dari tabungan
                  </FormLabel>
                  <p className="text-muted-foreground text-sm max-sm:text-base">
                    Hutang berkurang dan tabungan nasabah dipotong. Uang tidak
                    masuk ke saku.
                  </p>
                </div>
              </FormItem>
            )}
          />
        )}

        {butuhSaku && (
        <FormField
          control={form.control}
          name="saku_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={mobileFormLabelClass}>
                {butuhSakuTujuan ? "Saku asal" : "Saku"}
              </FormLabel>
              <Select {...selectProps(field)} items={sakuAsalOptions}>
                <FormControl>
                  <SelectTrigger
                    className={cn("w-full", mobileSelectTriggerClass)}
                  >
                    <SelectValue placeholder="Pilih saku">
                      {(value: string | null) =>
                        resolveSelectLabel(sakuAsalOptions, value)
                      }
                    </SelectValue>
                  </SelectTrigger>
                </FormControl>
                <SelectContent {...selectInDialogProps}>
                  {sakuAsalList.map((s) => (
                    <SelectItem
                      key={s.id}
                      value={s.id}
                      className={mobileSelectItemClass}
                    >
                      <span className="flex w-full min-w-48 items-center justify-between gap-4">
                        <span>{s.nama}</span>
                        <span className="text-muted-foreground text-xs tabular-nums">
                          {formatRupiah(Number(s.saldo))}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {sakuHint && <FormDescription>{sakuHint}</FormDescription>}
              {jumlahMelebihiSaldoSaku && (
                <p className="text-destructive text-sm">
                  Jumlah melebihi saldo saku — transaksi tidak bisa disimpan.
                </p>
              )}
              <FormMessage />
            </FormItem>
          )}
        />
        )}

        {butuhSakuTujuan && (
          <FormField
            control={form.control}
            name="saku_tujuan_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={mobileFormLabelClass}>Saku tujuan</FormLabel>
                <Select {...selectProps(field)} items={sakuTujuanOptions}>
                  <FormControl>
                    <SelectTrigger
                      className={cn("w-full", mobileSelectTriggerClass)}
                    >
                      <SelectValue placeholder="Pilih saku tujuan">
                        {(value: string | null) =>
                          resolveSelectLabel(sakuTujuanOptions, value)
                        }
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent {...selectInDialogProps}>
                    {sakuTujuanList.map((s) => (
                      <SelectItem
                        key={s.id}
                        value={s.id}
                        className={mobileSelectItemClass}
                      >
                        <span className="flex w-full min-w-48 items-center justify-between gap-4">
                          <span>{s.nama}</span>
                          <span className="text-muted-foreground text-xs tabular-nums">
                            {formatRupiah(Number(s.saldo))}
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Semua jenis saku boleh, termasuk deposito/instrumen.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="keterangan"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={mobileFormLabelClass}>Keterangan</FormLabel>
              <FormControl>
                <Textarea
                  rows={2}
                  className="max-sm:min-h-24 max-sm:px-3 max-sm:py-3 max-sm:text-base"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex flex-col gap-2">
          <Button
            type="submit"
            className="w-full touch-manipulation max-sm:min-h-12 max-sm:text-base sm:w-auto"
            disabled={
              form.formState.isSubmitting ||
              jumlahMelebihiTabungan ||
              jumlahMelebihiSaldoSaku
            }
          >
            Simpan transaksi
          </Button>
          <DialogClose
            render={
              <Button
                type="button"
                variant="ghost"
                className="w-full touch-manipulation sm:w-auto"
              />
            }
          >
            Batal
          </DialogClose>
        </div>
      </form>
    </Form>
  );
}
