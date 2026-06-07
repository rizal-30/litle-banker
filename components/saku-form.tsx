"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { JENIS_SAKU_LABEL, type JenisSaku } from "@/types/database";
import {
  resolveSelectLabel,
  selectOptionsFromRecord,
  type SelectOption,
} from "@/lib/select-options";
import { toast } from "sonner";

const schema = z.object({
  nama: z.string().min(2, "Nama minimal 2 karakter"),
  jenis: z.enum(["kas", "bank", "instrumen"]),
  keterangan: z.string().optional(),
  pilih_di_transaksi: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

const JENIS_SAKU_ITEMS: SelectOption[] =
  selectOptionsFromRecord(JENIS_SAKU_LABEL);

interface SakuFormProps {
  id?: string;
  defaultValues?: FormValues;
  onSuccess?: () => void;
}

export function SakuForm({ id, defaultValues, onSuccess }: SakuFormProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? {
      nama: "",
      jenis: "kas",
      keterangan: "",
      pilih_di_transaksi: true,
    },
  });

  async function onSubmit(values: FormValues) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const payload = {
      ...values,
      keterangan: values.keterangan || null,
      updated_by: user.id,
      ...(id ? {} : { created_by: user.id }),
    };

    const { error } = id
      ? await supabase.from("saku").update(payload).eq("id", id)
      : await supabase.from("saku").insert(payload);

    if (error) {
      const msg = error.message.includes("saku_nama_unique")
        ? "Nama saku sudah dipakai. Pilih nama lain."
        : error.message.includes("duplicate key")
          ? "Nama saku sudah dipakai. Pilih nama lain."
          : error.message;
      toast.error(msg);
      return;
    }

    toast.success(id ? "Saku diperbarui" : "Saku ditambahkan");
    if (!id) form.reset();
    onSuccess?.();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="nama"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nama saku</FormLabel>
              <FormControl>
                <Input placeholder="Mis. Kas loket" {...field} />
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
              <FormLabel>Jenis</FormLabel>
              <Select
                items={JENIS_SAKU_ITEMS}
                onValueChange={(v) => field.onChange(v ?? "kas")}
                value={field.value ?? "kas"}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Pilih jenis">
                      {(value: string | null) =>
                        resolveSelectLabel(JENIS_SAKU_ITEMS, value)
                      }
                    </SelectValue>
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {(
                    Object.entries(JENIS_SAKU_LABEL) as [JenisSaku, string][]
                  ).map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="keterangan"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Keterangan</FormLabel>
              <FormControl>
                <Textarea rows={2} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="pilih_di_transaksi"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start gap-3 rounded-md border p-3">
              <FormControl>
                <input
                  type="checkbox"
                  className="mt-1 size-4 rounded border"
                  checked={field.value ?? true}
                  onChange={(e) => field.onChange(e.target.checked)}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel className="cursor-pointer font-normal">
                  Tampilkan di form transaksi
                </FormLabel>
                <p className="text-muted-foreground text-sm">
                  Jika tidak dicentang, saku tidak muncul saat input transaksi
                  baru. Saldo tetap dihitung di dashboard dan laporan.
                </p>
              </div>
            </FormItem>
          )}
        />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {id ? "Simpan perubahan" : "Simpan"}
        </Button>
      </form>
    </Form>
  );
}
