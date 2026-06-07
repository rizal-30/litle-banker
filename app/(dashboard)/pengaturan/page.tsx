"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";
import { PengaturanPeriodeForm } from "@/components/pengaturan-periode-form";
import { toast } from "sonner";

export default function PengaturanPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [nama, setNama] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setEmail(user.email ?? "");
      supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setProfile(data as Profile);
            setNama(data.nama_lengkap);
          }
        });
    });
  }, []);

  async function simpanProfil() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("profiles")
      .update({ nama_lengkap: nama })
      .eq("id", user.id);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Profil diperbarui");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Pengaturan</h1>
        <p className="text-muted-foreground text-sm">
          Profil admin dan pengaturan periode dashboard
        </p>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Profil</CardTitle>
          <CardDescription>
            Admin baru ditambahkan lewat Supabase Dashboard (Authentication →
            Users → Invite). Matikan public signup di project settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={email} disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nama">Nama lengkap</Label>
            <Input
              id="nama"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
            />
          </div>
          <Button onClick={simpanProfil} className="w-full sm:w-auto">
            Simpan
          </Button>
          {profile && (
            <p className="text-xs text-muted-foreground">
              Peran: {profile.peran} · Status:{" "}
              {profile.aktif ? "Aktif" : "Nonaktif"}
            </p>
          )}
        </CardContent>
      </Card>

      <PengaturanPeriodeForm />
    </div>
  );
}
