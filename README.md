# InvoPro

Aplikasi invoice & quotation. Astro (SSR, Node) + PostgreSQL. Auth memakai session cookie (password di-hash dengan scrypt), data per user tersimpan di Postgres.

## Env
| Variabel | Keterangan |
|---|---|
| `DATABASE_URL` | Connection string Postgres, mis. `postgres://user:pass@host:5432/invopro` |
| `ALLOW_SIGNUP` | `true` untuk membuka pendaftaran publik. Default tutup; akun dibuat Admin lewat Users & Access |

Lihat `.env.example`.

## Lokal
```bash
cp .env.example .env   # isi DATABASE_URL
npm install
npm run build && npm start   # start otomatis menjalankan migrasi db/schema.sql
```

## Deploy di Coolify
1. New Resource > Database > **PostgreSQL**, deploy, salin *Internal URL*.
2. New Resource > Application dari repo ini. Build pack **Nixpacks/Railpack**:
   - Build Command: `npm run build`
   - Start Command: `npm start`
   - Port: `4321` (atau set env `PORT` dan `HOST=0.0.0.0`)
3. Env: `DATABASE_URL` (Internal URL dari langkah 1).
4. Deploy. Schema dibuat otomatis saat start (idempotent).
5. Buka app dan klik **Create account**: user pertama otomatis jadi **Admin**. Setelah itu pendaftaran publik tertutup.

Jadwalkan backup untuk database Postgres di Coolify (S3 atau storage lain).

## Struktur
- `src/app.html` — UI (satu halaman, dimuat oleh `src/pages/index.astro`)
- `src/pages/api/*` — endpoint auth, documents, settings, admin/users
- `src/lib/` — pool Postgres, helper auth/session
- `db/schema.sql`, `scripts/migrate.mjs` — schema dan migrasi

## Catatan
Logo disimpan di JSON settings sebagai data URL. Untuk skala besar, pindahkan ke object storage.
