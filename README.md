# Bank Hemat

Aplikasi PWA untuk pencatatan keuangan bank kecil: transaksi masuk/keluar, saldo nasabah (buku tabungan), beberapa saku, laporan Excel, multi-admin, dan audit log.

**Stack:** Next.js (App Router) · Supabase · shadcn/ui · Vercel

## Peta belajar (urutan baca kode)

1. [`proxy.ts`](proxy.ts) — proteksi route & refresh session
2. [`app/login/page.tsx`](app/login/page.tsx) — login Supabase
3. [`app/(dashboard)/layout.tsx`](app/(dashboard)/layout.tsx) — sidebar dashboard
4. [`components/dashboard/dashboard-page.tsx`](components/dashboard/dashboard-page.tsx) — chart & statistik
5. [`components/transaksi-form.tsx`](components/transaksi-form.tsx) — Form + zod
6. [`lib/supabase/client.ts`](lib/supabase/client.ts) vs [`server.ts`](lib/supabase/server.ts)

## Setup Supabase

Migration sudah ada di [`supabase/migrations/`](supabase/migrations/). Pilih **salah satu** cara di bawah.

### Opsi A — Supabase CLI (disarankan jika CLI sudah terpasang)

**1. Hubungkan ke proyek cloud**

```bash
cd bank-hemat
node scripts/supabase.mjs login
node scripts/supabase.mjs link --project-ref <PROJECT_REF>
```

Atau langsung jika `supabase` sudah di PATH: `supabase login`

`PROJECT_REF` ada di Supabase Dashboard → Project Settings → General.

**2. Push migration ke cloud**

```bash
npm run db:push
```

**3. Env untuk Next.js** (setelah link atau dari Dashboard → API):

```bash
npm run supabase:status
```

Salin **API URL** dan **anon key** ke `.env.local`.

Atau pakai script otomatis setelah link:

```bash
# Contoh isi .env.local (ganti dari Dashboard / supabase status)
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

**4. Auth**

- Dashboard → Authentication → matikan **Enable email signup**.
- Buat admin: **Authentication → Users → Add user** (email + password).
- Profil `profiles` terisi otomatis lewat trigger di migration.

---

### Opsi B — Supabase lokal (Docker + CLI)

Cocok untuk development tanpa menyentuh database cloud. **Butuh Docker Desktop** yang sedang berjalan.

```bash
npm run supabase:start   # pertama kali bisa lama (unduh image Docker)
npm run db:reset         # jalankan migration
npm run supabase:status  # URL + anon key untuk .env.local
```

`.env.local` untuk stack lokal (nilai dari `npm run supabase:status`):

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key dari supabase status>
```

Studio lokal: http://127.0.0.1:54423

> **Port khusus:** Proyek ini memakai port **54421–54424** agar tidak bentrok dengan Supabase lokal lain (default 54321). Lihat `supabase/config.toml`.

Hentikan stack: `npm run supabase:stop`

### Data uji & tes otomatis

Setelah `npm run db:reset`, seed memuat 10 nasabah + transaksi semua jenis, lalu admin dibuat otomatis:

| Item | Detail |
|------|--------|
| Admin | `admin@bank-hemat.test` / `Admin123!` |
| Nasabah | 10 pedagang (Budi Santoso … Rina Wulandari) |
| Saku | Kas Loket, Rekening BCA, Deposito |
| Transaksi | Menabung, penarikan, penarikan/setoran pinjaman, transfer antar saku |

Buat ulang admin saja (tanpa reset DB): `npm run seed`

Jalankan tes integrasi (Supabase lokal harus jalan):

```bash
npm test
```

Tes memverifikasi 28 skenario: auth, RLS, saldo, 5 jenis transaksi (insert), CRUD nasabah/saku, buku tabungan, laporan, profil, logout, export Excel, saldo non-negatif, dan integritas DB.

### Troubleshooting CLI di Windows

| Gejala | Penyebab | Solusi |
|--------|----------|--------|
| `'supabase' is not recognized` | CLI Scoop tidak di PATH npm | Pakai `npm run supabase:start` (sudah pakai wrapper) |
| `npx supabase` gagal di Windows | Paket npm tidak punya binary win32 | Pasang via Scoop: `scoop install supabase` |
| `supabase start` hang/lama | Unduh image Docker pertama kali | Tunggu sampai selesai; pastikan Docker Desktop jalan |

Tambah Scoop ke PATH permanen (PowerShell admin, opsional):

```powershell
[Environment]::SetEnvironmentVariable("Path", $env:Path + ";$env:USERPROFILE\scoop\shims", "User")
```

---

### Opsi C — Tanpa CLI (manual)

1. Buat proyek di [supabase.com](https://supabase.com).
2. **SQL Editor** → tempel & jalankan [`supabase/migrations/20250602000000_init.sql`](supabase/migrations/20250602000000_init.sql).
3. Matikan public signup, buat user admin pertama.

## Variabel lingkungan

Salin `.env.example` ke `.env.local` dan isi URL + anon key (dari cloud atau `supabase status`).

## Jalankan lokal

```bash
npm install
npm run dev
```

Buka [http://localhost:3200](http://localhost:3200) → diarahkan ke `/login`.

## Deploy Vercel (gratis)

1. Push repo ke GitHub.
2. Import di [vercel.com](https://vercel.com) → framework Next.js.
3. Set env `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Deploy.

## PWA di HP

Setelah deploy: buka URL di Chrome → menu **Add to Home Screen** / **Install app**.

## Fitur

| Menu | Fungsi |
|------|--------|
| Dashboard | Statistik + chart (7/30 hari, bulan ini) |
| Transaksi | Catat semua jenis transaksi |
| Nasabah | Daftar saldo + buku tabungan per nasabah |
| Saku | Saldo per saku + transfer |
| Laporan | Filter tanggal + unduh Excel |
| Audit | Log perubahan per admin |
| Pengaturan | Profil admin |

## Lisensi

Private — penggunaan internal bank Anda.
