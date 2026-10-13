# InvoPro V15 Cloud

Versi ini memakai **Supabase Auth + Postgres**. Invoice, quotation, settings, dan user tidak lagi bergantung pada localStorage.

## 1. Buat project Supabase
1. Buat project baru di Supabase.
2. Buka **SQL Editor**.
3. Paste dan jalankan isi `supabase-schema.sql`.

## 2. Isi konfigurasi frontend
Project ini memakai Astro. Salin `.env.example` ke `.env` (lokal) atau isi sebagai env di hosting:

```
PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Nilai ini di-inject saat build, jadi ubah env berarti harus rebuild. Jangan pernah memakai **service role / secret key** di variabel `PUBLIC_*`.

Lokal: `npm install && npm run dev`.

## 3. Login pertama
Klik **Create account** di halaman login. User pertama yang dibuat otomatis menjadi `Admin` oleh trigger SQL. Akun berikutnya default menjadi `User`.

Jika email confirmation aktif, verifikasi email dulu sebelum login.

## 4. Deploy Edge Function untuk Users & Access
User Management (create/reset/disable/delete user) butuh server-side function supaya service role key tetap rahasia.

Dengan Supabase CLI:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy admin-users
```

Function menggunakan environment secret bawaan Supabase (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).

## 5. Deploy website
- **Coolify:** build pack Static (atau Nixpacks), Build Command `npm run build`, Publish Directory `dist`. Tambahkan dua env `PUBLIC_*` di atas sebagai build variable.
- **Netlify:** `netlify.toml` sudah diatur (`dist`).

## Data online
- `profiles`: profil & role user
- `documents`: invoice / quotation per user
- `user_settings`: company profile, logo, template, font settings

Semua tabel memakai **Row Level Security**, sehingga user biasa hanya dapat membaca/menulis data miliknya sendiri.

## Catatan
Logo saat ini disimpan di JSON settings sebagai data URL untuk menjaga kompatibilitas dengan versi sebelumnya. Untuk penggunaan produksi skala besar, pindahkan logo ke Supabase Storage.
