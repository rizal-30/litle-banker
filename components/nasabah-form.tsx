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
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const schema = z.object({
  nama: z.string().min(2, "Nama minimal 2 karakter"),
  telepon: z.string().optional(),
  alamat: z.string().optional(),
  keterangan: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface NasabahFormProps {
  id?: string;
  defaultValues?: FormValues;
  onSuccess?: () => void;
}

export function NasabahForm({ id, defaultValues, onSuccess }: NasabahFormProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? {
      nama: "",
      telepon: "",
      alamat: "",
      keterangan: "",
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
      telepon: values.telepon || null,
      alamat: values.alamat || null,
      keterangan: values.keterangan || null,
      updated_by: user.id,
      ...(id ? {} : { created_by: user.id }),
    };

    const { error } = id
      ? await supabase.from("nasabah").update(payload).eq("id", id)
      : await supabase.from("nasabah").insert(payload);

    if (error) {
      const msg =
        error.message.includes("nasabah_nama_unique") ||
        error.message.includes("duplicate key")
          ? "Nama nasabah sudah dipakai. Pilih nama lain."
          : error.message;
      toast.error(msg);
      return;
    }

    toast.success(id ? "Nasabah diperbarui" : "Nasabah ditambahkan");
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
              <FormLabel>Nama</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="telepon"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Telepon</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="alamat"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Alamat</FormLabel>
              <FormControl>
                <Textarea rows={2} {...field} />
              </FormControl>
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
        <Button type="submit" disabled={form.formState.isSubmitting}>
          Simpan
        </Button>
      </form>
    </Form>
  );
}
